import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

export type VehicleOffer = {
  id: string;
  make: string;
  model: string;
  colour: string;
  registration: string;
  sender_name: string;
};

export function useVehicleOffers(accountId: string) {
  const [offers, setOffers] = useState<VehicleOffer[]>([]);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const requestVersion = useRef(0);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    let loading = false;

    async function refresh() {
      if (document.hidden || loading) return;
      const version = requestVersion.current;
      loading = true;
      try {
        const { data, error } = await client!.rpc("pending_mototrack_vehicle_shares");
        if (active && version === requestVersion.current && !error && Array.isArray(data)) {
          setOffers(data as VehicleOffer[]);
        }
      } catch {
        // A later refresh can recover from a temporary connection failure.
      } finally {
        loading = false;
      }
    }

    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [accountId]);

  async function accept(id: string) {
    if (!supabase || accepting) return false;
    setAccepting(id);
    setError("");
    try {
      const { error } = await supabase.rpc("accept_mototrack_vehicle_share", { share_id: id });
      if (error) throw error;
      requestVersion.current++;
      setOffers((current) => current.filter((offer) => offer.id !== id));
      return true;
    } catch {
      setError("Could not add this vehicle. Try again.");
      return false;
    } finally {
      setAccepting(null);
    }
  }

  return { offers, accepting, error, accept };
}
