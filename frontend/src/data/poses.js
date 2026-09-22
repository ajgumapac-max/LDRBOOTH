// Keep the `id` values in lockstep with backend/utils/poses.js — the server
// broadcasts a pose id per round and the frontend looks up the instruction
// text + illustration here.
export const POSE_PROMPTS = [
  { id: "classic-smile", label: "Classic Smile", instruction: "Smile naturally." },
  { id: "cheek-to-cheek", label: "Cheek to Cheek", instruction: "Bring your faces close together." },
  { id: "silly-face", label: "Silly Face", instruction: "Make your funniest expression." },
  { id: "half-heart", label: "Half Heart", instruction: "Each make half a heart." },
  { id: "peace-sign", label: "Peace Signs", instruction: "Both show your best peace sign." },
  { id: "movie-poster", label: "Movie Poster", instruction: "Pose dramatically." },
  { id: "look-away", label: "Look Away", instruction: "Look away like you're in a movie." },
  { id: "finger-heart", label: "Finger Heart", instruction: "Make tiny finger hearts." },
  { id: "surprised", label: "Surprise", instruction: "Give your biggest surprised face." },
  { id: "victory", label: "Victory", instruction: "Celebrate together." },
];

export function findPose(id) {
  return POSE_PROMPTS.find((p) => p.id === id) || POSE_PROMPTS[0];
}
