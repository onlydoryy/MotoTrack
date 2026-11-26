import { supabase } from "./supabase";
import type { ReceiptAttachment, ServiceRecord, Vehicle, VehicleDocument } from "./garageTypes";

function database() {
  if (!supabase) throw new Error("MotoTrack could not connect to Supabase.");
  return supabase;
}

const storage = () => database().storage.from("mototrack-files");

export function garageError(error: unknown) {
  return error && typeof error === "object" && "message" in error
    ? String(error.message)
    : "MotoTrack could not complete the request. Please try again.";
}

async function upload(path: string, file: Blob, importing: boolean) {
  const { error } = await storage().upload(path, file, { upsert: false });
  if (error && !(importing && "statusCode" in error && String(error.statusCode) === "409")) throw error;
  return path;
}

async function imageBlob(image: string) {
  if (!image.startsWith("data:image/")) throw new Error("A saved photo is invalid.");
  return (await fetch(image)).blob();
}

function vehicleFields(vehicle: Vehicle) {
  return {
    type: vehicle.type,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    registration: vehicle.registration,
    vin: vehicle.vin,
    manufacture_date: vehicle.manufactureDate || null,
    mileage: vehicle.mileage,
    colour: vehicle.colour,
    tax_expiry: vehicle.taxExpiry || null,
    test_expiry: vehicle.testExpiry || null,
    imported: vehicle.imported,
    notes: vehicle.notes,
    image_path: vehicle.imagePath ?? null,
    date_added: new Date(vehicle.dateAdded).toISOString(),
    favorite: vehicle.favorite ?? false,
    engine_size_cc: vehicle.engineSizeCc,
    fuel_type: vehicle.fuelType,
    transmission: vehicle.transmission,
    body_style: vehicle.bodyStyle,
    number_of_doors: vehicle.numberOfDoors,
    number_of_seats: vehicle.numberOfSeats,
    engine_number: vehicle.engineNumber,
    registration_county: vehicle.registrationCounty,
  };
}

function serviceFields(record: ServiceRecord, sort_order: number) {
  return {
    id: record.id,
    date: record.date,
    description: record.description,
    mileage: record.mileage,
    cost: record.cost,
    kind: record.kind ?? "Service",
    items: record.items ?? [],
    tracked_items: record.trackedItems ?? [],
    garage: record.garage ?? "",
    notes: record.notes ?? "",
    sort_order,
  };
}

type FolderRow = { id: string; name: string; sort_order: number };
type DocumentRow = FolderRow & { date_added: string; folder_id: string | null; storage_path: string | null };
type ReceiptRow = FolderRow & { storage_path: string };
type ServiceRow = ReturnType<typeof serviceFields> & { service_receipts: ReceiptRow[] };
type VehicleRow = ReturnType<typeof vehicleFields> & {
  id: string;
  revision: number;
  vehicle_document_folders: FolderRow[];
  vehicle_documents: DocumentRow[];
  service_records: ServiceRow[];
};

function inOrder<T extends { id: string; sort_order: number }>(rows: T[]) {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
}

function mediaPaths(vehicle?: Vehicle) {
  if (!vehicle) return [];
  return [
    vehicle.imagePath,
    ...vehicle.documents.map((doc) => doc.storagePath),
    ...vehicle.serviceRecords.flatMap((record) => (record.receipts ?? []).map((receipt) => receipt.storagePath)),
  ].filter((path): path is string => Boolean(path));
}

async function loadVehiclePage(accountId: string, afterId: string | null): Promise<VehicleRow[]> {
  const { data, error } = await database().rpc("load_mototrack_garage", {
    expected_account: accountId, after_id: afterId,
  });
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Supabase returned an invalid garage response.");
  return data as VehicleRow[];
}

export async function loadGarage(accountId: string): Promise<Vehicle[]> {
  const rows: VehicleRow[] = [];
  let afterId: string | null = null;
  for (;;) {
    const page = await loadVehiclePage(accountId, afterId);
    rows.push(...page);
    if (page.length < 100) break;
    afterId = page[page.length - 1].id;
  }

  const vehicles: Vehicle[] = rows.map((row) => ({
    id: row.id,
    revision: row.revision,
    type: row.type,
    make: row.make,
    model: row.model,
    year: row.year,
    registration: row.registration,
    vin: row.vin,
    manufactureDate: row.manufacture_date ?? "",
    mileage: row.mileage,
    colour: row.colour,
    taxExpiry: row.tax_expiry ?? "",
    testExpiry: row.test_expiry ?? "",
    imported: row.imported,
    notes: row.notes,
    image: "",
    imagePath: row.image_path ?? undefined,
    dateAdded: Date.parse(row.date_added),
    favorite: row.favorite,
    engineSizeCc: row.engine_size_cc,
    fuelType: row.fuel_type,
    transmission: row.transmission,
    bodyStyle: row.body_style,
    numberOfDoors: row.number_of_doors,
    numberOfSeats: row.number_of_seats,
    engineNumber: row.engine_number,
    registrationCounty: row.registration_county,
    documentFolders: inOrder(row.vehicle_document_folders).map(({ id, name }) => ({ id, name })),
    documents: inOrder(row.vehicle_documents).map((doc) => ({
      id: doc.id, name: doc.name, dateAdded: doc.date_added, folderId: doc.folder_id,
      storagePath: doc.storage_path ?? undefined,
    })),
    serviceRecords: inOrder(row.service_records).map((record) => ({
      id: record.id, date: record.date, description: record.description, mileage: record.mileage,
      cost: Number(record.cost), kind: record.kind, items: record.items, trackedItems: record.tracked_items,
      garage: record.garage, notes: record.notes,
      receipts: inOrder(record.service_receipts).map((receipt) => ({
        id: receipt.id, name: receipt.name, image: "", storagePath: receipt.storage_path,
      })),
    })),
  }));

  const paths = [...new Set(vehicles.flatMap((vehicle) => [
    vehicle.imagePath,
    ...vehicle.serviceRecords.flatMap((record) => (record.receipts ?? []).map((receipt) => receipt.storagePath)),
  ]).filter((path): path is string => Boolean(path)))];
  const urls = new Map<string, string>();
  for (let offset = 0; offset < paths.length; offset += 100) {
    const { data, error } = await storage().createSignedUrls(paths.slice(offset, offset + 100), 24 * 60 * 60);
    if (error) throw error;
    data.forEach(({ path, signedUrl }) => { if (path && signedUrl) urls.set(path, signedUrl); });
  }
  for (const vehicle of vehicles) {
    vehicle.image = urls.get(vehicle.imagePath ?? "") ?? "";
    for (const record of vehicle.serviceRecords) {
      for (const receipt of record.receipts ?? []) receipt.image = urls.get(receipt.storagePath ?? "") ?? "";
    }
  }
  return vehicles;
}

async function prepareVehicle(accountId: string, vehicle: Vehicle, importing: boolean): Promise<Vehicle> {
  const prefix = `${accountId}/vehicles/${vehicle.id}`;
  const imagePath = vehicle.image.startsWith("data:") && !vehicle.imagePath
    ? await upload(`${prefix}/photos/${importing ? "legacy" : crypto.randomUUID()}`, await imageBlob(vehicle.image), importing)
    : vehicle.imagePath;

  const serviceRecords: ServiceRecord[] = [];
  for (const record of vehicle.serviceRecords) {
    const receipts: ReceiptAttachment[] = [];
    for (const receipt of record.receipts ?? []) {
      const storagePath = receipt.storagePath ??
        await upload(`${prefix}/receipts/${receipt.id}`, await imageBlob(receipt.image), true);
      receipts.push({ ...receipt, storagePath });
    }
    serviceRecords.push({ ...record, receipts });
  }
  const documents: VehicleDocument[] = [];
  for (const { file, ...doc } of vehicle.documents) {
    const storagePath = file ? await upload(`${prefix}/documents/${doc.id}`, file, false) : doc.storagePath;
    documents.push({ ...doc, storagePath });
  }
  return { ...vehicle, imagePath, serviceRecords, documents };
}

function snapshot(vehicle: Vehicle) {
  return {
    id: vehicle.id,
    revision: vehicle.revision ?? null,
    vehicle: vehicleFields(vehicle),
    folders: vehicle.documentFolders.map(({ id, name }, sort_order) => ({ id, name, sort_order })),
    services: vehicle.serviceRecords.map(serviceFields),
    receipts: vehicle.serviceRecords.flatMap((record) => (record.receipts ?? []).map((receipt, sort_order) => ({
      id: receipt.id, name: receipt.name, storage_path: receipt.storagePath, service_record_id: record.id, sort_order,
    }))),
    documents: vehicle.documents.map((doc, sort_order) => ({
      id: doc.id, name: doc.name, date_added: doc.dateAdded,
      folder_id: doc.folderId ?? null, storage_path: doc.storagePath ?? null, sort_order,
    })),
  };
}

export async function saveVehicle(accountId: string, next: Vehicle, previous?: Vehicle) {
  const prepared = await prepareVehicle(accountId, next, false);
  const { error } = await database().rpc("save_mototrack_garage", {
    expected_account: accountId, changes: [snapshot(prepared)],
  });
  if (error) throw error;
  await removeUnusedFiles(previous, prepared);
  return { ...prepared, revision: (prepared.revision ?? 0) + 1 };
}

export async function removeVehicle(accountId: string, vehicle: Vehicle) {
  const { error } = await database().rpc("save_mototrack_garage", {
    expected_account: accountId, changes: [{ id: vehicle.id, revision: vehicle.revision, operation: "delete" }],
  });
  if (error) throw error;
  await removeUnusedFiles(vehicle);
}

async function removeUnusedFiles(previous?: Vehicle, next?: Vehicle) {
  const kept = new Set(mediaPaths(next));
  const removed = mediaPaths(previous).filter((path) => !kept.has(path));
  if (!removed.length) return;
  try {
    const { error } = await storage().remove(removed);
    if (error) throw error;
  } catch (error) {
    console.warn("MotoTrack could not remove unused files.", error);
  }
}

export async function downloadVehicleDocument(doc: VehicleDocument) {
  if (!doc.storagePath) return;
  const { data, error } = await storage().download(doc.storagePath);
  if (error) throw error;
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = doc.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function legacyId(accountId: string, ...parts: string[]) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([accountId, ...parts])));
  const hex = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function importGarage(accountId: string, vehicles: Vehicle[], existing: Vehicle[]) {
  const occupied = new Set(existing.map((vehicle) => vehicle.id));
  const changes = [];
  for (const vehicle of vehicles) {
    const id = await legacyId(accountId, "vehicle", vehicle.id);
    if (occupied.has(id)) continue;
    const documentFolders = await Promise.all(vehicle.documentFolders.map(async (folder) => ({
      ...folder, id: await legacyId(accountId, id, "folder", folder.id),
    })));
    const folderIds = new Map(vehicle.documentFolders.map((folder, index) => [folder.id, documentFolders[index].id]));
    const documents = await Promise.all(vehicle.documents.map(async (doc) => ({
      ...doc, id: await legacyId(accountId, id, "document", doc.id),
      folderId: folderIds.get(doc.folderId ?? "") ?? null,
    })));
    const serviceRecords = await Promise.all(vehicle.serviceRecords.map(async (record) => {
      const recordId = await legacyId(accountId, id, "service", record.id);
      return {
        ...record, id: recordId,
        receipts: await Promise.all((record.receipts ?? []).map(async (receipt) => ({
          ...receipt, id: await legacyId(accountId, recordId, "receipt", receipt.id),
        }))),
      };
    }));
    changes.push(snapshot(await prepareVehicle(accountId, { ...vehicle, id, documentFolders, documents, serviceRecords }, true)));
  }
  if (!changes.length) return;
  const { error } = await database().rpc("save_mototrack_garage", {
    expected_account: accountId, changes, importing: true,
  });
  if (error) throw error;
}
