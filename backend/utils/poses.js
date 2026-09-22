// Server's copy of the pose list — kept in lockstep with
// frontend/src/data/poses.js. The server only needs the name (it drives
// the capture round and includes the pose name in state broadcasts); the
// frontend owns the instruction text + reference illustration.
export const POSE_PROMPTS = [
  "classic-smile",
  "cheek-to-cheek",
  "silly-face",
  "half-heart",
  "peace-sign",
  "movie-poster",
  "look-away",
  "finger-heart",
  "surprised",
  "victory",
];

export function poseForShot(index, totalShots) {
  // Cycles if totalShots is ever configured above 10.
  return POSE_PROMPTS[index % POSE_PROMPTS.length];
}
