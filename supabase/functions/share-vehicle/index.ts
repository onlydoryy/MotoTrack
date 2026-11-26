import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const respond = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers });
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type SharePlan = { id: string; done: boolean; files: Array<{ old_path: string; new_path: string }> };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return respond({ error: "Method not allowed." }, 405);

  const token = request.headers.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return respond({ error: "Sign in to share a vehicle." }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return respond({ error: "Vehicle sharing is temporarily unavailable." }, 503);

  try {
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user?.email_confirmed_at) {
      return respond({ error: "Sign in with a verified MotoTrack account." }, 401);
    }

    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (typeof body?.vehicleId !== "string" || !uuid.test(body.vehicleId) || email.length > 254 || !emailPattern.test(email)) {
      return respond({ error: "Enter a valid recipient email address." }, 400);
    }
    if (email === auth.user.email?.toLowerCase()) {
      return respond({ error: "Enter the buyer’s email address." }, 400);
    }

    const sender = auth.user.id;
    const planResult = await admin.rpc("prepare_mototrack_vehicle_share", {
      sender, source: body.vehicleId, recipient_email: email,
      include_receipts: body.includeReceipts === true, include_documents: body.includeDocuments === true,
    });
    if (planResult.error?.message === "INVALID_RECIPIENT") {
      return respond({ error: "Use the email address of the buyer’s verified MotoTrack account." }, 400);
    }
    if (planResult.error?.message === "VEHICLE_UNAVAILABLE") {
      return respond({ error: "This vehicle is unavailable to share." }, 404);
    }
    if (planResult.error) throw planResult.error;
    const plan = planResult.data as SharePlan;
    if (plan.done) return respond({ alreadyShared: true });

    const bucket = admin.storage.from("mototrack-files");
    const concurrency = 6;
    for (let index = 0; index < plan.files.length; index += concurrency) {
      await Promise.all(plan.files.slice(index, index + concurrency).map(async ({ old_path, new_path }) => {
        const copy = await bucket.copy(old_path, new_path);
        if (copy.error) {
          // A retry may already have copied this immutable destination file.
          const existing = await bucket.exists(new_path);
          if (existing.error || !existing.data) throw copy.error;
        }
      }));
    }
    const { error } = await admin.rpc("finish_mototrack_vehicle_share", { sender, share_id: plan.id });
    if (error) throw error;
    return respond({ alreadyShared: false });
  } catch (error) {
    console.error("Vehicle share failed", error instanceof Error ? error.name : "database error");
    return respond({ error: "The copy could not be completed. Try sharing again." }, 500);
  }
});
