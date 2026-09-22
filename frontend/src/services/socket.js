import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

let socket = null;

/**
 * Returns a single shared, lazily-created socket. Auto-reconnects by
 * default (socket.io's built-in backoff) — we never manually disconnect
 * this from a component cleanup effect (that's the #1 way to silently
 * kill the app's connection). Call disconnectSocket() explicitly and only
 * when the person is intentionally leaving a booth.
 */
export function getSocket() {
  if (socket) return socket;
  socket = io(API_URL, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Emits an event and waits for the ack callback, with a timeout so the UI
 * never hangs forever on a dropped request. Resolves { ok:false, error }
 * on timeout rather than throwing, so callers can just check `.ok`.
 */
export function emitAck(event, payload, timeoutMs = 8000) {
  const s = getSocket();
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, error: "The server didn't respond in time. Check your connection and try again." });
    }, timeoutMs);

    s.emit(event, payload, (response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(response ?? { ok: false, error: "No response from server." });
    });
  });
}
