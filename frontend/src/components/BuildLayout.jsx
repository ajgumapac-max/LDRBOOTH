import { useEffect, useRef, useState } from "react";
import { getCompositionLayout } from "../utils/canvasRender.js";

const FRAME_COLORS = [
  ["Cream", "#FBF3EC"],
  ["Rose", "#E8879A"],
  ["Cherry", "#C85C74"],
  ["Gold", "#D9A441"],
  ["Sky", "#A9C8C6"],
  ["Ink", "#3A2E2A"],
];

const PATTERNS = [
  ["none", "Plain"],
  ["hearts", "Hearts"],
  ["dots", "Dots"],
  ["stars", "Stars"],
];

/*
|--------------------------------------------------------------------------
| Sticker library
|--------------------------------------------------------------------------
| These are Unicode stickers so users don't need external image assets.
| The same characters are rendered into the final canvas later.
|--------------------------------------------------------------------------
*/
const STICKERS = [
  "❤️",
  "💕",
  "💖",
  "💗",
  "💘",
  "🫶",
  "🥰",
  "😘",
  "😍",
  "😎",
  "😂",
  "✨",
  "⭐",
  "🌸",
  "🎀",
  "☀️",
];

/*
|--------------------------------------------------------------------------
| Text sizes
|--------------------------------------------------------------------------
| Stored as a fraction of the final canvas dimension so the editor and
| exported image stay proportional.
|--------------------------------------------------------------------------
*/
const TEXT_SIZES = [
  { id: "small", label: "Small", scale: 0.022 },
  { id: "medium", label: "Medium", scale: 0.03 },
  { id: "large", label: "Large", scale: 0.04 },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function BuildLayout({
  orderedShots,
  format,
  customization,
  onContinue,
}) {
  const [slots, setSlots] = useState(() =>
    Array(format.shotsUsed).fill(null)
  );

  const [activeShot, setActiveShot] = useState(null);
  const [draggingShot, setDraggingShot] = useState(null);

  const [frame, setFrame] = useState(() => ({
    ...customization,
    overlays: Array.isArray(customization?.overlays)
      ? customization.overlays
      : [],
  }));

  const [selectedOverlayId, setSelectedOverlayId] = useState(null);
  const [textInput, setTextInput] = useState("");
  const [textSize, setTextSize] = useState("medium");

  const boardRef = useRef(null);

  /*
  |--------------------------------------------------------------------------
  | Pointer dragging
  |--------------------------------------------------------------------------
  | This is intentionally pointer-based instead of HTML5 drag/drop.
  | That means it works with:
  | - mouse
  | - touch
  | - phone
  | - tablet
  |--------------------------------------------------------------------------
  */
  const overlayDragRef = useRef(null);

  const placedShots = new Set(
    slots.filter((shot) => shot !== null)
  );

  const availableShots = orderedShots.filter(
    (shot) => !placedShots.has(shot.index)
  );

  const complete = slots.every(
    (shot) => shot !== null
  );

  const composition = getCompositionLayout({
    format,
    imageCount: slots.length,
    borderThickness: frame.borderThickness,
  });

  const footerPercent =
    (96 / composition.canvasH) * 100;

  function placeShot(shotIndex, targetIndex) {
    if (
      shotIndex === null ||
      shotIndex === undefined
    ) {
      return;
    }

    setSlots((current) => {
      const next = [...current];

      const sourceIndex =
        next.indexOf(shotIndex);

      const displaced =
        next[targetIndex];

      if (sourceIndex >= 0) {
        next[sourceIndex] = displaced;
      }

      next[targetIndex] = shotIndex;

      return next;
    });

    setActiveShot(null);
    setDraggingShot(null);
  }

  /*
  |--------------------------------------------------------------------------
  | Add text
  |--------------------------------------------------------------------------
  */
  function addText() {
    const value = textInput.trim();

    if (!value) {
      return;
    }

    const size =
      TEXT_SIZES.find(
        (item) => item.id === textSize
      ) || TEXT_SIZES[1];

    const overlay = {
      id: `text-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,

      type: "text",

      content: value,

      /*
       * Start just above the LDRBOOTH watermark.
       * Users can drag it anywhere afterward.
       */
      x: 0.5,
      y: 0.925,

      fontScale: size.scale,

      color: "#3A2E2A",
    };

    setFrame((current) => ({
      ...current,
      overlays: [
        ...(current.overlays || []),
        overlay,
      ],
    }));

    setSelectedOverlayId(overlay.id);
    setTextInput("");
  }

  /*
  |--------------------------------------------------------------------------
  | Add sticker
  |--------------------------------------------------------------------------
  */
  function addSticker(sticker) {
    const overlay = {
      id: `sticker-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,

      type: "sticker",

      content: sticker,

      /*
       * Start around the upper-middle area.
       * Users can drag it anywhere.
       */
      x: 0.5,
      y: 0.42,

      fontScale: 0.045,

      color: "#3A2E2A",
    };

    setFrame((current) => ({
      ...current,
      overlays: [
        ...(current.overlays || []),
        overlay,
      ],
    }));

    setSelectedOverlayId(overlay.id);
  }

  /*
  |--------------------------------------------------------------------------
  | Delete selected overlay
  |--------------------------------------------------------------------------
  */
  function deleteSelectedOverlay() {
    if (!selectedOverlayId) {
      return;
    }

    setFrame((current) => ({
      ...current,
      overlays: (current.overlays || []).filter(
        (overlay) =>
          overlay.id !== selectedOverlayId
      ),
    }));

    setSelectedOverlayId(null);
  }

  /*
  |--------------------------------------------------------------------------
  | Pointer down
  |--------------------------------------------------------------------------
  */
  function handleOverlayPointerDown(
    event,
    overlayId
  ) {
    event.preventDefault();
    event.stopPropagation();

    const board = boardRef.current;

    if (!board) {
      return;
    }

    const overlayElement =
      event.currentTarget;

    const boardRect =
      board.getBoundingClientRect();

    const overlayRect =
      overlayElement.getBoundingClientRect();

    /*
     * Preserve where the user's finger/mouse touched
     * relative to the overlay center so the sticker does
     * not jump underneath the finger.
     */
    const centerX =
      overlayRect.left +
      overlayRect.width / 2;

    const centerY =
      overlayRect.top +
      overlayRect.height / 2;

    overlayDragRef.current = {
      overlayId,
      offsetX: event.clientX - centerX,
      offsetY: event.clientY - centerY,
      boardRect,
    };

    setSelectedOverlayId(overlayId);

    if (
      overlayElement.setPointerCapture
    ) {
      try {
        overlayElement.setPointerCapture(
          event.pointerId
        );
      } catch {
        // Some browsers do not allow capture in every situation.
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Pointer movement
  |--------------------------------------------------------------------------
  */
  useEffect(() => {
    function handlePointerMove(event) {
      const drag =
        overlayDragRef.current;

      if (!drag) {
        return;
      }

      const board = boardRef.current;

      if (!board) {
        return;
      }

      const rect =
        board.getBoundingClientRect();

      const x =
        (
          event.clientX -
          rect.left -
          drag.offsetX
        ) / rect.width;

      const y =
        (
          event.clientY -
          rect.top -
          drag.offsetY
        ) / rect.height;

      /*
       * Keep the object inside the frame.
       */
      const nextX = clamp(
        x,
        0.04,
        0.96
      );

      const nextY = clamp(
        y,
        0.04,
        0.96
      );

      setFrame((current) => ({
        ...current,

        overlays: (
          current.overlays || []
        ).map((overlay) =>
          overlay.id ===
          drag.overlayId
            ? {
                ...overlay,
                x: nextX,
                y: nextY,
              }
            : overlay
        ),
      }));
    }

    function handlePointerUp() {
      overlayDragRef.current = null;
    }

    window.addEventListener(
      "pointermove",
      handlePointerMove
    );

    window.addEventListener(
      "pointerup",
      handlePointerUp
    );

    window.addEventListener(
      "pointercancel",
      handlePointerUp
    );

    return () => {
      window.removeEventListener(
        "pointermove",
        handlePointerMove
      );

      window.removeEventListener(
        "pointerup",
        handlePointerUp
      );

      window.removeEventListener(
        "pointercancel",
        handlePointerUp
      );
    };
  }, []);

  return (
    <div className="screen layout-builder">
      <h2 className="section-title">
        Build your {format.name}
      </h2>

      <p className="section-hint">
        Drag a chosen photo into a slot. On a phone,
        tap a photo first, then tap the slot where you
        want it. Customize the frame with text and
        stickers too.
      </p>

      <div className="layout-builder__workspace">

        {/* =====================================================
            CHOSEN PHOTOS
        ====================================================== */}
        <section
          className="layout-builder__source"
          aria-label="Chosen photos"
        >
          <div className="layout-builder__heading">
            <h3>Chosen photos</h3>
            <span>
              {availableShots.length} left
            </span>
          </div>

          <div className="chosen-photo-grid">
            {availableShots.map((shot) => (
              <button
                className={`chosen-photo${
                  activeShot === shot.index
                    ? " chosen-photo--active"
                    : ""
                }`}
                draggable
                key={shot.index}
                onClick={() =>
                  setActiveShot(
                    (current) =>
                      current === shot.index
                        ? null
                        : shot.index
                  )
                }
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    "text/plain",
                    String(shot.index)
                  );

                  setDraggingShot(
                    shot.index
                  );
                }}
                onDragEnd={() =>
                  setDraggingShot(null)
                }
                type="button"
              >
                <img
                  src={shot.image}
                  alt={`Chosen shot ${
                    shot.index + 1
                  }`}
                />

                <span>
                  Photo {shot.index + 1}
                </span>
              </button>
            ))}

            {!availableShots.length && (
              <p className="layout-builder__empty">
                All your photos are on the board.
                Drag one to another slot to swap it.
              </p>
            )}
          </div>
        </section>

        {/* =====================================================
            FORMAT BOARD
        ====================================================== */}
        <section
          ref={boardRef}
          className={`format-board format-board--${
            format.id
          } format-board--pattern-${
            frame.pattern
          }`}
          style={{
            "--frame-color":
              frame.borderColor,

            "--footer-height": `${footerPercent}%`,

            aspectRatio: `${composition.canvasW} / ${composition.canvasH}`,
          }}
          aria-label={`${format.name} photo layout`}
        >

          <div className="format-board__slots">
            {slots.map(
              (shotIndex, index) => {
                const shot =
                  orderedShots.find(
                    (item) =>
                      item.index === shotIndex
                  );

                const target =
                  composition.frames[index];

                return (
                  <button
                    className={`format-slot${
                      shot
                        ? " format-slot--filled"
                        : ""
                    }${
                      activeShot !== null ||
                      draggingShot !== null
                        ? " format-slot--ready"
                        : ""
                    }`}
                    key={index}
                    style={{
                      left: `${
                        (target.x /
                          composition.canvasW) *
                        100
                      }%`,

                      top: `${
                        (target.y /
                          composition.canvasH) *
                        100
                      }%`,

                      width: `${
                        (target.w /
                          composition.canvasW) *
                        100
                      }%`,

                      height: `${
                        (target.h /
                          composition.canvasH) *
                        100
                      }%`,
                    }}
                    onClick={() => {
                      if (
                        activeShot !== null
                      ) {
                        placeShot(
                          activeShot,
                          index
                        );
                      } else if (shot) {
                        setActiveShot(
                          shot.index
                        );
                      }
                    }}
                    onDragOver={(event) =>
                      event.preventDefault()
                    }
                    onDrop={(event) => {
                      event.preventDefault();

                      const id =
                        Number(
                          event.dataTransfer.getData(
                            "text/plain"
                          )
                        );

                      placeShot(
                        Number.isNaN(id)
                          ? draggingShot
                          : id,
                        index
                      );
                    }}
                    onDragStart={(event) => {
                      if (shot) {
                        event.dataTransfer.setData(
                          "text/plain",
                          String(shot.index)
                        );

                        setDraggingShot(
                          shot.index
                        );
                      }
                    }}
                    onDragEnd={() =>
                      setDraggingShot(null)
                    }
                    draggable={Boolean(shot)}
                    type="button"
                  >
                    {shot ? (
                      <>
                        <img
                          src={shot.image}
                          alt={`Photo ${
                            index + 1
                          } in the final layout`}
                        />

                        <span className="format-slot__number">
                          {index + 1}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="format-slot__plus">
                          +
                        </span>

                        <span>
                          Drop photo{" "}
                          {index + 1}
                        </span>
                      </>
                    )}
                  </button>
                );
              }
            )}
          </div>

          {/* ===================================================
              USER TEXT + STICKERS
          ==================================================== */}
          <div
            className="format-board__overlays"
            aria-hidden="false"
          >
            {(
              frame.overlays || []
            ).map((overlay) => (
              <div
                key={overlay.id}
                className={`format-overlay format-overlay--${
                  overlay.type
                }${
                  selectedOverlayId ===
                  overlay.id
                    ? " format-overlay--selected"
                    : ""
                }`}
                style={{
                  left: `${overlay.x * 100}%`,
                  top: `${overlay.y * 100}%`,

                  fontSize:
                    overlay.type === "text"
                      ? `${(
                          overlay.fontScale *
                          100
                        ).toFixed(2)}%`
                      : `${(
                          overlay.fontScale *
                          100
                        ).toFixed(2)}%`,
                }}
                onPointerDown={(event) =>
                  handleOverlayPointerDown(
                    event,
                    overlay.id
                  )
                }
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedOverlayId(
                    overlay.id
                  );
                }}
              >
                <span
                  className="format-overlay__content"
                  style={{
                    color:
                      overlay.color ||
                      "#3A2E2A",
                  }}
                >
                  {overlay.content}
                </span>

                {selectedOverlayId ===
                  overlay.id && (
                  <button
                    type="button"
                    className="format-overlay__delete"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setFrame((current) => ({
                        ...current,
                        overlays: (
                          current.overlays ||
                          []
                        ).filter(
                          (item) =>
                            item.id !==
                            overlay.id
                        ),
                      }));

                      setSelectedOverlayId(
                        null
                      );
                    }}
                    aria-label="Delete decoration"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="format-board__footer">
            LDRBOOTH
          </div>
        </section>
      </div>

      {/* =====================================================
          FRAME CUSTOMIZER
      ====================================================== */}
      <section
        className="frame-customizer"
        aria-label="Customize your photo frame"
      >
        <div className="frame-customizer__heading">
          <h3>
            Customize your frame
          </h3>

          <span>
            Everything here appears in your final photo
          </span>
        </div>

        {/* Border thickness */}
        <label className="frame-thickness">
          <span>
            Border thickness{" "}
            <b>
              {frame.borderThickness}
            </b>
          </span>

          <input
            type="range"
            min="0"
            max="5"
            value={frame.borderThickness}
            onChange={(event) =>
              setFrame((current) => ({
                ...current,
                borderThickness:
                  Number(
                    event.target.value
                  ),
              }))
            }
          />
        </label>

        {/* Border colors */}
        <div className="frame-control">
          <span>Border color</span>

          <div className="frame-colors">
            {FRAME_COLORS.map(
              ([name, color]) => (
                <button
                  key={name}
                  type="button"
                  className={`frame-color${
                    frame.borderColor ===
                    color
                      ? " frame-color--selected"
                      : ""
                  }`}
                  style={{
                    backgroundColor:
                      color,
                  }}
                  onClick={() =>
                    setFrame(
                      (current) => ({
                        ...current,
                        borderColor:
                          color,
                      })
                    )
                  }
                  aria-label={`Use ${name} border`}
                  title={name}
                />
              )
            )}
          </div>
        </div>

        {/* Patterns */}
        <div className="frame-control">
          <span>Pattern</span>

          <div className="frame-patterns">
            {PATTERNS.map(
              ([id, name]) => (
                <button
                  key={id}
                  type="button"
                  className={`frame-pattern${
                    frame.pattern === id
                      ? " frame-pattern--selected"
                      : ""
                  }`}
                  onClick={() =>
                    setFrame(
                      (current) => ({
                        ...current,
                        pattern: id,
                      })
                    )
                  }
                >
                  {id === "hearts"
                    ? "♡ "
                    : id === "dots"
                    ? "• "
                    : id === "stars"
                    ? "✦ "
                    : ""}

                  {name}
                </button>
              )
            )}
          </div>
        </div>

        {/* ===================================================
            TEXT
        ==================================================== */}
        <div className="frame-control frame-decoration-control">
          <span>Add text</span>

          <div className="frame-text-row">
            <input
              className="frame-text-input"
              type="text"
              value={textInput}
              maxLength={32}
              placeholder="e.g. Together forever ♡"
              onChange={(event) =>
                setTextInput(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter"
                ) {
                  event.preventDefault();
                  addText();
                }
              }}
            />

            <button
              type="button"
              className="btn btn--secondary"
              onClick={addText}
              disabled={!textInput.trim()}
            >
              Add
            </button>
          </div>

          <div className="frame-text-sizes">
            {TEXT_SIZES.map(
              (item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`frame-text-size${
                    textSize === item.id
                      ? " frame-text-size--selected"
                      : ""
                  }`}
                  onClick={() =>
                    setTextSize(
                      item.id
                    )
                  }
                >
                  {item.label}
                </button>
              )
            )}
          </div>

          <small className="frame-decoration-help">
            New text starts above the LDRBOOTH watermark.
            Drag it anywhere on the frame.
          </small>
        </div>

        {/* ===================================================
            STICKERS
        ==================================================== */}
        <div className="frame-control frame-decoration-control">
          <span>Add stickers</span>

          <div className="sticker-picker">
            {STICKERS.map(
              (sticker) => (
                <button
                  key={sticker}
                  type="button"
                  className="sticker-picker__button"
                  onClick={() =>
                    addSticker(
                      sticker
                    )
                  }
                  aria-label={`Add ${sticker} sticker`}
                >
                  {sticker}
                </button>
              )
            )}
          </div>

          <small className="frame-decoration-help">
            Tap a sticker to add it, then drag it
            anywhere on the frame.
          </small>
        </div>

        {/* ===================================================
            SELECTED DECORATION
        ==================================================== */}
        {selectedOverlayId && (
          <div className="frame-selected-decoration">
            <span>
              Decoration selected
            </span>

            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={
                deleteSelectedOverlay
              }
            >
              Delete selected
            </button>
          </div>
        )}
      </section>

      <button
        className="btn btn--primary btn--lg"
        onClick={() =>
          onContinue(
            slots,
            frame
          )
        }
        disabled={!complete}
      >
        {complete
          ? "Finalize this layout"
          : `Place ${
              slots.filter(
                (shot) =>
                  shot !== null
              ).length
            } of ${
              slots.length
            } photos`}
      </button>
    </div>
  );
}