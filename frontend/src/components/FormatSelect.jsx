import { FORMATS } from "../data/formats.js";

export default function FormatSelect({ isCreator, selectedFormat, onChoose, partnerUsername }) {
  return (
    <div className="screen">
      <h2 className="section-title">What should your memory look like?</h2>
      {!isCreator && (
        <p className="section-hint">
          {selectedFormat ? "Here's the format your partner picked." : `Waiting for ${partnerUsername || "your partner"} to choose…`}
        </p>
      )}

      <div className="format-grid">
        {FORMATS.map((format) => (
          <button
            key={format.id}
            className={`format-card${selectedFormat === format.id ? " format-card--selected" : ""}`}
            onClick={() => isCreator && onChoose(format.id)}
            disabled={!isCreator}
            type="button"
          >
            <FormatPreview formatId={format.id} />
            <div className="format-card__body">
              <span className="format-card__name">{format.name}</span>
              <span className="format-card__desc">{format.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function FormatPreview({ formatId }) {
  if (formatId === "classic-strip") {
    return (
      <div className="preview preview--strip">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="preview__frame" />
        ))}
        <span className="preview__mark">LDRBOOTH</span>
      </div>
    );
  }
  if (formatId === "four-frame") {
    return (
      <div className="preview preview--grid">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="preview__frame" />
        ))}
      </div>
    );
  }
  if (formatId === "double-frame") {
    return (
      <div className="preview preview--double">
        <span className="preview__frame" />
        <span className="preview__frame" />
      </div>
    );
  }
  // memory-card
  return (
    <div className="preview preview--card">
      <span className="preview__frame preview__frame--hero" />
      <span className="preview__caption" />
    </div>
  );
}
