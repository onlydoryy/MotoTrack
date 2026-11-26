import type { Vehicle } from "./garageTypes";

// Used to recognise untouched examples when reading older browser backups.
const legacyExamples: Vehicle[] = [
  {
    id: "demo-car",
    type: "Car",
    make: "BMW",
    model: "320d",
    year: "2008",
    registration: "Demo vehicle",
    vin: "",
    engineSizeCc: "",
    fuelType: "",
    transmission: "",
    bodyStyle: "",
    numberOfDoors: "",
    numberOfSeats: "",
    engineNumber: "",
    registrationCounty: "",
    manufactureDate: "",
    mileage: 319000,
    colour: "Black",
    taxExpiry: "",
    testExpiry: "",
    imported: false,
    notes: "Add your own details to customise this vehicle record.",
    image: "",
    dateAdded: 1,
    serviceRecords: [],
    documents: [],
    documentFolders: [],
  },
  {
    id: "demo-bike",
    type: "Motorcycle",
    make: "Suzuki",
    model: "Bandit 600S",
    year: "2002",
    registration: "Demo vehicle",
    vin: "",
    engineSizeCc: "",
    fuelType: "",
    transmission: "",
    bodyStyle: "",
    numberOfDoors: "",
    numberOfSeats: "",
    engineNumber: "",
    registrationCounty: "",
    manufactureDate: "",
    mileage: 45000,
    colour: "Blue",
    taxExpiry: "",
    testExpiry: "",
    imported: false,
    notes: "",
    image: "",
    dateAdded: 2,
    serviceRecords: [],
    documents: [],
    documentFolders: [],
  },
];

// Convert records saved by older versions of the app.
export const legacyGarageKey = "mototrack-vehicles";

export function legacyVehicles(saved: string): Vehicle[] {
  const parsed = JSON.parse(saved) as Partial<Vehicle>[];
  if (!Array.isArray(parsed)) throw new Error("The browser garage could not be read.");

  return parsed.map((vehicle, index) => ({
    ...vehicle,
    id: vehicle.id ?? `vehicle-${index}`,
    type: (vehicle.type as string) === "Van" ? "Commercial" : vehicle.type ?? "Other",
    make: vehicle.make ?? "",
    model: vehicle.model ?? "",
    year: vehicle.year ?? "",
    registration: vehicle.registration ?? "",
    vin: vehicle.vin ?? "",
    engineSizeCc: vehicle.engineSizeCc ?? "",
    fuelType: vehicle.fuelType ?? "",
    transmission: vehicle.transmission ?? "",
    bodyStyle: vehicle.bodyStyle ?? "",
    numberOfDoors: vehicle.numberOfDoors ?? "",
    numberOfSeats: vehicle.numberOfSeats ?? "",
    engineNumber: vehicle.engineNumber ?? "",
    registrationCounty: vehicle.registrationCounty ?? "",
    manufactureDate: vehicle.manufactureDate ?? "",
    mileage: typeof vehicle.mileage === "number" ? vehicle.mileage : 0,
    colour: vehicle.colour ?? "",
    taxExpiry: vehicle.taxExpiry ?? "",
    testExpiry: vehicle.testExpiry ?? "",
    imported: vehicle.imported ?? false,
    notes: vehicle.notes ?? "",
    image: vehicle.image ?? "",
    dateAdded: typeof vehicle.dateAdded === "number" ? vehicle.dateAdded : Date.now(),
    favorite: vehicle.favorite ?? false,
    serviceRecords: (vehicle.serviceRecords ?? []).map((record) => ({
      ...record,
      kind: record.kind ?? "Service",
      items: record.items ?? [],
      trackedItems: record.trackedItems ?? [],
      garage: record.garage ?? "",
      notes: record.notes ?? "",
      receipts: record.receipts ?? [],
    })),
    documents: (vehicle.documents ?? []).map((doc) => ({ ...doc, folderId: doc.folderId ?? null })),
    documentFolders: vehicle.documentFolders ?? [],
  })).filter((vehicle) => {
    const demo = legacyExamples.find((item) => item.id === vehicle.id);
    return !demo || Object.keys(demo).some((key) =>
      JSON.stringify(demo[key as keyof Vehicle]) !== JSON.stringify(vehicle[key as keyof Vehicle])
    ) || vehicle.favorite;
  }).map((vehicle) => ({
    ...vehicle,
    registration: vehicle.registration.trim().toLowerCase() === "demo vehicle" ? "" : vehicle.registration,
  }));
}
