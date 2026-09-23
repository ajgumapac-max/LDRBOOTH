export default function Delivery({ status, downloadUrl, error, myEmail, onPrint }) {
  if (status === "preparing") {
    return (
      <div className="screen screen--center">
        <h2 className="section-title">Preparing your photos…</h2>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="screen screen--center">
        <h2 className="section-title">We hit a snag</h2>
        <p className="section-hint">{error || "This photo link has expired."}</p>
      </div>
    );
  }

  return (
    <div className="screen screen--center">
      <h2 className="section-title">Your photos are ready ❤️</h2>

      <div className="stack stack--row">
        <a className="btn btn--primary btn--lg" href={downloadUrl} download="ldrbooth.jpg" target="_blank" rel="noreferrer">
          Download photos
        </a>
        <button className="btn btn--secondary btn--lg" onClick={onPrint}>
          Print
        </button>
      </div>
    </div>
  );
}
