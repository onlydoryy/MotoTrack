create schema if not exists mototrack_private;
grant usage on schema mototrack_private to service_role;

create table mototrack_private.vehicle_shares (
  id uuid primary key,
  sender_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null,
  source_revision integer not null,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  with_receipts boolean not null,
  with_documents boolean not null,
  snapshot jsonb,
  finished_at timestamptz,
  unique (sender_id, source_id, recipient_id)
);
alter table mototrack_private.vehicle_shares enable row level security;
grant select, insert, update on mototrack_private.vehicle_shares to service_role;
create index vehicle_shares_recipient_idx on mototrack_private.vehicle_shares (recipient_id);

-- Only the Edge Function can look up a verified recipient by email.
create function mototrack_private.verified_recipient(address text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users u
  where lower(u.email) = lower(trim(address))
    and u.email_confirmed_at is not null and u.deleted_at is null
  limit 1;
$$;
revoke all on function mototrack_private.verified_recipient(text) from public, anon, authenticated;
grant execute on function mototrack_private.verified_recipient(text) to service_role;

create function public.prepare_mototrack_vehicle_share(
  sender uuid, source uuid, recipient_email text, include_receipts boolean, include_documents boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  original public.vehicles;
  recipient uuid;
  share_id uuid := gen_random_uuid();
  job mototrack_private.vehicle_shares;
  prefix text;
  source_prefix text := sender || '/vehicles/' || source || '/';
  captured jsonb;
begin
  select v.* into original from public.vehicles v
    where v.id = source and v.user_id = sender for share;
  if not found then raise exception 'VEHICLE_UNAVAILABLE'; end if;

  recipient := mototrack_private.verified_recipient(recipient_email);
  if recipient is null or recipient = sender then raise exception 'INVALID_RECIPIENT'; end if;

  select s.* into job from mototrack_private.vehicle_shares s
    where s.sender_id = sender and s.source_id = source and s.recipient_id = recipient;
  if found and (job.finished_at is not null or (job.source_revision = original.revision
      and job.with_receipts = include_receipts and job.with_documents = include_documents)) then
    return jsonb_build_object('id', job.id, 'done', job.finished_at is not null,
      'files', coalesce(job.snapshot->'files', '[]'::jsonb));
  end if;

  prefix := recipient || '/vehicles/' || share_id;
  with folders as materialized (
    select f.*, gen_random_uuid() as copy_id from public.vehicle_document_folders f
    where f.vehicle_id = source and include_documents
  ),
  services as materialized (
    select s.*, gen_random_uuid() as copy_id from public.service_records s where s.vehicle_id = source
  ),
  receipts as materialized (
    select r.*, s.copy_id as parent_id, gen_random_uuid() as copy_id
    from public.service_receipts r join services s on s.id = r.service_record_id
    where include_receipts
  ),
  documents as materialized (
    select d.*, f.copy_id as parent_id, gen_random_uuid() as copy_id
    from public.vehicle_documents d left join folders f on f.id = d.folder_id
    where d.vehicle_id = source and include_documents
  ),
  files as (
    select original.image_path as old_path, prefix || '/photos/shared' as new_path
      where original.image_path is not null
    union all select r.storage_path, prefix || '/receipts/' || r.copy_id from receipts r
    union all select d.storage_path, prefix || '/documents/' || d.copy_id from documents d
      where d.storage_path is not null
  )
  select jsonb_build_object(
    'vehicle', to_jsonb(original) || jsonb_build_object(
      'id', share_id, 'user_id', recipient, 'favorite', false, 'revision', 1, 'date_added', now(),
      'image_path', case when original.image_path is not null then prefix || '/photos/shared' end),
    'folders', coalesce((select jsonb_agg(to_jsonb(f) ||
      jsonb_build_object('id', f.copy_id, 'vehicle_id', share_id)) from folders f), '[]'::jsonb),
    'services', coalesce((select jsonb_agg(to_jsonb(s) ||
      jsonb_build_object('id', s.copy_id, 'vehicle_id', share_id)) from services s), '[]'::jsonb),
    'receipts', coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object(
      'id', r.copy_id, 'service_record_id', r.parent_id,
      'storage_path', prefix || '/receipts/' || r.copy_id)) from receipts r), '[]'::jsonb),
    'documents', coalesce((select jsonb_agg(to_jsonb(d) || jsonb_build_object(
      'id', d.copy_id, 'vehicle_id', share_id, 'folder_id', d.parent_id,
      'storage_path', case when d.storage_path is not null then prefix || '/documents/' || d.copy_id end
    )) from documents d), '[]'::jsonb),
    'files', coalesce((select jsonb_agg(to_jsonb(f)) from files f), '[]'::jsonb)
  ) into captured;

  if exists (select 1 from jsonb_array_elements(captured->'files') f
      where left(f->>'old_path', length(source_prefix)) is distinct from source_prefix) then
    raise exception 'INVALID_ATTACHMENT_PATH';
  end if;

  insert into mototrack_private.vehicle_shares as previous
    (id, sender_id, source_id, source_revision, recipient_id, with_receipts, with_documents, snapshot)
  values (share_id, sender, source, original.revision, recipient, include_receipts, include_documents, captured)
  on conflict (sender_id, source_id, recipient_id) do update
    set id = excluded.id, source_revision = excluded.source_revision, snapshot = excluded.snapshot,
      with_receipts = excluded.with_receipts, with_documents = excluded.with_documents
    where previous.finished_at is null and (previous.source_revision <> excluded.source_revision
      or previous.with_receipts <> excluded.with_receipts or previous.with_documents <> excluded.with_documents);

  select s.* into strict job from mototrack_private.vehicle_shares s
    where s.sender_id = sender and s.source_id = source and s.recipient_id = recipient;
  return jsonb_build_object('id', job.id, 'done', job.finished_at is not null,
    'files', coalesce(job.snapshot->'files', '[]'::jsonb));
end;
$$;

create function public.finish_mototrack_vehicle_share(sender uuid, share_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  job mototrack_private.vehicle_shares;
  record_to_copy public.vehicles;
  original_mileage integer;
begin
  select s.* into job from mototrack_private.vehicle_shares s
    where s.id = share_id and s.sender_id = sender for update;
  if not found then raise exception 'SHARE_UNAVAILABLE'; end if;
  if job.finished_at is not null then return; end if;

  if exists (select 1 from jsonb_array_elements(job.snapshot->'files') f
    where not exists (select 1 from storage.objects o
      where o.bucket_id = 'mototrack-files' and o.name = f->>'new_path')) then
    raise exception 'ATTACHMENTS_INCOMPLETE';
  end if;

  record_to_copy := jsonb_populate_record(null::public.vehicles, job.snapshot->'vehicle');
  original_mileage := record_to_copy.mileage;
  record_to_copy.mileage := 0;
  insert into public.vehicles select (record_to_copy).*;

  insert into public.vehicle_document_folders
    select f.* from jsonb_populate_recordset(null::public.vehicle_document_folders, job.snapshot->'folders') f;
  insert into public.service_records
    select s.* from jsonb_populate_recordset(null::public.service_records, job.snapshot->'services') s
    order by s.mileage, s.id;
  insert into public.service_receipts
    select r.* from jsonb_populate_recordset(null::public.service_receipts, job.snapshot->'receipts') r;
  insert into public.vehicle_documents
    select d.* from jsonb_populate_recordset(null::public.vehicle_documents, job.snapshot->'documents') d;

  update public.vehicles set mileage = greatest(mileage, original_mileage) where id = share_id;
  update mototrack_private.vehicle_shares set finished_at = now(), snapshot = null where id = share_id;
end;
$$;

revoke all on function public.prepare_mototrack_vehicle_share(uuid, uuid, text, boolean, boolean) from public, anon, authenticated;
revoke all on function public.finish_mototrack_vehicle_share(uuid, uuid) from public, anon, authenticated;
grant execute on function public.prepare_mototrack_vehicle_share(uuid, uuid, text, boolean, boolean) to service_role;
grant execute on function public.finish_mototrack_vehicle_share(uuid, uuid) to service_role;
