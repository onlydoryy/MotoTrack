// Server-side registration lookup. Deploy with Supabase; set REGCHECK_USERNAME and REGCHECK_API_KEY as secrets.
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
  }),
};
