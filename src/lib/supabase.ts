import { createClient } from "@supabase/supabase-js";

// Vite exposes only VITE_-prefixed variables to the browser.
// A missing configuration should display a useful setup screen, not crash the app at import time.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const hasSupabaseConfig = Boolean(
  supabaseUrl && supabaseKey && /^https:\/\/.+\.supabase\.co\/?$/.test(supabaseUrl),
);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl!, supabaseKey!)
  : null;
