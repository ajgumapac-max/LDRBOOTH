import { useCallback, useEffect, useRef, useState } from "react";

import ConnectionBanner from "./components/ConnectionBanner.jsx";
import Landing from "./components/Landing.jsx";
import ProfileForm from "./components/ProfileForm.jsx";
import Lobby from "./components/Lobby.jsx";
import FormatSelect from "./components/FormatSelect.jsx";
import ReadyScreen from "./components/ReadyScreen.jsx";
import Photobooth from "./components/Photobooth.jsx";
import SelectFavorites from "./components/SelectFavorites.jsx";
import BuildLayout from "./components/BuildLayout.jsx";
import StylePicker from "./components/StylePicker.jsx";
import FinalPreview from "./components/FinalPreview.jsx";
import Payment from "./components/Payment.jsx";
import Delivery from "./components/Delivery.jsx";
import CameraTile from "./components/CameraTile.jsx";

import { getSocket, emitAck } from "./services/socket.js";
import { createWebRTCSession } from "./services/webrtc.js";
import { finalizeBooth, fetchMyDelivery } from "./services/api.js";
import { renderFinalComposition } from "./utils/canvasRender.js";
import { findFormat } from "./data/formats.js";
import { findStyle } from "./data/styles.js";

export default function App() {
  // ---- navigation ----
  const [screen, setScreen] = useState("landing");
  const [profileMode, setProfileMode] = useState("create");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [banner, setBanner] = useState("");

  // ---- connection ----
  const [connectionStatus, setConnectionStatus] = useState("connecting");

  // ---- identity ----
  const [roomCode, setRoomCode] = useState("");
  const [myParticipantId, setMyParticipantId] = useState("");
  const [myUsername, setMyUsername] = useState("");
  const [myEmail, setMyEmail] = useState("");
  const [myRole, setMyRole] = useState("joiner");

  // ---- booth/room state ----
  const [participants, setParticipants] = useState([]);
  const [format, setFormat] = useState(null);
  const [totalShots, setTotalShots] = useState(10);

  // ---- capture ----
  const [currentShotIndex, setCurrentShotIndex] = useState(-1);
  const [currentPoseId, setCurrentPoseId] = useState(null);
  const [capturedShots, setCapturedShots] = useState([]); // [{index, poseName, image}]
  const [mySnapped, setMySnapped] = useState(false);
  const [cameraError, setCameraError] = useState("");

  // ---- selection ----
  const [mySelection, setMySelection] = useState([]);
  const [partnerSelection, setPartnerSelection] = useState([]);
  const [selectionsMatched, setSelectionsMatched] = useState(false);

  // ---- layout / style ----
  const [layoutOrder, setLayoutOrder] = useState([]);
  const [layoutCustomization, setLayoutCustomization] = useState({ borderColor: "#FBF3EC", borderThickness: 1, pattern: "none" });
  const [style, setStyle] = useState(null);
  const [finalImageUrl, setFinalImageUrl] = useState(null);
  const [finalImageLoading, setFinalImageLoading] = useState(false);

  // ---- payment ----
  const [paymentStatus, setPaymentStatus] = useState("idle");
  const [paymentStartedBy, setPaymentStartedBy] = useState(null); // {id, username}
  const [paymentMode, setPaymentMode] = useState("mock");
  const iConfirmedPayment = useRef(false);
  const finalizingDeliveryRef = useRef(false);

  // ---- delivery ----
  const [deliveryStatus, setDeliveryStatus] = useState("preparing");
  const [deliveryUrl, setDeliveryUrl] = useState(null);
  const [deliveryError, setDeliveryError] = useState("");

  // ---- webrtc / video ----
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const webrtcSessionRef = useRef(null);

  const socket = getSocket();

  // ---------------------------------------------------------------------
  // Socket lifecycle: connection status + every room event, wired once.
  // We never call socket.disconnect() here — only specific listeners are
  // removed on cleanup, so reconnection keeps working across re-renders.
  // ---------------------------------------------------------------------
  useEffect(() => {
    const onConnect = () => setConnectionStatus("connected");
    const onDisconnect = () => setConnectionStatus("disconnected");
    const onReconnectAttempt = () => setConnectionStatus("reconnecting");
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    if (socket.connected) setConnectionStatus("connected");

    const onParticipantJoined = ({ participants: list }) => setParticipants(list);
    const onParticipantLeft = ({ participants: list }) => {
      setParticipants(list);
      setBanner("Your partner left the booth.");
    };
    const onPartnerDisconnected = () => setBanner("Your partner disconnected — waiting for them to reconnect…");
    const onFormatUpdated = ({ format: f }) => {
      setFormat(f);
      // Whoever hasn't already moved past the format step (e.g. the joiner,
      // while the creator was the one who picked) follows along here.
      setScreen((s) => (["lobby", "format"].includes(s) ? "format" : s));
    };
    const onReadyStateUpdated = ({ participants: list }) => setParticipants(list);
    const onCaptureSessionStart = ({ totalShots: t }) => {
      setTotalShots(t);
      setCapturedShots([]);
      setScreen("photobooth");
    };
    const onCaptureRoundStart = ({ shotIndex, poseName }) => {
      setCurrentShotIndex(shotIndex);
      setCurrentPoseId(poseName);
      setMySnapped(false);
    };
    const onShotComplete = ({ shotIndex, image }) => {
      setCapturedShots((prev) => {
        const next = prev.filter((s) => s.index !== shotIndex);
        next.push({ index: shotIndex, poseName: currentPoseIdRef.current, image });
        return next.sort((a, b) => a.index - b.index);
      });
    };
    const onCaptureSessionComplete = ({ shots }) => {
      setCapturedShots(shots);
      setScreen("select");
    };
    const onSelectionUpdated = ({ selections }) => {
      const mine = selections[myParticipantIdRef.current] || [];
      setMySelection(mine);
      const partnerEntry = Object.entries(selections).find(([id]) => id !== myParticipantIdRef.current);
      setPartnerSelection(partnerEntry ? partnerEntry[1] : []);
    };
    const onSelectionMatched = ({ selectedShots }) => {
      setSelectionsMatched(true);
      setLayoutOrder(selectedShots);
      setScreen("layout");
    };
    const onPaymentStarted = ({ byParticipantId, byUsername }) => {
      setPaymentStatus("processing");
      setPaymentStartedBy({ id: byParticipantId, username: byUsername });
      setScreen((s) => (s === "preview" || s === "payment" ? "payment" : s));
    };
    const onPaymentSuccess = () => {
      setPaymentStatus("success");
      setDeliveryStatus("preparing");
      // Someone can still be arranging their own version when payment is
      // completed. Keep them in the editor until their composition is ready.
      setScreen((s) => (s === "payment" ? "delivery" : s));
    };
    const onPaymentFailed = ({ reason }) => {
      setPaymentStatus("idle");
      setBanner(reason || "Payment failed — please try again.");
    };
    const onDeliveryReady = async () => {
      if (iConfirmedPayment.current) return; // payer already has its own link from the API response
      try {
        const res = await fetchMyDelivery({ roomCode: roomCodeRef.current, participantId: myParticipantIdRef.current });
        setDeliveryUrl(res.downloadUrl);
        setDeliveryStatus("ready");
      } catch (err) {
        setDeliveryError(err.message);
        setDeliveryStatus("error");
      }
    };
    const onBoothError = ({ message }) => setBanner(message);

    socket.on("participant-joined", onParticipantJoined);
    socket.on("participant-left", onParticipantLeft);
    socket.on("partner-disconnected", onPartnerDisconnected);
    socket.on("format-updated", onFormatUpdated);
    socket.on("ready-state-updated", onReadyStateUpdated);
    socket.on("capture-session-start", onCaptureSessionStart);
    socket.on("capture-round-start", onCaptureRoundStart);
    socket.on("shot-complete", onShotComplete);
    socket.on("capture-session-complete", onCaptureSessionComplete);
    socket.on("selection-updated", onSelectionUpdated);
    socket.on("selection-matched", onSelectionMatched);
    socket.on("payment-started", onPaymentStarted);
    socket.on("payment-success", onPaymentSuccess);
    socket.on("payment-failed", onPaymentFailed);
    socket.on("delivery-ready", onDeliveryReady);
    socket.on("booth-error", onBoothError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.off("participant-joined", onParticipantJoined);
      socket.off("participant-left", onParticipantLeft);
      socket.off("partner-disconnected", onPartnerDisconnected);
      socket.off("format-updated", onFormatUpdated);
      socket.off("ready-state-updated", onReadyStateUpdated);
      socket.off("capture-session-start", onCaptureSessionStart);
      socket.off("capture-round-start", onCaptureRoundStart);
      socket.off("shot-complete", onShotComplete);
      socket.off("capture-session-complete", onCaptureSessionComplete);
      socket.off("selection-updated", onSelectionUpdated);
      socket.off("selection-matched", onSelectionMatched);
      socket.off("payment-started", onPaymentStarted);
      socket.off("payment-success", onPaymentSuccess);
      socket.off("payment-failed", onPaymentFailed);
      socket.off("delivery-ready", onDeliveryReady);
      socket.off("booth-error", onBoothError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refs mirroring state so long-lived socket closures always read current values.
  const myParticipantIdRef = useRef("");
  const roomCodeRef = useRef("");
  const currentPoseIdRef = useRef(null);
  useEffect(() => void (myParticipantIdRef.current = myParticipantId), [myParticipantId]);
  useEffect(() => void (roomCodeRef.current = roomCode), [roomCode]);
  useEffect(() => void (currentPoseIdRef.current = currentPoseId), [currentPoseId]);

  // ---------------------------------------------------------------------
  // WebRTC: start once both participants are in the room.
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (participants.length === 2 && !webrtcSessionRef.current && roomCode) {
      const isCreator = myRole === "creator";
      const session = createWebRTCSession({
        roomCode,
        isCreator,
        onRemoteStream: setRemoteStream,
        onConnectionStateChange: () => {},
        onError: setCameraError,
      });
      webrtcSessionRef.current = session;
      session
        .start()
        .then(setLocalStream)
        .catch(() => {});
      setScreen((s) => (s === "lobby" ? "format" : s));
    }
  }, [participants.length, roomCode, myRole]);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream, screen]);
  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream, screen]);

  useEffect(() => {
    return () => webrtcSessionRef.current?.close();
  }, []);

  // ---------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------
  const handleCreate = useCallback(async ({ username, email }) => {
    setSubmitting(true);
    setFormError("");
    const res = await emitAck("create-booth", { username, email });
    setSubmitting(false);
    if (!res.ok) return setFormError(res.error);
    setRoomCode(res.roomCode);
    setMyParticipantId(res.participantId);
    setMyUsername(username);
    setMyEmail(email);
    setMyRole("creator");
    setParticipants(res.state.participants);
    setScreen("lobby");
  }, []);

  const handleJoin = useCallback(async ({ username, email, roomCode: code }) => {
    setSubmitting(true);
    setFormError("");
    const res = await emitAck("join-booth", { username, email, roomCode: code });
    setSubmitting(false);
    if (!res.ok) return setFormError(res.error);
    setRoomCode(res.roomCode);
    setMyParticipantId(res.participantId);
    setMyUsername(username);
    setMyEmail(email);
    setMyRole("joiner");
    setParticipants(res.state.participants);
    setFormat(res.state.format);
    setScreen(res.state.participants.length === 2 ? "format" : "lobby");
  }, []);

  const handleChooseFormat = useCallback(
    async (formatId) => {
      const res = await emitAck("set-format", { roomCode, format: formatId });
      if (!res.ok) setBanner(res.error);
    },
    [roomCode]
  );

  const handleToggleReady = useCallback(
    async (ready) => {
      const res = await emitAck("set-ready", { roomCode, ready });
      if (!res.ok) setBanner(res.error);
      else setScreen("ready");
    },
    [roomCode]
  );

  // Enter the ready screen as soon as format has been chosen.
  useEffect(() => {
    if (format && screen === "format") setScreen("ready");
  }, [format, screen]);

  const handleCapture = useCallback(
    (dataUrl) => {
      setMySnapped(true);
      emitAck("capture-complete", { roomCode, shotIndex: currentShotIndex, imageDataUrl: dataUrl });
    },
    [roomCode, currentShotIndex]
  );

  const handleToggleSelection = useCallback(
    (index) => {
      setMySelection((prev) => {
        const has = prev.includes(index);
        const requiredCount = findFormat(format).shotsUsed;
        let next;
        if (has) next = prev.filter((i) => i !== index);
        else if (prev.length < requiredCount) next = [...prev, index];
        else next = prev;
        emitAck("submit-selection", { roomCode, selectedIndices: next });
        return next;
      });
    },
    [roomCode, format]
  );

  const handleChooseStyle = useCallback((styleId) => {
    setStyle(styleId);
    setScreen("preview");
  }, []);

  // Render the final composite whenever we land on the preview screen.
  useEffect(() => {
    if (screen !== "preview" || !style || layoutOrder.length === 0) return;
    let cancelled = false;
    setFinalImageLoading(true);
    const images = layoutOrder.map((idx) => capturedShots.find((s) => s.index === idx)?.image);
    renderFinalComposition({ images, format: findFormat(format), style: findStyle(style), frame: layoutCustomization })
      .then((url) => {
        if (!cancelled) setFinalImageUrl(url);
      })
      .finally(() => !cancelled && setFinalImageLoading(false));
    return () => {
      cancelled = true;
    };
  }, [screen, style, layoutOrder, capturedShots, format, layoutCustomization]);

  const handleStartPayment = useCallback(async () => {
    const res = await emitAck("start-payment", { roomCode });
    if (!res.ok) return setBanner(res.error);
    setPaymentMode(res.paymentMode);
    setPaymentStatus("processing");
    setPaymentStartedBy({ id: myParticipantId, username: myUsername });
  }, [roomCode, myParticipantId, myUsername]);

  const handleConfirmPayment = useCallback(
    async (reference) => {
      iConfirmedPayment.current = true;
      const res = await emitAck("confirm-payment", { roomCode, reference });
      if (!res.ok) setBanner(res.error);
    },
    [roomCode]
  );

  // Each participant uploads their own locally customized composition after payment.
  useEffect(() => {
    if (paymentStatus !== "success" || !finalImageUrl || finalizingDeliveryRef.current) return;
    finalizingDeliveryRef.current = true;
    finalizeBooth({ roomCode, participantId: myParticipantId, imageDataUrl: finalImageUrl })
      .then((res) => {
        setDeliveryUrl(res.downloadUrl);
        setDeliveryStatus("ready");
        setScreen("delivery");
      })
      .catch((err) => {
        setDeliveryError(err.message);
        setDeliveryStatus("error");
        finalizingDeliveryRef.current = false;
      });
  }, [paymentStatus, finalImageUrl, roomCode, myParticipantId]);

  function handlePrint() {
    window.print();
  }

  function startOver() {
    webrtcSessionRef.current?.close();
    webrtcSessionRef.current = null;
    emitAck("leave-booth", { roomCode });
    window.location.reload();
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  const partner = participants.find((p) => p.id !== myParticipantId);
  const requiredPicks = format ? findFormat(format).shotsUsed : 4;
  const orderedShots = layoutOrder.map((idx) => capturedShots.find((s) => s.index === idx)).filter(Boolean);

  return (
    <div className={`app-shell ${screen === "landing" ? "app-shell--landing" : ""}`}>
      <ConnectionBanner status={connectionStatus} />
      {banner && (
        <div className="dismissible-banner" onClick={() => setBanner("")}>
          {banner} <span className="dismissible-banner__x">✕</span>
        </div>
      )}
      {cameraError && (
        <div className="dismissible-banner dismissible-banner--error" onClick={() => setCameraError("")}>
          {cameraError} <span className="dismissible-banner__x">✕</span>
        </div>
      )}

      {/* Always-present hidden video sinks so the WebRTC stream keeps flowing
          even on screens that don't render CameraTile (they get shown once
          Photobooth mounts and reuses the same ref objects). */}

      {screen === "landing" && (
        <Landing
          onCreate={() => {
            setProfileMode("create");
            setScreen("profile");
          }}
          onJoin={() => {
            setProfileMode("join");
            setScreen("profile");
          }}
        />
      )}

      {screen === "profile" && (
        <ProfileForm
          mode={profileMode}
          submitting={submitting}
          error={formError}
          onBack={() => setScreen("landing")}
          onSubmit={profileMode === "create" ? handleCreate : handleJoin}
        />
      )}

      {screen === "lobby" && <Lobby roomCode={roomCode} myUsername={myUsername} />}

      {screen === "format" && (
        <FormatSelect
          isCreator={myRole === "creator"}
          selectedFormat={format}
          onChoose={handleChooseFormat}
          partnerUsername={partner?.username}
        />
      )}

      {screen === "ready" && (
        <ReadyScreen participants={participants} myParticipantId={myParticipantId} onToggleReady={handleToggleReady} />
      )}

      {screen === "photobooth" && (
        <Photobooth
          shotIndex={currentShotIndex}
          totalShots={totalShots}
          poseId={currentPoseId}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          myUsername={myUsername}
          partnerUsername={partner?.username}
          mySnapped={mySnapped}
          myRole={myRole}
          onCapture={handleCapture}
        />
      )}

      {screen === "select" && (
        <SelectFavorites
          shots={capturedShots}
          requiredCount={requiredPicks}
          mySelection={mySelection}
          partnerSelection={partnerSelection}
          matched={selectionsMatched}
          myUsername={myUsername}
          partnerUsername={partner?.username}
          onToggle={handleToggleSelection}
        />
      )}

      {screen === "layout" && (
        <BuildLayout
          orderedShots={orderedShots}
          format={findFormat(format)}
          customization={layoutCustomization}
          onContinue={(order, customization) => {
            setLayoutOrder(order);
            setLayoutCustomization(customization);
            setScreen("style");
          }}
        />
      )}

      {screen === "style" && (
        <StylePicker selected={style} previewImage={orderedShots[0]?.image} onChoose={handleChooseStyle} />
      )}

      {screen === "preview" && (
        <FinalPreview
          imageUrl={finalImageUrl}
          loading={finalImageLoading}
          onBack={() => setScreen("style")}
          onContinue={() => setScreen("payment")}
        />
      )}

      {screen === "payment" && (
        <Payment
          status={paymentStatus}
          startedByUsername={paymentStartedBy?.username}
          isStartedByMe={paymentStartedBy?.id === myParticipantId}
          myUsername={myUsername}
          paymentMode={paymentMode}
          onStartPayment={handleStartPayment}
          onConfirmPayment={handleConfirmPayment}
        />
      )}

      {screen === "delivery" && (
        <>
          <Delivery status={deliveryStatus} downloadUrl={deliveryUrl} error={deliveryError} myEmail={myEmail} onPrint={handlePrint} />
          {finalImageUrl && <img src={finalImageUrl} alt="" className="print-only" />}
        </>
      )}

      {screen !== "landing" && screen !== "profile" && (
        <button className="start-over-link" onClick={startOver}>
          Leave booth
        </button>
      )}
    </div>
  );
}
