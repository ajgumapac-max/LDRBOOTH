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
  myRole,
  onCapture,
}) {
  const [count, setCount] = useState(COUNT_FROM);
  const [snap, setSnap] = useState(false);
  const capturedForRound = useRef(-1);
  const pose = findPose(poseId);
  const creatorIsMe = myRole === "creator";
  console.log(
  "[PHOTOBOOTH ROLE]",
  {
    myRole,
    creatorIsMe,
  }
);

  const leftVideoRef = creatorIsMe
    ? localVideoRef
    : remoteVideoRef;

  const rightVideoRef = creatorIsMe
    ? remoteVideoRef
    : localVideoRef;

  const leftUsername = creatorIsMe
    ? myUsername
    : partnerUsername;

  const rightUsername = creatorIsMe
    ? partnerUsername
    : myUsername;

  const leftMirrored = true;
const rightMirrored = true;

  useEffect(() => {
    setCount(COUNT_FROM);
    setSnap(false);
    capturedForRound.current = -1;

    let flashTimer = null;

    const tick = setInterval(() => {
      setCount((currentCount) => {
        if (currentCount <= 1) {
          clearInterval(tick);

          setSnap(true);

          if (capturedForRound.current !== shotIndex) {
            capturedForRound.current = shotIndex;

            const dataUrl =
              captureVideoPairToDataUrl(
                leftVideoRef.current,
                rightVideoRef.current,
                {
                  mirrorA: leftMirrored,
                  mirrorB: rightMirrored,
                }
              );

            onCapture(dataUrl);
          }

          flashTimer = setTimeout(() => {
            setSnap(false);
          }, 450);

          return 0;
        }

        return currentCount - 1;
      });
    }, 1000);

    return () => {
      clearInterval(tick);

      if (flashTimer) {
        clearTimeout(flashTimer);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shotIndex]);

  return (
    <div className="screen photobooth">
      <div className="photobooth__header">
        <span className="shot-counter">
          SHOT {shotIndex + 1} / {totalShots}
        </span>

        <h2 className="pose-name">{pose.label}</h2>

        <p className="pose-instruction">
          {pose.instruction}
        </p>
      </div>

      <PoseIllustration
        poseId={pose.id}
        className="pose-illustration"
      />

      {/* =====================================================
          CAMERA STAGE
          The countdown lives INSIDE this wrapper so it can
          sit on top of the center of both cameras.
      ====================================================== */}
      <div className={`camera-stage ${snap ? "camera-stage--snap" : ""}`}>

      <div className="camera-grid">
  <CameraTile
    ref={leftVideoRef}
    username={leftUsername}
    muted={creatorIsMe}
    mirrored={leftMirrored}
    status={{
      text: creatorIsMe
        ? (mySnapped ? "Captured" : "Live")
        : (partnerSnapped ? "Captured" : "Live"),
      tone: creatorIsMe
        ? (mySnapped ? "captured" : "live")
        : (partnerSnapped ? "captured" : "live"),
    }}
  />

  <CameraTile
    ref={rightVideoRef}
    username={rightUsername}
    muted={!creatorIsMe}
    mirrored={rightMirrored}
    status={{
      text: creatorIsMe
        ? (partnerSnapped ? "Captured" : "Live")
        : (mySnapped ? "Captured" : "Live"),
      tone: creatorIsMe
        ? (partnerSnapped ? "captured" : "live")
        : (mySnapped ? "captured" : "live"),
    }}
  />
</div>

        {/* ===================================================
            COUNTDOWN OVERLAY
            Positioned at the exact center of the two cameras.
        ==================================================== */}
        <div
          className={`countdown countdown--overlay ${snap ? "countdown--snap" : ""
            }`}
          aria-live="polite"
        >
          {snap ? (
            <span className="countdown__snap">SNAP!</span>
          ) : (
            <span className="countdown__number">{count}</span>
          )}
        </div>

        {/* ===================================================
            WHITE CAMERA FLASH
            Covers both feeds briefly when the photo is taken.
        ==================================================== */}
        {snap && (
          <div
            className="camera-flash"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}