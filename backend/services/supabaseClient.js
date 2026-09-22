import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

if (url && serviceKey) {
  supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
} else {
  console.warn(
    "[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — " +
      "running without persistence. Live sockets still work for local " +
      "testing, but nothing will be saved to Postgres or Storage."
  );
}

export function isSupabaseConfigured() {
  return supabase !== null;
}

export function getSupabase() {
  return supabase;
}
