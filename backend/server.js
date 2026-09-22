import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { v4 as uuid } from "uuid";

import * as store from "./services/boothStore.js";
import * as db from "./services/db.js";
import { uploadDataUrl, createSignedUrl, FINAL_BUCKET } from "./services/storage.js";
import { sendDeliveryEmail } from "./services/email.js";
import { confirmPayment, getPaymentMode } from "./services/payment.js";

const PORT = process.env.PORT || 3001;
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

  console.log("[CORS] Allowed frontend origins:", FRONTEND_ORIGINS);

const app = express();
app.use(cors({ origin: FRONTEND_ORIGINS, credentials: true }));
app.use(express.json({ limit: "15mb" })); // final composite images are base64 JPEGs

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: FRONTEND_ORIGINS, credentials: true },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roomState(room) {
  return {
    roomCode: room.roomCode,
    status: room.status,
    format: room.format,
    totalShots: room.totalShots,
    participants: store.publicParticipants(room),
  };
}

function requireRoom(roomCode, ack) {
  const room = store.getRoom(roomCode);
  if (!room) {
    ack?.({ ok: false, error: "This booth no longer exists." });
    return null;
  }
  if (store.isRoomExpired(room)) {
    ack?.({ ok: false, error: "This booth has expired." });
    return null;
  }
  return room;
}

function otherParticipant(room, participantId) {
  return room.participants.find((p) => p.id !== participantId) || null;
}

// A little safety wrapper so one bad event handler can't crash the process
// or silently hang a client waiting on an ack that never comes.
function safeHandler(fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error("[socket] handler error:", err);
      const ack = args[args.length - 1];
      if (typeof ack === "function") ack({ ok: false, error: "Something went wrong on the server." });
    }
  };
}

// ---------------------------------------------------------------------------
// Socket.IO — every event below has a matching handler; keep this list in
// sync with frontend/src/services/socket.js if you add new events.
// ---------------------------------------------------------------------------

io.on("connection", (socket) => {
  socket.data.roomCode = null;
  socket.data.participantId = null;

  // ---- CREATE ----
  socket.on(
    "create-booth",
    safeHandler(async ({ username, email, format }, ack) => {
      username = String(username || "").trim().slice(0, 40);
      email = String(email || "").trim().slice(0, 120);
      if (!username || !email || !/^\S+@\S+\.\S+$/.test(email)) {
        return ack({ ok: false, error: "A valid name and email are required." });
      }

      const user = await db.upsertUser({ username, email });
      // Generate the room before persistence so the required, unique
      // booths.room_code column receives the same code used by Socket.IO.
      const room = store.createRoom({ dbId: null, totalShots: 10 });
      const boothRecord = await db.createBooth({ roomCode: room.roomCode, creatorUserId: user.id, totalShots: 10 });
      room.dbId = boothRecord.id;
      if (room.dbId) await db.updateBoothStatus(room.dbId, "lobby");
      room.format = format || null;

      const participant = store.addParticipant(room, {
        dbId: null,
        username,
        email,
        role: "creator",
        socketId: socket.id,
      });
      const partDb = await db.addParticipant({
        boothDbId: room.dbId,
        userId: user.id,
        username,
        email,
        role: "creator",
      });
      participant.dbId = partDb.id;

      socket.join(room.roomCode);
      socket.data.roomCode = room.roomCode;
      socket.data.participantId = participant.id;

      ack({ ok: true, roomCode: room.roomCode, participantId: participant.id, state: roomState(room) });
    })
  );

  // ---- JOIN ----
  socket.on(
    "join-booth",
    safeHandler(async ({ username, email, roomCode }, ack) => {
      username = String(username || "").trim().slice(0, 40);
      email = String(email || "").trim().slice(0, 120);
      if (!username || !email || !/^\S+@\S+\.\S+$/.test(email)) {
        return ack({ ok: false, error: "A valid name and email are required." });
      }
      const room = requireRoom(roomCode, ack);
      if (!room) return;
      if (room.participants.length >= 2) {
        return ack({ ok: false, error: "This booth already has two people in it." });
      }

      const user = await db.upsertUser({ username, email });
      const participant = store.addParticipant(room, {
        dbId: null,
        username,
        email,
        role: "joiner",
        socketId: socket.id,
      });
      const partDb = await db.addParticipant({
        boothDbId: room.dbId,
        userId: user.id,
        username,
        email,
        role: "joiner",
      });
      participant.dbId = partDb.id;

      socket.join(room.roomCode);
      socket.data.roomCode = room.roomCode;
      socket.data.participantId = participant.id;

      ack({ ok: true, roomCode: room.roomCode, participantId: participant.id, state: roomState(room) });
      io.to(room.roomCode).emit("participant-joined", { participants: store.publicParticipants(room) });
    })
  );

  // ---- WEBRTC SIGNALING (relay only — video itself stays peer-to-peer) ----
  socket.on("webrtc-offer", ({ roomCode, sdp }) => {
    socket.to(roomCode).emit("webrtc-offer", { sdp, from: socket.data.participantId });
  });
  socket.on("webrtc-answer", ({ roomCode, sdp }) => {
    socket.to(roomCode).emit("webrtc-answer", { sdp, from: socket.data.participantId });
  });
  socket.on("webrtc-ice-candidate", ({ roomCode, candidate }) => {
    socket.to(roomCode).emit("webrtc-ice-candidate", { candidate, from: socket.data.participantId });
  });

  // ---- FORMAT (creator picks, partner receives) ----
  socket.on(
    "set-format",
    safeHandler(async ({ roomCode, format }, ack) => {
      const room = requireRoom(roomCode, ack);
      if (!room) return;
      const participant = store.findParticipantBySocket(room, socket.id);
      if (!participant || participant.role !== "creator") {
        return ack?.({ ok: false, error: "Only the booth creator can set the format." });
      }
      room.format = format;
      room.status = "format";
      if (room.dbId) await db.updateBoothStatus(room.dbId, "format", { format });
      io.to(room.roomCode).emit("format-updated", { format });
      ack?.({ ok: true });
    })
  );

  // ---- READY ----
  socket.on(
    "set-ready",
    safeHandler(async ({ roomCode, ready }, ack) => {
      const room = requireRoom(roomCode, ack);
      if (!room) return;
      const participant = store.findParticipantBySocket(room, socket.id);
      if (!participant) return ack?.({ ok: false, error: "You're not part of this booth." });
      participant.ready = Boolean(ready);
      io.to(room.roomCode).emit("ready-state-updated", { participants: store.publicParticipants(room) });
      ack?.({ ok: true });

      if (store.allReady(room) && !room.capture.inProgress) {
        room.status = "capturing";
        if (room.dbId) await db.updateBoothStatus(room.dbId, "capturing");
        io.to(room.roomCode).emit("capture-session-start", { totalShots: room.totalShots });
        beginRound(room, 0);
      }
    })
  );

  // ---- CAPTURE ----
  socket.on(
    "capture-complete",
    safeHandler(async ({ roomCode, shotIndex, imageDataUrl }, ack) => {
      const room = requireRoom(roomCode, ack);
      if (!room) return;
      const participant = store.findParticipantBySocket(room, socket.id);
      if (!participant) return ack?.({ ok: false, error: "You're not part of this booth." });
      if (shotIndex !== room.capture.currentShot) {
        // Stale/late submission for a round that already advanced — ignore.
        return ack?.({ ok: true, stale: true });
      }
      store.recordCapture(room, participant.id, shotIndex, imageDataUrl);
      ack?.({ ok: true });

      if (store.shotComplete(room, shotIndex)) {
        const image = store.canonicalShotImage(room, shotIndex);
        io.to(room.roomCode).emit("shot-complete", { shotIndex, image });

        const nextIndex = shotIndex + 1;
        if (nextIndex < room.totalShots) {
          setTimeout(() => beginRound(room, nextIndex), 900); // brief beat before next pose
        } else {
          room.capture.inProgress = false;
          room.status = "selecting";
          if (room.dbId) await db.updateBoothStatus(room.dbId, "selecting");
          const shots = room.capture.shots.map((s) => ({
            index: s.index,
            poseName: s.poseName,
            image: store.canonicalShotImage(room, s.index),
          }));
          io.to(room.roomCode).emit("capture-session-complete", { shots });
        }
      }
    })
  );

  function beginRound(room, index) {
    const shot = store.startCaptureRound(room, index);
    io.to(room.roomCode).emit("capture-round-start", {
      shotIndex: index,
      poseName: shot.poseName,
      totalShots: room.totalShots,
    });
  }

  // ---- SELECTION ----
  socket.on(
    "submit-selection",
    safeHandler(async ({ roomCode, selectedIndices }, ack) => {
      const room = requireRoom(roomCode, ack);
      if (!room) return;
      const participant = store.findParticipantBySocket(room, socket.id);
      if (!participant) return ack?.({ ok: false, error: "You're not part of this booth." });

      const normalized = store.normalizeSelection(selectedIndices || []);
      room.selections[participant.id] = normalized;
      await db.saveSelection({ boothDbId: room.dbId, participantDbId: participant.dbId, selectedShots: normalized });
      ack?.({ ok: true });

      io.to(room.roomCode).emit("selection-updated", { selections: room.selections });

      if (store.selectionsMatch(room)) {
        room.status = "layout";
        if (room.dbId) await db.updateBoothStatus(room.dbId, "layout");
        io.to(room.roomCode).emit("selection-matched", {
          selectedShots: Object.values(room.selections)[0],
        });
      }
    })
  );

  // ---- LAYOUT ----
  socket.on(
    "update-layout",
    safeHandler(async ({ roomCode, order, customization }, ack) => {
      const room = requireRoom(roomCode, ack);
      if (!room) return;
      room.layout.order = order;
      if (customization) room.layout.customization = customization;
      await db.saveLayout({ boothDbId: room.dbId, photoOrder: order, format: room.format, style: room.layout.style });
      io.to(room.roomCode).emit("layout-updated", { order, customization: room.layout.customization });
      ack?.({ ok: true });
    })
  );

  // ---- STYLE ----
  socket.on(
    "set-style",
    safeHandler(async ({ roomCode, style }, ack) => {
      const room = requireRoom(roomCode, ack);
      if (!room) return;
      room.layout.style = style;
      room.status = "style";
      if (room.dbId) await db.updateBoothStatus(room.dbId, "style");
      await db.saveLayout({ boothDbId: room.dbId, photoOrder: room.layout.order, format: room.format, style });
      io.to(room.roomCode).emit("style-updated", { style });
      ack?.({ ok: true });
    })
  );

  // ---- PAYMENT ----
  socket.on(
    "start-payment",
    safeHandler(async ({ roomCode }, ack) => {
      const room = requireRoom(roomCode, ack);
      if (!room) return;
      const participant = store.findParticipantBySocket(room, socket.id);
      if (!participant) return ack?.({ ok: false, error: "You're not part of this booth." });
      room.payment.status = "processing";
      room.payment.paidBy = participant.id;
      room.status = "payment";
      if (room.dbId) await db.updateBoothStatus(room.dbId, "payment");
      io.to(room.roomCode).emit("payment-started", {
        byParticipantId: participant.id,
        byUsername: participant.username,
      });
      ack?.({ ok: true, paymentMode: getPaymentMode() });
    })
  );

  socket.on(
    "confirm-payment",
    safeHandler(async ({ roomCode, reference }, ack) => {
      const room = requireRoom(roomCode, ack);
      if (!room) return;
      const participant = store.findParticipantBySocket(room, socket.id);
      if (!participant) return ack?.({ ok: false, error: "You're not part of this booth." });

      const result = await confirmPayment({ reference });
      if (!result.ok) {
        room.payment.status = "failed";
        io.to(room.roomCode).emit("payment-failed", { reason: result.reason });
        return ack?.({ ok: false, error: result.reason });
      }
      room.payment.status = "success";
      room.payment.reference = result.reference;
      await db.createPayment({
        boothDbId: room.dbId,
        paidByParticipantId: participant.dbId,
        status: "success",
        reference: result.reference,
      });
      io.to(room.roomCode).emit("payment-success", { reference: result.reference });
      ack?.({ ok: true });
    })
  );

  // ---- LEAVE / DISCONNECT ----
  socket.on("leave-booth", ({ roomCode }) => handleLeave(socket, roomCode));

  socket.on("disconnect", () => {
    if (socket.data.roomCode) handleLeave(socket, socket.data.roomCode, true);
  });

  function handleLeave(sock, roomCode, isDisconnect = false) {
    const room = store.getRoom(roomCode);
    if (!room) return;
    const participant = store.findParticipantBySocket(room, sock.id);
    if (!participant) return;

    if (isDisconnect) {
      participant.connected = false;
      socket.to(room.roomCode).emit("partner-disconnected", { participantId: participant.id });
    } else {
      room.participants = room.participants.filter((p) => p.id !== participant.id);
      sock.leave(room.roomCode);
      socket.to(room.roomCode).emit("participant-left", { participants: store.publicParticipants(room) });
    }

    // Clean up empty rooms.
    const stillConnected = room.participants.some((p) => p.connected);
    if (room.participants.length === 0 || !stillConnected) {
      setTimeout(() => {
        const r = store.getRoom(roomCode);
        if (r && !r.participants.some((p) => p.connected)) store.deleteRoom(roomCode);
      }, 5 * 60 * 1000); // grace period in case of a quick reconnect
    }
  }
});

// ---------------------------------------------------------------------------
// HTTP API
// ---------------------------------------------------------------------------

app.get("/health", (_req, res) => res.json({ ok: true, paymentMode: getPaymentMode() }));

// Generates the final composite image (uploaded already-rendered from the
// client's <canvas>, per spec — the server never re-renders it) and creates
// a private, expiring delivery for BOTH participants. Only one client needs
// to call this; the other participant fetches their own link separately via
// GET /api/delivery below.
app.post("/api/finalize", async (req, res) => {
  try {
    const { roomCode, participantId, imageDataUrl } = req.body || {};
    const room = store.getRoom(roomCode);
    if (!room) return res.status(404).json({ ok: false, error: "Booth not found." });
    const participant = room.participants.find((item) => item.id === participantId);
    if (!participant) return res.status(403).json({ ok: false, error: "You're not part of this booth." });
    if (room.payment.status !== "success") {
      return res.status(403).json({ ok: false, error: "Payment has not been confirmed yet." });
    }
    if (!imageDataUrl) return res.status(400).json({ ok: false, error: "Missing final image." });

    const path = `${room.dbId || room.roomCode}/${participantId}/final.jpg`;
    await uploadDataUrl({ bucket: FINAL_BUCKET, path, dataUrl: imageDataUrl });

    room.deliveries = room.deliveries || {};
    const expiresAtMs = Date.now() + 60 * 60 * 1000;
    const expiresAtIso = new Date(expiresAtMs).toISOString();

    // Each participant uploads the version they personally arranged and styled.
    const signedUrl = await createSignedUrl({ bucket: FINAL_BUCKET, path });
    const token = uuid();
    const deliveryRecord = await db.createDelivery({
      boothDbId: room.dbId,
      participantDbId: participant.dbId,
      storagePath: path,
      downloadToken: token,
      expiresAt: expiresAtIso,
    });
    room.deliveries[participant.id] = { downloadUrl: signedUrl, expiresAtMs, token };
    const emailResult = await sendDeliveryEmail({
      to: participant.email,
      username: participant.username,
      downloadUrl: signedUrl || "(storage unavailable)",
    });
    if (deliveryRecord.id) await db.markDeliveryEmailStatus(deliveryRecord.id, emailResult.status);

    room.status = "delivered";
    if (room.dbId) await db.updateBoothStatus(room.dbId, "delivered");
    io.to(participant.socketId).emit("delivery-ready", { participantId });
    return res.json({ ok: true, downloadUrl: signedUrl || null, expiresAt: expiresAtIso });

    for (const participant of room.participants) {
      const signedUrl = await createSignedUrl({ bucket: FINAL_BUCKET, path });
      const token = uuid();
      const deliveryRecord = await db.createDelivery({
        boothDbId: room.dbId,
        participantDbId: participant.dbId,
        storagePath: path,
        downloadToken: token,
        expiresAt: expiresAtIso,
      });
      room.deliveries[participant.id] = { downloadUrl: signedUrl, expiresAtMs, token };

      const emailResult = await sendDeliveryEmail({
        to: participant.email,
        username: participant.username,
        downloadUrl: signedUrl || "(storage not configured — see server logs)",
      });
      if (deliveryRecord.id) await db.markDeliveryEmailStatus(deliveryRecord.id, emailResult.status);
    }

    room.status = "delivered";
    if (room.dbId) await db.updateBoothStatus(room.dbId, "delivered");
    io.to(room.roomCode).emit("delivery-ready", {});

    const mine = room.deliveries[participantId];
    res.json({ ok: true, downloadUrl: mine?.downloadUrl || null, expiresAt: expiresAtIso });
  } catch (err) {
    console.error("[api/finalize] failed:", err);
    res.status(500).json({ ok: false, error: "Could not finalize your photos." });
  }
});

// Lets a participant fetch (or re-fetch, e.g. after a refresh) their own
// private download link. Never returns the other participant's link.
app.get("/api/delivery/:roomCode/:participantId", (req, res) => {
  const { roomCode, participantId } = req.params;
  const room = store.getRoom(roomCode);
  if (!room || !room.deliveries || !room.deliveries[participantId]) {
    return res.status(404).json({ ok: false, error: "Your photos aren't ready yet." });
  }
  const delivery = room.deliveries[participantId];
  if (Date.now() > delivery.expiresAtMs) {
    return res.status(410).json({ ok: false, error: "This photo link has expired." });
  }
  res.json({ ok: true, downloadUrl: delivery.downloadUrl, expiresAt: new Date(delivery.expiresAtMs).toISOString() });
});

// ---------------------------------------------------------------------------
// Periodic cleanup of expired rooms
// ---------------------------------------------------------------------------
setInterval(() => {
  for (const [code, room] of store.listRooms()) {
    if (store.isRoomExpired(room)) store.deleteRoom(code);
  }
}, 10 * 60 * 1000);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`LDRBOOTH backend listening on 0.0.0.0:${PORT} (payment mode: ${getPaymentMode()})`);
});
