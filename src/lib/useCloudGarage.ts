import { useEffect, useRef, useState } from "react";
import { garageError, importGarage, loadGarage, removeVehicle, saveVehicle } from "./cloudGarage";
import { legacyGarageKey, legacyVehicles } from "./legacyGarage";
import type { Vehicle } from "./garageTypes";

export function useCloudGarage(accountId: string) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [ready, setReady] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [legacy, setLegacy] = useState(() => {
    try {
      const raw = localStorage.getItem(legacyGarageKey);
      const records = raw ? legacyVehicles(raw) : [];
      return raw && records.length ? { raw, records } : null;
    } catch {
      return null;
    }
  });
  const writing = useRef(false);

  useEffect(() => {
    let active = true;
    void loadGarage(accountId).then((loaded) => {
      if (!active) return;
      setVehicles(loaded);
      setReady(true);
    }).catch((err: unknown) => {
      if (active) setError(garageError(err));
    });
    return () => { active = false; };
  }, [accountId, loadAttempt]);

  function reload() {
    setError("");
    setReady(false);
    setLoadAttempt((attempt) => attempt + 1);
  }

  async function perform(operation: () => Promise<void>) {
    if (!ready || writing.current) return false;
    writing.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
      return true;
    } catch (err) {
      setError(garageError(err));
      return false;
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }

  function save(next: Vehicle) {
    return perform(async () => {
      const previous = vehicles.find((vehicle) => vehicle.id === next.id);
      const saved = await saveVehicle(accountId, next, previous);
      setVehicles((current) => previous
        ? current.map((vehicle) => vehicle.id === saved.id ? saved : vehicle)
        : [...current, saved]);
    });
  }

  function remove(vehicle: Vehicle) {
    return perform(async () => {
      await removeVehicle(accountId, vehicle);
      setVehicles((current) => current.filter(({ id }) => id !== vehicle.id));
    });
  }

  function importLocal() {
    if (!legacy) return;
    void perform(async () => {
      if (localStorage.getItem(legacyGarageKey) !== legacy.raw) {
        setLegacy(null);
        throw new Error("The browser records have changed. Refresh the page to check for records to import.");
      }
      await importGarage(accountId, legacy.records, vehicles);
      const loaded = await loadGarage(accountId);
      setVehicles(loaded);
      try {
        if (localStorage.getItem(legacyGarageKey) === legacy.raw) localStorage.removeItem(legacyGarageKey);
      } catch {
        // Stable imported IDs allow a retry if browser storage is unavailable.
      }
      setLegacy(null);
    });
  }

  return { vehicles, ready, busy, error, reload, save, remove, perform, importLocal, legacyCount: legacy?.records.length ?? 0 };
}
