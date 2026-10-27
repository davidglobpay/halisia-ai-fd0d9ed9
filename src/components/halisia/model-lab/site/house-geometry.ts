/**
 * Procedural schematic houses (three.js). No downloaded assets. Every solid
 * part is also returned as an axis-aligned collider for walk mode.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import {
  CONTAINER_DIMS,
  MASONRY_WALL_HEIGHT_M,
  MASONRY_WALL_M,
  ROOF_PITCH_DEG,
  masonryFootprint,
} from "./house-spec";
import type { SiteStructure } from "./site-params";

export type HouseBuild = { group: THREE.Group; colliders: THREE.Box3[] };

const mat = (color: number, roughness = 0.8, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

function box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildContainer(s: "container_20ft" | "container_40ft"): HouseBuild {
  const { lengthM: L, widthM: W, heightM: H } = CONTAINER_DIMS[s];
  const group = new THREE.Group();
  const steel = mat(0x7a5a3a, 0.65, 0.35);
  group.add(box(L, H, W, steel, 0, H / 2, 0));

  // Corrugation: vertical ribs on both long sides, merged into one mesh.
  const ribs: THREE.BufferGeometry[] = [];
  const pitch = 0.28;
  for (let x = -L / 2 + 0.15; x < L / 2 - 0.1; x += pitch) {
    for (const side of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.12, H * 0.92, 0.03);
      g.translate(x, H / 2, side * (W / 2 + 0.015));
      ribs.push(g);
    }
  }
  const merged = mergeGeometries(ribs);
  ribs.forEach((g) => g.dispose());
  if (merged) {
    const ribMesh = new THREE.Mesh(merged, steel);
    ribMesh.castShadow = true;
    group.add(ribMesh);
  }

  const door = mat(0x3b2a1c, 0.7);
  const glass = mat(0xa9c6d8, 0.15, 0.1);
  // One door on the south long side, two windows.
  group.add(box(0.9, 2.05, 0.05, door, -L / 4, 1.025, W / 2 + 0.05));
  group.add(box(1.2, 1.0, 0.05, glass, L / 6, 1.5, W / 2 + 0.05));
  group.add(box(1.2, 1.0, 0.05, glass, -L / 8, 1.5, -W / 2 - 0.05));

  return {
    group,
    colliders: [new THREE.Box3(new THREE.Vector3(-L / 2, 0, -W / 2), new THREE.Vector3(L / 2, H, W / 2))],
  };
}

type Opening = { at: number; width: number; bottom: number; top: number };

/** A straight wall along local X centred at 0, with rectangular openings. */
function wallSegments(length: number, height: number, openings: Opening[]) {
  const parts: Array<{ x0: number; x1: number; y0: number; y1: number }> = [];
  const sorted = [...openings].sort((a, b) => a.at - b.at);
  let cursor = -length / 2;
  for (const o of sorted) {
    const a = o.at - o.width / 2;
    const b = o.at + o.width / 2;
    if (a > cursor) parts.push({ x0: cursor, x1: a, y0: 0, y1: height });
    if (o.bottom > 0) parts.push({ x0: a, x1: b, y0: 0, y1: o.bottom });
    if (o.top < height) parts.push({ x0: a, x1: b, y0: o.top, y1: height });
    cursor = b;
  }
  if (cursor < length / 2) parts.push({ x0: cursor, x1: length / 2, y0: 0, y1: height });
  return parts;
}

function buildMasonry(floorAreaM2: number | null): HouseBuild {
  const fp = masonryFootprint(floorAreaM2);
  const L = fp.outerLengthM;
  const W = fp.outerWidthM;
  const T = MASONRY_WALL_M;
  const H = MASONRY_WALL_HEIGHT_M;
  const group = new THREE.Group();
  const colliders: THREE.Box3[] = [];
  const stone = mat(0xcdbf9f, 0.95);
  const win: Opening = { at: 0, width: 1.2, bottom: 0.9, top: 2.1 };

  const walls: Array<{ len: number; ops: Opening[]; place: (x: number, z: number) => [number, number]; alongX: boolean }> = [
    // South (front): door + two windows.
    {
      len: L,
      ops: [
        { at: 0, width: 0.9, bottom: 0, top: 2.1 },
        { ...win, at: -L / 3 },
        { ...win, at: L / 3 },
      ],
      place: (x) => [x, W / 2 - T / 2],
      alongX: true,
    },
    // North: two windows.
    { len: L, ops: [{ ...win, at: -L / 4 }, { ...win, at: L / 4 }], place: (x) => [x, -W / 2 + T / 2], alongX: true },
    // East / West: one window each (between the long walls).
    { len: W - 2 * T, ops: [{ ...win }], place: (x) => [L / 2 - T / 2, x], alongX: false },
    { len: W - 2 * T, ops: [{ ...win }], place: (x) => [-L / 2 + T / 2, x], alongX: false },
  ];

  for (const w of walls) {
    for (const p of wallSegments(w.len, H, w.ops)) {
      const cx = (p.x0 + p.x1) / 2;
      const span = p.x1 - p.x0;
      const h = p.y1 - p.y0;
      const [px, pz] = w.place(cx, 0);
      const sx = w.alongX ? span : T;
      const sz = w.alongX ? T : span;
      group.add(box(sx, h, sz, stone, px, p.y0 + h / 2, pz));
      colliders.push(
        new THREE.Box3(
          new THREE.Vector3(px - sx / 2, p.y0, pz - sz / 2),
          new THREE.Vector3(px + sx / 2, p.y1, pz + sz / 2),
        ),
      );
    }
  }

  // Floor slab.
  const slab = box(L, 0.1, W, mat(0x9a9488, 0.9), 0, 0.05, 0);
  slab.castShadow = false;
  group.add(slab);

  // Pitched (gable) roof, ridge along X, 300 mm eaves.
  const eave = 0.3;
  const half = W / 2 + eave;
  const rise = Math.tan((ROOF_PITCH_DEG * Math.PI) / 180) * half;
  const shape = new THREE.Shape();
  shape.moveTo(-half, 0);
  shape.lineTo(half, 0);
  shape.lineTo(0, rise);
  shape.lineTo(-half, 0);
  const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: L + 2 * eave, bevelEnabled: false });
  roofGeo.translate(0, 0, -(L + 2 * eave) / 2);
  roofGeo.rotateY(Math.PI / 2);
  const roof = new THREE.Mesh(roofGeo, mat(0x6e3b2a, 0.75));
  roof.position.y = H;
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  return { group, colliders };
}

export function buildHouse(structure: SiteStructure, floorAreaM2: number | null): HouseBuild {
  const b =
    structure === "masonry_stone" ? buildMasonry(floorAreaM2) : buildContainer(structure);
  b.group.name = `schematic-${structure}`;
  return b;
}
