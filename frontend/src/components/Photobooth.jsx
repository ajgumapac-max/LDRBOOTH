import { useEffect, useRef, useState } from "react";
import CameraTile from "./CameraTile.jsx";
import PoseIllustration from "./PoseIllustration.jsx";
import { findPose } from "../data/poses.js";
import { captureVideoPairToDataUrl } from "../utils/canvasRender.js";

const COUNT_FROM = 3;

export default function Photobooth({
  shotIndex,
  totalShots,
  poseId,
  localVideoRef,
  remoteVideoRef,
  myUsername,
  partnerUsername,
  mySnapped,
  partnerSnapped,
  onCapture,
}) {
  const [count, setCount] = useState(COUNT_FROM);
  const [snap, setSnap] = useState(false);
  const capturedForRound = useRef(-1);
  const pose = findPose(poseId);

  useEffect(() => {
    setCount(COUNT_FROM);
    setSnap(false);
    capturedForRound.current = -1;

    const tick = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          clearInterval(tick);
          setSnap(true);
          if (capturedForRound.current !== shotIndex) {
            capturedForRound.current = shotIndex;
            const dataUrl = captureVideoPairToDataUrl(localVideoRef.current, remoteVideoRef.current);
            onCapture(dataUrl);
          }
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shotIndex]);

  return (
    <div className="screen photobooth">
      <div className="photobooth__header">
        <span className="shot-counter">
          SHOT {shotIndex + 1} / {totalShots}
        </span>
        <h2 className="pose-name">{pose.label}</h2>
        <p className="pose-instruction">{pose.instruction}</p>
      </div>

      <PoseIllustration poseId={pose.id} className="pose-illustration" />

      <div className="camera-grid">
        <CameraTile
          ref={localVideoRef}
          username={myUsername}
          muted
          mirrored
          status={{ text: mySnapped ? "Captured" : "Live", tone: mySnapped ? "captured" : "live" }}
        />
        <CameraTile
          ref={remoteVideoRef}
          username={partnerUsername}
          status={{ text: partnerSnapped ? "Captured" : "Live", tone: partnerSnapped ? "captured" : "live" }}
        />
      </div>

      <div className="countdown" aria-live="polite">
        {snap ? <span className="countdown__snap">SNAP!</span> : <span className="countdown__number">{count}</span>}
      </div>
    </div>
  );
}
