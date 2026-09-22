// Simple, original two-figure illustrations — not photorealistic, just
// enough to show two people what to do for each pose (per spec: "a clean
// two-person illustration is enough"). Two rounded blob characters, tinted
// pink and gold, with pose-specific arm/prop variations.
export default function PoseIllustration({ poseId, className }) {
  return (
    <svg viewBox="0 0 220 160" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="0" y="0" width="220" height="160" rx="18" fill="#FBF3EC" />
      <Figure x={62} pose={poseId} side="left" />
      <Figure x={158} pose={poseId} side="right" />
      <Extras poseId={poseId} />
    </svg>
  );
}

function Figure({ x, pose, side }) {
  const color = side === "left" ? "#E8879A" : "#D9A441";
  const lean = side === "left" ? 6 : -6;
  const headY = pose === "cheek-to-cheek" ? 58 : 52;
  const headX = pose === "cheek-to-cheek" ? (side === "left" ? x + 14 : x - 14) : x;
  const armPaths = getArms(pose, side, x);

  return (
    <g transform={pose === "look-away" && side === "right" ? `translate(0,0) scale(-1,1) translate(-${x * 2},0)` : ""}>
      {/* body */}
      <path
        d={`M ${x - 22} 150 Q ${x - 26} 100 ${x} 96 Q ${x + 26} 100 ${x + 22} 150 Z`}
        fill={color}
        opacity="0.9"
        transform={`rotate(${lean} ${x} 130)`}
      />
      {/* arms */}
      {armPaths.map((d, i) => (
        <path key={i} d={d} stroke={color} strokeWidth="7" strokeLinecap="round" fill="none" />
      ))}
      {/* head */}
      <circle cx={headX} cy={headY} r="22" fill="#3A2E2A" opacity="0.92" />
      {/* face */}
      <Face pose={pose} cx={headX} cy={headY} />
    </g>
  );
}

function Face({ pose, cx, cy }) {
  if (pose === "surprised") {
    return (
      <>
        <circle cx={cx - 7} cy={cy - 2} r="2.6" fill="#FBF3EC" />
        <circle cx={cx + 7} cy={cy - 2} r="2.6" fill="#FBF3EC" />
        <circle cx={cx} cy={cy + 9} r="4.5" fill="#FBF3EC" />
      </>
    );
  }
  if (pose === "silly-face") {
    return (
      <>
        <path d={`M ${cx - 9} ${cy - 3} l 5 3 l -5 3`} stroke="#FBF3EC" strokeWidth="2" fill="none" />
        <circle cx={cx + 7} cy={cy - 2} r="2.4" fill="#FBF3EC" />
        <path d={`M ${cx - 5} ${cy + 8} Q ${cx + 4} ${cy + 14} ${cx + 10} ${cy + 6}`} stroke="#FBF3EC" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </>
    );
  }
  if (pose === "look-away") {
    return (
      <>
        <circle cx={cx + 9} cy={cy - 2} r="2.4" fill="#FBF3EC" />
      </>
    );
  }
  // default smiling face used by most poses
  return (
    <>
      <circle cx={cx - 7} cy={cy - 2} r="2.4" fill="#FBF3EC" />
      <circle cx={cx + 7} cy={cy - 2} r="2.4" fill="#FBF3EC" />
      <path d={`M ${cx - 7} ${cy + 7} Q ${cx} ${cy + 13} ${cx + 7} ${cy + 7}`} stroke="#FBF3EC" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </>
  );
}

function getArms(pose, side, x) {
  const inward = side === "left" ? 1 : -1;
  switch (pose) {
    case "peace-sign":
      return [`M ${x} 110 L ${x + inward * 26} 82`];
    case "victory":
      return [`M ${x} 108 L ${x + inward * 20} 74`, `M ${x} 118 L ${x - inward * 6} 138`];
    case "movie-poster":
      return [`M ${x} 110 L ${x - inward * 24} 96`];
    case "finger-heart":
    case "half-heart":
      return [`M ${x} 108 L ${x + inward * 20} 90`];
    case "cheek-to-cheek":
      return [`M ${x} 112 L ${x + inward * 22} 108`];
    default:
      return [`M ${x} 112 L ${x + inward * 14} 130`];
  }
}

function Extras({ poseId }) {
  if (poseId === "half-heart" || poseId === "finger-heart") {
    return (
      <path
        d="M110 78 c-6-8-18-4-18 4 0 9 18 20 18 20 s18-11 18-20c0-8-12-12-18-4z"
        fill="#C85C74"
        opacity="0.9"
      />
    );
  }
  if (poseId === "movie-poster") {
    return (
      <>
        <path d="M40 30 l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#D9A441" />
        <path d="M180 26 l2 5 5 1-4 4 1 5-4-2-4 2 1-5-4-4 5-1z" fill="#D9A441" />
      </>
    );
  }
  if (poseId === "surprised") {
    return <text x="110" y="34" textAnchor="middle" fontSize="22" fill="#C85C74" fontFamily="Fraunces, serif">!</text>;
  }
  return null;
}
