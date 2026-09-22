import { useState } from "react";
import { getCompositionLayout } from "../utils/canvasRender.js";

const FRAME_COLORS = [
  ["Cream", "#FBF3EC"], ["Rose", "#E8879A"], ["Cherry", "#C85C74"],
  ["Gold", "#D9A441"], ["Sky", "#A9C8C6"], ["Ink", "#3A2E2A"],
];
const PATTERNS = [["none", "Plain"], ["hearts", "Hearts"], ["dots", "Dots"], ["stars", "Stars"]];

export default function BuildLayout({ orderedShots, format, customization, onContinue }) {
  const [slots, setSlots] = useState(() => Array(format.shotsUsed).fill(null));
  const [activeShot, setActiveShot] = useState(null);
  const [draggingShot, setDraggingShot] = useState(null);
  const placedShots = new Set(slots.filter((shot) => shot !== null));
  const availableShots = orderedShots.filter((shot) => !placedShots.has(shot.index));
  const complete = slots.every((shot) => shot !== null);
  const [frame, setFrame] = useState(customization);
  const composition = getCompositionLayout({ format, imageCount: slots.length, borderThickness: frame.borderThickness });
  const footerPercent = (96 / composition.canvasH) * 100;

  function placeShot(shotIndex, targetIndex) {
    if (shotIndex === null || shotIndex === undefined) return;
    setSlots((current) => {
      const next = [...current];
      const sourceIndex = next.indexOf(shotIndex);
      const displaced = next[targetIndex];
      if (sourceIndex >= 0) next[sourceIndex] = displaced;
      next[targetIndex] = shotIndex;
      return next;
    });
    setActiveShot(null);
    setDraggingShot(null);
  }

  return (
    <div className="screen layout-builder">
      <h2 className="section-title">Build your {format.name}</h2>
      <p className="section-hint">Drag a chosen photo into a slot. On a phone, tap a photo first, then tap the slot where you want it. Your layout and frame choices are only for your own download.</p>

      <div className="layout-builder__workspace">
        <section className="layout-builder__source" aria-label="Chosen photos">
          <div className="layout-builder__heading"><h3>Chosen photos</h3><span>{availableShots.length} left</span></div>
          <div className="chosen-photo-grid">
            {availableShots.map((shot) => (
              <button
                className={`chosen-photo${activeShot === shot.index ? " chosen-photo--active" : ""}`}
                draggable
                key={shot.index}
                onClick={() => setActiveShot((current) => (current === shot.index ? null : shot.index))}
                onDragStart={(event) => { event.dataTransfer.setData("text/plain", String(shot.index)); setDraggingShot(shot.index); }}
                onDragEnd={() => setDraggingShot(null)}
                type="button"
              >
                <img src={shot.image} alt={`Chosen shot ${shot.index + 1}`} />
                <span>Photo {shot.index + 1}</span>
              </button>
            ))}
            {!availableShots.length && <p className="layout-builder__empty">All your photos are on the board. Drag one to another slot to swap it.</p>}
          </div>
        </section>

        <section className={`format-board format-board--${format.id} format-board--pattern-${frame.pattern}`} style={{ "--frame-color": frame.borderColor, "--footer-height": `${footerPercent}%`, aspectRatio: `${composition.canvasW} / ${composition.canvasH}` }} aria-label={`${format.name} photo layout`}>
          <div className="format-board__slots">
            {slots.map((shotIndex, index) => {
              const shot = orderedShots.find((item) => item.index === shotIndex);
              const target = composition.frames[index];
              return <button
                className={`format-slot${shot ? " format-slot--filled" : ""}${activeShot !== null || draggingShot !== null ? " format-slot--ready" : ""}`}
                key={index}
                style={{ left: `${(target.x / composition.canvasW) * 100}%`, top: `${(target.y / composition.canvasH) * 100}%`, width: `${(target.w / composition.canvasW) * 100}%`, height: `${(target.h / composition.canvasH) * 100}%` }}
                onClick={() => {
                  if (activeShot !== null) placeShot(activeShot, index);
                  else if (shot) setActiveShot(shot.index);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => { event.preventDefault(); const id = Number(event.dataTransfer.getData("text/plain")); placeShot(Number.isNaN(id) ? draggingShot : id, index); }}
                onDragStart={(event) => { if (shot) { event.dataTransfer.setData("text/plain", String(shot.index)); setDraggingShot(shot.index); } }}
                onDragEnd={() => setDraggingShot(null)}
                draggable={Boolean(shot)}
                type="button"
              >
                {shot ? <><img src={shot.image} alt={`Photo ${index + 1} in the final layout`} /><span className="format-slot__number">{index + 1}</span></> : <><span className="format-slot__plus">+</span><span>Drop photo {index + 1}</span></>}
              </button>;
            })}
          </div>
          <div className="format-board__footer">LDRBOOTH</div>
        </section>
      </div>

      <section className="frame-customizer" aria-label="Customize your photo frame">
        <div className="frame-customizer__heading"><h3>Customize your frame</h3><span>Updates your final photo</span></div>
        <label className="frame-thickness"><span>Border thickness <b>{frame.borderThickness}</b></span><input type="range" min="0" max="5" value={frame.borderThickness} onChange={(event) => setFrame((current) => ({ ...current, borderThickness: Number(event.target.value) }))} /></label>
        <div className="frame-control"><span>Border color</span><div className="frame-colors">{FRAME_COLORS.map(([name, color]) => <button key={name} type="button" className={`frame-color${frame.borderColor === color ? " frame-color--selected" : ""}`} style={{ backgroundColor: color }} onClick={() => setFrame((current) => ({ ...current, borderColor: color }))} aria-label={`Use ${name} border`} title={name} />)}</div></div>
        <div className="frame-control"><span>Pattern</span><div className="frame-patterns">{PATTERNS.map(([id, name]) => <button key={id} type="button" className={`frame-pattern${frame.pattern === id ? " frame-pattern--selected" : ""}`} onClick={() => setFrame((current) => ({ ...current, pattern: id }))}>{id === "hearts" ? "♡ " : id === "dots" ? "• " : id === "stars" ? "✦ " : ""}{name}</button>)}</div></div>
      </section>

      <button className="btn btn--primary btn--lg" onClick={() => onContinue(slots, frame)} disabled={!complete}>
        {complete ? "Finalize this layout" : `Place ${slots.filter((shot) => shot !== null).length} of ${slots.length} photos`}
      </button>
    </div>
  );
}
