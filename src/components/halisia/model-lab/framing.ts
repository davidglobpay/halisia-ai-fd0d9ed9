/**
 * Camera framing math for the Model Lab. Pure and unit-testable: no hard-coded
 * camera position is shared across models — a 6 m villa and a 60 m tower are
 * both framed from their own bounds.
 */
import * as THREE from "three";

export type Framing = {
  center: THREE.Vector3;
  size: THREE.Vector3;
  maxExtent: number;
  radius: number;
  distance: number;
  position: THREE.Vector3;
  target: THREE.Vector3;
  minDistance: number;
  maxDistance: number;
  near: number;
  far: number;
  /** True when the incoming bounds were empty/degenerate and were substituted. */
  degenerate: boolean;
};

const FALLBACK_EXTENT = 10;

function finite(v: THREE.Vector3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

/** Framing from an arbitrary Box3, guarding non-finite and zero-size bounds. */
export function framingFromBox(
  box: THREE.Box3,
  fovDeg = 45,
  aspect = 16 / 9,
): Framing {
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  let degenerate = false;

  if (box.isEmpty()) {
    degenerate = true;
  } else {
    box.getCenter(center);
    box.getSize(size);
  }
  if (!finite(center)) {
    center.set(0, 0, 0);
    degenerate = true;
  }
  if (!finite(size) || Math.max(size.x, size.y, size.z) <= 1e-6) {
    size.set(FALLBACK_EXTENT, FALLBACK_EXTENT, FALLBACK_EXTENT);
    degenerate = true;
  }

  const maxExtent = Math.max(size.x, size.y, size.z);
  const radius = size.length() / 2 || maxExtent / 2;

  const vFov = (Math.max(1, fovDeg) * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(0.2, aspect));
  const distance =
    Math.max(radius / Math.sin(vFov / 2), radius / Math.sin(hFov / 2)) * 1.15;

  const dir = new THREE.Vector3(0.8, 0.5, 1).normalize();
  const position = center.clone().add(dir.multiplyScalar(distance));

  return {
    center,
    size,
    maxExtent,
    radius,
    distance,
    position,
    target: center.clone(),
    minDistance: Math.max(radius * 0.05, 0.01),
    maxDistance: distance * 12,
    near: Math.max(distance / 5000, 0.01),
    far: distance * 100,
    degenerate,
  };
}

/** Convenience: framing directly from a loaded object. */
export function framingFromObject(
  object: THREE.Object3D,
  fovDeg = 45,
  aspect = 16 / 9,
): Framing {
  return framingFromBox(new THREE.Box3().setFromObject(object), fovDeg, aspect);
}

/**
 * Uniform scale that fits a model into a tabletop presentation footprint,
 * without ever mutating the authored hierarchy (apply it to a wrapper Group).
 */
export function tabletopScale(maxExtent: number, targetMeters = 0.5): number {
  if (!Number.isFinite(maxExtent) || maxExtent <= 1e-6) return 1;
  return targetMeters / maxExtent;
}
