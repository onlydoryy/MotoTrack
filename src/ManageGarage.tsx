import { useState } from "react";

type GarageVehicle = { id: string; make: string; model: string; registration: string; year: string; mileage: number; type: string };
type Props = { vehicles: GarageVehicle[]; onEdit: (id: string) => void; onDelete: (id: string) => void };

export default function ManageGarage({ vehicles, onEdit, onDelete }: Props) {
  const [expanded, setExpanded] = useState("");
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState("");
  return <>
    <h1>Manage garage</h1>
    {!vehicles.length && <p>Your garage is empty. Add a vehicle from My Garage.</p>}
    <div className="account-list">{vehicles.map(vehicle => {
      const title = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || vehicle.type;
      const summary = [title, vehicle.type, vehicle.registration, vehicle.mileage.toLocaleString() + " km"].filter(Boolean).join("\n");
      const open = expanded === vehicle.id;
      return <section className="account-row" key={vehicle.id}>
        <button className="vehicle-disclosure" type="button" aria-expanded={open} onClick={() => {
          setExpanded(open ? "" : vehicle.id); setSharing(false); setMessage("");
        }}><span><strong>{title}</strong><small>{vehicle.registration} · {vehicle.type}</small></span><span aria-hidden="true">{open ? "−" : "+"}</span></button>
        {open && <div className="row-actions">
          <button onClick={() => onEdit(vehicle.id)}>Edit</button>
          <button onClick={() => { setSharing(!sharing); setMessage(""); }}>Share</button>
          <button className="danger" onClick={() => onDelete(vehicle.id)}>Delete</button>
          {sharing && <div className="share-summary"><label>Vehicle summary<textarea readOnly value={summary} /></label>
            <button onClick={async () => {
              try {
                if (navigator.share) await navigator.share({ title, text: summary });
                else { await navigator.clipboard.writeText(summary); setMessage("Vehicle summary copied."); }
              } catch (err) { if (!(err instanceof Error && err.name === "AbortError")) setMessage("Select the summary above to copy it manually."); }
            }}>{typeof navigator.share === "function" ? "Share summary" : "Copy summary"}</button>
            <span role="status">{message}</span>
          </div>}
        </div>}
      </section>;
    })}</div>
  </>;
}
