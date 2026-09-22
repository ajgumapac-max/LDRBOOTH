import { getSupabase, isSupabaseConfigured } from "./supabaseClient.js";

// Every function here degrades gracefully (logs + returns null) when
// Supabase isn't configured, so the app is still testable locally without
// a Supabase project — persistence just won't happen. See README for
// what that means for TESTED vs REQUIRES-EXTERNAL-SERVICE.

function guard(label, fallback = null) {
  if (!isSupabaseConfigured()) {
    console.warn(`[db] skipping "${label}" — Supabase not configured`);
    return fallback;
  }
  return undefined; // means "not skipped"
}

export async function upsertUser({ username, email }) {
  const skip = guard("upsertUser");
  if (skip !== undefined) return { id: null, username, email };
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .insert({ username, email })
    .select()
    .single();
  if (error) {
    console.error("[db] upsertUser failed:", error.message);
    return { id: null, username, email };
  }
  return data;
}

export async function createBooth({ roomCode, creatorUserId, totalShots }) {
  const skip = guard("createBooth");
  if (skip !== undefined) return { id: null, room_code: roomCode };
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("booths")
    .insert({ room_code: roomCode, creator_user_id: creatorUserId, total_shots: totalShots })
    .select()
    .single();
  if (error) {
    console.error("[db] createBooth failed:", error.message);
    return { id: null, room_code: roomCode };
  }
  return data;
}

export async function updateBoothStatus(boothDbId, status, extra = {}) {
  const skip = guard("updateBoothStatus");
  if (skip !== undefined || !boothDbId) return;
  const supabase = getSupabase();
  const { error } = await supabase.from("booths").update({ status, ...extra }).eq("id", boothDbId);
  if (error) console.error("[db] updateBoothStatus failed:", error.message);
}

export async function addParticipant({ boothDbId, userId, username, email, role }) {
  const skip = guard("addParticipant");
  if (skip !== undefined) return { id: null, username, email, role };
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("participants")
    .insert({ booth_id: boothDbId, user_id: userId, username, email, role })
    .select()
    .single();
  if (error) {
    console.error("[db] addParticipant failed:", error.message);
    return { id: null, username, email, role };
  }
  return data;
}

export async function saveSelection({ boothDbId, participantDbId, selectedShots }) {
  const skip = guard("saveSelection");
  if (skip !== undefined || !boothDbId || !participantDbId) return;
  const supabase = getSupabase();
  const { error } = await supabase
    .from("photo_selections")
    .upsert(
      { booth_id: boothDbId, participant_id: participantDbId, selected_shots: selectedShots, updated_at: new Date().toISOString() },
      { onConflict: "booth_id,participant_id" }
    );
  if (error) console.error("[db] saveSelection failed:", error.message);
}

export async function saveLayout({ boothDbId, photoOrder, format, style }) {
  const skip = guard("saveLayout");
  if (skip !== undefined || !boothDbId) return;
  const supabase = getSupabase();
  const { error } = await supabase
    .from("layouts")
    .upsert(
      { booth_id: boothDbId, photo_order: photoOrder, format, style, updated_at: new Date().toISOString() },
      { onConflict: "booth_id" }
    );
  if (error) console.error("[db] saveLayout failed:", error.message);
}

export async function createPayment({ boothDbId, paidByParticipantId, status, reference }) {
  const skip = guard("createPayment");
  if (skip !== undefined) return { id: null };
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("payments")
    .insert({ booth_id: boothDbId, paid_by: paidByParticipantId, status, reference })
    .select()
    .single();
  if (error) {
    console.error("[db] createPayment failed:", error.message);
    return { id: null };
  }
  return data;
}

export async function createDelivery({ boothDbId, participantDbId, storagePath, downloadToken, expiresAt }) {
  const skip = guard("createDelivery");
  if (skip !== undefined) return { id: null };
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("deliveries")
    .insert({
      booth_id: boothDbId,
      participant_id: participantDbId,
      storage_path: storagePath,
      download_token: downloadToken,
      expires_at: expiresAt,
    })
    .select()
    .single();
  if (error) {
    console.error("[db] createDelivery failed:", error.message);
    return { id: null };
  }
  return data;
}

export async function markDeliveryEmailStatus(deliveryDbId, status) {
  const skip = guard("markDeliveryEmailStatus");
  if (skip !== undefined || !deliveryDbId) return;
  const supabase = getSupabase();
  const { error } = await supabase.from("deliveries").update({ email_status: status }).eq("id", deliveryDbId);
  if (error) console.error("[db] markDeliveryEmailStatus failed:", error.message);
}

export async function getDeliveryByToken(token) {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase.from("deliveries").select("*").eq("download_token", token).single();
  if (error) return null;
  return data;
}
