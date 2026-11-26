import { FunctionsHttpError } from "@supabase/supabase-js";
import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "./lib/supabase";

type GarageVehicle = { id: string; make: string; model: string; registration: string; year: string; type: string };
type Props = { vehicles: GarageVehicle[]; onEdit: (id: string) => void; onDelete: (id: string) => void };

function ShareVehicleForm({ vehicleId, onCancel }: { vehicleId: string; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  async function sendCopy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || result || !supabase) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("recipient") ?? "").trim();

    setError("");
    setBusy(true);
    try {
      const response = await supabase.functions.invoke<{ alreadyShared: boolean }>("share-vehicle", {
        body: {
          vehicleId, email,
          includeReceipts: form.has("receipts"),
          includeDocuments: form.has("documents"),
        },
      });
      if (response.error) throw response.error;
      setResult(response.data?.alreadyShared
        ? `A copy was already sent to ${email}.`
        : `Copy sent to ${email}. It will appear in their garage.`);
    } catch (err) {
      let message = "The copy could not be sent. Try again.";
      if (err instanceof FunctionsHttpError) {
        const body = await err.context.json().catch(() => null);
        if (typeof body?.error === "string") message = body.error;
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return <form className="share-vehicle-form" onSubmit={sendCopy}>
    <p>The buyer gets their own copy of the vehicle details, photo and service history. Your copy stays in your garage.</p>
    <fieldset disabled={busy || Boolean(result)}>
      <label className="share-recipient">
        Buyer’s MotoTrack email
        <input name="recipient" type="email" autoComplete="off" maxLength={254} required />
      </label>
      <label><input name="receipts" type="checkbox" defaultChecked /> Include service receipt photos</label>
      <label><input name="documents" type="checkbox" defaultChecked /> Include vehicle documents and folders</label>
      <small>Review any personal details in the vehicle notes, receipts and documents before sending.</small>
    </fieldset>
    {error && <p className="auth-feedback auth-error" role="alert">{error}</p>}
    {result && <p className="auth-feedback auth-success" role="status">{result}</p>}
    <div className="row-actions">
      {!result && <button type="submit" disabled={busy}>{busy ? "Sending copy…" : "Send copy"}</button>}
      <button type="button" onClick={onCancel} disabled={busy}>{result ? "Done" : "Cancel"}</button>
    </div>
  </form>;
}

export default function ManageGarage({ vehicles, onEdit, onDelete }: Props) {
  const [expanded, setExpanded] = useState("");
  const [sharing, setSharing] = useState(false);
  return <>
    <h1>Manage garage</h1>
    {!vehicles.length && <p>Your garage is empty. Add a vehicle from My Garage.</p>}
    <div className="account-list">{vehicles.map(vehicle => {
      const title = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || vehicle.type;
      const open = expanded === vehicle.id;
      return <section className="account-row" key={vehicle.id}>
        <button className="vehicle-disclosure" type="button" aria-expanded={open} onClick={() => {
          setExpanded(open ? "" : vehicle.id);
          setSharing(false);
        }}><span><strong>{title}</strong><small>{[vehicle.registration, vehicle.type].filter(Boolean).join(" · ")}</small></span><span aria-hidden="true">{open ? "−" : "+"}</span></button>
        {open && <div className="row-actions">
          <button type="button" onClick={() => onEdit(vehicle.id)}>Edit</button>
          <button type="button" aria-expanded={sharing} onClick={() => setSharing(!sharing)}>Share</button>
          <button type="button" className="danger" onClick={() => onDelete(vehicle.id)}>Delete</button>
          {sharing && <ShareVehicleForm vehicleId={vehicle.id} onCancel={() => setSharing(false)} />}
        </div>}
      </section>;
    })}</div>
  </>;
}
