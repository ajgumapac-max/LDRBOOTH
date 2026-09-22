const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function handle(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function finalizeBooth({ roomCode, participantId, imageDataUrl }) {
  const res = await fetch(`${API_URL}/api/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomCode, participantId, imageDataUrl }),
  });
  return handle(res);
}

export async function fetchMyDelivery({ roomCode, participantId }) {
  const res = await fetch(`${API_URL}/api/delivery/${encodeURIComponent(roomCode)}/${encodeURIComponent(participantId)}`);
  return handle(res);
}
