/**
 * GPU resource disposal for the Model Lab. Never hold more than the active
 * model on the GPU: geometry, materials and every texture slot are released
 * when a model is swapped out or the viewer unmounts.
 */
import * as THREE from "three";

/** Texture-bearing material slots across modern three.js materials. */
export const TEXTURE_SLOTS = [
  "map",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "aoMap",
  "emissiveMap",
  "alphaMap",
  "lightMap",
  "bumpMap",
  "displacementMap",
  "envMap",
  "specularMap",
  "clearcoatMap",
  "clearcoatNormalMap",
  "clearcoatRoughnessMap",
  "sheenColorMap",
  "sheenRoughnessMap",
  "transmissionMap",
  "thicknessMap",
  "iridescenceMap",
  "iridescenceThicknessMap",
  "anisotropyMap",
  "specularIntensityMap",
  "specularColorMap",
  "gradientMap",
] as const;

type Disposable = { dispose?: () => void };

export function collectMaterialTextures(
  material: unknown,
  out: Set<Disposable> = new Set(),
): Set<Disposable> {
  const m = material as Record<string, unknown> | null;
  if (!m) return out;
  for (const slot of TEXTURE_SLOTS) {
    const tex = m[slot] as Disposable | undefined | null;
    if (tex && typeof tex.dispose === "function") out.add(tex);
  }
  return out;
}

export type DisposalReport = {
  geometries: number;
  materials: number;
  textures: number;
};

/**
 * Dispose an entire subtree exactly once per resource. A texture shared by
 * several materials is disposed a single time (Set-deduplicated).
 */
export function disposeSubtree(root: THREE.Object3D | null | undefined): DisposalReport {
  const report: DisposalReport = { geometries: 0, materials: 0, textures: 0 };
  if (!root) return report;

  const geometries = new Set<Disposable>();
  const materials = new Set<Disposable>();
  const textures = new Set<Disposable>();

  root.traverse((obj) => {
    const o = obj as unknown as {
      geometry?: Disposable;
      material?: unknown;
    };
    if (o.geometry && typeof o.geometry.dispose === "function") geometries.add(o.geometry);
    const mat = o.material;
    const list = Array.isArray(mat) ? mat : mat ? [mat] : [];
    for (const m of list) {
      collectMaterialTextures(m, textures);
      const d = m as Disposable;
      if (typeof d.dispose === "function") materials.add(d);
    }
  });

  textures.forEach((t) => {
    t.dispose?.();
    report.textures += 1;
  });
  materials.forEach((m) => {
    m.dispose?.();
    report.materials += 1;
  });
  geometries.forEach((g) => {
    g.dispose?.();
    report.geometries += 1;
  });

  root.parent?.remove(root);
  return report;
}

/** True when the parsed scene contains at least one renderable mesh. */
export function hasRenderableMesh(root: THREE.Object3D | null | undefined): boolean {
  if (!root) return false;
  let found = false;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (found) return;
    if ((m.isMesh || (o as THREE.SkinnedMesh).isSkinnedMesh) && m.geometry) found = true;
  });
  return found;
}
