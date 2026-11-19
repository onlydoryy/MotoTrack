import type { ReactNode } from "react";
import type { Vehicle, Tab } from "./App";
import Icon from "./InterfaceIcon";

type OpenVehicle = (vehicle: Vehicle, tab?: Tab, recordId?: string) => void;
type HeadingProps = { vehicles: Vehicle[]; onAdd: () => void; onOpen: OpenVehicle };
type CollectionProps = {
  vehicles: Vehicle[];
  onOpen: OpenVehicle;
  onFavourite: (id: string) => void;
  picture: (vehicle: Vehicle) => ReactNode;
};

function vehicleName(v: Vehicle) { return [v.make, v.model].filter(Boolean).join(" ") || v.type; }

function Favourite({ vehicle, toggle }: { vehicle: Vehicle; toggle: (id: string) => void }) {
  return <button type="button" className="fav" aria-pressed={Boolean(vehicle.favorite)}
    aria-label={`${vehicle.favorite ? "Remove" : "Add"} ${vehicleName(vehicle)} ${vehicle.favorite ? "from" : "to"} favourites`}
    onClick={() => toggle(vehicle.id)}><Icon name="star" /></button>;
}

function AddVehicle({ onAdd }: { onAdd: () => void }) {
  return <button type="button" className="design-primary" onClick={onAdd}><Icon name="plus" />Add vehicle</button>;
}
function displayDate(date: string) {
  return new Intl.DateTimeFormat("en-IE", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date + "T12:00:00"));
}
function validDate(date: string) { return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date + "T12:00:00")); }

export function GarageHeader({ vehicles, onAdd, onOpen }: HeadingProps) {
  const entries = vehicles.flatMap(v => v.serviceRecords.filter(r => validDate(r.date)).map(record => ({ v, record })))
    .sort((a, b) => b.record.date.localeCompare(a.record.date)).slice(0, 3);
  const dates = vehicles.flatMap(v => [
    { v, label: "Motor tax", date: v.taxExpiry },
    ...(v.type === "Motorcycle" ? [] : [{ v, label: v.type === "Commercial" ? "CVRT" : "Vehicle test", date: v.testExpiry }]),
  ]).filter(item => validDate(item.date)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return <>
    <header className="journal-heading"><div><h1>Garage logbook</h1><p>{vehicles.length} {vehicles.length === 1 ? "vehicle" : "vehicles"} on file</p></div><AddVehicle onAdd={onAdd} /></header>
    <div className="journal-panels">
      <section><h2><Icon name="clock" />Recent maintenance</h2>
        {entries.length ? entries.map(({v,record}) => <button className="journal-entry" key={v.id + record.id} onClick={() => onOpen(v, "service", record.id)}>
          <span><small>{displayDate(record.date)} · {record.kind || "Service"}</small><strong>{record.description || record.items?.join(", ") || "Maintenance entry"}</strong><small>{vehicleName(v)}</small></span><Icon name="arrow" />
        </button>) : <p>Service and repair entries appear here when you record work on a vehicle.</p>}
      </section>
      <section><h2><Icon name="calendar" />Renewal dates</h2>
        {dates.length ? dates.map(({v,label,date}) => <button className="journal-entry" key={v.id + label} onClick={() => onOpen(v)}>
          <span><small>{vehicleName(v)}</small><strong>{label}</strong><small>{new Date(date + "T00:00:00") < today ? "Expired " : "Due "}{displayDate(date)}</small></span><Icon name="arrow" />
        </button>) : <p>Add a tax or test expiry on a vehicle to see its renewal date here.</p>}
      </section>
    </div>
    <h2 className="collection-title">Vehicle index</h2>
  </>;
}

export function VehicleCollection({ vehicles, onOpen, onFavourite, picture }: CollectionProps) {
  return <ul className="index-grid">{vehicles.map(v => <li key={v.id}>
    <div className="index-heading"><span className="index-photo">{picture(v)}</span><div><small>{[v.year, v.type].filter(Boolean).join(" · ")}</small><button onClick={() => onOpen(v)}>{vehicleName(v)}</button></div><Favourite vehicle={v} toggle={onFavourite} /></div>
    <div className="index-metadata"><span>{v.registration || "Registration unrecorded"}</span><strong>{v.mileage.toLocaleString("en-IE")} km</strong></div>
    <footer><button onClick={() => onOpen(v, "service")}><Icon name="tools" />History</button><button onClick={() => onOpen(v, "documents")}><Icon name="documents" />Documents</button></footer>
  </li>)}</ul>;
}
