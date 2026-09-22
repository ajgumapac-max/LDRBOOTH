export default function FinalPreview({ imageUrl, loading, onBack, onContinue }) {
  return (
    <div className="screen screen--center">
      <h2 className="section-title">Here's your memory</h2>

      <div className="final-preview">
        {loading || !imageUrl ? (
          <div className="final-preview__loading">Building your photo…</div>
        ) : (
          <img src={imageUrl} alt="Your LDRBOOTH final composition" />
        )}
      </div>

      <div className="stack stack--row">
        <button className="btn btn--ghost" onClick={onBack}>
          Back
        </button>
        <button className="btn btn--primary btn--lg" onClick={onContinue} disabled={loading || !imageUrl}>
          Continue to payment
        </button>
      </div>
    </div>
  );
}
