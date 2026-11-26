-- Import historical services in odometer order before restoring the current vehicle mileage.
create or replace function public.save_mototrack_garage(expected_account uuid, changes jsonb, importing boolean default false)
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
      values (incoming.id, incoming.user_id, incoming.type, incoming.make, incoming.model, incoming.year, incoming.registration, incoming.vin, incoming.manufacture_date, case when importing then 0 else incoming.mileage end, incoming.colour, incoming.tax_expiry, incoming.test_expiry, incoming.imported, incoming.notes, incoming.image_path, incoming.date_added, incoming.favorite, incoming.engine_size_cc, incoming.fuel_type, incoming.transmission, incoming.body_style, incoming.number_of_doors, incoming.number_of_seats, incoming.engine_number, incoming.registration_county, incoming.revision)
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
    order by item.mileage, item.id
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

    if importing then
      update public.vehicles set mileage = greatest(mileage, incoming.mileage)
      where id = target_id and user_id = account_id;
    end if;
  end loop;
end;
$$;

