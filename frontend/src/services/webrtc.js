import { getSocket } from "./socket.js";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export function createWebRTCSession({
  roomCode,
  isCreator,
  onRemoteStream,
  onConnectionStateChange,
  onError,
}) {
  const socket = getSocket();

  const pc = new RTCPeerConnection({
    iceServers: ICE_SERVERS,
  });

  let localStream = null;
  let closed = false;

  /*
  |--------------------------------------------------------------------------
  | ICE queue
  |--------------------------------------------------------------------------
  | Candidates can arrive before the remote SDP description.
  | Never throw them away — store them and apply them once
  | setRemoteDescription() has completed.
  |--------------------------------------------------------------------------
  */
  const pendingIceCandidates = [];

  let remoteDescriptionSet = false;

  /*
  |--------------------------------------------------------------------------
  | Remote stream
  |--------------------------------------------------------------------------
  */
  pc.ontrack = (event) => {
    const stream =
      event.streams && event.streams[0];

    if (!stream) {
      return;
    }

    console.log(
      "[WebRTC] Remote stream received",
      {
        roomCode,
        streamId: stream.id,
        tracks: stream
          .getTracks()
          .map((track) => ({
            kind: track.kind,
            readyState: track.readyState,
            enabled: track.enabled,
          })),
      }
    );

    onRemoteStream?.(stream);
  };

  /*
  |--------------------------------------------------------------------------
  | ICE candidate generation
  |--------------------------------------------------------------------------
  */
  pc.onicecandidate = (event) => {
    if (!event.candidate || closed) {
      return;
    }

    socket.emit(
      "webrtc-ice-candidate",
      {
        roomCode,
        candidate: event.candidate,
      }
    );
  };

  /*
  |--------------------------------------------------------------------------
  | Connection state
  |--------------------------------------------------------------------------
  */
  pc.onconnectionstatechange = () => {
    const state =
      pc.connectionState;

    console.log(
      "[WebRTC] Connection state:",
      state,
      roomCode
    );

    onConnectionStateChange?.(state);

    if (
      state === "failed" ||
      state === "closed"
    ) {
      console.warn(
        "[WebRTC] Peer connection failed/closed"
      );
    }
  };

  pc.oniceconnectionstatechange = () => {
    console.log(
      "[WebRTC] ICE state:",
      pc.iceConnectionState,
      roomCode
    );
  };

  pc.onsignalingstatechange = () => {
    console.log(
      "[WebRTC] Signaling state:",
      pc.signalingState,
      roomCode
    );
  };

  /*
  |--------------------------------------------------------------------------
  | Local camera
  |--------------------------------------------------------------------------
  */
  async function attachLocalStream() {
    try {
      localStream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: {
              ideal: 720,
            },
            height: {
              ideal: 1280,
            },
          },
          audio: true,
        });

      console.log(
        "[WebRTC] Local camera acquired",
        roomCode
      );
    } catch (err) {
      onError?.(
        describeCameraError(err)
      );

      throw err;
    }

    localStream
      .getTracks()
      .forEach((track) => {
        pc.addTrack(
          track,
          localStream
        );
      });

    return localStream;
  }

  /*
  |--------------------------------------------------------------------------
  | Flush queued ICE candidates
  |--------------------------------------------------------------------------
  */
  async function flushPendingIce() {
    if (!remoteDescriptionSet) {
      return;
    }

    while (
      pendingIceCandidates.length
    ) {
      const candidate =
        pendingIceCandidates.shift();

      try {
        await pc.addIceCandidate(
          candidate
        );

        console.log(
          "[WebRTC] Queued ICE candidate applied"
        );
      } catch (err) {
        console.warn(
          "[WebRTC] Failed to apply queued ICE candidate:",
          err
        );
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Create offer
  |--------------------------------------------------------------------------
  */
  async function createOffer() {
    if (closed) {
      return;
    }

    console.log(
      "[WebRTC] Creating offer",
      roomCode
    );

    const offer =
      await pc.createOffer();

    await pc.setLocalDescription(
      offer
    );

    console.log(
      "[WebRTC] Sending offer",
      roomCode
    );

    socket.emit(
      "webrtc-offer",
      {
        roomCode,
        sdp: pc.localDescription,
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Handle incoming offer
  |--------------------------------------------------------------------------
  */
  async function handleRemoteOffer(
    sdp
  ) {
    if (closed) {
      return;
    }

    console.log(
      "[WebRTC] Offer received",
      roomCode
    );

    await pc.setRemoteDescription(
      new RTCSessionDescription(
        sdp
      )
    );

    remoteDescriptionSet = true;

    await flushPendingIce();

    const answer =
      await pc.createAnswer();

    await pc.setLocalDescription(
      answer
    );

    console.log(
      "[WebRTC] Sending answer",
      roomCode
    );

    socket.emit(
      "webrtc-answer",
      {
        roomCode,
        sdp: pc.localDescription,
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Handle incoming answer
  |--------------------------------------------------------------------------
  */
  async function handleRemoteAnswer(
    sdp
  ) {
    if (closed) {
      return;
    }

    console.log(
      "[WebRTC] Answer received",
      roomCode
    );

    if (
      pc.signalingState !==
      "have-local-offer"
    ) {
      console.warn(
        "[WebRTC] Ignoring answer because signaling state is:",
        pc.signalingState
      );

      return;
    }

    await pc.setRemoteDescription(
      new RTCSessionDescription(
        sdp
      )
    );

    remoteDescriptionSet = true;

    await flushPendingIce();
  }

  /*
  |--------------------------------------------------------------------------
  | Handle incoming ICE
  |--------------------------------------------------------------------------
  */
  async function handleRemoteIce(
    candidate
  ) {
    if (closed || !candidate) {
      return;
    }

    const iceCandidate =
      new RTCIceCandidate(
        candidate
      );

    /*
     * Critical fix:
     * If remote SDP isn't ready yet, QUEUE the candidate.
     */
    if (!remoteDescriptionSet) {
      console.log(
        "[WebRTC] Queueing ICE candidate"
      );

      pendingIceCandidates.push(
        iceCandidate
      );

      return;
    }

    try {
      await pc.addIceCandidate(
        iceCandidate
      );
    } catch (err) {
      console.warn(
        "[WebRTC] Failed to add ICE candidate:",
        err
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Socket event handlers
  |--------------------------------------------------------------------------
  */
  function onOfferEvent({
    sdp,
  }) {
    handleRemoteOffer(
      sdp
    ).catch((err) => {
      console.error(
        "[WebRTC] Offer handling failed:",
        err
      );

      onError?.(
        "Couldn't connect to your partner's camera."
      );
    });
  }

  function onAnswerEvent({
    sdp,
  }) {
    handleRemoteAnswer(
      sdp
    ).catch((err) => {
      console.error(
        "[WebRTC] Answer handling failed:",
        err
      );

      onError?.(
        "Your partner's camera connection failed."
      );
    });
  }

  function onIceEvent({
    candidate,
  }) {
    handleRemoteIce(
      candidate
    );
  }

  socket.on(
    "webrtc-offer",
    onOfferEvent
  );

  socket.on(
    "webrtc-answer",
    onAnswerEvent
  );

  socket.on(
    "webrtc-ice-candidate",
    onIceEvent
  );

  /*
  |--------------------------------------------------------------------------
  | Start
  |--------------------------------------------------------------------------
  */
  async function start() {
    if (closed) {
      throw new Error(
        "WebRTC session is already closed."
      );
    }

    const stream =
      await attachLocalStream();

    /*
     * Do NOT create an offer immediately here.
     *
     * The caller (App) will start the creator after
     * both peers have had a chance to create their
     * WebRTC listeners.
     */
    if (isCreator) {
      /*
       * Small signaling delay prevents the creator
       * from firing an offer before the joiner's
       * socket event listeners are ready.
       */
      setTimeout(() => {
        if (!closed) {
          createOffer().catch(
            (err) => {
              console.error(
                "[WebRTC] Offer creation failed:",
                err
              );

              onError?.(
                "Couldn't start the camera connection."
              );
            }
          );
        }
      }, 500);
    }

    return stream;
  }

  /*
  |--------------------------------------------------------------------------
  | Close
  |--------------------------------------------------------------------------
  */
  function close() {
    if (closed) {
      return;
    }

    closed = true;

    socket.off(
      "webrtc-offer",
      onOfferEvent
    );

    socket.off(
      "webrtc-answer",
      onAnswerEvent
    );

    socket.off(
      "webrtc-ice-candidate",
      onIceEvent
    );

    pendingIceCandidates.length = 0;

    localStream
      ?.getTracks()
      .forEach((track) =>
        track.stop()
      );

    pc.getSenders()
      .forEach((sender) => {
        if (sender.track) {
          sender.track.stop();
        }
      });

    pc.close();

    console.log(
      "[WebRTC] Session closed",
      roomCode
    );
  }

  return {
    start,
    close,

    get localStream() {
      return localStream;
    },

    pc,
  };
}

function describeCameraError(
  err
) {
  if (
    err?.name ===
    "NotAllowedError"
  ) {
    return "We couldn't access your camera. Please allow camera access and try again.";
  }

  if (
    err?.name ===
    "NotFoundError"
  ) {
    return "No camera was found on this device.";
  }

  if (
    err?.name ===
    "NotReadableError"
  ) {
    return "Your camera seems to be in use by another app.";
  }

  return "We couldn't access your camera. Please allow camera access and try again.";
}