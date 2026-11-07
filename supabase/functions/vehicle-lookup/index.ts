// Server-side registration lookup. Deploy with Supabase; set REGCHECK_USERNAME as an Edge Function secret.
import { withSupabase } from "jsr:@supabase/server@^1";
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export default {
  fetch: withSupabase({ auth: "user" }, async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: { registration?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const plate = typeof body.registration === "string"
    ? body.registration.toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
  if (!/^[0-9]{2,3}[A-Z]{1,2}[0-9]{1,6}$/.test(plate)) return json({ error: "Invalid Irish registration" }, 400);
  const username = Deno.env.get("REGCHECK_USERNAME");
  if (!username) return json({ error: "Lookup not configured" }, 503);

  try {
    // The documented CheckIreland HTTP/XML endpoint only requires a username.
    // Keep it on the server so the paid account cannot be used directly from browsers.
    const endpoint = new URL("https://www.carregistrationapi.ie/api/reg.asmx/CheckIreland");
    endpoint.searchParams.set("RegistrationNumber", plate);
    endpoint.searchParams.set("username", username);
    const upstream = await fetch(endpoint, { signal: AbortSignal.timeout(12000) });
    if (!upstream.ok) return json({ error: "Lookup unavailable" }, 502);
    const xml = await upstream.text();
    const match = xml.match(/<vehicleJson(?:\s[^>]*)?>([\s\S]*?)<\/vehicleJson>/i);
    if (!match) return json({ error: "Vehicle not found or invalid provider response" }, 404);
    let embedded = match[1].trim();
    if (embedded.startsWith("<![CDATA[") && embedded.endsWith("]]>")) {
      embedded = embedded.slice(9, -3);
    } else {
      embedded = embedded.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    }
    const raw = JSON.parse(embedded);
    const field = (value: unknown) => typeof value === "string" ? value :
      value && typeof value === "object" && "CurrentTextValue" in value
        ? String(value.CurrentTextValue ?? "") : "";
    const known = (value: unknown) => {
      const result = field(value).trim();
      return /^(?:unknown|n\/a|not available|null|undefined)$/i.test(result) ? "" : result;
    };
    const positiveInteger = (value: unknown) => {
      const text = known(value).replace(/\s*cc$/i, "");
      return /^\d+$/.test(text) && Number(text) > 0 ? text : "";
    };
    const make = field(raw.MakeDescription) || field(raw.CarMake);
    const model = field(raw.ModelDescription) || field(raw.CarModel);
    if (!make || !model) return json({ error: "No vehicle details found" }, 404);
    return json({
      make, model,
      year: field(raw.RegistrationYear) || field(raw.ManufactureYearFrom),
      colour: known(raw.Colour) || known(raw.Color),
      engineSizeCc: positiveInteger(raw.EngineSize),
      fuelType: known(raw.FuelType),
      transmission: known(raw.Transmission),
      bodyStyle: known(raw.BodyStyle),
      numberOfDoors: positiveInteger(raw.NumberOfDoors),
      numberOfSeats: positiveInteger(raw.NumberOfSeats),
      vin: known(raw.VIN) || known(raw.VechileIdentificationNumber),
      engineNumber: known(raw.Engine) || known(raw.EngineNumber),
      registrationCounty: known(raw.County),
    });
  } catch {
    return json({ error: "Vehicle lookup failed" }, 502);
  }
  }),
};
