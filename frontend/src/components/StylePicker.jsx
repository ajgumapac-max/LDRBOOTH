import { STYLES } from "../data/styles.js";

export default function StylePicker({ selected, previewImage, onChoose }) {
  return (
    <div className="screen">
      <h2 className="section-title">Choose your look</h2>

      <div className="style-grid">
        {STYLES.map((style) => (
          <button
            key={style.id}
            type="button"
            className={`style-card${selected === style.id ? " style-card--selected" : ""}`}
            onClick={() => onChoose(style.id)}
          >
            {previewImage && (
              <img src={previewImage} alt="" style={{ filter: style.filter === "none" ? "none" : style.filter }} />
            )}
            <span>{style.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
