// Supported vehicle categories.
export type VehicleType = "Car" | "Motorcycle" | "Commercial" | "Other";

// One history entry is either routine maintenance or a repair.
export type ServiceKind = "Service" | "Repair";

// Receipt metadata and its private file.
export type ReceiptAttachment = { id: string; name: string; image: string; storagePath?: string };

// Optional fields allow older saved records to load without breaking.
export type ServiceRecord = {
  id: string;
  date: string;
  description: string;
  mileage: number;
  cost: number;
  kind?: ServiceKind;
  items?: string[];
  trackedItems?: string[];
  garage?: string;
  notes?: string;
  receipts?: ReceiptAttachment[];
};

// A vehicle document can have a private file or be an older filename-only entry.
export type VehicleDocument = {
  id: string;
  name: string;
  dateAdded: string;
  storagePath?: string;
  file?: File;
  folderId?: string | null;
};

export type DocumentFolder = {
  id: string;
  name: string;
};

// Complete saved vehicle shape, including service history and document metadata.
export type Vehicle = {
  id: string;
  type: VehicleType;
  make: string;
  model: string;
  year: string;
  registration: string;
  vin: string;
  engineSizeCc: string;
  fuelType: string;
  transmission: string;
  bodyStyle: string;
  numberOfDoors: string;
  numberOfSeats: string;
  engineNumber: string;
  registrationCounty: string;
  manufactureDate: string;
  mileage: number;
  colour: string;
  taxExpiry: string;
  testExpiry: string;
  imported: boolean;
  notes: string;
  image: string;
  imagePath?: string;
  revision?: number;
  dateAdded: number;
  favorite?: boolean;
  serviceRecords: ServiceRecord[];
  documents: VehicleDocument[];
  documentFolders: DocumentFolder[];
};

