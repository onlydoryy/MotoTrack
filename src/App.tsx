
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import "./App.css";

type VehicleType = "Car" | "Motorcycle" | "Van" | "Other";
type Tab = "info" | "service" | "documents";

type ServiceRecord = {
  id: string;
  date: string;
  description: string;
  mileage: number;
  cost: number;
};

type VehicleDocument = {
  id: string;
  name: string;
  dateAdded: string;
};

type Vehicle = {
  id: string;
  type: VehicleType;
  make: string;
  model: string;
  year: string;
  registration: string;
  mileage: number;
  colour: string;
  taxExpiry: string;
  testExpiry: string;
  notes: string;
  image: string;
  dateAdded: number;
  serviceRecords: ServiceRecord[];
  documents: VehicleDocument[];
};

const starterVehicles: Vehicle[] = [
  {
    id: "demo-car",
    type: "Car",
    make: "BMW",
    model: "320d",
    year: "2008",
    registration: "Demo vehicle",
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

function loadVehicles(): Vehicle[] {
  try {
    const saved = localStorage.getItem("mototrack-vehicles");
    return saved ? (JSON.parse(saved) as Vehicle[]) : starterVehicles;
  } catch {
    return starterVehicles;
  }
}

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

  const isVan = type === "Van";
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

function formatMileage(mileage: number) {
  return new Intl.NumberFormat("en-IE").format(mileage);
}

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

function App() {
  const [vehicles, setVehicles] = useState<Vehicle[]>(loadVehicles);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [filter, setFilter] = useState("All");
  const [customTypes, setCustomTypes] = useState<VehicleType[]>(["Car", "Motorcycle"]);
  const [sort, setSort] = useState("newest");
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [serviceMileage, setServiceMileage] = useState("");
  const [serviceCost, setServiceCost] = useState("");
  const [vehiclePhoto, setVehiclePhoto] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem("mototrack-vehicles", JSON.stringify(vehicles));
    } catch {
      console.warn("MotoTrack could not save to browser storage.");
    }
  }, [vehicles]);

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedId) ?? null;

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
      if (sort === "name-az") return `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`);
      if (sort === "name-za") return `${b.make} ${b.model}`.localeCompare(`${a.make} ${a.model}`);
      if (sort === "mileage-low") return a.mileage - b.mileage;
      if (sort === "mileage-high") return b.mileage - a.mileage;
      return b.dateAdded - a.dateAdded;
    });

    return result;
  }, [vehicles, filter, customTypes, sort, search]);

  function addVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const newVehicle: Vehicle = {
      id: crypto.randomUUID(),
      type: String(form.get("type")) as VehicleType,
      make: String(form.get("make")).trim(),
      model: String(form.get("model")).trim(),
      year: String(form.get("year")).trim(),
      registration: String(form.get("registration")).trim() || "Not recorded",
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

  function updateVehicle(field: keyof Vehicle, value: string | number) {
    if (!selectedVehicle) return;

    setVehicles((current) =>
      current.map((vehicle) =>
        vehicle.id === selectedVehicle.id ? { ...vehicle, [field]: value } : vehicle,
      ),
    );
  }

  function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>, vehicleId?: string) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      window.alert("Please choose an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      window.alert("Please choose an image smaller than 5 MB.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const image = String(reader.result);

      if (vehicleId) {
        setVehicles((current) =>
          current.map((vehicle) =>
            vehicle.id === vehicleId ? { ...vehicle, image } : vehicle,
          ),
        );
      } else {
        setVehiclePhoto(image);
      }
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function addServiceRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedVehicle || !serviceDescription.trim()) return;

    const record: ServiceRecord = {
      id: crypto.randomUUID(),
      date: serviceDate || new Date().toISOString().slice(0, 10),
      description: serviceDescription.trim(),
      mileage: Number(serviceMileage) || selectedVehicle.mileage,
      cost: Number(serviceCost) || 0,
    };

    setVehicles((current) =>
      current.map((vehicle) =>
        vehicle.id === selectedVehicle.id
          ? { ...vehicle, serviceRecords: [record, ...vehicle.serviceRecords] }
          : vehicle,
      ),
    );

    setServiceDescription("");
    setServiceDate("");
    setServiceMileage("");
    setServiceCost("");
  }

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

  function deleteVehicle(id: string) {
    if (!window.confirm("Delete this vehicle and its records? This cannot be undone.")) return;

    setVehicles((current) => current.filter((vehicle) => vehicle.id !== id));
    setSelectedId(null);
  }

  return (
    <div className="app-shell">
      <main className="main-content">
        {selectedVehicle ? (
          <section className="page-content detail-page">
            <Brand onClick={() => setSelectedId(null)} />

            <button className="back-button" onClick={() => setSelectedId(null)}>
              ← Back to My Garage
            </button>

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
              </div>

              <div className="hero-image">
                {selectedVehicle.image ? (
                  <img src={selectedVehicle.image} alt={`${selectedVehicle.make} ${selectedVehicle.model}`} />
                ) : (
                  <VehicleIllustration type={selectedVehicle.type} />
                )}
                <span className="image-caption">
                  {selectedVehicle.image ? "YOUR VEHICLE PHOTO" : "PLACEHOLDER ILLUSTRATION"}
                </span>
              </div>
            </div>

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
                    : selectedVehicle.type === "Van"
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

            {activeTab === "info" && (
              <div className="detail-panel">
                <div className="section-heading">
                  <div>
                    <h2>Vehicle information</h2>
                    <p>Keep the main details up to date.</p>
                  </div>
                </div>

                <div className="info-grid">
                  <label className="field">
                    <span>Make</span>
                    <input value={selectedVehicle.make} onChange={(e) => updateVehicle("make", e.target.value)} />
                  </label>
                  <label className="field">
                    <span>Model</span>
                    <input value={selectedVehicle.model} onChange={(e) => updateVehicle("model", e.target.value)} />
                  </label>
                  <label className="field">
                    <span>Vehicle type</span>
                    <select value={selectedVehicle.type} onChange={(e) => updateVehicle("type", e.target.value)}>
                      <option>Car</option><option>Motorcycle</option><option>Van</option><option>Other</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Year</span>
                    <input value={selectedVehicle.year} onChange={(e) => updateVehicle("year", e.target.value)} />
                  </label>
                  <label className="field">
                    <span>Registration</span>
                    <input value={selectedVehicle.registration} onChange={(e) => updateVehicle("registration", e.target.value)} />
                  </label>
                  <label className="field">
                    <span>Colour</span>
                    <input value={selectedVehicle.colour} onChange={(e) => updateVehicle("colour", e.target.value)} />
                  </label>
                  <label className="field">
                    <span>Current mileage (km)</span>
                    <input type="number" min="0" value={selectedVehicle.mileage} onChange={(e) => updateVehicle("mileage", Number(e.target.value))} />
                  </label>
                  <label className="field">
                    <span>Motor tax expiry</span>
                    <input type="date" value={selectedVehicle.taxExpiry} onChange={(e) => updateVehicle("taxExpiry", e.target.value)} />
                  </label>

                  {selectedVehicle.type !== "Motorcycle" && (
                    <label className="field">
                      <span>{selectedVehicle.type === "Van" ? "CVRT / test expiry" : "NCT expiry"}</span>
                      <input type="date" value={selectedVehicle.testExpiry} onChange={(e) => updateVehicle("testExpiry", e.target.value)} />
                    </label>
                  )}

                  <label className="field field-wide">
                    <span>Notes</span>
                    <textarea
                      rows={3}
                      value={selectedVehicle.notes}
                      onChange={(e) => updateVehicle("notes", e.target.value)}
                      placeholder="Add useful details, repairs, or reminders..."
                    />
                  </label>
                </div>

                <div className="panel-footer">
                  <span className="save-hint"><span className="save-check">✓</span> Changes save automatically on this device</span>
                  <button className="button button-danger-ghost" onClick={() => deleteVehicle(selectedVehicle.id)}>
                    Delete vehicle
                  </button>
                </div>
              </div>
            )}

            {activeTab === "service" && (
              <div className="detail-panel">
                <div className="section-heading">
                  <div>
                    <h2>Service history</h2>
                    <p>Record servicing, repairs, parts and other work.</p>
                  </div>
                </div>

                <form className="service-form" onSubmit={addServiceRecord}>
                  <label className="field field-wide">
                    <span>What work was carried out?</span>
                    <input required value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} placeholder="e.g. Oil and filter change" />
                  </label>
                  <label className="field">
                    <span>Date</span>
                    <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
                  </label>
                  <label className="field">
                    <span>Mileage (km)</span>
                    <input type="number" min="0" value={serviceMileage} onChange={(e) => setServiceMileage(e.target.value)} placeholder={String(selectedVehicle.mileage)} />
                  </label>
                  <label className="field">
                    <span>Cost (€)</span>
                    <input type="number" min="0" step="0.01" value={serviceCost} onChange={(e) => setServiceCost(e.target.value)} placeholder="0.00" />
                  </label>
                  <div className="field-action">
                    <button className="button button-primary" type="submit">＋ Add service record</button>
                  </div>
                </form>

                {selectedVehicle.serviceRecords.length ? (
                  <div className="record-list">
                    {selectedVehicle.serviceRecords.map((record) => (
                      <div className="record-row" key={record.id}>
                        <div className="record-icon">🔧</div>
                        <div className="record-main">
                          <strong>{record.description}</strong>
                          <span>{record.date} · {formatMileage(record.mileage)} km</span>
                        </div>
                        <strong className="record-cost">
                          {record.cost ? `€${record.cost.toFixed(2)}` : "No cost added"}
                        </strong>
                      </div>
                    ))}
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
            <Brand onClick={() => setSelectedId(null)} />

            <div className="page-heading">
              <div>
                <span className="eyebrow">YOUR VEHICLES</span>
                <h1>My Garage<span className="heading-period">.</span></h1>
                <p>All your vehicles, details and records in one place.</p>
              </div>
              <button className="button button-primary large-add" onClick={() => setShowAddModal(true)}>
                ＋ Add vehicle
              </button>
            </div>

            <div className="garage-summary">
              <div className="summary-symbol">▦</div>
              <div>
                <span>YOUR GARAGE</span>
                <strong>{vehicles.length} {vehicles.length === 1 ? "vehicle" : "vehicles"}</strong>
              </div>
              <div className="summary-divider" />
              <div className="summary-type"><span className="type-dot car-dot" />{vehicles.filter((v) => v.type === "Car").length} cars</div>
              <div className="summary-type"><span className="type-dot bike-dot" />{vehicles.filter((v) => v.type === "Motorcycle").length} motorcycles</div>
              <div className="summary-type"><span className="type-dot van-dot" />{vehicles.filter((v) => v.type === "Van").length} vans</div>
            </div>

            <div className="garage-toolbar">
              <div className="filter-group">
                {["All", "Car", "Motorcycle", "Van", "Other", "Custom"].map((item) => (
                  <button
                    key={item}
                    className={`filter-button ${filter === item ? "chosen" : ""}`}
                    onClick={() => setFilter(item)}
                  >
                    {item === "Car" ? "Cars"
                      : item === "Motorcycle" ? "Motorcycles"
                        : item === "Van" ? "Vans"
                          : item === "Other" ? "Other"
                            : item === "All" ? "All vehicles" : "Custom"}
                  </button>
                ))}
              </div>

              <div className="toolbar-right">
                {filter === "Custom" && (
                  <div className="custom-filter">
                    {(["Car", "Motorcycle", "Van", "Other"] as VehicleType[]).map((type) => (
                      <label key={type}>
                        <input
                          type="checkbox"
                          checked={customTypes.includes(type)}
                          onChange={(e) => setCustomTypes((current) =>
                            e.target.checked
                              ? [...current, type]
                              : current.filter((item) => item !== type)
                          )}
                        />
                        {type === "Motorcycle" ? "Bikes" : `${type}s`}
                      </label>
                    ))}
                  </div>
                )}

                <label className="search-box">
                  <span>⌕</span>
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search garage..." />
                </label>

                <label className="sort-select">
                  <span>Sort:</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value)}>
                    <option value="newest">Recently added</option>
                    <option value="name-az">Name A–Z</option>
                    <option value="name-za">Name Z–A</option>
                    <option value="mileage-low">Mileage: low to high</option>
                    <option value="mileage-high">Mileage: high to low</option>
                  </select>
                </label>
              </div>
            </div>

            {visibleVehicles.length ? (
              <div className="vehicle-grid">
                {visibleVehicles.map((vehicle) => (
                  <button
                    className="vehicle-card"
                    key={vehicle.id}
                    onClick={() => { setSelectedId(vehicle.id); setActiveTab("info"); }}
                  >
                    <div className={`vehicle-card-image ${vehicle.image ? "has-photo" : ""}`}>
                      {vehicle.image ? (
                        <img src={vehicle.image} alt={`${vehicle.make} ${vehicle.model}`} />
                      ) : (
                        <VehicleIllustration type={vehicle.type} />
                      )}
                      <span className="vehicle-type-pill">{vehicle.type}</span>
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
                  </button>
                ))}
              </div>
            ) : (
              <div className="garage-empty">
                <div className="empty-garage-illustration">
                  <VehicleIllustration type={filter === "Motorcycle" ? "Motorcycle" : filter === "Van" ? "Van" : "Car"} />
                </div>
                <h2>{vehicles.length ? "No vehicles match your filters" : "Your garage starts here"}</h2>
                <p>
                  {vehicles.length
                    ? "Try a different category or search term."
                    : "Add your car, bike, van or another vehicle to start keeping its records together."}
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
                  <option value="Van">Van</option>
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
    </div>
  );
}

export default App;
