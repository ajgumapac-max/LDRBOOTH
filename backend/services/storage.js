import { getSupabase, isSupabaseConfigured } from "./supabaseClient.js";

export const SHOTS_BUCKET = "shots";
export const FINAL_BUCKET = "final-photos";
const DEFAULT_SIGNED_URL_SECONDS = 60 * 60; // 1 hour, per spec

/**
 * Uploads a base64 data-URL (e.g. "data:image/jpeg;base64,....") to a
 * private Supabase Storage bucket. Returns the storage path.
 * Buckets must already exist and be PRIVATE (no public read) — see README.
 */
export async function uploadDataUrl({ bucket, path, dataUrl, contentType = "image/jpeg" }) {
  if (!isSupabaseConfigured()) {
    console.warn(`[storage] Supabase not configured — skipping upload of ${bucket}/${path}`);
    return { path, skipped: true };
  }
  const supabase = getSupabase();
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const buffer = Buffer.from(base64, "base64");

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`[storage] upload failed (${bucket}/${path}): ${error.message}`);
  return { path, skipped: false };
}

/**
 * Creates a signed, time-limited URL for a private object.
 */
export async function createSignedUrl({ bucket, path, expiresInSeconds = DEFAULT_SIGNED_URL_SECONDS }) {
  if (!isSupabaseConfigured()) {
    console.warn(`[storage] Supabase not configured — cannot sign URL for ${bucket}/${path}`);
    return null;
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw new Error(`[storage] signing failed (${bucket}/${path}): ${error.message}`);
  return data.signedUrl;
}
