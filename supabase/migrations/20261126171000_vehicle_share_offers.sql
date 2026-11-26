alter table mototrack_private.vehicle_shares
  add column offered_at timestamptz,
  add column sender_label text;

-- Retain the original atomic garage-copy routine for recipient acceptance.
alter function public.finish_mototrack_vehicle_share(uuid, uuid) rename to materialize_vehicle_share;
alter function public.materialize_vehicle_share(uuid, uuid) set schema mototrack_private;
revoke execute on function mototrack_private.materialize_vehicle_share(uuid, uuid) from service_role;

create or replace function public.prepare_mototrack_vehicle_share(
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
  if found and ((job.offered_at is not null and job.finished_at is null) or (job.finished_at is not null
      and exists (select 1 from public.vehicles v where v.id = job.id)) or (job.finished_at is null and job.source_revision = original.revision
      and job.with_receipts = include_receipts and job.with_documents = include_documents)) then
    return jsonb_build_object('id', job.id, 'done', job.finished_at is not null or job.offered_at is not null,
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
      with_receipts = excluded.with_receipts, with_documents = excluded.with_documents,
      finished_at = null, offered_at = null, sender_label = null
    where (previous.offered_at is null or previous.finished_at is not null) and (
      (previous.finished_at is not null and not exists (select 1 from public.vehicles v where v.id = previous.id))
      or (previous.finished_at is null and (previous.source_revision <> excluded.source_revision
        or previous.with_receipts <> excluded.with_receipts or previous.with_documents <> excluded.with_documents))
    );

  select s.* into strict job from mototrack_private.vehicle_shares s
    where s.sender_id = sender and s.source_id = source and s.recipient_id = recipient;
  return jsonb_build_object('id', job.id, 'done', job.finished_at is not null or job.offered_at is not null,
    'files', coalesce(job.snapshot->'files', '[]'::jsonb));
end;
$$;

create function mototrack_private.vehicle_share_sender_label(sender uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select coalesce(nullif(left(trim(u.raw_user_meta_data->>'display_name'), 60), ''),
    nullif(split_part(u.email, '@', 1), ''), 'MotoTrack user')
  from auth.users u where u.id = sender;
$$;
revoke all on function mototrack_private.vehicle_share_sender_label(uuid) from public, anon, authenticated;
grant execute on function mototrack_private.vehicle_share_sender_label(uuid) to service_role;

-- Publish the offer after the Edge Function copies every attachment.
create function public.finish_mototrack_vehicle_share(sender uuid, share_id uuid)
returns void language plpgsql security invoker set search_path = ''
as $$
declare
  job mototrack_private.vehicle_shares;
begin
  select s.* into job from mototrack_private.vehicle_shares s
    where s.id = share_id and s.sender_id = sender for update;
  if not found then raise exception 'SHARE_UNAVAILABLE'; end if;
  if job.offered_at is not null or job.finished_at is not null then return; end if;

  if exists (select 1 from jsonb_array_elements(job.snapshot->'files') f
    where not exists (select 1 from storage.objects o
      where o.bucket_id = 'mototrack-files' and o.name = f->>'new_path')) then
    raise exception 'ATTACHMENTS_INCOMPLETE';
  end if;

  update mototrack_private.vehicle_shares set offered_at = now(),
    sender_label = mototrack_private.vehicle_share_sender_label(sender)
  where id = share_id;
end;
$$;
revoke all on function public.finish_mototrack_vehicle_share(uuid, uuid) from public, anon, authenticated;
grant execute on function public.finish_mototrack_vehicle_share(uuid, uuid) to service_role;

create function mototrack_private.pending_vehicle_shares()
returns table(id uuid, make text, model text, colour text, registration text, sender_name text)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.snapshot#>>'{vehicle,make}', s.snapshot#>>'{vehicle,model}',
    s.snapshot#>>'{vehicle,colour}', s.snapshot#>>'{vehicle,registration}', s.sender_label
  from mototrack_private.vehicle_shares s
  where s.recipient_id = (select auth.uid()) and s.offered_at is not null and s.finished_at is null
  order by s.offered_at desc, s.id;
$$;

create function mototrack_private.accept_vehicle_share(share_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  job mototrack_private.vehicle_shares;
begin
  select s.* into job from mototrack_private.vehicle_shares s
    where s.id = share_id and s.recipient_id = auth.uid() and s.offered_at is not null
    for update;
  if not found then raise exception 'This vehicle offer is unavailable.' using errcode = '42501'; end if;
  if job.finished_at is not null then return; end if;
  perform mototrack_private.materialize_vehicle_share(job.sender_id, share_id);
end;
$$;

create function mototrack_private.can_access_shared_vehicle_file(vehicle_path_id text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select not exists (
    select 1 from mototrack_private.vehicle_shares s
    where s.recipient_id = (select auth.uid()) and s.id::text = vehicle_path_id and s.finished_at is null
  );
$$;

grant usage on schema mototrack_private to authenticated;
revoke all on function mototrack_private.pending_vehicle_shares() from public, anon;
revoke all on function mototrack_private.accept_vehicle_share(uuid) from public, anon;
revoke all on function mototrack_private.can_access_shared_vehicle_file(text) from public, anon;
grant execute on function mototrack_private.pending_vehicle_shares() to authenticated;
grant execute on function mototrack_private.accept_vehicle_share(uuid) to authenticated;
grant execute on function mototrack_private.can_access_shared_vehicle_file(text) to authenticated;

create policy "Keep shared vehicle files private until accepted"
  on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'mototrack-files' or (storage.foldername(name))[2] is distinct from 'vehicles'
    or mototrack_private.can_access_shared_vehicle_file((storage.foldername(name))[3]))
  with check (bucket_id <> 'mototrack-files' or (storage.foldername(name))[2] is distinct from 'vehicles'
    or mototrack_private.can_access_shared_vehicle_file((storage.foldername(name))[3]));

create function public.pending_mototrack_vehicle_shares()
returns table(id uuid, make text, model text, colour text, registration text, sender_name text)
language sql stable security invoker set search_path = ''
as $$ select * from mototrack_private.pending_vehicle_shares(); $$;

create function public.accept_mototrack_vehicle_share(share_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select mototrack_private.accept_vehicle_share(share_id); $$;

revoke all on function public.pending_mototrack_vehicle_shares() from public, anon;
revoke all on function public.accept_mototrack_vehicle_share(uuid) from public, anon;
grant execute on function public.pending_mototrack_vehicle_shares() to authenticated;
grant execute on function public.accept_mototrack_vehicle_share(uuid) to authenticated;
