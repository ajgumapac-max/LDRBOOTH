import { useState } from "react";

export default function Lobby({ roomCode, myUsername }) {
  const [copied, setCopied] = useState("");
  const inviteLink = `${window.location.origin}${window.location.pathname}?join=${encodeURIComponent(roomCode)}`;

  function copy(text, which) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(""), 1800);
    });
  }

  return (
    <div className="screen screen--center">
      <p className="eyebrow-free">Your booth is ready ❤️</p>
      <div className="room-code">{roomCode}</div>

      <div className="stack stack--tight">
        <button className="btn btn--secondary" onClick={() => copy(roomCode, "code")}>
          {copied === "code" ? "Copied!" : "Copy code"}
        </button>
        <button className="btn btn--ghost" onClick={() => copy(inviteLink, "link")}>
          {copied === "link" ? "Copied!" : "Copy invite link"}
        </button>
      </div>

      <div className="waiting-indicator">
        <span className="pulse-dot" />
        Waiting for your person, {myUsername}…
      </div>
    </div>
  );
}
