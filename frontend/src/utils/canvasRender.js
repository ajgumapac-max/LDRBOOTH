// Composites the two live video elements (own + partner) into a single
// JPEG for one capture round. Both participants generate this locally
// from their own <video> elements — the server just decides when to fire
// and waits for both copies before advancing (see services/boothStore.js).
export function captureVideoPairToDataUrl(
  videoA,
  videoB,
  {
    width = 960,
    height = 720,
    mirrorA = false,
    mirrorB = false,
  } = {}
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#FBF3EC";
  ctx.fillRect(0, 0, width, height);

  const halfW = width / 2;

  drawVideoCover(
    ctx,
    videoA,
    0,
    0,
    halfW,
    height,
    mirrorA
  );

  drawVideoCover(
    ctx,
    videoB,
    halfW,
    0,
    halfW,
    height,
    mirrorB
  );

  return canvas.toDataURL("image/jpeg", 0.85);
}

function drawVideoCover(
  ctx,
  video,
  x,
  y,
  w,
  h,
  mirrored = false
) {
  if (!video || !video.videoWidth) {
    ctx.fillStyle = "#EFE3D8";
    ctx.fillRect(x, y, w, h);
    return;
  }

  const vw = video.videoWidth;
  const vh = video.videoHeight;

  const scale = Math.max(
    w / vw,
    h / vh
  );

  const sw = w / scale;
  const sh = h / scale;

  const sx = (vw - sw) / 2;
  const sy = (vh - sh) / 2;

  ctx.save();

  if (mirrored) {
    /*
     * Match the CSS:
     * transform: scaleX(-1)
     *
     * This makes the exported image use
     * the exact same left/right orientation
     * as the mirrored live camera preview.
     */
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);

    ctx.drawImage(
      video,
      sx,
      sy,
      sw,
      sh,
      0,
      0,
      w,
      h
    );
  } else {
    ctx.drawImage(
      video,
      sx,
      sy,
      sw,
      sh,
      x,
      y,
      w,
      h
    );
  }

  ctx.restore();
}

// Renders the final photo composition: chosen shots, in the chosen order,
// inside the chosen format's frame layout, with the chosen style filter and
// the LDRBOOTH mark. This is the SAME function used for the on-screen
// preview and the exported image, so what you see is what you get.
export async function renderFinalComposition({ images, format, style, frame = {}, dimension = 1600 }) {
  const layout = getCompositionLayout({ format, imageCount: images.length, dimension, borderThickness: frame.borderThickness });
  const canvas = document.createElement("canvas");
  canvas.width = layout.canvasW;
  canvas.height = layout.canvasH;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = frame.borderColor || style.border || "#FBF3EC";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawFramePattern(ctx, canvas.width, canvas.height, frame.pattern);

  const loaded = await Promise.all(images.map(loadImage));

  ctx.filter = style.filter && style.filter !== "none" ? style.filter : "none";
  layout.frames.forEach((frame, i) => {
    const img = loaded[i % loaded.length];
    if (!img) return;
    drawImageCover(ctx, img, frame.x, frame.y, frame.w, frame.h);
  });
  ctx.filter = "none";

  /*
  |--------------------------------------------------------------------------
  | Draw user decorations
  |--------------------------------------------------------------------------
  | These must be drawn BEFORE the LDRBOOTH watermark so the watermark
  | remains the final branded element at the bottom.
  |--------------------------------------------------------------------------
  */
  drawFrameOverlays(
    ctx,
    canvas.width,
    canvas.height,
    frame.overlays || [],
    dimension
  );

  // Footer mark
  ctx.save();

  ctx.fillStyle = "#3A2E2A";
  ctx.font = `600 ${Math.round(
    dimension * 0.024
  )}px "Fraunces", serif`;

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillText(
    "LDRBOOTH",
    canvas.width / 2,
    canvas.height -
      dimension * 0.02
  );

  ctx.restore();

  return canvas.toDataURL(
    "image/jpeg",
    0.92
  );
}

// Kept public for the editor board. This prevents the visual editor from
// approximating frame proportions differently from the exported canvas.
export function getCompositionLayout({ format, imageCount, dimension = 1600, borderThickness = 1 }) {
  return layoutFor(format.id, imageCount, dimension, borderThickness);
}

function layoutFor(formatId, count, dimension, borderThickness = 1) {
  const pad = Math.round(dimension * (0.008 + Math.max(0, Math.min(5, borderThickness)) * 0.006));
  const footer = Math.round(dimension * 0.06);

  if (formatId === "classic-strip") {
    // Traditional 2 × 6 photo-booth strip.  Keeping this a true 1:3
    // portrait format makes the downloaded image match the strip preview.
    const canvasW = Math.round(dimension / 3);
    const frameH = Math.round((dimension - footer - pad * 7) / 6);
    const frameW = canvasW - pad * 2;
    const frames = Array.from({ length: 6 }, (_, i) => ({
      x: pad,
      y: pad + i * (frameH + pad),
      w: frameW,
      h: frameH,
    }));
    return { canvasW, canvasH: dimension, frames };
  }

  if (formatId === "four-frame") {
    const canvasW = dimension;
    const canvasH = dimension;
    // Reserve the footer before determining the square cells. The previous
    // layout let the bottom frame overlap the LDRBOOTH mark and made the
    // exported "square" image shorter than it was wide.
    const cell = Math.floor((canvasH - footer - pad * 3) / 2);
    const gridW = cell * 2 + pad;
    const startX = Math.round((canvasW - gridW) / 2);
    const frames = [
      { x: startX, y: pad, w: cell, h: cell },
      { x: startX + pad + cell, y: pad, w: cell, h: cell },
      { x: startX, y: pad * 2 + cell, w: cell, h: cell },
      { x: startX + pad + cell, y: pad * 2 + cell, w: cell, h: cell },
    ];
    return { canvasW, canvasH, frames };
  }

  if (formatId === "double-frame") {
    // Standard landscape print ratio (3:2).
    const canvasH = Math.round(dimension * 2 / 3);
    const frameW = Math.round((dimension - pad * 2) / 2); // no center gap — frames touch
    const frameH = canvasH - pad * 2 - footer;
    const frames = [
      { x: pad, y: pad, w: frameW, h: frameH },
      { x: pad + frameW, y: pad, w: frameW, h: frameH },
    ];
    return { canvasW: dimension, canvasH, frames };
  }

  // memory-card (default): one hero photo with caption strip below
  // Standard photo-card ratio (4:3).
  const canvasH = Math.round(dimension * 3 / 4);
  const frames = [{ x: pad, y: pad, w: dimension - pad * 2, h: canvasH - pad * 2 - footer }];
  return { canvasW: dimension, canvasH, frames };
}

function drawFramePattern(ctx, width, height, pattern) {
  if (!pattern || pattern === "none") return;
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "#FFFFFF";
  if (pattern === "dots") {
    for (let y = 18; y < height; y += 28) for (let x = 18; x < width; x += 28) {
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    const mark = pattern === "hearts" ? "♡" : "✦";
    ctx.font = "20px sans-serif";
    for (let y = 22; y < height; y += 34) for (let x = 16; x < width; x += 34) ctx.fillText(mark, x, y);
  }
  ctx.restore();
}

function drawFrameOverlays(
  ctx,
  canvasW,
  canvasH,
  overlays = [],
  dimension
) {
  if (!Array.isArray(overlays)) {
    return;
  }

  overlays.forEach((overlay) => {
    if (!overlay || !overlay.content) {
      return;
    }

    const x =
      Number(overlay.x || 0.5) *
      canvasW;

    const y =
      Number(overlay.y || 0.5) *
      canvasH;

    /*
    |--------------------------------------------------------------------------
    | FONT SIZE
    |--------------------------------------------------------------------------
    | BuildLayout stores fontScale as a fraction of the final dimension.
    |--------------------------------------------------------------------------
    */
    const fontSize = Math.max(
      12,
      Number(
        overlay.fontScale ||
          0.03
      ) * dimension
    );

    ctx.save();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (
      overlay.type === "sticker"
    ) {
      /*
      * Emoji stickers need a regular sans-serif/emoji capable font.
      * The browser/device supplies the platform's emoji glyphs.
      */
      ctx.font = `${Math.round(
        fontSize
      )}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;

      ctx.fillStyle =
        overlay.color ||
        "#3A2E2A";

      ctx.fillText(
        overlay.content,
        x,
        y
      );
    } else {
      /*
      * User text.
      */
      ctx.font = `600 ${Math.round(
        fontSize
      )}px "Fraunces", Georgia, serif`;

      ctx.fillStyle =
        overlay.color ||
        "#3A2E2A";

      /*
      * Small shadow makes text readable over photos.
      */
      ctx.shadowColor =
        "rgba(255,255,255,0.85)";

      ctx.shadowBlur =
        Math.max(
          2,
          Math.round(
            dimension * 0.004
          )
        );

      ctx.fillText(
        overlay.content,
        x,
        y
      );
    }

    ctx.restore();
  });
}

function drawImageCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
