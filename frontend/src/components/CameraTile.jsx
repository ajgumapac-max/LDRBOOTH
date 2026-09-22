import { forwardRef } from "react";

const CameraTile = forwardRef(function CameraTile(
  { username, muted = false, status, mirrored = false },
  ref
) {
  return (
    <div className="camera-tile">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={`camera-video${mirrored ? " camera-video--mirrored" : ""}`}
      />
      <div className="camera-label">
        <span className="camera-name">{username || "…"}</span>
        {status && (
          <span className={`camera-status camera-status--${status.tone || "live"}`}>
            <span className="status-dot" />
            {status.text}
          </span>
        )}
      </div>
    </div>
  );
});

export default CameraTile;
