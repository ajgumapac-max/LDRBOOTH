export default function ConnectionBanner({ status }) {
  if (status === "connected") return null; // don't clutter the UI when everything's fine

  const copy = {
    connecting: { text: "Connecting…", tone: "info" },
    reconnecting: { text: "Reconnecting…", tone: "warn" },
    disconnected: { text: "You're offline — trying to reconnect…", tone: "warn" },
  }[status] || { text: status, tone: "info" };

  return (
    <div className={`connection-banner connection-banner--${copy.tone}`} role="status">
      <span className="connection-dot" />
      {copy.text}
    </div>
  );
}
