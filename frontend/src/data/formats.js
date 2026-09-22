export const FORMATS = [
  {
    id: "classic-strip",
    name: "Classic Strip",
    description: "Six classic frames in a single column, like a real booth strip.",
    shotsUsed: 6,
    aspect: "tall",
  },
  {
    id: "memory-card",
    name: "Memory Card",
    description: "One large hero photo with a caption strip below.",
    shotsUsed: 1,
    aspect: "wide",
  },
  {
    id: "four-frame",
    name: "Four Frame",
    description: "A 2×2 grid — four favorites, evenly framed.",
    shotsUsed: 4,
    aspect: "square",
  },
  {
    id: "double-frame",
    name: "Double Frame",
    description: "Two side-by-side photos, connected with no gap between you.",
    shotsUsed: 2,
    aspect: "wide",
  },
];

export function findFormat(id) {
  return FORMATS.find((f) => f.id === id) || FORMATS[0];
}
