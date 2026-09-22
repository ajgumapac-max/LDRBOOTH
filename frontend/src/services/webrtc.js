import { getSocket } from "./socket.js";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/**
 * Wraps a single RTCPeerConnection for the two-person booth. Live video
 * flows directly peer-to-peer; Socket.IO is only used to exchange the
 * offer/answer/ICE candidates (see server.js webrtc-* relay handlers).
 *
 * roomCode: the booth this session belongs to (candidates/offers are
 * scoped to it so a stray event from another room is never applied).
 * isCreator: the creator always initiates the offer, to avoid both sides
 * racing to create one.
 */
export function createWebRTCSession({ roomCode, isCreator, onRemoteStream, onConnectionStateChange, onError }) {
  const socket = getSocket();
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  let localStream = null;
  let closed = false;

  pc.ontrack = (event) => {
    if (event.streams && event.streams[0]) onRemoteStream?.(event.streams[0]);
  };
  pc.onicecandidate = (event) => {
    if (event.candidate) socket.emit("webrtc-ice-candidate", { roomCode, candidate: event.candidate });
  };
  pc.onconnectionstatechange = () => {
    onConnectionStateChange?.(pc.connectionState);
  };

  async function attachLocalStream() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true,
      });
    } catch (err) {
      onError?.(describeCameraError(err));
      throw err;
    }
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    return localStream;
  }

  async function createOffer() {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("webrtc-offer", { roomCode, sdp: offer });
  }

  async function handleRemoteOffer(sdp) {
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("webrtc-answer", { roomCode, sdp: answer });
  }

  async function handleRemoteAnswer(sdp) {
    if (pc.signalingState === "have-local-offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  }

  async function handleRemoteIce(candidate) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      // Benign if it arrives before the remote description is set — ignore.
    }
  }

  function onOfferEvent({ sdp }) {
    handleRemoteOffer(sdp).catch((err) => onError?.("Couldn't connect to your partner's camera."));
  }
  function onAnswerEvent({ sdp }) {
    handleRemoteAnswer(sdp).catch(() => {});
  }
  function onIceEvent({ candidate }) {
    handleRemoteIce(candidate);
  }

  socket.on("webrtc-offer", onOfferEvent);
  socket.on("webrtc-answer", onAnswerEvent);
  socket.on("webrtc-ice-candidate", onIceEvent);

  async function start() {
    const stream = await attachLocalStream();
    if (isCreator) await createOffer();
    return stream;
  }

  function close() {
    if (closed) return;
    closed = true;
    socket.off("webrtc-offer", onOfferEvent);
    socket.off("webrtc-answer", onAnswerEvent);
    socket.off("webrtc-ice-candidate", onIceEvent);
    localStream?.getTracks().forEach((t) => t.stop());
    pc.getSenders().forEach((s) => s.track && s.track.stop());
    pc.close();
  }

  return { start, close, get localStream() { return localStream; }, pc };
}

function describeCameraError(err) {
  if (err?.name === "NotAllowedError") {
    return "We couldn't access your camera. Please allow camera access and try again.";
  }
  if (err?.name === "NotFoundError") {
    return "No camera was found on this device.";
  }
  if (err?.name === "NotReadableError") {
    return "Your camera seems to be in use by another app.";
  }
  return "We couldn't access your camera. Please allow camera access and try again.";
}
