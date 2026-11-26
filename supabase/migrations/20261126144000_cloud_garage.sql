-- Set up the existing garage tables when installing MotoTrack into a fresh project.
create table if not exists public.vehicles (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  type text not null default 'Car'::text,
  make text not null default ''::text,
  model text not null default ''::text,
  year text not null default ''::text,
  registration text not null default ''::text,
  vin text not null default ''::text,
  manufacture_date date,
  mileage integer not null default 0,
  colour text not null default ''::text,
  tax_expiry date,
  test_expiry date,
  imported boolean not null default false,
  notes text not null default ''::text,
  image_path text,
  date_added timestamp with time zone not null default now(),
  favorite boolean not null default false,
  check ((mileage >= 0)),
  primary key (id),
  check ((type = any (array['Car'::text, 'Motorcycle'::text, 'Commercial'::text, 'Other'::text]))),
  foreign key (user_id) references auth.users(id) on delete cascade
);
create index if not exists vehicles_user_id_idx on public.vehicles (user_id);
alter table public.vehicles enable row level security;
grant select, insert, update, delete on public.vehicles to authenticated;
create table if not exists public.service_records (
  id uuid not null default gen_random_uuid(),
  vehicle_id uuid not null,
  date date not null default CURRENT_DATE,
  description text not null,
  mileage integer not null,
  cost numeric not null default 0,
  kind text not null default 'Service'::text,
  items text[] not null default '{}'::text[],
  tracked_items text[] not null default '{}'::text[],
  garage text not null default ''::text,
  notes text not null default ''::text,
  created_at timestamp with time zone not null default now(),
  check ((cost >= (0)::numeric)),
  check ((kind = any (array['Service'::text, 'Repair'::text]))),
  check ((mileage >= 0)),
  primary key (id),
  foreign key (vehicle_id) references public.vehicles(id) on delete cascade
);
create index if not exists service_records_vehicle_id_idx on public.service_records (vehicle_id);
alter table public.service_records enable row level security;
grant select, insert, update, delete on public.service_records to authenticated;
create table if not exists public.vehicle_documents (
  id uuid not null default gen_random_uuid(),
  vehicle_id uuid not null,
  name text not null,
  storage_path text,
  date_added date not null default CURRENT_DATE,
  primary key (id),
  foreign key (vehicle_id) references public.vehicles(id) on delete cascade
);
create index if not exists vehicle_documents_vehicle_id_idx on public.vehicle_documents (vehicle_id);
alter table public.vehicle_documents enable row level security;
grant select, insert, update, delete on public.vehicle_documents to authenticated;
create table if not exists public.service_receipts (
  id uuid not null default gen_random_uuid(),
  service_record_id uuid not null,
  name text not null,
  storage_path text not null,
  date_added timestamp with time zone not null default now(),
  primary key (id),
  foreign key (service_record_id) references public.service_records(id) on delete cascade
);
create index if not exists service_receipts_service_record_id_idx on public.service_receipts (service_record_id);
alter table public.service_receipts enable row level security;
grant select, insert, update, delete on public.service_receipts to authenticated;

insert into storage.buckets (id, name, public)
values ('mototrack-files', 'mototrack-files', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicles'
    and policyname = 'Users manage their own vehicles') then
    create policy "Users manage their own vehicles" on public.vehicles for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'service_records'
    and policyname = 'Users manage service history on their vehicles') then
    create policy "Users manage service history on their vehicles" on public.service_records for all to authenticated
      using (exists (select 1 from public.vehicles v where v.id = service_records.vehicle_id and v.user_id = (select auth.uid())))
      with check (exists (select 1 from public.vehicles v where v.id = service_records.vehicle_id and v.user_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicle_documents'
    and policyname = 'Users manage documents on their vehicles') then
    create policy "Users manage documents on their vehicles" on public.vehicle_documents for all to authenticated
      using (exists (select 1 from public.vehicles v where v.id = vehicle_documents.vehicle_id and v.user_id = (select auth.uid())))
      with check (exists (select 1 from public.vehicles v where v.id = vehicle_documents.vehicle_id and v.user_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'service_receipts'
    and policyname = 'Users manage receipts on their service records') then
    create policy "Users manage receipts on their service records" on public.service_receipts for all to authenticated
      using (exists (select 1 from public.service_records s join public.vehicles v on v.id = s.vehicle_id where s.id = service_receipts.service_record_id and v.user_id = (select auth.uid())))
      with check (exists (select 1 from public.service_records s join public.vehicles v on v.id = s.vehicle_id where s.id = service_receipts.service_record_id and v.user_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'Users manage files in their own storage folder') then
    create policy "Users manage files in their own storage folder" on storage.objects for all to authenticated
      using (bucket_id = 'mototrack-files' and (storage.foldername(name))[1] = (select auth.uid()::text))
      with check (bucket_id = 'mototrack-files' and (storage.foldername(name))[1] = (select auth.uid()::text));
  end if;
end;
$$;

alter table public.vehicles
  add column engine_size_cc text not null default '',
  add column fuel_type text not null default '',
  add column transmission text not null default '',
  add column body_style text not null default '',
  add column number_of_doors text not null default '',
  add column number_of_seats text not null default '',
  add column engine_number text not null default '',
  add column registration_county text not null default '',
  add column revision integer not null default 1;

create table public.vehicle_document_folders (
  id uuid primary key,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 70),
  sort_order integer not null default 0,
  unique (vehicle_id, id)
);

alter table public.vehicle_document_folders enable row level security;
grant select, insert, update, delete on public.vehicle_document_folders to authenticated;
create policy "Users manage folders on their own vehicles"
  on public.vehicle_document_folders for all to authenticated
  using (exists (
    select 1 from public.vehicles v
    where v.id = vehicle_document_folders.vehicle_id and v.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.vehicles v
    where v.id = vehicle_document_folders.vehicle_id and v.user_id = (select auth.uid())
  ));

alter table public.vehicle_documents
  add column sort_order integer not null default 0,
  add column folder_id uuid,
  add constraint vehicle_documents_folder_fk foreign key (vehicle_id, folder_id)
    references public.vehicle_document_folders(vehicle_id, id) on delete set null (folder_id);
create index vehicle_documents_folder_idx on public.vehicle_documents (vehicle_id, folder_id)
  where folder_id is not null;
alter table public.service_records add column sort_order integer not null default 0;
alter table public.service_receipts add column sort_order integer not null default 0;

-- A single transaction covers the vehicle, its history and its document organisation.
-- The revision check prevents one device from overwriting a newer garage edit.
create function public.save_mototrack_garage(expected_account uuid, changes jsonb, importing boolean default false)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
  change jsonb;
  target_id uuid;
  current_revision integer;
  expected_revision integer;
  incoming public.vehicles;
begin
  if account_id is null or account_id <> expected_account then
    raise exception 'Sign in to save your garage.' using errcode = '42501';
  end if;

  for change in select value from jsonb_array_elements(changes) order by value->>'id'
  loop
    target_id := (change->>'id')::uuid;
    expected_revision := (change->>'revision')::integer;
    select v.revision into current_revision from public.vehicles v
    where v.id = target_id and v.user_id = account_id for update;

    if importing and found then
      continue;
    end if;
    if current_revision is distinct from expected_revision then
      raise exception 'This vehicle changed on another device. Reload the garage and try again.'
        using errcode = '40001';
    end if;

    if change->>'operation' = 'delete' then
      delete from public.vehicles where id = target_id and user_id = account_id;
      continue;
    end if;

    incoming := jsonb_populate_record(null::public.vehicles, (change->'vehicle') ||
      jsonb_build_object('id', target_id, 'user_id', account_id, 'revision', coalesce(current_revision, 0) + 1));

    if current_revision is null then
      insert into public.vehicles (id, user_id, type, make, model, year, registration, vin, manufacture_date, mileage, colour, tax_expiry, test_expiry, imported, notes, image_path, date_added, favorite, engine_size_cc, fuel_type, transmission, body_style, number_of_doors, number_of_seats, engine_number, registration_county, revision)
      values (incoming.id, incoming.user_id, incoming.type, incoming.make, incoming.model, incoming.year, incoming.registration, incoming.vin, incoming.manufacture_date, incoming.mileage, incoming.colour, incoming.tax_expiry, incoming.test_expiry, incoming.imported, incoming.notes, incoming.image_path, incoming.date_added, incoming.favorite, incoming.engine_size_cc, incoming.fuel_type, incoming.transmission, incoming.body_style, incoming.number_of_doors, incoming.number_of_seats, incoming.engine_number, incoming.registration_county, incoming.revision)
      on conflict (id) do nothing;
      if not found then
        if importing and exists (select 1 from public.vehicles where id = target_id and user_id = account_id) then
          continue;
        end if;
        raise exception 'This vehicle could not be created.' using errcode = '40001';
      end if;
    else
      update public.vehicles set (type, make, model, year, registration, vin, manufacture_date, mileage, colour, tax_expiry, test_expiry, imported, notes, image_path, date_added, favorite, engine_size_cc, fuel_type, transmission, body_style, number_of_doors, number_of_seats, engine_number, registration_county, revision) =
        (incoming.type, incoming.make, incoming.model, incoming.year, incoming.registration, incoming.vin, incoming.manufacture_date, incoming.mileage, incoming.colour, incoming.tax_expiry, incoming.test_expiry, incoming.imported, incoming.notes, incoming.image_path, incoming.date_added, incoming.favorite, incoming.engine_size_cc, incoming.fuel_type, incoming.transmission, incoming.body_style, incoming.number_of_doors, incoming.number_of_seats, incoming.engine_number, incoming.registration_county, incoming.revision)
      where id = target_id and user_id = account_id;
    end if;

    delete from public.vehicle_document_folders as existing
    where existing.vehicle_id = target_id
      and not exists (
        select 1 from jsonb_array_elements(change->'folders') as item
        where (item->>'id')::uuid = existing.id
      );

    insert into public.vehicle_document_folders as existing (vehicle_id, id, name, sort_order)
    select target_id, item.id, item.name, item.sort_order
    from jsonb_populate_recordset(null::public.vehicle_document_folders, change->'folders') as item
    on conflict (id) do update
      set name = excluded.name, sort_order = excluded.sort_order
      where existing.vehicle_id = excluded.vehicle_id;

    delete from public.service_records as existing
    where existing.vehicle_id = target_id
      and not exists (
        select 1 from jsonb_array_elements(change->'services') as item
        where (item->>'id')::uuid = existing.id
      );

    insert into public.service_records as existing (vehicle_id, id, date, description, mileage, cost, kind, items, tracked_items, garage, notes, sort_order)
    select target_id, item.id, item.date, item.description, item.mileage, item.cost, item.kind, item.items, item.tracked_items, item.garage, item.notes, item.sort_order
    from jsonb_populate_recordset(null::public.service_records, change->'services') as item
    on conflict (id) do update
      set date = excluded.date, description = excluded.description, mileage = excluded.mileage, cost = excluded.cost, kind = excluded.kind, items = excluded.items, tracked_items = excluded.tracked_items, garage = excluded.garage, notes = excluded.notes, sort_order = excluded.sort_order
      where existing.vehicle_id = excluded.vehicle_id;

    delete from public.service_receipts as existing
    using public.service_records as service
    where service.id = existing.service_record_id and service.vehicle_id = target_id
      and not exists (
        select 1 from jsonb_array_elements(change->'receipts') as item
        where (item->>'id')::uuid = existing.id
      );

    insert into public.service_receipts as existing (id, service_record_id, name, storage_path, sort_order)
    select item.id, item.service_record_id, item.name, item.storage_path, item.sort_order
    from jsonb_populate_recordset(null::public.service_receipts, change->'receipts') as item
    join public.service_records as service on service.id = item.service_record_id and service.vehicle_id = target_id
    on conflict (id) do update set name = excluded.name, storage_path = excluded.storage_path, sort_order = excluded.sort_order
      where existing.service_record_id = excluded.service_record_id;

    delete from public.vehicle_documents as existing
    where existing.vehicle_id = target_id
      and not exists (
        select 1 from jsonb_array_elements(change->'documents') as item
        where (item->>'id')::uuid = existing.id
      );

    insert into public.vehicle_documents as existing (vehicle_id, id, name, storage_path, date_added, folder_id, sort_order)
    select target_id, item.id, item.name, item.storage_path, item.date_added, item.folder_id, item.sort_order
    from jsonb_populate_recordset(null::public.vehicle_documents, change->'documents') as item
    on conflict (id) do update
      set name = excluded.name, storage_path = excluded.storage_path, date_added = excluded.date_added, folder_id = excluded.folder_id, sort_order = excluded.sort_order
      where existing.vehicle_id = excluded.vehicle_id;

  end loop;
end;
$$;

revoke execute on function public.save_mototrack_garage(uuid, jsonb, boolean) from public, anon;
grant execute on function public.save_mototrack_garage(uuid, jsonb, boolean) to authenticated;

-- Build complete nested records in SQL so API pagination cannot truncate service or document history.
create function public.load_mototrack_garage(expected_account uuid, after_id uuid default null)
returns setof jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select to_jsonb(v) || jsonb_build_object(
    'vehicle_document_folders', coalesce((
      select jsonb_agg(to_jsonb(f)) from public.vehicle_document_folders f where f.vehicle_id = v.id
    ), '[]'::jsonb),
    'vehicle_documents', coalesce((
      select jsonb_agg(to_jsonb(d)) from public.vehicle_documents d where d.vehicle_id = v.id
    ), '[]'::jsonb),
    'service_records', coalesce((
      select jsonb_agg(to_jsonb(s) || jsonb_build_object('service_receipts', coalesce((
        select jsonb_agg(to_jsonb(r)) from public.service_receipts r where r.service_record_id = s.id
      ), '[]'::jsonb))) from public.service_records s where s.vehicle_id = v.id
    ), '[]'::jsonb)
  )
  from public.vehicles v
  where v.user_id = expected_account and expected_account = (select auth.uid())
    and (after_id is null or v.id > after_id)
  order by v.id
  limit 100;
$$;
revoke execute on function public.load_mototrack_garage(uuid, uuid) from public, anon;
grant execute on function public.load_mototrack_garage(uuid, uuid) to authenticated;
