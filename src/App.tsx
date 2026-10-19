
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import "./App.css";

// Supported vehicle categories and the three tabs on a vehicle profile.
type VehicleType = "Car" | "Motorcycle" | "Commercial" | "Other";
type Tab = "info" | "service" | "documents";

// One history entry is either routine maintenance or a repair.
type ServiceKind = "Service" | "Repair";

// Receipt photos are stored with their history entry in this browser-only version.
type ReceiptAttachment = { id: string; name: string; image: string };

// Optional fields allow older saved records to load without breaking.
type ServiceRecord = {
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

// Searchable preset jobs, grouped by the type of maintenance they belong to.
const maintenanceGroups = [
  { title: "Filters", items: ["Oil filter", "Air filter", "Fuel filter", "Cabin / pollen filter"] },
  { title: "Fluids", items: ["Engine oil", "Coolant", "Brake fluid", "Gearbox oil", "Differential oil", "Power steering fluid"] },
  { title: "Brakes & tyres", items: ["Brake pads", "Brake discs", "Tyre replacement", "Tyre rotation"] },
  { title: "Other routine maintenance", items: ["Spark plugs", "Timing belt / chain inspection", "Battery", "Wipers", "Motorcycle chain clean / lube / adjustment"] },
];

// Lightweight metadata for documents listed in the Documents tab.
type VehicleDocument = {
  id: string;
  name: string;
  dateAdded: string;
};

// Complete saved vehicle shape, including service history and document metadata.
type Vehicle = {
  id: string;
  type: VehicleType;
  make: string;
  model: string;
  year: string;
  registration: string;
  vin: string;
  manufactureDate: string;
  mileage: number;
  colour: string;
  taxExpiry: string;
  testExpiry: string;
  notes: string;
  image: string;
  dateAdded: number;
  favorite?: boolean;
  serviceRecords: ServiceRecord[];
  documents: VehicleDocument[];
};

// Demo vehicles shown the first time the app is opened without saved data.
const starterVehicles: Vehicle[] = [
  {
    id: "demo-car",
    type: "Car",
    make: "BMW",
    model: "320d",
    year: "2008",
    registration: "Demo vehicle",
    vin: "",
    manufactureDate: "",
    mileage: 319000,
    colour: "Black",
    taxExpiry: "",
    testExpiry: "",
    notes: "Add your own details to customise this vehicle record.",
    image: "",
    dateAdded: 1,
    serviceRecords: [],
    documents: [],
  },
  {
    id: "demo-bike",
    type: "Motorcycle",
    make: "Suzuki",
    model: "Bandit 600S",
    year: "2002",
    registration: "Demo vehicle",
    vin: "",
    manufactureDate: "",
    mileage: 45000,
    colour: "Blue",
    taxExpiry: "",
    testExpiry: "",
    notes: "",
    image: "",
    dateAdded: 2,
    serviceRecords: [],
    documents: [],
  },
];

// Load saved vehicles and fill in missing fields from older versions of the app.
function loadVehicles(): Vehicle[] {
  try {
    const saved = localStorage.getItem("mototrack-vehicles");
    if (!saved) return starterVehicles;
    const parsed = JSON.parse(saved) as Partial<Vehicle>[];
    if (!Array.isArray(parsed)) return starterVehicles;

    return parsed.map((vehicle, index) => ({
      ...vehicle,
      id: vehicle.id ?? `vehicle-${index}-${Date.now()}`,
      type: vehicle.type === "Van" ? "Commercial" : vehicle.type ?? "Other",
      make: vehicle.make ?? "",
      model: vehicle.model ?? "",
      year: vehicle.year ?? "",
      registration: vehicle.registration ?? "",
      vin: vehicle.vin ?? "",
      manufactureDate: vehicle.manufactureDate ?? "",
      mileage: typeof vehicle.mileage === "number" ? vehicle.mileage : 0,
      colour: vehicle.colour ?? "",
      taxExpiry: vehicle.taxExpiry ?? "",
      testExpiry: vehicle.testExpiry ?? "",
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
      documents: vehicle.documents ?? [],
    })) as Vehicle[];
  } catch {
    return starterVehicles;
  }
}

// Simple inline SVG placeholder used when a vehicle has no uploaded photo.
function VehicleIllustration({ type }: { type: VehicleType }) {
  if (type === "Motorcycle") {
    return (
      <svg viewBox="0 0 240 150" className="vehicle-illustration" role="img" aria-label="Motorcycle illustration">
        <ellipse cx="120" cy="125" rx="82" ry="7" fill="currentColor" opacity=".08" />
        <circle cx="67" cy="105" r="23" fill="#202a35" stroke="#8b9baa" strokeWidth="5" />
        <circle cx="67" cy="105" r="8" fill="#8b9baa" />
        <circle cx="177" cy="105" r="23" fill="#202a35" stroke="#8b9baa" strokeWidth="5" />
        <circle cx="177" cy="105" r="8" fill="#8b9baa" />
        <path d="M67 103 L92 74 L124 76 L151 104 L111 104 L92 74 L80 103" fill="none" stroke="#f1a64a" strokeWidth="8" strokeLinejoin="round" />
        <path d="M99 71 L120 60 L144 69 L151 83 L119 83 Z" fill="#e1e8ef" />
        <path d="M101 69 L123 64 L140 70 L135 77 L103 77 Z" fill="#f1a64a" />
        <path d="M144 69 L162 72 L174 91 L163 94 L149 80" fill="none" stroke="#8b9baa" strokeWidth="6" strokeLinecap="round" />
        <path d="M94 73 L79 66 L68 68" fill="none" stroke="#8b9baa" strokeWidth="5" strokeLinecap="round" />
        <path d="M118 60 L125 48 L146 48" fill="none" stroke="#8b9baa" strokeWidth="5" strokeLinecap="round" />
        <path d="M112 57 L139 57" stroke="#f1a64a" strokeWidth="5" strokeLinecap="round" />
      </svg>
    );
  }

  const isVan = type === "Commercial";
  const isOther = type === "Other";

  return (
    <svg viewBox="0 0 240 150" className="vehicle-illustration" role="img" aria-label={`${type} illustration`}>
      <ellipse cx="120" cy="125" rx="91" ry="7" fill="currentColor" opacity=".08" />
      <path
        d={isVan
          ? "M35 91 L35 49 Q35 41 44 41 L153 41 Q161 41 165 49 L193 76 L204 83 L204 108 L35 108 Z"
          : isOther
            ? "M28 83 L41 62 Q45 55 55 55 L165 55 Q174 55 181 66 L204 88 L204 108 L28 108 Z"
            : "M31 91 L48 72 Q54 64 67 64 L151 64 Q163 64 172 75 L197 91 L202 108 L30 108 Z"}
        fill={isVan ? "#8ca6b8" : isOther ? "#88a88f" : "#6e8ca8"}
      />
      <path
        d={isVan
          ? "M48 49 L150 49 L150 74 L48 74 Z"
          : isOther
            ? "M57 63 L91 63 L91 80 L46 80 Z M100 63 L160 63 L176 80 L100 80 Z"
            : "M62 72 L97 72 L97 86 L48 86 Z M105 72 L150 72 Q158 72 165 82 L105 86 Z"}
        fill="#d9e7ef"
      />
      <path d="M27 96 L205 96 L205 107 L27 107 Z" fill="#263544" />
      <rect x="38" y="91" width="16" height="7" rx="2" fill="#f3c36a" />
      <rect x="184" y="91" width="14" height="7" rx="2" fill="#e77b6a" />
      <circle cx="65" cy="108" r="17" fill="#202a35" stroke="#a8b3bd" strokeWidth="4" />
      <circle cx="65" cy="108" r="6" fill="#a8b3bd" />
      <circle cx="169" cy="108" r="17" fill="#202a35" stroke="#a8b3bd" strokeWidth="4" />
      <circle cx="169" cy="108" r="6" fill="#a8b3bd" />
    </svg>
  );
}

// Format mileage using Irish number separators (for example, 12,345).
function formatMileage(mileage: number) {
  return new Intl.NumberFormat("en-IE").format(mileage);
}

// Convert a tax/test expiry date into a label and CSS status colour.
function expiryStatus(date: string) {
  if (!date) return { label: "Not recorded", className: "status-neutral" };

  const expiry = new Date(`${date}T23:59:59`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (Number.isNaN(expiry.getTime())) {
    return { label: "Not recorded", className: "status-neutral" };
  }

  if (expiry < today) return { label: "Expired", className: "status-bad" };

  const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);

  if (daysLeft <= 30) {
    return { label: "Expiring soon", className: "status-warning" };
  }

  return { label: "Valid", className: "status-good" };
}

// Reusable MotoTrack logo button; clicking it returns to the garage overview.
function Brand({ onClick }: { onClick: () => void }) {
  return (
    <button className="brand garage-brand" onClick={onClick} aria-label="MotoTrack home">
      <span className="brand-mark">M</span>
      <span>
        Moto<span className="brand-light">Track</span>
      </span>
    </button>
  );
}

// Only these vehicle fields are editable in the Vehicle Info form.
type VehicleInfoDraft = Pick<
  Vehicle,
  "type" | "make" | "model" | "year" | "registration" | "vin" | "manufactureDate" | "colour" | "notes"
>;

// Main app component: manages the garage, active vehicle, and forms.
function App() {
  // Load vehicle records from browser storage when the app starts.
  const [vehicles, setVehicles] = useState<Vehicle[]>(loadVehicles);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [infoDraft, setInfoDraft] = useState<VehicleInfoDraft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [filter, setFilter] = useState("All");
  const [customTypes, setCustomTypes] = useState<VehicleType[]>(["Car", "Motorcycle"]);
  const [sort, setSort] = useState("newest");
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState("");
  const [serviceKind, setServiceKind] = useState<ServiceKind>("Service");
  const [serviceDescription, setServiceDescription] = useState("");
  const [selectedMaintenanceItems, setSelectedMaintenanceItems] = useState<string[]>([]);
  const [serviceOtherItem, setServiceOtherItem] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [serviceMileage, setServiceMileage] = useState("");
  const [serviceCost, setServiceCost] = useState("");
  const [serviceGarage, setServiceGarage] = useState("");
  const [serviceNotes, setServiceNotes] = useState("");
  const [maintenanceSearch, setMaintenanceSearch] = useState("");
  // Receipt photos waiting to be saved with the next history entry.
  const [serviceReceipts, setServiceReceipts] = useState<ReceiptAttachment[]>([]);
  // Keep track of which history entry is currently expanded.
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [vehiclePhoto, setVehiclePhoto] = useState("");
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropTargetId, setCropTargetId] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const [isCropDragging, setIsCropDragging] = useState(false);
  const [stagedVehiclePhoto, setStagedVehiclePhoto] = useState<{ id: string; image: string } | null>(null);

  // Persist the latest garage data after each change.
  useEffect(() => {
    try {
      localStorage.setItem("mototrack-vehicles", JSON.stringify(vehicles));
    } catch {
      console.warn("MotoTrack could not save to browser storage.");
    }
  }, [vehicles]);

  // Resolve the active vehicle ID to the full saved vehicle object.
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedId) ?? null;

  // Filter and sort garage cards without repeating the work on unrelated renders.
  const visibleVehicles = useMemo(() => {
    let result = vehicles.filter((vehicle) => {
      const text = `${vehicle.make} ${vehicle.model} ${vehicle.registration}`.toLowerCase();
      const matchesSearch = text.includes(search.toLowerCase());
      const matchesFilter =
        filter === "All" ||
        (filter === "Custom" && customTypes.includes(vehicle.type)) ||
        vehicle.type === filter;

      return matchesSearch && matchesFilter;
    });

    result = [...result].sort((a, b) => {
      if (Boolean(a.favorite) !== Boolean(b.favorite)) return a.favorite ? -1 : 1;
      if (sort === "name-az") return `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`);
      if (sort === "name-za") return `${b.make} ${b.model}`.localeCompare(`${a.make} ${a.model}`);
      if (sort === "mileage-low") return a.mileage - b.mileage;
      if (sort === "mileage-high") return b.mileage - a.mileage;
      return b.dateAdded - a.dateAdded;
    });

    return result;
  }, [vehicles, filter, customTypes, sort, search]);

  // Read the add-vehicle form and create a new vehicle record.
  function addVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const newVehicle: Vehicle = {
      id: crypto.randomUUID(),
      type: String(form.get("type")) as VehicleType,
      make: String(form.get("make")).trim(),
      model: String(form.get("model")).trim(),
      year: String(form.get("year")).trim(),
      registration: String(form.get("registration")).trim(),
      vin: String(form.get("vin")).trim(),
      manufactureDate: String(form.get("manufactureDate")),
      mileage: Number(form.get("mileage")) || 0,
      colour: String(form.get("colour")).trim(),
      taxExpiry: String(form.get("taxExpiry")),
      testExpiry: String(form.get("testExpiry")),
      notes: "",
      image: vehiclePhoto,
      dateAdded: Date.now(),
      serviceRecords: [],
      documents: [],
    };

    setVehicles((current) => [...current, newVehicle]);
    setSelectedId(newVehicle.id);
    setActiveTab("info");
    setShowAddModal(false);
    setVehiclePhoto("");
  }

  // Toggle a favourite; favourites always appear before other vehicles.
  function toggleFavorite(vehicleId: string) {
    setVehicles((current) => current.map((vehicle) =>
      vehicle.id === vehicleId ? { ...vehicle, favorite: !vehicle.favorite } : vehicle,
    ));
  }

  // Copy saved details into a draft so Cancel can discard unsaved edits.
  function startEditingInfo() {
    if (!selectedVehicle) return;
    setInfoDraft({
      type: selectedVehicle.type,
      make: selectedVehicle.make,
      model: selectedVehicle.model,
      year: selectedVehicle.year,
      registration: selectedVehicle.registration,
      vin: selectedVehicle.vin ?? "",
      manufactureDate: selectedVehicle.manufactureDate ?? "",
      colour: selectedVehicle.colour,
      notes: selectedVehicle.notes,
    });
    setIsEditingInfo(true);
  }

  // Discard the draft and return to the read-only vehicle details.
  function cancelEditingInfo() {
    setInfoDraft(null);
    setIsEditingInfo(false);
  }

  // Apply the edited details to the selected vehicle, then close edit mode.
  function saveVehicleInfo() {
    if (!selectedVehicle || !infoDraft) return;
    setVehicles((current) => current.map((vehicle) =>
      vehicle.id === selectedVehicle.id ? { ...vehicle, ...infoDraft } : vehicle,
    ));
    setInfoDraft(null);
    setIsEditingInfo(false);
  }

  // Update one field in the unsaved Vehicle Info draft.
  function updateInfoDraft(field: keyof VehicleInfoDraft, value: string) {
    setInfoDraft((current) => current ? { ...current, [field]: value } : current);
  }

  // Stage a photo for cropping first; it is not saved until confirmed and explicitly saved.
  function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>, vehicleId?: string) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    input.value = "";
    if (!file.type.startsWith("image/")) { window.alert("Please choose an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { window.alert("Please choose an image smaller than 5 MB."); return; }
    const reader = new FileReader();
    reader.onerror = () => window.alert("Could not read that image. Please try again.");
    reader.onload = () => {
      setCropSource(String(reader.result));
      setCropTargetId(vehicleId ?? null);
      setCropZoom(1);
      setCropX(50);
      setCropY(50);
      setIsCropDragging(false);
    };
    reader.readAsDataURL(file);
  }

  function confirmPhotoCrop() {
    if (!cropSource) return;
    const image = new Image();
    image.onerror = () => window.alert("Could not open that image. Please try another one.");
    image.onload = () => {
      // Match the garage card image frame (1 / 0.79) so the crop is what users see.\n      const aspect = 1 / 0.79;
      const baseWidth = Math.min(image.naturalWidth, image.naturalHeight * aspect);
      const baseHeight = baseWidth / aspect;
      const cropWidth = baseWidth / cropZoom;
      const cropHeight = baseHeight / cropZoom;
      const sx = Math.max(0, image.naturalWidth - cropWidth) * cropX / 100;
      const sy = Math.max(0, image.naturalHeight - cropHeight) * cropY / 100;
      const canvas = document.createElement("canvas");
      canvas.width = 1200; canvas.height = 900;
      const context = canvas.getContext("2d");
      if (!context) { window.alert("Could not crop that image. Please try again."); return; }
      context.drawImage(image, sx, sy, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
      const croppedImage = canvas.toDataURL("image/jpeg", 0.88);
      if (cropTargetId) setStagedVehiclePhoto({ id: cropTargetId, image: croppedImage });
      else setVehiclePhoto(croppedImage);
      setCropSource(null);
      setCropTargetId(null);
    };
    image.src = cropSource;
  }

  function saveStagedVehiclePhoto() {
    if (!stagedVehiclePhoto) return;
    setVehicles((current) => current.map((vehicle) =>
      vehicle.id === stagedVehiclePhoto.id ? { ...vehicle, image: stagedVehiclePhoto.image } : vehicle,
    ));
    setStagedVehiclePhoto(null);
  }

  // Toggle a preset maintenance job in the current service checklist.
  function toggleMaintenanceItem(item: string) {
    setSelectedMaintenanceItems((current) =>
      current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item],
    );
  }

  // Clear the entry form after a successful save.
  function resetServiceForm() {
    setServiceDescription("");
    setSelectedMaintenanceItems([]);
    setServiceOtherItem("");
    setServiceReceipts([]);
    setServiceDate("");
    setServiceMileage("");
    setServiceCost("");
    setServiceGarage("");
    setServiceNotes("");
    setMaintenanceSearch("");
  }

  // Compress receipt images so storing them locally uses less browser storage.
  async function handleReceiptUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length !== files.length) window.alert("Please choose image files for receipts (JPG, PNG or WEBP).");
    const acceptedFiles = imageFiles.filter((file) => file.size <= 10 * 1024 * 1024);
    if (acceptedFiles.length !== imageFiles.length) window.alert("Each receipt image must be smaller than 10 MB before compression.");
    if (!acceptedFiles.length) return;

    try {
      const compressedReceipts = await Promise.all(acceptedFiles.map((file) => new Promise<ReceiptAttachment>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Could not read the receipt image."));
        reader.onload = () => {
          const photo = new Image();
          photo.onerror = () => reject(new Error("Could not open the receipt image."));
          photo.onload = () => {
            const maxDimension = 1400;
            const scale = Math.min(1, maxDimension / Math.max(photo.width, photo.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(photo.width * scale));
            canvas.height = Math.max(1, Math.round(photo.height * scale));
            const context = canvas.getContext("2d");
            if (!context) { reject(new Error("Could not process the receipt image.")); return; }
            context.drawImage(photo, 0, 0, canvas.width, canvas.height);
            resolve({ id: crypto.randomUUID(), name: file.name, image: canvas.toDataURL("image/jpeg", 0.72) });
          };
          photo.src = String(reader.result);
        };
        reader.readAsDataURL(file);
      })));
      setServiceReceipts((current) => [...current, ...compressedReceipts]);
    } catch {
      window.alert("A receipt image could not be processed. Please try again.");
    }
  }

  // Save one combined history entry, including all selected work and receipt photos.
  function addServiceRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedVehicle) return;

    const customItem = serviceOtherItem.trim();
    const items = serviceKind === "Service"
      ? [...selectedMaintenanceItems, ...(customItem ? [customItem] : [])]
      : [];
    const description = serviceKind === "Service"
      ? items.join(", ")
      : serviceDescription.trim();

    if (!description) return;

    const record: ServiceRecord = {
      id: crypto.randomUUID(),
      date: serviceDate || new Date().toISOString().slice(0, 10),
      description,
      mileage: serviceMileage !== "" ? Number(serviceMileage) : selectedVehicle.mileage,
      cost: serviceCost !== "" ? Number(serviceCost) : 0,
      kind: serviceKind,
      items,
      trackedItems: serviceKind === "Service" ? items : [],
      garage: serviceGarage.trim(),
      notes: serviceNotes.trim(),
      receipts: serviceReceipts,
    };

    setVehicles((current) =>
      current.map((vehicle) =>
        vehicle.id === selectedVehicle.id
          ? { ...vehicle, serviceRecords: [record, ...vehicle.serviceRecords] }
          : vehicle,
      ),
    );

    resetServiceForm();
  }

  // Record the names of uploaded vehicle documents (full document storage comes later).
  // Record the names of uploaded vehicle documents (full document storage comes later).
  function addDocument(event: ChangeEvent<HTMLInputElement>) {
    if (!selectedVehicle) return;

    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    const newDocuments = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      dateAdded: new Date().toISOString().slice(0, 10),
    }));

    setVehicles((current) =>
      current.map((vehicle) =>
        vehicle.id === selectedVehicle.id
          ? { ...vehicle, documents: [...newDocuments, ...vehicle.documents] }
          : vehicle,
      ),
    );

    event.target.value = "";
  }

  // Confirm before deleting a vehicle and its associated local history.
  function deleteVehicle(id: string) {
    if (!window.confirm("Delete this vehicle and its records? This cannot be undone.")) return;

    setVehicles((current) => current.filter((vehicle) => vehicle.id !== id));
    setSelectedId(null);
  }

  return (
    <div className="app-shell">
      {/* Main content changes between the garage overview and a vehicle profile. */}
      <main className="main-content">
        {selectedVehicle ? (
          <section className="page-content detail-page">
            <Brand onClick={() => { setSelectedId(null); cancelEditingInfo(); }} />

            <button className="back-button" onClick={() => { setSelectedId(null); cancelEditingInfo(); }}>
              ← Back to My Garage
            </button>

            {/* Header section: vehicle identity, registration, and photo. */}
            <div className="vehicle-hero">
              <div className="hero-copy">
                <span className="eyebrow">{selectedVehicle.type} PROFILE</span>
                <h1>{selectedVehicle.make} {selectedVehicle.model}</h1>
                <p className="hero-subtitle">
                  {[selectedVehicle.year, selectedVehicle.colour].filter(Boolean).join(" · ") || "Vehicle details"}
                </p>

                <div className="hero-registration">
                  <span className="plate-icon">▰</span>
                  <span>{selectedVehicle.registration || "Registration not recorded"}</span>
                </div>

                <label className="button button-secondary photo-button">
                  <span>↥</span>
                  {selectedVehicle.image ? "Change photo" : "Upload your photo"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => handlePhotoUpload(event, selectedVehicle.id)}
                  />
                </label>
                {stagedVehiclePhoto?.id === selectedVehicle.id && <div className="photo-save-actions">
                  <span>Preview ready — save it to keep this photo.</span>
                  <button type="button" className="button button-secondary" onClick={() => setStagedVehiclePhoto(null)}>Discard</button>
                  <button type="button" className="button button-primary" onClick={saveStagedVehiclePhoto}>Save photo</button>
                </div>}
              </div>

              <div className="hero-image">
                {(stagedVehiclePhoto?.id === selectedVehicle.id ? stagedVehiclePhoto.image : selectedVehicle.image) ? (
                  <img src={stagedVehiclePhoto?.id === selectedVehicle.id ? stagedVehiclePhoto.image : selectedVehicle.image} alt={`${selectedVehicle.make} ${selectedVehicle.model}`} />
                ) : (
                  <VehicleIllustration type={selectedVehicle.type} />
                )}
                <span className="image-caption">
                  {stagedVehiclePhoto?.id === selectedVehicle.id ? "PHOTO PREVIEW — NOT SAVED" : selectedVehicle.image ? "YOUR VEHICLE PHOTO" : "PLACEHOLDER ILLUSTRATION"}
                </span>
              </div>
            </div>

            {/* At-a-glance mileage, motor tax, and test status. */}
            <div className="quick-stats">
              <div className="quick-stat">
                <span className="stat-label">LAST RECORDED MILEAGE</span>
                <strong>{formatMileage(selectedVehicle.mileage)} <small>km</small></strong>
                <span className="stat-foot">Update in Vehicle Info</span>
              </div>

              <div className="quick-stat">
                <span className="stat-label">MOTOR TAX</span>
                <strong className="status-line">
                  <span className={`status-dot ${expiryStatus(selectedVehicle.taxExpiry).className}`} />
                  {expiryStatus(selectedVehicle.taxExpiry).label}
                </strong>
                <span className="stat-foot">
                  {selectedVehicle.taxExpiry
                    ? `Expiry: ${selectedVehicle.taxExpiry}`
                    : "Add an expiry date in Vehicle Info"}
                </span>
              </div>

              <div className="quick-stat">
                <span className="stat-label">
                  {selectedVehicle.type === "Motorcycle"
                    ? "NCT"
                    : selectedVehicle.type === "Commercial"
                      ? "CVRT / TEST"
                      : "NCT STATUS"}
                </span>

                {selectedVehicle.type === "Motorcycle" ? (
                  <>
                    <strong className="status-line">
                      <span className="status-dot status-neutral" />
                      Not applicable
                    </strong>
                    <span className="stat-foot">Motorcycles do not require an NCT</span>
                  </>
                ) : (
                  <>
                    <strong className="status-line">
                      <span className={`status-dot ${expiryStatus(selectedVehicle.testExpiry).className}`} />
                      {expiryStatus(selectedVehicle.testExpiry).label}
                    </strong>
                    <span className="stat-foot">
                      {selectedVehicle.testExpiry
                        ? `Expiry: ${selectedVehicle.testExpiry}`
                        : "Add a test expiry date in Vehicle Info"}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Navigation between vehicle information, service history, and documents. */}
            <div className="detail-tabs">
              <button className={activeTab === "info" ? "selected" : ""} onClick={() => setActiveTab("info")}>
                ▤ Vehicle Info
              </button>
              <button className={activeTab === "service" ? "selected" : ""} onClick={() => setActiveTab("service")}>
                ◷ Service History <span>{selectedVehicle.serviceRecords.length}</span>
              </button>
              <button className={activeTab === "documents" ? "selected" : ""} onClick={() => setActiveTab("documents")}>
                ▧ Documents <span>{selectedVehicle.documents.length}</span>
              </button>
            </div>

            {/* Vehicle details are read-only until Edit details is selected. */}
            {activeTab === "info" && (
              <div className="detail-panel vehicle-info-panel">
                <div className="section-heading">
                  <div>
                    <h2>Vehicle information</h2>
                    <p>{isEditingInfo ? "Update the details for this vehicle." : "Key details for your vehicle, all in one place."}</p>
                  </div>
                  {!isEditingInfo && <button className="button button-secondary" onClick={startEditingInfo}>✎ Edit details</button>}
                </div>
                {isEditingInfo && infoDraft ? (
                  <form onSubmit={(event) => { event.preventDefault(); saveVehicleInfo(); }}>
                    <div className="info-grid">
                      <label className="field"><span>Make</span><input value={infoDraft.make} onChange={(event) => updateInfoDraft("make", event.target.value)} /></label>
                      <label className="field"><span>Model</span><input value={infoDraft.model} onChange={(event) => updateInfoDraft("model", event.target.value)} /></label>
                      <label className="field">
                        <span>Vehicle type</span>
                        <select value={infoDraft.type} onChange={(event) => updateInfoDraft("type", event.target.value as VehicleType)}>
                          <option value="Car">Car</option><option value="Motorcycle">Motorcycle</option><option value="Commercial">Commercial</option><option value="Other">Other</option>
                        </select>
                      </label>
                      <label className="field"><span>Model year</span><input value={infoDraft.year} onChange={(event) => updateInfoDraft("year", event.target.value)} inputMode="numeric" /></label>
                      <label className="field"><span>Registration</span><input value={infoDraft.registration} onChange={(event) => updateInfoDraft("registration", event.target.value)} placeholder="e.g. 12-C-12345" /></label>
                      <label className="field"><span>Colour</span><input value={infoDraft.colour} onChange={(event) => updateInfoDraft("colour", event.target.value)} placeholder="e.g. Black" /></label>
                      <label className="field"><span>VIN / chassis number</span><input value={infoDraft.vin} onChange={(event) => updateInfoDraft("vin", event.target.value)} placeholder="Vehicle identification number" /></label>
                      <label className="field"><span>Date of manufacture</span><input type="date" value={infoDraft.manufactureDate} onChange={(event) => updateInfoDraft("manufactureDate", event.target.value)} /></label>
                      <label className="field field-wide">
                        <span>Notes</span>
                        <textarea rows={3} value={infoDraft.notes} onChange={(event) => updateInfoDraft("notes", event.target.value)} placeholder="Add useful details, repairs, or reminders..." />
                      </label>
                    </div>
                    <div className="panel-footer info-edit-footer">
                      <span className="save-hint">Changes are only saved when you select Save Changes.</span>
                      <div className="info-actions">
                        <button type="button" className="button button-secondary" onClick={cancelEditingInfo}>Cancel</button>
                        <button type="submit" className="button button-primary">Save Changes</button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="vehicle-details-grid">
                      <div className="vehicle-detail-item"><span>Make</span><strong>{selectedVehicle.make || "Not recorded"}</strong></div>
                      <div className="vehicle-detail-item"><span>Model</span><strong>{selectedVehicle.model || "Not recorded"}</strong></div>
                      <div className="vehicle-detail-item"><span>Vehicle type</span><strong>{selectedVehicle.type || "Not recorded"}</strong></div>
                      <div className="vehicle-detail-item"><span>Model year</span><strong>{selectedVehicle.year || "Not recorded"}</strong></div>
                      <div className="vehicle-detail-item"><span>Registration</span><strong>{selectedVehicle.registration || "Not recorded"}</strong></div>
                      <div className="vehicle-detail-item"><span>Colour</span><strong>{selectedVehicle.colour || "Not recorded"}</strong></div>
                      <div className="vehicle-detail-item"><span>VIN / chassis number</span><strong className="detail-value-mono">{selectedVehicle.vin || "Not recorded"}</strong></div>
                      <div className="vehicle-detail-item"><span>Date of manufacture</span><strong>{selectedVehicle.manufactureDate || "Not recorded"}</strong></div>
                      <div className="vehicle-detail-item vehicle-detail-notes"><span>Notes</span><strong>{selectedVehicle.notes || "No notes added"}</strong></div>
                    </div>
                    <div className="panel-footer info-view-footer">
                      <span className="save-hint">Saved locally on this device.</span>
                      <button className="button button-danger-ghost" onClick={() => deleteVehicle(selectedVehicle.id)}>Delete vehicle</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Service/repair form and expandable history records for the selected vehicle. */}
            {activeTab === "service" && (
              <div className="detail-panel">
                <div className="section-heading">
                  <div>
                    <h2>Service history</h2>
                    <p>Record servicing, repairs, parts and other work.</p>
                  </div>
                </div>

                <form className="service-entry-form" onSubmit={addServiceRecord}>
                  <div className="service-kind-switch" role="group" aria-label="Record type">
                    <button type="button" className={serviceKind === "Service" ? "active" : ""} onClick={() => setServiceKind("Service")}>
                      <span>⚙</span><strong>Service</strong><small>Routine maintenance</small>
                    </button>
                    <button type="button" className={serviceKind === "Repair" ? "active" : ""} onClick={() => setServiceKind("Repair")}>
                      <span>🔧</span><strong>Repair</strong><small>Fix a fault or replace a part</small>
                    </button>
                  </div>

                  {serviceKind === "Service" ? (
                    <div className="maintenance-picker">
                      <div className="maintenance-picker-heading">
                        <div><h3>What was maintained?</h3><p>Choose everything completed. You can search for less common jobs too.</p></div>
                        <span className="selection-count">{selectedMaintenanceItems.length} selected</span>
                      </div>
                      <label className="maintenance-search">
                        <span>⌕</span>
                        <input value={maintenanceSearch} onChange={(event) => setMaintenanceSearch(event.target.value)} placeholder="Find maintenance items..." />
                      </label>
                      <div className="maintenance-groups">
                        {maintenanceGroups.map((group) => {
                          const visibleItems = group.items.filter((item) => item.toLowerCase().includes(maintenanceSearch.toLowerCase()));
                          if (!visibleItems.length) return null;
                          return (
                            <div className="maintenance-group" key={group.title}>
                              <h4>{group.title}</h4>
                              <div className="maintenance-options">
                                {visibleItems.map((item) => (
                                  <label className={selectedMaintenanceItems.includes(item) ? "maintenance-option checked" : "maintenance-option"} key={item}>
                                    <input type="checkbox" checked={selectedMaintenanceItems.includes(item)} onChange={() => toggleMaintenanceItem(item)} />
                                    <span className="custom-check">{selectedMaintenanceItems.includes(item) ? "✓" : ""}</span>
                                    <span>{item}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                        {!maintenanceGroups.some((group) => group.items.some((item) => item.toLowerCase().includes(maintenanceSearch.toLowerCase()))) && (
                          <p className="maintenance-no-results">No matching preset. Add it in “Other maintenance” below.</p>
                        )}
                      </div>
                      <label className="field other-maintenance-field">
                        <span>Other maintenance (optional)</span>
                        <input value={serviceOtherItem} onChange={(event) => setServiceOtherItem(event.target.value)} placeholder="e.g. Differential oil, fork seals, valve clearances" />
                      </label>
                    </div>
                  ) : (
                    <div className="repair-details">
                      <label className="field field-wide"><span>What needed repairing?</span><input required value={serviceDescription} onChange={(event) => setServiceDescription(event.target.value)} placeholder="e.g. Replaced alternator, fixed coolant leak" /></label>
                    </div>
                  )}

                  <div className="service-details-grid">
                    <label className="field"><span>Date completed</span><input type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} /></label>
                    <label className="field"><span>Mileage (km)</span><input type="number" min="0" value={serviceMileage} onChange={(event) => setServiceMileage(event.target.value)} placeholder={String(selectedVehicle.mileage)} /></label>
                    <label className="field"><span>Cost (€)</span><input type="number" min="0" step="0.01" value={serviceCost} onChange={(event) => setServiceCost(event.target.value)} placeholder="Optional" /></label>
                    <label className="field"><span>Garage / mechanic (optional)</span><input value={serviceGarage} onChange={(event) => setServiceGarage(event.target.value)} placeholder="Who carried out the work?" /></label>
                    <label className="field field-wide"><span>Notes (optional)</span><textarea rows={2} value={serviceNotes} onChange={(event) => setServiceNotes(event.target.value)} placeholder="Parts used, symptoms, invoice details..." /></label>
                    {/* Receipt photos are compressed and attached to this entry when saved. */}
                    <div className="field field-wide receipt-upload-field">
                      <span>Receipt photos (optional)</span>
                      <label className="button button-secondary receipt-upload-button">＋ Attach receipt photos<input type="file" accept="image/*" multiple onChange={handleReceiptUpload} /></label>
                      <small className="receipt-help">Image files only. Photos are resized to help save space on this device.</small>
                      {serviceReceipts.length > 0 && <div className="receipt-staging-list">{serviceReceipts.map((receipt) => <div className="receipt-staging-item" key={receipt.id}><img src={receipt.image} alt={receipt.name} /><span>{receipt.name}</span><button type="button" aria-label={`Remove ${receipt.name}`} onClick={() => setServiceReceipts((current) => current.filter((item) => item.id !== receipt.id))}>×</button></div>)}</div>}
                    </div>
                  </div>
                  <div className="service-form-footer">
                    <span>{serviceKind === "Service" ? "Select at least one maintenance item or add a custom item." : "Keep a record of the repair, cost and who carried it out."}</span>
                    <button className="button button-primary" type="submit">＋ Add {serviceKind.toLowerCase()} record</button>
                  </div>
                </form>

                {/* Each save creates one compact card; expand it to inspect all work and receipts. */}
                {selectedVehicle.serviceRecords.length ? (
                  <div className="record-list">
                    <div className="record-list-heading"><h3>History</h3><span>{selectedVehicle.serviceRecords.length} record{selectedVehicle.serviceRecords.length === 1 ? "" : "s"}</span></div>
                    {selectedVehicle.serviceRecords.map((record) => {
                      // Convert older comma-separated descriptions into bullet points for display.
                      const recordItems = record.items?.length
                        ? record.items
                        : record.kind === "Repair"
                          ? [record.description]
                          : record.description.split(", ").filter(Boolean);
                      const isExpanded = expandedRecordId === record.id;
                      const receipts = record.receipts ?? [];
                      return (
                        <article className={`history-record ${isExpanded ? "expanded" : ""}`} key={record.id}>
                          <button type="button" className="history-record-toggle" aria-expanded={isExpanded} onClick={() => setExpandedRecordId(isExpanded ? null : record.id)}>
                            <span className="record-icon">{record.kind === "Repair" ? "🔧" : "⚙"}</span>
                            <span className="history-record-main">
                              <strong className="history-record-title">{record.kind === "Repair" ? "Repair" : "Service"} · {record.date}</strong>
                              <span className="history-record-meta">{formatMileage(record.mileage)} km{record.garage ? ` · ${record.garage}` : ""}</span>
                              <ul className="history-record-preview">
                                {recordItems.slice(0, 3).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                                {recordItems.length > 3 && <li className="preview-ellipsis">…</li>}
                              </ul>
                              <span className="history-record-hint">{isExpanded ? "Hide details" : "Click to view full record"}{receipts.length ? ` · ${receipts.length} receipt photo${receipts.length === 1 ? "" : "s"}` : ""}</span>
                            </span>
                            <strong className="record-cost">{record.cost ? `€${record.cost.toFixed(2)}` : "—"}</strong>
                            <span className="record-expand-icon" aria-hidden="true">{isExpanded ? "−" : "+"}</span>
                          </button>
                          {isExpanded && (
                            <div className="history-record-details">
                              <h4>{record.kind === "Repair" ? "Repair details" : "Work completed"}</h4>
                              <ul className="history-record-full-list">{recordItems.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
                              <div className="history-detail-grid">
                                <span><strong>Date</strong>{record.date}</span>
                                <span><strong>Mileage</strong>{formatMileage(record.mileage)} km</span>
                                <span><strong>Cost</strong>{record.cost ? `€${record.cost.toFixed(2)}` : "Not recorded"}</span>
                                <span><strong>Garage / mechanic</strong>{record.garage || "Not recorded"}</span>
                              </div>
                              {record.notes && <div className="history-detail-notes"><strong>Notes</strong><p>{record.notes}</p></div>}
                              {receipts.length > 0 && (
                                <div className="history-receipts">
                                  <h4>Attached receipts</h4>
                                  <div className="history-receipt-grid">{receipts.map((receipt) => <a key={receipt.id} href={receipt.image} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><img src={receipt.image} alt={receipt.name} /><span>{receipt.name}</span></a>)}</div>
                                </div>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">◷</div>
                    <h3>No service records yet</h3>
                    <p>Add your first service or repair above to start building the vehicle's history.</p>
                  </div>
                )}
              </div>
            )}

            {/* Paperwork tab: currently stores document names, not file contents. */}
            {activeTab === "documents" && (
              <div className="detail-panel">
                <div className="section-heading">
                  <div>
                    <h2>Documents</h2>
                    <p>Keep track of receipts, invoices and vehicle paperwork.</p>
                  </div>
                  <label className="button button-primary upload-doc-button">
                    ＋ Add document
                    <input type="file" multiple onChange={addDocument} />
                  </label>
                </div>

                <p className="document-note">
                  This first version records document names only. File storage and previews can be added with the backend.
                </p>

                {selectedVehicle.documents.length ? (
                  <div className="record-list">
                    {selectedVehicle.documents.map((document) => (
                      <div className="record-row" key={document.id}>
                        <div className="record-icon">▤</div>
                        <div className="record-main">
                          <strong>{document.name}</strong>
                          <span>Added {document.dateAdded}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">▧</div>
                    <h3>No documents added</h3>
                    <p>Add a receipt, invoice or other document to keep a record of it here.</p>
                  </div>
                )}
              </div>
            )}
          </section>
        ) : (
          <section className="page-content">
            <Brand onClick={() => { setSelectedId(null); cancelEditingInfo(); }} />

            <div className="garage-summary">
              <div className="summary-symbol">▦</div>
              <div className="garage-summary-title">
                <span>MY GARAGE</span>
                <strong>{vehicles.length} {vehicles.length === 1 ? "vehicle" : "vehicles"}</strong>
              </div>
              <div className="summary-divider" />
              {([
                { type: "Car", label: "cars", className: "car-dot" },
                { type: "Motorcycle", label: "motorcycles", className: "bike-dot" },
                { type: "Commercial", label: "commercial", className: "van-dot" },
                { type: "Other", label: "other", className: "other-dot" },
              ] as const).map(({ type, label, className }) => {
                const count = vehicles.filter((vehicle) => vehicle.type === type).length;
                return count > 0 ? (
                  <div className="summary-type" key={type}>
                    <span className={`type-dot ${className}`} />{count} {label}
                  </div>
                ) : null;
              })}
              <button className="button button-primary large-add garage-add-button" onClick={() => setShowAddModal(true)}>
                ＋ Add vehicle
              </button>
            </div>

            <div className="garage-toolbar">
              <div className="toolbar-controls">
                <label className="toolbar-control filter-control"><span>Filter</span>
                  <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter vehicles">
                    <option value="All">All vehicles</option><option value="Car">Cars</option><option value="Motorcycle">Motorcycles</option>
                    <option value="Commercial">Commercial</option><option value="Other">Other</option><option value="Custom">Custom selection…</option>
                  </select>
                </label>
                <label className="toolbar-control sort-control"><span>Sort</span>
                  <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort vehicles">
                    <option value="newest">Recently added</option><option value="name-az">Name A–Z</option><option value="name-za">Name Z–A</option>
                    <option value="mileage-low">Mileage: low to high</option><option value="mileage-high">Mileage: high to low</option>
                  </select>
                </label>
                <label className="search-box"><span>⌕</span>
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search garage..." aria-label="Search garage" />
                </label>
              </div>
              {filter === "Custom" && <div className="custom-filter">
                {(["Car", "Motorcycle", "Commercial", "Other"] as VehicleType[]).map((type) => (
                  <label key={type}><input type="checkbox" checked={customTypes.includes(type)} onChange={(event) =>
                    setCustomTypes((current) => event.target.checked ? [...new Set([...current, type])] : current.filter((item) => item !== type))
                  } />{type === "Motorcycle" ? "Motorcycles" : type === "Commercial" ? "Commercial" : type === "Other" ? "Other" : "Cars"}</label>
                ))}
              </div>}
            </div>

            {visibleVehicles.length ? (
              <div className="vehicle-grid">
                {visibleVehicles.map((vehicle) => (
                  <div
                    className="vehicle-card"
                    key={vehicle.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => { setSelectedId(vehicle.id); setActiveTab("info"); setIsEditingInfo(false); setInfoDraft(null); }}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(vehicle.id);
                        setActiveTab("info");
                        setIsEditingInfo(false);
                        setInfoDraft(null);
                      }
                    }}
                  >
                    <div className={`vehicle-card-image ${vehicle.image ? "has-photo" : ""}`}>
                      {vehicle.image ? (
                        <img src={vehicle.image} alt={`${vehicle.make} ${vehicle.model}`} />
                      ) : (
                        <VehicleIllustration type={vehicle.type} />
                      )}
                      <span className="vehicle-type-pill">{vehicle.type}</span>
                      <button
                        type="button"
                        className={`vehicle-favorite ${vehicle.favorite ? "is-favorite" : ""}`}
                        aria-label={vehicle.favorite ? "Remove from favourites" : "Add to favourites"}
                        aria-pressed={Boolean(vehicle.favorite)}
                        title={vehicle.favorite ? "Remove from favourites" : "Add to favourites"}
                        onClick={(event) => { event.stopPropagation(); toggleFavorite(vehicle.id); }}
                        onKeyDown={(event) => event.stopPropagation()}
                      >★</button>
                      <span className="card-open">↗</span>
                    </div>

                    <div className="vehicle-card-content">
                      <div className="vehicle-card-title">
                        <h3>{vehicle.make || "New"} {vehicle.model || "vehicle"}</h3>
                        <span>{vehicle.year || "Year not set"}</span>
                      </div>
                      <div className="vehicle-card-registration">
                        {vehicle.registration || "Registration not recorded"}
                      </div>
                      <div className="vehicle-card-footer">
                        <span>◉ {formatMileage(vehicle.mileage)} km</span>
                        <span className="view-details">View details <span>→</span></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="garage-empty">
                <div className="empty-garage-illustration">
                  <VehicleIllustration type={filter === "Motorcycle" ? "Motorcycle" : filter === "Commercial" ? "Commercial" : "Car"} />
                </div>
                <h2>{vehicles.length ? "No vehicles match your filters" : "Your garage starts here"}</h2>
                <p>
                  {vehicles.length
                    ? "Try a different category or search term."
                    : "Add your car, bike, commercial vehicle or another vehicle to start keeping its records together."}
                </p>
                {vehicles.length ? (
                  <button className="button button-secondary" onClick={() => { setFilter("All"); setSearch(""); }}>
                    Clear filters
                  </button>
                ) : (
                  <button className="button button-primary" onClick={() => setShowAddModal(true)}>
                    ＋ Add your first vehicle
                  </button>
                )}
              </div>
            )}

            <div className="page-footnote">
              <span>✓</span> Your garage is saved locally on this device. Database sync can be added later.
            </div>
          </section>
        )}
      </main>

      {/* Modal form for creating a new vehicle. */}
      {showAddModal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
              setVehiclePhoto("");
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <span className="eyebrow">NEW RECORD</span>
                <h2>Add a vehicle</h2>
                <p>Start with the basics. You can update everything later.</p>
              </div>
              <button className="modal-close" onClick={() => { setShowAddModal(false); setVehiclePhoto(""); }}>
                ×
              </button>
            </div>

            <form onSubmit={addVehicle}>
              <label className="field">
                <span>Vehicle type *</span>
                <select name="type" required>
                  <option value="Car">Car</option>
                  <option value="Motorcycle">Motorcycle</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <div className="form-two-col">
                <label className="field">
                  <span>Make *</span>
                  <input name="make" required placeholder="e.g. BMW" />
                </label>
                <label className="field">
                  <span>Model *</span>
                  <input name="model" required placeholder="e.g. 320d" />
                </label>
                <label className="field">
                  <span>Year</span>
                  <input name="year" type="number" min="1900" max="2100" placeholder="e.g. 2018" />
                </label>
                <label className="field">
                  <span>Colour</span>
                  <input name="colour" placeholder="e.g. Black" />
                </label>
                <label className="field">
                  <span>Registration</span>
                  <input name="registration" placeholder="e.g. 12-C-12345" />
                </label>
                <label className="field">
                  <span>VIN / chassis number</span>
                  <input name="vin" placeholder="Vehicle identification number" />
                </label>
                <label className="field">
                  <span>Date of manufacture</span>
                  <input name="manufactureDate" type="date" />
                </label>
                <label className="field">
                  <span>Current mileage (km)</span>
                  <input name="mileage" type="number" min="0" defaultValue="0" />
                </label>
                <label className="field">
                  <span>Motor tax expiry</span>
                  <input name="taxExpiry" type="date" />
                </label>
                <label className="field">
                  <span>NCT / test expiry</span>
                  <input name="testExpiry" type="date" />
                </label>
              </div>

              <label className="photo-upload-zone">
                {vehiclePhoto ? (
                  <img src={vehiclePhoto} alt="Vehicle preview" />
                ) : (
                  <span className="upload-placeholder"><VehicleIllustration type="Car" /></span>
                )}
                <span>
                  <strong>{vehiclePhoto ? "Photo selected" : "Add a vehicle photo (optional)"}</strong>
                  <small>{vehiclePhoto ? "Choose another photo to replace it" : "PNG, JPG or WEBP · Max 5 MB"}</small>
                </span>
                <span className="upload-action">Browse</span>
                <input type="file" accept="image/*" onChange={(event) => handlePhotoUpload(event)} />
              </label>

              <div className="modal-actions">
                <button type="button" className="button button-secondary" onClick={() => { setShowAddModal(false); setVehiclePhoto(""); }}>
                  Cancel
                </button>
                <button type="submit" className="button button-primary">Add to garage →</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {cropSource && <div className="modal-backdrop crop-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) { setCropSource(null); setCropTargetId(null); }
      }}>
        <section className="modal crop-modal" role="dialog" aria-modal="true" aria-labelledby="crop-title">
          <div className="modal-header"><div><span className="eyebrow">PHOTO EDITOR</span><h2 id="crop-title">Frame your vehicle photo</h2><p>Adjust the zoom and framing, then confirm your crop.</p></div>
            <button type="button" className="modal-close" aria-label="Close photo editor" onClick={() => { setCropSource(null); setCropTargetId(null); }}>×</button>
          </div>
          <p className="crop-instructions">Drag the photo to position it. Use the zoom slider to get closer.</p>
          <div className={`crop-preview ${isCropDragging ? "is-dragging" : ""}`}
            onPointerDown={(event) => { setIsCropDragging(true); event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerMove={(event) => {
              if (!isCropDragging) return;
              const bounds = event.currentTarget.getBoundingClientRect();
              setCropX((current) => Math.max(0, Math.min(100, current - event.movementX / bounds.width * 100)));
              setCropY((current) => Math.max(0, Math.min(100, current - event.movementY / bounds.height * 100)));
            }}
            onPointerUp={() => setIsCropDragging(false)}
            onPointerCancel={() => setIsCropDragging(false)}
            onLostPointerCapture={() => setIsCropDragging(false)}>
            <img src={cropSource} alt="Drag to frame vehicle photo" draggable={false} style={{ objectPosition: `${cropX}% ${cropY}%`, transform: `scale(${cropZoom})` }} />
            <span className="crop-drag-hint"><span>✥</span> Drag to reposition</span>
          </div>
          <div className="crop-controls">
            <label><span>Zoom</span><input type="range" min="1" max="3" step="0.05" value={cropZoom} onChange={(event) => setCropZoom(Number(event.target.value))} /></label>
          </div>
          <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => { setCropSource(null); setCropTargetId(null); }}>Cancel</button>
            <button type="button" className="button button-primary" onClick={confirmPhotoCrop}>OK — use this crop</button></div>
        </section>
      </div>}
    </div>
  );
}

export default App;
