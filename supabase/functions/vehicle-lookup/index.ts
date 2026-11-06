// Server-side registration lookup. Deploy with Supabase; set REGCHECK_USERNAME and REGCHECK_API_KEY as secrets.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!token || !url || !anonKey) return json({ error: "Unauthorised" }, 401);
  const client = createClient(url, anonKey);
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) return json({ error: "Unauthorised" }, 401);

  let body: { registration?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const plate = typeof body.registration === "string"
    ? body.registration.toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
  if (!/^[0-9]{2,3}[A-Z]{1,2}[0-9]{1,6}$/.test(plate)) return json({ error: "Invalid Irish registration" }, 400);
  const username = Deno.env.get("REGCHECK_USERNAME");
  const apiKey = Deno.env.get("REGCHECK_API_KEY");
  if (!username || !apiKey) return json({ error: "Lookup not configured" }, 503);

  try {
    const upstream = await fetch(
      "https://www.regcheck.org.uk/api/json.aspx/CheckIreland/" + encodeURIComponent(plate),
      { headers: { Authorization: "Basic " + btoa(username + ":" + apiKey) }, signal: AbortSignal.timeout(12000) },
    );
    if (!upstream.ok) return json({ error: "Lookup unavailable or not found" }, 502);
    const raw = await upstream.json();
    const field = (value: unknown) => typeof value === "string" ? value :
      value && typeof value === "object" && "CurrentTextValue" in value
        ? String(value.CurrentTextValue ?? "") : "";
    const make = field(raw.MakeDescription) || field(raw.CarMake);
    const model = field(raw.ModelDescription) || field(raw.CarModel);
    if (!make || !model) return json({ error: "No vehicle details found" }, 404);
    return json({
      make, model,
      year: field(raw.RegistrationYear) || field(raw.ManufactureYearFrom),
      colour: field(raw.Colour) || field(raw.Color),
    });
  } catch {
    return json({ error: "Vehicle lookup failed" }, 502);
  }
});
