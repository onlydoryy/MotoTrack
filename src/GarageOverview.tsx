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
export function GarageHeader({ vehicles, onAdd }: HeadingProps) {
  const favourites = vehicles.filter(v => v.favorite).length;
  return <><header className="showroom-cover"><div>
    <h1>My garage</h1><p>{vehicles.length} {vehicles.length === 1 ? "vehicle" : "vehicles"} <span aria-hidden="true">/</span> {favourites} {favourites === 1 ? "favourite" : "favourites"}</p>
    <AddVehicle onAdd={onAdd} />
  </div></header><h2 className="collection-title">Your collection</h2></>;
}

export function VehicleCollection({ vehicles, onOpen, onFavourite, picture }: CollectionProps) {
  return <ul className="showroom-grid">{vehicles.map(v => <li key={v.id}>
    <div className="poster-image"><button className="poster-cover" aria-label={`Open ${vehicleName(v)}`} onClick={() => onOpen(v)}>{picture(v)}</button>
    <span className="poster-type">{v.type}</span><Favourite vehicle={v} toggle={onFavourite} /></div>
    <div className="poster-caption"><span>{[v.year, v.registration].filter(Boolean).join(" · ") || "Vehicle"}</span>
      <button className="poster-name" onClick={() => onOpen(v)}>{vehicleName(v)}<Icon name="arrow" /></button>
      <footer><span>{v.mileage.toLocaleString("en-IE")} km</span><button onClick={() => onOpen(v, "service")}>Service history</button></footer>
    </div></li>)}</ul>;
}
