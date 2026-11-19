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
export function GarageHeader({ vehicles, onAdd, onOpen }: HeadingProps) {
  const latest = vehicles.flatMap(vehicle => vehicle.serviceRecords.map(record => ({ vehicle, record })))
    .sort((a, b) => b.record.date.localeCompare(a.record.date))[0];
  const historyCount = vehicles.reduce((n, v) => n + v.serviceRecords.length, 0);
  return <>
    <header className="desk-heading"><div><h1>Garage overview</h1><p>{vehicles.length} {vehicles.length === 1 ? "vehicle" : "vehicles"} in your workshop</p></div><AddVehicle onAdd={onAdd} /></header>
    <div className="work-stats">
      <a href="#manage-garage"><Icon name="garage" /><span>Vehicles<strong>{vehicles.length}</strong></span><Icon name="arrow" /></a>
      <div><Icon name="tools" /><span>Service &amp; repair records<strong>{historyCount}</strong></span></div>
      {latest ? <button onClick={() => onOpen(latest.vehicle, "service", latest.record.id)}><Icon name="clock" /><span>Latest work<strong>{vehicleName(latest.vehicle)}</strong><small>{latest.record.date}</small></span><Icon name="arrow" /></button>
        : <div><Icon name="clock" /><span>Latest work<strong className="no-work">No entries yet</strong></span></div>}
    </div>
    <h2 className="collection-title">Vehicle register</h2>
  </>;
}

export function VehicleCollection({ vehicles, onOpen, onFavourite, picture }: CollectionProps) {
  return <ul className="register">{vehicles.map(v => <li key={v.id}>
    <button className="register-vehicle" onClick={() => onOpen(v)}><span className="register-image">{picture(v)}</span><span><strong>{vehicleName(v)}</strong><small>{[v.year, v.type].filter(Boolean).join(" · ")}</small></span></button>
    <div className="register-meta"><span>Registration</span><strong>{v.registration || "Unrecorded"}</strong></div>
    <div className="register-meta"><span>Mileage</span><strong>{v.mileage.toLocaleString("en-IE")} km</strong></div>
    <div className="register-actions"><button onClick={() => onOpen(v, "service")} aria-label={`Service history for ${vehicleName(v)}`}><Icon name="tools" /><span>History</span></button><Favourite vehicle={v} toggle={onFavourite} /></div>
  </li>)}</ul>;
}
