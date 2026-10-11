/** Browser-safe camera preset list (no three.js import). */
export type CameraPreset =
  | "isometric"
  | "front"
  | "back"
  | "left"
  | "right"
  | "aerial"
  | "eye-level"
  | "worms-eye";

export const CAMERA_PRESETS: { id: CameraPreset; label: string }[] = [
  { id: "isometric", label: "Isometric" },
  { id: "front", label: "Front" },
  { id: "back", label: "Back" },
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
  { id: "aerial", label: "Aerial" },
  { id: "eye-level", label: "Eye level" },
  { id: "worms-eye", label: "Worm's eye" },
];
