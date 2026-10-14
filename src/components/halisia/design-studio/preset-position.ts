import * as THREE from "three";
import type { CameraPreset } from "./camera-presets";
export function presetPosition(
  preset: CameraPreset,
  centre: THREE.Vector3,
  radius: number,
  height: number,
): { position: THREE.Vector3; target: THREE.Vector3 } {
  const r = Math.max(radius * 2.2, 8);
  const t = centre.clone();
  const p = new THREE.Vector3();
  switch (preset) {
    case "front":
      p.set(t.x, t.y + height * 0.1, t.z + r);
      break;
    case "back":
      p.set(t.x, t.y + height * 0.1, t.z - r);
      break;
    case "left":
      p.set(t.x - r, t.y + height * 0.1, t.z);
      break;
    case "right":
      p.set(t.x + r, t.y + height * 0.1, t.z);
      break;
    case "aerial":
      p.set(t.x + 0.01, t.y + r * 1.4, t.z + 0.01);
      break;
    case "eye-level":
      t.y = 1.6;
      p.set(t.x + r * 0.35, 1.6, t.z + r * 0.9);
      break;
    case "worms-eye":
      t.y = Math.max(height * 0.7, 2);
      p.set(t.x + r * 0.2, 0.35, t.z + r * 0.55);
      break;
    default:
      p.set(t.x + r * 0.7, t.y + r * 0.7, t.z + r * 0.7);
  }
  return { position: p, target: t };
}
