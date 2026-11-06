/**
 * Furnished schematic houses for the site view (three.js, procedural, no
 * downloaded assets).
 *
 * - Stone masonry: rooms laid out from the bedroom count (bedrooms along the
 *   back, living, kitchen and bathroom along the front), partition walls with
 *   doorways, windows with glass, and simple furniture so the inside reads as
 *   a home.
 * - Containers: the number of units the cost templates use for the typology,
 *   each a steel shell you can walk into, joined through openings in the
 *   shared walls, and optionally stacked two high with an outside stair.
 *
 * Still schematic massing: room sizes follow simple rules, not an
 * architect's plan. Every solid part that should stop a walker is also a
 * collider (house-local coordinates).
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { containerCount, containerLayout, TYPOLOGY_AREA_M2 } from "@/lib/plot-placement";
import type { FoundationPlan } from "./foundation";
import {
  CONTAINER_DIMS,
  MASONRY_WALL_HEIGHT_M,
  MASONRY_WALL_M,
  ROOF_PITCH_DEG,
  masonryFootprint,
} from "./house-spec";
import type { SiteStructure } from "./site-params";

/* ------------------------------------------------------------------ types */

export type PlanRect = { x0: number; x1: number; z0: number; z1: number; level: number };
export type PlanRoom = PlanRect & { name: string };

export type SiteHouse = {
  group: THREE.Group;
  /** Hidden by "See inside": roofs and the upper level of a stack. */
  cutaway: THREE.Object3D[];
  /** House-local boxes that stop a walker. */
  colliders: THREE.Box3[];
  /** Footprint along x (east) and z (south), metres. */
  lengthM: number;
  widthM: number;
  /** Top of the roof above the underside of the floor, metres. */
  heightM: number;
  floorAreaM2: number;
  levels: number;
  /** Container units (0 for masonry). */
  units: number;
  bedrooms: number;
  rooms: PlanRoom[];
  /** Unit outlines (containers) or the external wall line (masonry). */
  outlines: PlanRect[];
  /** Footprint rectangles that sit on the ground (for footings). */
  groundRects: PlanRect[];
  structure: SiteStructure;
};

export function bedroomsOf(typology: string): number {
  const m = /^(\d)br$/.exec(typology);
  return m ? Number(m[1]) : 0;
}

/* -------------------------------------------------------------- materials */

type Mats = Record<
  | "plaster"
  | "inner"
  | "slab"
  | "roof"
  | "fascia"
  | "glass"
  | "frame"
  | "wood"
  | "tile"
  | "carpet"
  | "steel"
  | "steelTrim"
  | "ply"
  | "fabric"
  | "fabric2"
  | "linen"
  | "counter"
  | "cabinet"
  | "white"
  | "dark"
  | "concrete"
  | "stone"
  | "rug",
  THREE.MeshStandardMaterial
>;

function makeMats(steelColor = 0x51606a): Mats {
  const m = (
    color: number,
    roughness = 0.85,
    metalness = 0,
    extra: Partial<THREE.MeshStandardMaterialParameters> = {},
  ) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  return {
    plaster: m(0xe8dfcb, 0.92),
    inner: m(0xf2eee6, 0.95),
    slab: m(0x9a958a, 0.9),
    roof: m(0x6f2f25, 0.55, 0.35),
    fascia: m(0x3a3a38, 0.7),
    glass: m(0x9fbfcf, 0.08, 0.3, { transparent: true, opacity: 0.45 }),
    frame: m(0x2e2f31, 0.6, 0.2),
    wood: m(0x8b6a48, 0.7),
    tile: m(0xd9d6cf, 0.55),
    carpet: m(0xb9ad99, 1),
    steel: m(steelColor, 0.55, 0.45),
    steelTrim: m(0x2c3236, 0.5, 0.5),
    ply: m(0xa07e56, 0.8),
    fabric: m(0x51627a, 0.95),
    fabric2: m(0xb08a5e, 0.95),
    linen: m(0xf4f1ea, 0.95),
    counter: m(0x3b3b3b, 0.35, 0.1),
    cabinet: m(0xd8cfbf, 0.6),
    white: m(0xf7f7f5, 0.35),
    dark: m(0x202224, 0.5),
    concrete: m(0xa6a298, 0.95),
    stone: m(0x8f8574, 1),
    rug: m(0x8c5a46, 1),
  };
}

/* ---------------------------------------------------------------- helpers */

type Ctx = {
  group: THREE.Group;
  colliders: THREE.Box3[];
  mats: Mats;
  /** Offset added to every position (unit origin). */
  ox: number;
  oy: number;
  oz: number;
};

function addBox(
  ctx: Ctx,
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  collide = false,
  parent?: THREE.Object3D,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(ctx.ox + x, ctx.oy + y, ctx.oz + z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  (parent ?? ctx.group).add(mesh);
  if (collide) {
    ctx.colliders.push(
      new THREE.Box3(
        new THREE.Vector3(ctx.ox + x - w / 2, ctx.oy + y - h / 2, ctx.oz + z - d / 2),
        new THREE.Vector3(ctx.ox + x + w / 2, ctx.oy + y + h / 2, ctx.oz + z + d / 2),
      ),
    );
  }
  return mesh;
}

type Opening = { at: number; width: number; bottom: number; top: number; glass?: boolean };

/** Solid pieces of a straight wall between `from` and `to` around openings. */
function wallParts(from: number, to: number, height: number, openings: Opening[]) {
  const parts: Array<{ a: number; b: number; y0: number; y1: number }> = [];
  const ops = openings
    .map((o) => ({
      ...o,
      a: Math.max(from, o.at - o.width / 2),
      b: Math.min(to, o.at + o.width / 2),
    }))
    .filter((o) => o.b - o.a > 0.05)
    .sort((p, q) => p.a - q.a);
  let cursor = from;
  for (const o of ops) {
    if (o.a > cursor + 0.01) parts.push({ a: cursor, b: o.a, y0: 0, y1: height });
    if (o.bottom > 0.01) parts.push({ a: Math.max(o.a, cursor), b: o.b, y0: 0, y1: o.bottom });
    if (o.top < height - 0.01)
      parts.push({ a: Math.max(o.a, cursor), b: o.b, y0: o.top, y1: height });
    cursor = Math.max(cursor, o.b);
  }
  if (cursor < to - 0.01) parts.push({ a: cursor, b: to, y0: 0, y1: height });
  return { parts, ops };
}

/**
 * A wall along `axis` at the fixed coordinate `at`, spanning `from`..`to`,
 * starting at height `y0`. Openings with `glass` get a pane and a frame.
 */
function addWall(
  ctx: Ctx,
  o: {
    axis: "x" | "z";
    at: number;
    from: number;
    to: number;
    y0: number;
    height: number;
    thick: number;
    mat: THREE.Material;
    openings?: Opening[];
    parent?: THREE.Object3D;
  },
) {
  const { parts, ops } = wallParts(o.from, o.to, o.height, o.openings ?? []);
  for (const p of parts) {
    const len = p.b - p.a;
    const h = p.y1 - p.y0;
    const c = (p.a + p.b) / 2;
    const y = o.y0 + p.y0 + h / 2;
    if (o.axis === "x") addBox(ctx, len, h, o.thick, o.mat, c, y, o.at, true, o.parent);
    else addBox(ctx, o.thick, h, len, o.mat, o.at, y, c, true, o.parent);
  }
  for (const op of ops) {
    if (!op.glass) continue;
    const len = op.b - op.a;
    const h = op.top - op.bottom;
    const c = (op.a + op.b) / 2;
    const y = o.y0 + op.bottom + h / 2;
    const ft = 0.05;
    if (o.axis === "x") {
      addBox(ctx, len, h, 0.02, ctx.mats.glass, c, y, o.at, false, o.parent).castShadow = false;
      addBox(
        ctx,
        len,
        ft,
        o.thick + 0.02,
        ctx.mats.frame,
        c,
        o.y0 + op.bottom,
        o.at,
        false,
        o.parent,
      );
      addBox(ctx, len, ft, o.thick + 0.02, ctx.mats.frame, c, o.y0 + op.top, o.at, false, o.parent);
      addBox(ctx, ft, h, 0.06, ctx.mats.frame, c, y, o.at, false, o.parent);
    } else {
      addBox(ctx, 0.02, h, len, ctx.mats.glass, o.at, y, c, false, o.parent).castShadow = false;
      addBox(
        ctx,
        o.thick + 0.02,
        ft,
        len,
        ctx.mats.frame,
        o.at,
        o.y0 + op.bottom,
        c,
        false,
        o.parent,
      );
      addBox(ctx, o.thick + 0.02, ft, len, ctx.mats.frame, o.at, o.y0 + op.top, c, false, o.parent);
      addBox(ctx, 0.06, h, ft, ctx.mats.frame, o.at, y, c, false, o.parent);
    }
  }
}

/* -------------------------------------------------------------- furniture */

type Rect = { x0: number; x1: number; z0: number; z1: number };
/** `outer`: which side of the rect is an outside wall ("z0" | "z1" | "x0" | "x1"). */
type Side = "x0" | "x1" | "z0" | "z1";

function bed(ctx: Ctx, r: Rect, head: Side, y: number, width = 1.5) {
  const along = head === "z0" || head === "z1" ? "z" : "x";
  const len = 2.0;
  const room = along === "z" ? r.z1 - r.z0 : r.x1 - r.x0;
  if (room < len + 0.4) return;
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const s = head === "z0" || head === "x0" ? 1 : -1;
  const edge = head === "z0" ? r.z0 : head === "z1" ? r.z1 : head === "x0" ? r.x0 : r.x1;
  const mid = edge + s * (len / 2 + 0.06);
  const m = ctx.mats;
  if (along === "z") {
    addBox(ctx, width, 0.3, len, m.wood, cx, y + 0.15, mid, true);
    addBox(ctx, width - 0.06, 0.2, len - 0.06, m.linen, cx, y + 0.4, mid);
    addBox(ctx, width - 0.04, 0.06, len * 0.55, m.fabric, cx, y + 0.53, mid + s * len * 0.2);
    addBox(ctx, width, 1.0, 0.08, m.wood, cx, y + 0.5, edge + s * 0.05, true);
    for (const dx of [-0.35, 0.35])
      addBox(ctx, 0.5, 0.12, 0.32, m.white, cx + dx * (width / 1.5), y + 0.56, edge + s * 0.3);
    const ns = width / 2 + 0.3;
    if (r.x1 - r.x0 > width + 1.3)
      for (const side of [-1, 1])
        addBox(ctx, 0.45, 0.5, 0.4, m.cabinet, cx + side * ns, y + 0.25, edge + s * 0.25, true);
  } else {
    addBox(ctx, len, 0.3, width, m.wood, mid, y + 0.15, cz, true);
    addBox(ctx, len - 0.06, 0.2, width - 0.06, m.linen, mid, y + 0.4, cz);
    addBox(ctx, len * 0.55, 0.06, width - 0.04, m.fabric, mid + s * len * 0.2, y + 0.53, cz);
    addBox(ctx, 0.08, 1.0, width, m.wood, edge + s * 0.05, y + 0.5, cz, true);
    for (const dz of [-0.35, 0.35])
      addBox(ctx, 0.32, 0.12, 0.5, m.white, edge + s * 0.3, y + 0.56, cz + dz * (width / 1.5));
  }
}

function wardrobe(ctx: Ctx, x: number, z: number, w: number, d: number, y: number) {
  addBox(ctx, w, 2.1, d, ctx.mats.cabinet, x, y + 1.05, z, true);
  addBox(ctx, 0.02, 1.9, 0.02, ctx.mats.dark, x, y + 1.05, z);
}

function sofa(ctx: Ctx, cx: number, cz: number, y: number, facing: Side, length = 2.1) {
  const m = ctx.mats;
  const alongZ = facing === "x0" || facing === "x1";
  // `facing` is the direction the seat looks toward.
  const s = facing === "x1" || facing === "z1" ? 1 : -1;
  if (alongZ) {
    addBox(ctx, 0.9, 0.42, length, m.fabric, cx, y + 0.21, cz, true);
    addBox(ctx, 0.22, 0.45, length, m.fabric, cx - s * 0.34, y + 0.62, cz);
    for (const e of [-1, 1])
      addBox(ctx, 0.9, 0.6, 0.18, m.fabric, cx, y + 0.3, cz + e * (length / 2 - 0.09));
    addBox(ctx, 0.5, 0.42, 1.0, m.wood, cx + s * 1.05, y + 0.21, cz, true);
    addBox(ctx, 1.6, 0.003, 2.4, m.rug, cx + s * 0.9, y + 0.002, cz).castShadow = false;
  } else {
    addBox(ctx, length, 0.42, 0.9, m.fabric, cx, y + 0.21, cz, true);
    addBox(ctx, length, 0.45, 0.22, m.fabric, cx, y + 0.62, cz - s * 0.34);
    for (const e of [-1, 1])
      addBox(ctx, 0.18, 0.6, 0.9, m.fabric, cx + e * (length / 2 - 0.09), y + 0.3, cz);
    addBox(ctx, 1.0, 0.42, 0.5, m.wood, cx, y + 0.21, cz + s * 1.05, true);
    addBox(ctx, 2.4, 0.003, 1.6, m.rug, cx, y + 0.002, cz + s * 0.9).castShadow = false;
  }
}

function tvUnit(ctx: Ctx, x: number, z: number, y: number, alongZ: boolean) {
  const m = ctx.mats;
  if (alongZ) {
    addBox(ctx, 0.4, 0.5, 1.6, m.wood, x, y + 0.25, z, true);
    addBox(ctx, 0.06, 0.65, 1.2, m.dark, x, y + 0.85, z);
  } else {
    addBox(ctx, 1.6, 0.5, 0.4, m.wood, x, y + 0.25, z, true);
    addBox(ctx, 1.2, 0.65, 0.06, m.dark, x, y + 0.85, z);
  }
}

function diningSet(ctx: Ctx, cx: number, cz: number, y: number, alongZ = false, seats = 4) {
  const m = ctx.mats;
  const tw = alongZ ? 0.9 : 1.5;
  const td = alongZ ? 1.5 : 0.9;
  addBox(ctx, tw, 0.05, td, m.wood, cx, y + 0.74, cz, true);
  for (const [dx, dz] of [
    [-tw / 2 + 0.06, -td / 2 + 0.06],
    [tw / 2 - 0.06, -td / 2 + 0.06],
    [-tw / 2 + 0.06, td / 2 - 0.06],
    [tw / 2 - 0.06, td / 2 - 0.06],
  ])
    addBox(ctx, 0.06, 0.72, 0.06, m.wood, cx + dx, y + 0.36, cz + dz);
  const places = alongZ
    ? [
        [-0.75, -0.35],
        [-0.75, 0.35],
        [0.75, -0.35],
        [0.75, 0.35],
      ]
    : [
        [-0.35, -0.75],
        [0.35, -0.75],
        [-0.35, 0.75],
        [0.35, 0.75],
      ];
  for (const [dx, dz] of places.slice(0, seats)) {
    addBox(ctx, 0.42, 0.45, 0.42, m.fabric2, cx + dx, y + 0.225, cz + dz);
    const bx = alongZ ? cx + dx + Math.sign(dx) * 0.19 : cx + dx;
    const bz = alongZ ? cz + dz : cz + dz + Math.sign(dz) * 0.19;
    addBox(ctx, alongZ ? 0.05 : 0.42, 0.45, alongZ ? 0.42 : 0.05, m.fabric2, bx, y + 0.67, bz);
  }
}

/** Kitchen run along the wall `side` of the rect, leaving room for a fridge. */
function kitchenRun(ctx: Ctx, r: Rect, side: Side, y: number, maxLen = 4) {
  const m = ctx.mats;
  const alongX = side === "z0" || side === "z1";
  const s = side === "z0" || side === "x0" ? 1 : -1;
  const edge = side === "z0" ? r.z0 : side === "z1" ? r.z1 : side === "x0" ? r.x0 : r.x1;
  const span = alongX ? r.x1 - r.x0 : r.z1 - r.z0;
  const len = Math.min(maxLen, span - 0.3);
  if (len < 1.2) return;
  const start = (alongX ? r.x0 : r.z0) + 0.1;
  const runLen = len - 0.75;
  const runC = start + runLen / 2;
  const fridgeC = start + runLen + 0.38;
  const d = edge + s * 0.31;
  if (alongX) {
    addBox(ctx, runLen, 0.86, 0.6, m.cabinet, runC, y + 0.43, d, true);
    addBox(ctx, runLen + 0.02, 0.04, 0.62, m.counter, runC, y + 0.88, d);
    addBox(ctx, 0.55, 0.02, 0.4, m.dark, runC - runLen * 0.2, y + 0.905, d);
    addBox(ctx, runLen, 0.7, 0.34, m.cabinet, runC, y + 1.85, edge + s * 0.18);
    addBox(ctx, 0.7, 1.85, 0.68, m.white, fridgeC, y + 0.925, edge + s * 0.35, true);
  } else {
    addBox(ctx, 0.6, 0.86, runLen, m.cabinet, d, y + 0.43, runC, true);
    addBox(ctx, 0.62, 0.04, runLen + 0.02, m.counter, d, y + 0.88, runC);
    addBox(ctx, 0.4, 0.02, 0.55, m.dark, d, y + 0.905, runC - runLen * 0.2);
    addBox(ctx, 0.34, 0.7, runLen, m.cabinet, edge + s * 0.18, y + 1.85, runC);
    addBox(ctx, 0.68, 1.85, 0.7, m.white, edge + s * 0.35, y + 0.925, fridgeC, true);
  }
}

/**
 * Shower in the corner farthest from the doorway, toilet along the far wall,
 * basin on a vanity by the doorway. `entry` is the wall with the door.
 */
function bathroom(ctx: Ctx, r: Rect, y: number, entry: Side) {
  const m = ctx.mats;
  if (entry === "z0" || entry === "z1") {
    const far = entry === "z0" ? r.z1 : r.z0;
    const s = entry === "z0" ? -1 : 1; // from the far wall into the room
    addBox(ctx, 0.9, 0.05, 0.9, m.white, r.x0 + 0.48, y + 0.025, far + s * 0.48);
    addBox(ctx, 0.02, 1.9, 0.9, m.glass, r.x0 + 0.95, y + 0.95, far + s * 0.48).castShadow = false;
    const tx = r.x1 - 0.35;
    addBox(ctx, 0.4, 0.4, 0.55, m.white, tx, y + 0.2, far + s * 0.4, true);
    addBox(ctx, 0.4, 0.4, 0.2, m.white, tx, y + 0.6, far + s * 0.12);
    if (r.z1 - r.z0 > 1.8)
      addBox(
        ctx,
        0.45,
        0.85,
        0.6,
        m.cabinet,
        r.x1 - 0.25,
        y + 0.425,
        far + s * (r.z1 - r.z0 - 0.45),
        true,
      );
    return;
  }
  const far = entry === "x0" ? r.x1 : r.x0;
  const s = entry === "x0" ? -1 : 1;
  addBox(ctx, 0.9, 0.05, 0.9, m.white, far + s * 0.48, y + 0.025, r.z1 - 0.48);
  addBox(ctx, 0.9, 1.9, 0.02, m.glass, far + s * 0.48, y + 0.95, r.z1 - 0.95).castShadow = false;
  addBox(ctx, 0.55, 0.4, 0.4, m.white, far + s * 0.4, y + 0.2, r.z0 + 0.35, true);
  addBox(ctx, 0.2, 0.4, 0.4, m.white, far + s * 0.12, y + 0.6, r.z0 + 0.35);
  if (r.x1 - r.x0 > 1.8)
    addBox(
      ctx,
      0.6,
      0.85,
      0.45,
      m.cabinet,
      far + s * (r.x1 - r.x0 - 0.45),
      y + 0.425,
      r.z1 - 0.25,
      true,
    );
}

function desk(ctx: Ctx, x: number, z: number, y: number, alongZ: boolean) {
  const m = ctx.mats;
  if (alongZ) {
    addBox(ctx, 0.6, 0.04, 1.3, m.wood, x, y + 0.74, z, true);
    addBox(ctx, 0.45, 0.45, 0.45, m.fabric, x + 0.5, y + 0.225, z);
  } else {
    addBox(ctx, 1.3, 0.04, 0.6, m.wood, x, y + 0.74, z, true);
    addBox(ctx, 0.45, 0.45, 0.45, m.fabric, x, y + 0.225, z + 0.5);
  }
}

/* -------------------------------------------------------- stone masonry */

type RoomType = "bedroom" | "living" | "kitchen" | "bath" | "living_kitchen" | "bedsit";
type LaidRoom = Rect & { type: RoomType; strip: "n" | "s" };

function allocate(
  types: RoomType[],
  from: number,
  length: number,
  fixed: Partial<Record<RoomType, number>>,
): Array<{ type: RoomType; a: number; b: number }> {
  const fixedSum = types.reduce((s, t) => s + (fixed[t] ?? 0), 0);
  const flex = types.filter((t) => fixed[t] == null).length;
  const flexW = flex ? Math.max(0.5, (length - fixedSum) / flex) : 0;
  const scale = flex ? 1 : length / Math.max(0.01, fixedSum);
  let x = from;
  return types.map((t) => {
    const w = fixed[t] != null ? (fixed[t] as number) * scale : flexW;
    const out = { type: t, a: x, b: x + w };
    x += w;
    return out;
  });
}

/** Room layout inside the walls. North = back (z < 0), south = front. */
function masonryRooms(n: number, iL: number, iW: number) {
  const cw = iW >= 6 ? 1.2 : 0;
  const depth = (iW - cw) / 2;
  const x0 = -iL / 2;
  const zN0 = -iW / 2;
  const zN1 = zN0 + depth;
  const zS0 = zN1 + cw;
  const zS1 = iW / 2;
  let north: RoomType[];
  let south: RoomType[];
  if (n === 0) {
    north = ["bath", "kitchen"];
    south = ["bedsit"];
  } else if (n === 1) {
    north = ["bedroom", "bath"];
    south = ["kitchen", "living"];
  } else {
    north = Array.from({ length: Math.min(n, 4) }, () => "bedroom" as const);
    // Four or more bedrooms get a second bathroom.
    south = [
      ...Array.from({ length: n - north.length }, () => "bedroom" as const),
      ...(n >= 4 ? (["bath", "bath"] as const) : (["bath"] as const)),
      "kitchen",
      "living",
    ];
  }
  const fixedN: Partial<Record<RoomType, number>> = n <= 1 ? { bath: 2.2 } : {};
  let fixedS: Partial<Record<RoomType, number>> = { bedroom: 3.3, bath: 2.0, kitchen: 2.8 };
  if (n === 1) fixedS = { kitchen: Math.min(2.8, iL * 0.4) };
  if (n === 0) fixedS = {};
  // Merge the kitchen into the living room when the front gets too tight.
  const sFixed = south.reduce((s, t) => s + (fixedS[t] ?? 0), 0);
  if (n > 1 && iL - sFixed < 3.6) {
    south = south
      .filter((t) => t !== "kitchen")
      .map((t) => (t === "living" ? "living_kitchen" : t));
  }
  const rooms: LaidRoom[] = [
    ...allocate(north, x0, iL, fixedN).map((r) => ({
      type: r.type,
      strip: "n" as const,
      x0: r.a,
      x1: r.b,
      z0: zN0,
      z1: zN1,
    })),
    ...allocate(south, x0, iL, fixedS).map((r) => ({
      type: r.type,
      strip: "s" as const,
      x0: r.a,
      x1: r.b,
      z0: zS0,
      z1: zS1,
    })),
  ];
  return { rooms, corridor: cw > 0 ? { z0: zN1, z1: zS0 } : null };
}

const ROOM_NAME: Record<RoomType, string> = {
  bedroom: "Bedroom",
  living: "Living / dining",
  kitchen: "Kitchen",
  bath: "Bathroom",
  living_kitchen: "Living / kitchen",
  bedsit: "Living / sleeping",
};

function furnishMasonryRoom(ctx: Ctx, r: LaidRoom, y: number) {
  const outer: Side = r.strip === "n" ? "z0" : "z1";
  const inner: Side = r.strip === "n" ? "z1" : "z0";
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const innerZ = r.strip === "n" ? r.z1 : r.z0;
  const si = r.strip === "n" ? -1 : 1; // from the inner wall into the room
  switch (r.type) {
    case "bedroom": {
      bed(ctx, r, d >= 2.9 ? outer : "x0", y, w >= 3.2 ? 1.5 : 1.2);
      if (w >= 3.1 && d >= 2.9) wardrobe(ctx, r.x1 - 0.32, innerZ + si * 0.95, 0.6, 1.5, y);
      break;
    }
    case "living": {
      const cz = (r.z0 + r.z1) / 2;
      if (w >= 5.5) {
        sofa(ctx, r.x1 - 3.2, cz, y, "x1", Math.min(2.2, d - 0.8));
        tvUnit(ctx, r.x1 - 0.25, cz, y, true);
        diningSet(ctx, r.x0 + 1.3, cz, y, true);
      } else {
        sofa(
          ctx,
          (r.x0 + r.x1) / 2,
          r.strip === "s" ? r.z1 - 0.6 : r.z0 + 0.6,
          y,
          inner,
          Math.min(2.2, w - 0.6),
        );
      }
      break;
    }
    case "living_kitchen": {
      kitchenRun(ctx, { ...r, x1: r.x0 + Math.min(3.2, w * 0.45) }, outer, y, 3);
      const cz = (r.z0 + r.z1) / 2;
      if (w >= 5.5) {
        sofa(ctx, r.x1 - 3.0, cz, y, "x1", Math.min(2.2, d - 0.8));
        tvUnit(ctx, r.x1 - 0.25, cz, y, true);
      }
      break;
    }
    case "kitchen":
      kitchenRun(ctx, r, outer, y, 4);
      if (d >= 3.2 && w >= 2.4) diningSet(ctx, (r.x0 + r.x1) / 2, innerZ + si * 0.9, y, false, 2);
      break;
    case "bath":
      bathroom(ctx, r, y, inner);
      break;
    case "bedsit":
      bed(ctx, r, "x0", y, 1.2);
      if (w >= 4.5) sofa(ctx, r.x1 - 1.4, (r.z0 + r.z1) / 2, y, "x0", Math.min(1.8, d - 0.6));
      break;
  }
}

function floorMat(mats: Mats, t: RoomType) {
  return t === "bedroom" ? mats.wood : t === "bedsit" ? mats.wood : mats.tile;
}

function buildMasonry(typology: string, floorAreaM2: number | null): SiteHouse {
  const area = floorAreaM2 ?? TYPOLOGY_AREA_M2[typology] ?? 110;
  const fp = masonryFootprint(area);
  const L = fp.outerLengthM;
  const W = fp.outerWidthM;
  const T = MASONRY_WALL_M;
  const H = MASONRY_WALL_HEIGHT_M;
  const iL = fp.innerLengthM;
  const iW = fp.innerWidthM;
  const n = bedroomsOf(typology);
  const mats = makeMats();
  const group = new THREE.Group();
  const colliders: THREE.Box3[] = [];
  const ctx: Ctx = { group, colliders, mats, ox: 0, oy: 0, oz: 0 };
  const FLOOR = 0.12;

  const { rooms, corridor } = masonryRooms(n, iL, iW);

  // Slab and finished floors.
  const slab = addBox(ctx, L, 0.1, W, mats.slab, 0, 0.05, 0);
  slab.castShadow = false;
  for (const r of rooms)
    addBox(
      ctx,
      r.x1 - r.x0,
      0.02,
      r.z1 - r.z0,
      floorMat(mats, r.type),
      (r.x0 + r.x1) / 2,
      0.11,
      (r.z0 + r.z1) / 2,
    ).castShadow = false;
  if (corridor)
    addBox(
      ctx,
      iL,
      0.02,
      corridor.z1 - corridor.z0,
      mats.tile,
      0,
      0.11,
      (corridor.z0 + corridor.z1) / 2,
    ).castShadow = false;

  // Outside walls with windows from the rooms behind them, and the front door.
  const win = (r: Rect, width = 1.5): Opening => ({
    at: (r.x0 + r.x1) / 2,
    width: Math.min(width, r.x1 - r.x0 - 0.8),
    bottom: 0.9,
    top: 2.1,
    glass: true,
  });
  const small = (r: Rect): Opening => ({
    at: (r.x0 + r.x1) / 2,
    width: 0.6,
    bottom: 1.5,
    top: 2.1,
    glass: true,
  });
  const northOps: Opening[] = [];
  const southOps: Opening[] = [];
  let doorX = 0;
  for (const r of rooms) {
    const list = r.strip === "n" ? northOps : southOps;
    if (r.type === "bath") list.push(small(r));
    else if (r.type === "living" || r.type === "living_kitchen" || r.type === "bedsit") {
      const w = r.x1 - r.x0;
      doorX = r.x1 - 1.0;
      list.push({ at: doorX, width: 1.0, bottom: 0, top: 2.1 });
      const ww = Math.min(2.0, w - 2.6);
      if (ww >= 0.8)
        list.push({ at: r.x0 + 0.4 + ww / 2, width: ww, bottom: 0.9, top: 2.1, glass: true });
    } else list.push(win(r));
  }
  addWall(ctx, {
    axis: "x",
    at: -W / 2 + T / 2,
    from: -L / 2,
    to: L / 2,
    y0: 0.1,
    height: H - 0.1,
    thick: T,
    mat: mats.plaster,
    openings: northOps.map((o) => ({
      ...o,
      bottom: Math.max(0, o.bottom - 0.1),
      top: o.top - 0.1,
    })),
  });
  addWall(ctx, {
    axis: "x",
    at: W / 2 - T / 2,
    from: -L / 2,
    to: L / 2,
    y0: 0.1,
    height: H - 0.1,
    thick: T,
    mat: mats.plaster,
    openings: southOps.map((o) => ({
      ...o,
      bottom: Math.max(0, o.bottom - 0.1),
      top: o.top - 0.1,
    })),
  });
  const strips = rooms.length
    ? [rooms.find((r) => r.strip === "n"), rooms.find((r) => r.strip === "s")]
    : [];
  const endOps: Opening[] = strips
    .filter((r): r is LaidRoom => !!r && r.type !== "bath")
    .map((r) => ({
      at: (r.z0 + r.z1) / 2,
      width: Math.min(1.2, r.z1 - r.z0 - 0.8),
      bottom: 0.8,
      top: 2.0,
      glass: true,
    }));
  for (const sx of [-1, 1])
    addWall(ctx, {
      axis: "z",
      at: sx * (L / 2 - T / 2),
      from: -W / 2 + T,
      to: W / 2 - T,
      y0: 0.1,
      height: H - 0.1,
      thick: T,
      mat: mats.plaster,
      openings: endOps,
    });

  // Inside walls: corridor walls with doorways, then partitions between rooms.
  const PT = 0.1;
  const doorFor = (r: LaidRoom): Opening => {
    const w = r.x1 - r.x0;
    if (r.type === "living" || r.type === "living_kitchen" || r.type === "bedsit")
      return { at: (r.x0 + r.x1) / 2, width: Math.max(0.9, w - 1.2), bottom: 0, top: 2.1 };
    if (r.type === "kitchen")
      return { at: (r.x0 + r.x1) / 2, width: Math.min(1.4, w - 0.6), bottom: 0, top: 2.1 };
    // Bedroom doors sit off-centre, away from the wardrobe corner.
    const at = r.type === "bedroom" ? r.x0 + Math.min(0.9, w / 2) : (r.x0 + r.x1) / 2;
    return { at, width: r.type === "bath" ? 0.75 : 0.85, bottom: 0, top: 2.1 };
  };
  const northRooms = rooms.filter((r) => r.strip === "n");
  const southRooms = rooms.filter((r) => r.strip === "s");
  if (corridor) {
    addWall(ctx, {
      axis: "x",
      at: corridor.z0,
      from: -iL / 2,
      to: iL / 2,
      y0: 0.1,
      height: H - 0.1,
      thick: PT,
      mat: mats.inner,
      openings: northRooms.map(doorFor),
    });
    addWall(ctx, {
      axis: "x",
      at: corridor.z1,
      from: -iL / 2,
      to: iL / 2,
      y0: 0.1,
      height: H - 0.1,
      thick: PT,
      mat: mats.inner,
      openings: southRooms.map(doorFor),
    });
  } else if (northRooms.length) {
    addWall(ctx, {
      axis: "x",
      at: northRooms[0].z1,
      from: -iL / 2,
      to: iL / 2,
      y0: 0.1,
      height: H - 0.1,
      thick: PT,
      mat: mats.inner,
      openings: northRooms.map(doorFor),
    });
  }
  for (const strip of [northRooms, southRooms]) {
    for (let i = 1; i < strip.length; i++) {
      const a = strip[i - 1];
      const b = strip[i];
      const open =
        (a.type === "kitchen" && (b.type === "living" || b.type === "living_kitchen")) ||
        (b.type === "kitchen" && (a.type === "living" || a.type === "living_kitchen"));
      addWall(ctx, {
        axis: "z",
        at: b.x0,
        from: a.z0,
        to: a.z1,
        y0: 0.1,
        height: H - 0.1,
        thick: PT,
        mat: mats.inner,
        openings: open
          ? [
              {
                at: (a.z0 + a.z1) / 2,
                width: Math.max(0.9, a.z1 - a.z0 - 1.0),
                bottom: 0,
                top: 2.2,
              },
            ]
          : [],
      });
    }
  }

  for (const r of rooms) furnishMasonryRoom(ctx, r, FLOOR);

  // Front step and a door leaf standing open.
  // The step runs down into the ground so it never floats on a slope.
  addBox(ctx, 1.4, 1.6, 0.6, mats.concrete, doorX, -0.7, W / 2 + 0.3);
  addBox(ctx, 0.05, 2.0, 0.95, mats.wood, doorX - 0.5, 1.1, W / 2 - T - 0.47);

  // Gable roof, ridge along x, 450 mm eaves, with fascia boards.
  const cutaway: THREE.Object3D[] = [];
  const eave = 0.45;
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
  const roof = new THREE.Mesh(roofGeo, mats.roof);
  roof.position.y = H;
  roof.castShadow = true;
  roof.receiveShadow = true;
  roof.name = "roof";
  group.add(roof);
  cutaway.push(roof);
  for (const sz of [-1, 1]) {
    const f = addBox(ctx, L + 2 * eave, 0.2, 0.04, mats.fascia, 0, H - 0.05, sz * half);
    f.name = "roof-fascia";
    cutaway.push(f);
  }
  // Ceiling under the roof (also hidden by "See inside").
  const ceiling = addBox(ctx, iL, 0.03, iW, mats.inner, 0, H - 0.02, 0);
  ceiling.castShadow = false;
  cutaway.push(ceiling);

  const name = (r: LaidRoom) => {
    const same = rooms.filter((q) => q.type === r.type);
    return same.length > 1 ? `${ROOM_NAME[r.type]} ${same.indexOf(r) + 1}` : ROOM_NAME[r.type];
  };
  group.name = "schematic-masonry_stone";
  return {
    group,
    cutaway,
    colliders,
    lengthM: L,
    widthM: W,
    heightM: H + rise,
    floorAreaM2: Math.round(iL * iW),
    levels: 1,
    units: 0,
    bedrooms: n,
    rooms: rooms.map((r) => ({ name: name(r), x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, level: 0 })),
    outlines: [{ x0: -L / 2, x1: L / 2, z0: -W / 2, z1: W / 2, level: 0 }],
    groundRects: [{ x0: -L / 2, x1: L / 2, z0: -W / 2, z1: W / 2, level: 0 }],
    structure: "masonry_stone",
  };
}

/* -------------------------------------------------------------- containers */

type UnitRole =
  | "studio"
  | "living_kitchen"
  | "bed1"
  | "bed2"
  | "bed1_bath"
  | "bed2_bath"
  | "bath_utility"
  | "lounge";

export function containerRoles(n: number, bedrooms: number, is40: boolean): UnitRole[] {
  if (n <= 1) return ["studio"];
  const roles: UnitRole[] = ["living_kitchen"];
  let left = bedrooms;
  const rest = n - 1;
  for (let i = 0; i < rest; i++) {
    const unitsLeft = rest - i;
    const per = left <= 0 ? 0 : is40 && left > unitsLeft ? 2 : 1;
    left -= per;
    roles.push(per === 2 ? "bed2" : per === 1 ? "bed1" : "lounge");
  }
  // One bathroom, two from three bedrooms up: a spare lounge unit becomes a
  // bathroom and laundry, otherwise a bedroom unit gets an en-suite.
  const baths = bedrooms >= 3 ? 2 : 1;
  for (let k = 0; k < baths; k++) {
    const lounge = roles.lastIndexOf("lounge");
    const b1 = roles.lastIndexOf("bed1");
    const b2 = roles.lastIndexOf("bed2");
    if (lounge > 0) roles[lounge] = "bath_utility";
    else if (b1 > 0) roles[b1] = "bed1_bath";
    else if (b2 > 0) roles[b2] = "bed2_bath";
  }
  return roles;
}

const ROLE_ROOMS: Record<UnitRole, (L: number) => Array<{ name: string; a: number; b: number }>> = {
  studio: (L) => [
    { name: "Living / sleeping / kitchen", a: -L / 2, b: L / 2 - 2.2 },
    { name: "Bathroom", a: L / 2 - 2.2, b: L / 2 },
  ],
  living_kitchen: (L) => [{ name: "Living / kitchen", a: -L / 2, b: L / 2 }],
  bed1: (L) =>
    L > 8
      ? [
          { name: "Study / lounge", a: -L / 2, b: 0 },
          { name: "Bedroom", a: 0, b: L / 2 },
        ]
      : [{ name: "Bedroom", a: -L / 2, b: L / 2 }],
  bed2: (L) => [
    { name: "Bedroom", a: -L / 2, b: 0 },
    { name: "Bedroom", a: 0, b: L / 2 },
  ],
  bed1_bath: (L) =>
    L > 8
      ? [
          { name: "Bedroom", a: -L / 2, b: 0 },
          { name: "Dressing / store", a: 0, b: L / 2 - 2.6 },
          { name: "Bathroom", a: L / 2 - 2.6, b: L / 2 },
        ]
      : [
          { name: "Bedroom", a: -L / 2, b: L / 2 - 2.2 },
          { name: "Bathroom", a: L / 2 - 2.2, b: L / 2 },
        ],
  bed2_bath: (L) => [
    { name: "Bedroom", a: -L / 2, b: -1.2 },
    { name: "Bedroom", a: -1.2, b: L / 2 - 2.4 },
    { name: "Bathroom", a: L / 2 - 2.4, b: L / 2 },
  ],
  bath_utility: (L) => [
    { name: "Laundry / store", a: -L / 2, b: L / 2 - 2.4 },
    { name: "Bathroom", a: L / 2 - 2.4, b: L / 2 },
  ],
  lounge: (L) => [{ name: "Lounge / dining", a: -L / 2, b: L / 2 }],
};

function furnishContainerRoom(ctx: Ctx, name: string, r: Rect, y: number, L: number) {
  const len = r.x1 - r.x0;
  const cz = (r.z0 + r.z1) / 2;
  if (name.startsWith("Bedroom")) {
    bed(ctx, r, r.x0 <= -L / 2 + 0.2 ? "x0" : "x1", y, 1.4);
    if (len > 4.2)
      wardrobe(ctx, r.x0 <= -L / 2 + 0.2 ? r.x1 - 0.7 : r.x0 + 0.7, r.z1 - 0.35, 1.2, 0.6, y);
  } else if (name === "Bathroom") bathroom(ctx, r, y, "x0");
  else if (name === "Living / kitchen") {
    kitchenRun(ctx, { ...r, x0: r.x0 + len * 0.45 }, "z1", y, 3.4);
    sofa(ctx, r.x0 + Math.min(2.2, len * 0.25), r.z0 + 0.5, y, "z1", Math.min(2.1, len * 0.3));
    if (len > 8) diningSet(ctx, r.x1 - 1.2, cz, y, true, 4);
  } else if (name === "Living / sleeping / kitchen") {
    bed(ctx, { ...r, x0: r.x1 - Math.min(2.4, len * 0.4) }, "x1", y, 1.2);
    kitchenRun(ctx, { ...r, x1: r.x0 + Math.min(2.6, len * 0.45) }, "z1", y, 2.6);
    if (len > 6) sofa(ctx, r.x0 + len * 0.45, r.z0 + 0.5, y, "z1", 1.8);
  } else if (name === "Study / lounge") {
    desk(ctx, r.x0 + 1.0, r.z0 + 0.35, y, false);
    sofa(ctx, r.x1 - 1.6, r.z1 - 0.5, y, "z0", 1.8);
  } else if (name === "Lounge / dining") {
    diningSet(ctx, (r.x0 + r.x1) / 2, cz, y, false, 4);
  } else if (name === "Laundry / store" || name === "Dressing / store") {
    wardrobe(ctx, (r.x0 + r.x1) / 2, r.z0 + 0.35, Math.min(2.4, len - 0.6), 0.6, y);
    if (name === "Laundry / store")
      addBox(ctx, 0.6, 0.85, 0.6, ctx.mats.white, r.x1 - 0.5, y + 0.425, r.z1 - 0.4, true);
  }
}

function buildContainers(
  structure: "container_20ft" | "container_40ft",
  typology: string,
  stacked: boolean,
): SiteHouse {
  const { lengthM: L, widthM: W, heightM: H } = CONTAINER_DIMS[structure];
  const is40 = structure === "container_40ft";
  const n = containerCount(typology, structure);
  const levels = stacked && n > 1 ? 2 : 1;
  const groundN = Math.ceil(n / levels);
  const layout = containerLayout(groundN, structure);
  const bedrooms = bedroomsOf(typology);
  const roles = containerRoles(n, bedrooms, is40);
  const mats = makeMats();
  const group = new THREE.Group();
  const colliders: THREE.Box3[] = [];
  const cutaway: THREE.Object3D[] = [];
  const upper = new THREE.Group();
  upper.name = "upper-level";
  const rooms: PlanRoom[] = [];
  const outlines: PlanRect[] = [];
  const groundRects: PlanRect[] = [];
  const PER_ROW = 4;
  const occupied = new Set<string>();
  const slotOf = (i: number) =>
    i < groundN ? { level: 0, slot: i } : { level: 1, slot: i - groundN };
  for (let i = 0; i < n; i++) {
    const s = slotOf(i);
    occupied.add(`${s.level}:${s.slot}`);
  }
  const sameRowNeighbour = (level: number, slot: number, d: -1 | 1) => {
    const t = slot + d;
    if (t < 0 || Math.floor(t / PER_ROW) !== Math.floor(slot / PER_ROW)) return false;
    return occupied.has(`${level}:${t}`);
  };
  const t = 0.05; // steel wall
  const ribsGeo: THREE.BufferGeometry[] = [];
  const connect = is40 ? [-L / 4, L / 4] : [0];

  for (let i = 0; i < n; i++) {
    const { level, slot } = slotOf(i);
    const pos = layout.units[slot];
    const parent = level === 1 ? upper : group;
    const ctx: Ctx = { group: parent, colliders, mats, ox: pos.x, oy: level * H, oz: pos.z };
    const zMinus = sameRowNeighbour(level, slot, -1);
    const zPlus = sameRowNeighbour(level, slot, 1);
    const entrance = slot % PER_ROW === 0 && (level === 0 || slot === 0);

    // Floor, roof plate, corner posts.
    addBox(ctx, L, 0.1, W, mats.steelTrim, 0, 0.05, 0).castShadow = false;
    addBox(ctx, L - 2 * t, 0.02, W - 2 * t, mats.ply, 0, 0.11, 0).castShadow = false;
    const top = addBox(ctx, L, 0.06, W, mats.steel, 0, H - 0.03, 0);
    top.name = "roof";
    if (level === levels - 1 || !occupied.has(`1:${slot}`)) cutaway.push(top);
    for (const cx of [-1, 1])
      for (const cz of [-1, 1])
        addBox(
          ctx,
          0.16,
          H,
          0.16,
          mats.steelTrim,
          cx * (L / 2 - 0.08),
          H / 2,
          cz * (W / 2 - 0.08),
          true,
        );

    // Long walls: openings to neighbours, windows to the outside.
    const win40 = is40 ? [-L / 4, L / 4] : [0];
    const longOps = (neighbour: boolean): Opening[] =>
      neighbour
        ? connect.map((at) => ({ at, width: 1.0, bottom: 0, top: 2.05 }))
        : win40.map((at) => ({
            at,
            width: is40 ? 1.8 : 1.2,
            bottom: 0.85,
            top: 2.15,
            glass: true,
          }));
    for (const [sz, nb] of [
      [-1, zMinus],
      [1, zPlus],
    ] as const) {
      addWall(ctx, {
        axis: "x",
        at: sz * (W / 2 - t / 2),
        from: -L / 2 + 0.16,
        to: L / 2 - 0.16,
        y0: 0.1,
        height: H - 0.16,
        thick: t,
        mat: mats.steel,
        openings: longOps(nb).map((o) => ({
          ...o,
          bottom: Math.max(0, o.bottom - 0.1),
          top: o.top - 0.1,
        })),
        parent,
      });
      if (!nb) {
        for (let x = -L / 2 + 0.3; x < L / 2 - 0.25; x += 0.3) {
          if (win40.some((at) => Math.abs(x - at) < (is40 ? 0.95 : 0.65))) continue;
          const g = new THREE.BoxGeometry(0.1, H - 0.3, 0.035);
          g.translate(pos.x + x, level * H + H / 2, pos.z + sz * (W / 2 + 0.017));
          ribsGeo.push(g);
        }
      }
    }
    // Short end walls: the entrance door or a window.
    for (const sx of [-1, 1]) {
      const isDoor = sx === -1 && entrance;
      addWall(ctx, {
        axis: "z",
        at: sx * (L / 2 - t / 2),
        from: -W / 2 + 0.16,
        to: W / 2 - 0.16,
        y0: 0.1,
        height: H - 0.16,
        thick: t,
        mat: mats.steel,
        openings: [
          isDoor
            ? { at: 0, width: 0.95, bottom: 0, top: 2.0 }
            : { at: 0, width: 1.1, bottom: 0.8, top: 2.0, glass: true },
        ],
        parent,
      });
    }

    // Entrance step down to the ground.
    if (entrance && level === 0) addBox(ctx, 0.6, 1.6, 1.3, mats.concrete, -L / 2 - 0.32, -0.75, 0);

    // Rooms and furniture.
    const inner = { z0: -W / 2 + t, z1: W / 2 - t };
    const roomList = ROLE_ROOMS[roles[i]](L - 2 * t);
    for (let k = 0; k < roomList.length; k++) {
      const rm = roomList[k];
      if (k > 0) {
        addWall(ctx, {
          axis: "z",
          at: rm.a,
          from: inner.z0,
          to: inner.z1,
          y0: 0.1,
          height: H - 0.16,
          thick: 0.08,
          mat: mats.inner,
          openings: [
            {
              at: inner.z0 + 0.65,
              width: rm.name === "Bathroom" ? 0.7 : 0.85,
              bottom: 0,
              top: 2.0,
            },
          ],
          parent,
        });
      }
      const r = { x0: rm.a + 0.05, x1: rm.b - 0.05, z0: inner.z0, z1: inner.z1 };
      furnishContainerRoom(ctx, rm.name, r, 0.12, L - 2 * t);
      rooms.push({
        name: rm.name,
        x0: pos.x + rm.a,
        x1: pos.x + rm.b,
        z0: pos.z + inner.z0,
        z1: pos.z + inner.z1,
        level,
      });
    }
    const rect = {
      x0: pos.x - L / 2,
      x1: pos.x + L / 2,
      z0: pos.z - W / 2,
      z1: pos.z + W / 2,
      level,
    };
    outlines.push(rect);
    if (level === 0) groundRects.push(rect);
  }

  const ribs = ribsGeo.length ? mergeGeometries(ribsGeo) : null;
  ribsGeo.forEach((g) => g.dispose());
  if (ribs) {
    const ribMesh = new THREE.Mesh(ribs, mats.steel);
    ribMesh.castShadow = true;
    ribMesh.receiveShadow = true;
    ribMesh.name = "corrugation";
    group.add(ribMesh);
  }

  // Outside stair and landing up to the first upper unit.
  if (levels === 2) {
    const u0 = layout.units[0];
    const ctx: Ctx = { group: upper, colliders, mats, ox: 0, oy: 0, oz: 0 };
    const top = H + 0.1;
    const lx = u0.x - L / 2 - 0.75;
    addBox(ctx, 1.3, 0.08, 1.3, mats.steelTrim, lx, top - 0.04, u0.z);
    for (const [dx, dz] of [
      [-0.6, -0.6],
      [-0.6, 0.6],
    ])
      addBox(ctx, 0.1, top, 0.1, mats.steelTrim, lx + dx, top / 2, u0.z + dz, true);
    const N = Math.ceil(top / 0.18);
    const rise = top / N;
    const going = 0.26;
    const z0 = u0.z + 0.65;
    for (let k = 1; k < N; k++) {
      const zc = z0 + (N - k - 0.5) * going;
      addBox(ctx, 0.95, 0.04, going + 0.02, mats.steelTrim, lx, k * rise - 0.02, zc);
    }
    const run = (N - 1) * going;
    const len = Math.hypot(run, top);
    const ang = Math.atan2(top, run);
    for (const sx of [-0.5, 0.5]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, len), mats.steelTrim);
      st.position.set(lx + sx, top / 2 - 0.05, z0 + run / 2);
      st.rotation.x = ang;
      st.castShadow = true;
      upper.add(st);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, len), mats.steelTrim);
      rail.position.set(lx + sx, top / 2 + 0.9, z0 + run / 2);
      rail.rotation.x = ang;
      upper.add(rail);
    }
    rooms.push({
      name: "Outside stair",
      x0: lx - 0.5,
      x1: lx + 0.5,
      z0: u0.z - 0.65,
      z1: z0 + run,
      level: 0,
    });
  }
  if (levels === 2) {
    group.add(upper);
    cutaway.push(upper);
  }

  group.name = `schematic-${structure}`;
  const unitArea = is40 ? 29.7 : 14.6;
  return {
    group,
    cutaway,
    colliders,
    lengthM: layout.lengthM,
    widthM: layout.widthM,
    heightM: levels * H,
    floorAreaM2: Math.round(n * unitArea * 10) / 10,
    levels,
    units: n,
    bedrooms,
    rooms,
    outlines,
    groundRects,
    structure,
  };
}

/* ------------------------------------------------------------------ public */

export function buildSiteHouse(o: {
  structure: SiteStructure;
  typology: string;
  floorAreaM2: number | null;
  stacked?: boolean;
}): SiteHouse {
  if (o.structure === "masonry_stone") return buildMasonry(o.typology, o.floorAreaM2);
  return buildContainers(o.structure, o.typology, !!o.stacked);
}

/**
 * Foundation geometry under the house, in house-local coordinates: from
 * `depthM` below the underside of the floor up to it. The bottom sits below
 * the lowest ground so nothing floats.
 */
export function buildFoundation(h: SiteHouse, plan: FoundationPlan, depthM: number): THREE.Group {
  const g = new THREE.Group();
  g.name = `foundation-${plan.kind}`;
  const mats = makeMats();
  const ctx: Ctx = { group: g, colliders: [], mats, ox: 0, oy: 0, oz: 0 };
  const d = Math.max(0.3, depthM);
  if (plan.kind === "container_pads" || plan.kind === "container_piers") {
    const is40 = h.structure === "container_40ft";
    for (const r of h.groundRects) {
      const xs = is40 ? [r.x0 + 0.2, (r.x0 + r.x1) / 2, r.x1 - 0.2] : [r.x0 + 0.2, r.x1 - 0.2];
      for (const x of xs)
        for (const z of [r.z0 + 0.2, r.z1 - 0.2]) {
          const s = plan.kind === "container_piers" ? 0.4 : 0.55;
          addBox(ctx, s, d, s, mats.concrete, x, -d / 2, z);
          addBox(ctx, 0.9, 0.3, 0.9, mats.concrete, x, -d + 0.15, z);
          addBox(ctx, s + 0.05, 0.02, s + 0.05, mats.steelTrim, x, -0.01, z);
        }
    }
    return g;
  }
  const L = h.lengthM;
  const W = h.widthM;
  if (plan.kind === "columns_beams") {
    addBox(ctx, L, 0.15, W, mats.concrete, 0, -0.075, 0);
    const nx = Math.max(2, Math.ceil(L / 3.5) + 1);
    const nz = Math.max(2, Math.ceil(W / 3.5) + 1);
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++) {
        const x = -L / 2 + 0.2 + ((L - 0.4) * i) / (nx - 1);
        const z = -W / 2 + 0.2 + ((W - 0.4) * j) / (nz - 1);
        addBox(ctx, 0.3, d - 0.15, 0.3, mats.concrete, x, -0.15 - (d - 0.15) / 2, z);
        addBox(ctx, 1.0, 0.35, 1.0, mats.concrete, x, -d + 0.175, z);
      }
    for (const z of [-W / 2 + 0.2, W / 2 - 0.2])
      addBox(ctx, L, 0.4, 0.25, mats.concrete, 0, -0.35, z);
    for (const x of [-L / 2 + 0.2, L / 2 - 0.2])
      addBox(ctx, 0.25, 0.4, W, mats.concrete, x, -0.35, 0);
    return g;
  }
  // Strip footing / raised plinth: a stone plinth wall to floor level.
  addBox(ctx, L + 0.1, d, W + 0.1, mats.stone, 0, -d / 2, 0);
  addBox(ctx, L + 0.12, 0.03, W + 0.12, mats.dark, 0, -0.015, 0).castShadow = false;
  return g;
}
