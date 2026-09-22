export default function ReadyScreen({ participants, myParticipantId, onToggleReady }) {
  const me = participants.find((p) => p.id === myParticipantId);
  const partner = participants.find((p) => p.id !== myParticipantId);

  return (
    <div className="screen screen--center">
      <h2 className="section-title">Ready when you are</h2>
      <p className="section-hint">Both of you need to press ready before the first shot.</p>

      <div className="ready-list">
        {participants.map((p) => (
          <div key={p.id} className="ready-row">
            <span className="ready-row__name">{p.username}</span>
            <span className={`ready-pill${p.ready ? " ready-pill--on" : ""}`}>
              <span className="status-dot" /> {p.ready ? "Ready" : "Not ready"}
            </span>
          </div>
        ))}
        {!partner && <p className="section-hint">Waiting for your partner to join the ready screen…</p>}
      </div>

      <button
        className={`btn btn--lg ${me?.ready ? "btn--secondary" : "btn--primary"}`}
        onClick={() => onToggleReady(!me?.ready)}
      >
        {me?.ready ? "Not ready yet" : "I'm ready"}
      </button>
    </div>
  );
}
