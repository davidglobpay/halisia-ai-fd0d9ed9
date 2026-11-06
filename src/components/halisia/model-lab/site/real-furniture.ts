/**
 * Real furniture models for the site house. The house is built at once with
 * simple box furniture; this module then loads small glTF models in the
 * background and swaps them in where the builder left a marker
 * (`userData.realModel`). If a model fails to load, the boxes stay.
 *
 * Model credits (shown in the viewer):
 * - "Glam Velvet Sofa" © 2021 Wayfair LLC, CC BY 4.0, via the Khronos
 *   glTF Sample Assets.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type RealModelMarker = {
  kind: "sofa";
  /** Floor point under the seat centre, in the marker's parent space. */
  x: number;
  y: number;
  z: number;
  /** Overall length (along the back) and depth, metres. */
  length: number;
  depth: number;
  /** Rotation about Y so the model's front (+Z) faces where the seat looks. */
  rotY: number;
};

const MODEL_URLS: Record<RealModelMarker["kind"], string> = {
  sofa: "/site-assets/sofa.glb",
};

export const REAL_FURNITURE_CREDITS =
  "Sofa model “Glam Velvet Sofa” © 2021 Wayfair LLC, CC BY 4.0. Sky light “Quarry 01” by Poly Haven, CC0.";

type Prepared = { scene: THREE.Object3D; size: THREE.Vector3 };
const cache = new Map<string, Promise<Prepared | null>>();

function load(kind: RealModelMarker["kind"]): Promise<Prepared | null> {
  const hit = cache.get(kind);
  if (hit) return hit;
  const p = new GLTFLoader()
    .loadAsync(MODEL_URLS[kind])
    .then((gltf) => {
      const scene = gltf.scene;
      // Centre on the floor: x/z about the middle, y from the lowest point.
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());
      const pivot = new THREE.Group();
      scene.position.set(-centre.x, -box.min.y, -centre.z);
      pivot.add(scene);
      pivot.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
      return { scene: pivot, size } satisfies Prepared;
    })
    .catch(() => null);
  cache.set(kind, p);
  return p;
}

/** Start downloading the models early (e.g. when the viewer opens). */
export function preloadRealFurniture() {
  if (typeof window === "undefined") return;
  void load("sofa");
}

/**
 * Replace every box placeholder under `root` that has a marker with the
 * real model, scaled to the placeholder's length. Resolves to the number of
 * pieces swapped. Collision boxes are unchanged (they match the footprint).
 */
export async function upgradeFurniture(root: THREE.Object3D): Promise<number> {
  if (typeof window === "undefined") return 0;
  const targets: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o.userData.realModel && !o.userData.realModelDone) targets.push(o);
  });
  let swapped = 0;
  for (const placeholder of targets) {
    const marker = placeholder.userData.realModel as RealModelMarker;
    const prepared = await load(marker.kind);
    // The house may have been rebuilt while the model was loading.
    if (!prepared || !placeholder.parent) continue;
    const model = prepared.scene.clone(true);
    const sx = marker.length / prepared.size.x;
    const sz = marker.depth / prepared.size.z;
    // Keep proportions; fit length and depth, never taller than 1.0 m.
    const k = Math.min(sx, sz * 1.15, 1.0 / prepared.size.y);
    model.scale.set(sx, k, Math.min(sz, k * 1.2));
    model.position.set(marker.x, marker.y, marker.z);
    model.rotation.y = marker.rotY;
    model.name = `${marker.kind}-model`;
    placeholder.parent.add(model);
    for (const c of placeholder.children) c.visible = false;
    placeholder.userData.realModelDone = true;
    swapped++;
  }
  return swapped;
}
