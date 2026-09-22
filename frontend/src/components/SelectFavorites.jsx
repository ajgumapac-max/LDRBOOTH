export default function SelectFavorites({
  shots,
  requiredCount,
  mySelection,
  partnerSelection,
  matched,
  myUsername,
  partnerUsername,
  onToggle,
}) {
  const mySet = new Set(mySelection);
  const partnerSet = new Set(partnerSelection || []);

  return (
    <div className="screen">
      <h2 className="section-title">Choose your favorites</h2>
      <p className="section-hint">
        Pick {requiredCount} of {shots.length}. {mySelection.length}/{requiredCount} selected.
      </p>

      <div className="shot-grid">
        {shots.map((shot) => {
          const picked = mySet.has(shot.index);
          const disableAdd = !picked && mySelection.length >= requiredCount;
          return (
            <button
              key={shot.index}
              type="button"
              className={`shot-card${picked ? " shot-card--picked" : ""}`}
              onClick={() => onToggle(shot.index)}
              disabled={disableAdd}
            >
              <img src={shot.image} alt={`Shot ${shot.index + 1}`} />
              {picked && <span className="shot-card__check">✓</span>}
            </button>
          );
        })}
      </div>

      <div className="picks-columns">
        <PicksColumn label={`${myUsername}'s picks`} shots={shots} selection={mySet} />
        <PicksColumn label={`${partnerUsername || "Partner"}'s picks`} shots={shots} selection={partnerSet} />
      </div>

      <div className={`match-banner${matched ? " match-banner--matched" : ""}`}>
        {matched ? "Perfect match ❤️" : "Your choices don't match yet"}
      </div>
    </div>
  );
}

function PicksColumn({ label, shots, selection }) {
  return (
    <div className="picks-column">
      <span className="picks-column__label">{label}</span>
      <ul className="picks-column__list">
        {shots.map((shot) => (
          <li key={shot.index} className={selection.has(shot.index) ? "picked" : ""}>
            {selection.has(shot.index) ? "✓" : "—"} Shot {shot.index + 1}
          </li>
        ))}
      </ul>
    </div>
  );
}
