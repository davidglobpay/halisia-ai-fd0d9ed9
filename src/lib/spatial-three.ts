/**
 * Three.js helpers for the Spatial canvas. Every geometry here bakes the one
 * shared ENU → Three.js convention (east = +X, up = +Y, north = −Z, see
 * `enuToThree` in `@/lib/spatial`) directly into the geometry via
 * `rotateX(-PI/2)` — mesh-level rotations must not re-introduce a second,
 * conflicting transform.
 */
import * as THREE from "three";
import { enuToThree, type Vec2 } from "./spatial";

/** Rotation that maps shape-space (x, y=north) onto the XZ ground plane. */
export const SHAPE_FLAT_ROTATION_X = -Math.PI / 2;

function shapeFromRing(ring: Vec2[]): THREE.Shape {
  const shape = new THREE.Shape();
  ring.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y)));
  shape.closePath();
  return shape;
}

/** Closed ring of world-space points at height `y` (north → −Z). */
export function ringToThreePoints(ring: Vec2[], y: number): THREE.Vector3[] {
  return [...ring, ring[0]!].map((p) => {
    const v = enuToThree(p, y);
    return new THREE.Vector3(v.x, v.y, v.z);
  });
}

/** Flat ground-plate geometry lying on the XZ plane, north → −Z, facing +Y. */
export function flatShapeGeometry(ring: Vec2[]): THREE.ShapeGeometry {
  const geo = new THREE.ShapeGeometry(shapeFromRing(ring));
  geo.rotateX(SHAPE_FLAT_ROTATION_X);
  return geo;
}

/** Setback ribbon: outer ring with the buildable footprint cut out. */
export function setbackRibbonGeometry(outer: Vec2[], inner: Vec2[]): THREE.ShapeGeometry {
  const shape = shapeFromRing(outer);
  shape.holes.push(new THREE.Path(inner.map((p) => new THREE.Vector2(p.x, p.y))));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(SHAPE_FLAT_ROTATION_X);
  return geo;
}

/** Extruded buildable envelope, base on the XZ plane, growing +Y. */
export function footprintExtrudeGeometry(ring: Vec2[], heightM: number): THREE.ExtrudeGeometry {
  const geo = new THREE.ExtrudeGeometry(shapeFromRing(ring), {
    depth: heightM,
    bevelEnabled: false,
  });
  geo.rotateX(SHAPE_FLAT_ROTATION_X);
  return geo;
}

type Disposable = {
  geometry?: { dispose(): void };
  material?: { dispose(): void } | Array<{ dispose(): void }>;
};

/**
 * Dispose every geometry/material in a subtree. Safe to call before
 * `group.clear()` on rebuilds and again on unmount — prevents GPU memory
 * leaks when parcels, prototypes or toggles rebuild the scene content.
 */
export function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const d = obj as unknown as Disposable;
    d.geometry?.dispose();
    const mat = d.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  });
}

export type XrSessionMode = "ar" | "vr";
export type XrStartStage = "no-webxr" | "unsupported" | "request-failed";

/**
 * Differentiated XR start failure messages: an unsupported browser, an
 * unsupported session mode, a denied permission and a generic request failure
 * each read differently, and the underlying error message is preserved
 * instead of being masked.
 */
export function xrStartErrorMessage(
  mode: XrSessionMode,
  stage: XrStartStage,
  err?: unknown,
): string {
  const label = mode === "ar" ? "AR" : "VR";
  switch (stage) {
    case "no-webxr":
      return `WebXR is not available in this browser, so immersive ${label} cannot start here. Use the model viewer fallback below.`;
    case "unsupported":
      return `This device or browser does not support immersive ${label} sessions. Use the model viewer fallback below.`;
    case "request-failed": {
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        return `Permission to start the immersive ${label} session was denied. Allow the camera/motion permission and try again.`;
      }
      const msg = err instanceof Error && err.message ? `: ${err.message}` : "";
      return `Could not start the immersive ${label} session${msg}.`;
    }
  }
}
