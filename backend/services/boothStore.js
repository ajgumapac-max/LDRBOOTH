import { v4 as uuid } from "uuid";
import { poseForShot } from "../utils/poses.js";

// Ephemeral, in-memory session state — this is what Socket.IO events read
// and write live (ready state, capture progress, who's connected). Durable
// business records (booth existed, who selected what, payment happened)
// are separately persisted to Supabase via services/db.js. Losing this
// in-memory state on a server restart loses an in-progress *session*, not
// the historical record.
const rooms = new Map(); // roomCode -> room

const ROOM_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours, matches schema default

function generateRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
  let code = "";
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `LDR-${code}`;
}

export function createRoom({ dbId, totalShots = 10 }) {
  let roomCode = generateRoomCode();
  while (rooms.has(roomCode)) roomCode = generateRoomCode(); // extremely unlikely, but be safe

  const room = {
    roomCode,
    dbId, // Supabase booths.id, or null if not persisted
    status: "lobby", // lobby | format | ready | capturing | selecting | layout | style | payment | delivered
    format: null,
    totalShots,
    createdAt: Date.now(),
    expiresAt: Date.now() + ROOM_TTL_MS,
    participants: [], // { id, dbId, socketId, username, email, role, ready, connected }
    capture: {
      currentShot: -1,
      shots: [], // { index, poseName, images: { [participantId]: dataUrl } }
      inProgress: false,
    },
    selections: {}, // participantId -> number[]
    layout: { order: [], style: null, customization: { borderColor: "#FBF3EC", borderThickness: 1, pattern: "none" } },
    payment: { status: "pending", paidBy: null, reference: null },
  };
  rooms.set(roomCode, room);
  return room;
}

export function getRoom(roomCode) {
  return rooms.get(String(roomCode || "").toUpperCase()) || null;
}

export function deleteRoom(roomCode) {
  rooms.delete(roomCode);
}

export function isRoomExpired(room) {
  return Date.now() > room.expiresAt;
}

export function addParticipant(room, { dbId, username, email, role, socketId }) {
  const participant = {
    id: uuid(),
    dbId: dbId || null,
    socketId,
    username,
    email,
    role,
    ready: false,
    connected: true,
  };
  room.participants.push(participant);
  return participant;
}

export function findParticipantBySocket(room, socketId) {
  return room.participants.find((p) => p.socketId === socketId) || null;
}

export function findParticipantById(room, participantId) {
  return room.participants.find((p) => p.id === participantId) || null;
}

export function publicParticipants(room) {
  // Never leak email addresses to the other participant.
  return room.participants.map((p) => ({
    id: p.id,
    username: p.username,
    role: p.role,
    ready: p.ready,
    connected: p.connected,
  }));
}

export function allReady(room) {
  return room.participants.length === 2 && room.participants.every((p) => p.ready);
}

export function startCaptureRound(room, index) {
  room.capture.currentShot = index;
  room.capture.inProgress = true;
  const poseName = poseForShot(index, room.totalShots);
  room.capture.shots[index] = room.capture.shots[index] || { index, poseName, images: {} };
  room.capture.shots[index].poseName = poseName;
  return room.capture.shots[index];
}

export function recordCapture(room, participantId, shotIndex, imageDataUrl) {
  const shot = room.capture.shots[shotIndex];
  if (!shot) return null;
  shot.images[participantId] = imageDataUrl;
  return shot;
}

export function shotComplete(room, shotIndex) {
  const shot = room.capture.shots[shotIndex];
  if (!shot) return false;
  return room.participants.every((p) => Boolean(shot.images[p.id]));
}

export function canonicalShotImage(room, shotIndex) {
  const shot = room.capture.shots[shotIndex];
  if (!shot) return null;
  // Prefer the creator's composite (both cameras are visible in either
  // participant's canvas capture, so either works — creator is canonical
  // for consistency).
  const creator = room.participants.find((p) => p.role === "creator");
  if (creator && shot.images[creator.id]) return shot.images[creator.id];
  const any = Object.values(shot.images)[0];
  return any || null;
}

export function normalizeSelection(indices) {
  return [...new Set(indices)].sort((a, b) => a - b);
}

export function selectionsMatch(room) {
  const vals = Object.values(room.selections);
  if (vals.length < 2) return false;
  const [a, b] = vals.map(normalizeSelection);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function listRooms() {
  return rooms;
}
