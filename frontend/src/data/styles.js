export const STYLES = [
  { id: "natural", name: "Natural", filter: "none", border: "#FBF3EC" },
  { id: "warm", name: "Warm", filter: "sepia(0.15) saturate(1.25) contrast(1.05)", border: "#E8879A" },
  { id: "film", name: "Film", filter: "contrast(1.12) saturate(0.88) brightness(1.02)", border: "#3A2E2A" },
  { id: "dreamy", name: "Dreamy", filter: "brightness(1.1) saturate(0.82)", border: "#F3C6D2" },
  { id: "vintage", name: "Vintage", filter: "sepia(0.35) contrast(0.95) saturate(0.75)", border: "#D9A441" },
  { id: "mono", name: "Mono", filter: "grayscale(1) contrast(1.1)", border: "#3A2E2A" },
];

export function findStyle(id) {
  return STYLES.find((s) => s.id === id) || STYLES[0];
}
