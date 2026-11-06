/**
 * Furnished schematic houses for the site view (three.js, procedural, no
 * downloaded assets), in the client's design language (roof form, wall
 * finish, window size, interior mood and colours — see design-style.ts).
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
import { DEFAULT_STYLE, hexToInt, type DesignStyle, type WallFinish } from "./design-style";
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
  /** Ceiling and lamp light positions (house-local); the viewer lights them at dusk. */
  lights: THREE.PointLight[];
  /** Shared glowing material of every lamp shade; its emissive intensity is the switch. */
  lampMaterial: THREE.MeshStandardMaterial;
  style: DesignStyle;
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
  | "rug"
  | "rug2"
  | "art1"
  | "art2"
  | "art3"
  | "leaf"
  | "pot"
  | "curtain"
  | "lamp"
  | "mirror"
  | "person",
  THREE.MeshStandardMaterial
>;

/** Interior palettes: [sofa, chairs, timber, floor, rug, curtain]. */
const MOOD: Record<DesignStyle["interior"], number[]> = {
  warm: [0x8a5a3c, 0xb08a5e, 0x8b6a48, 0xb58f63, 0x9a4f36, 0xd8c3a0],
  modern: [0x6b7075, 0x3d4247, 0xc9ae8a, 0xd8d3c8, 0x8d9297, 0xeeeae2],
  classic: [0x2f4a66, 0x7a2f2f, 0x5e4128, 0x6e4a2c, 0x7d2e2a, 0xb9a27c],
};

function makeMats(style: DesignStyle = DEFAULT_STYLE): Mats {
  const m = (
    color: number,
    roughness = 0.85,
    metalness = 0,
    extra: Partial<THREE.MeshStandardMaterialParameters> = {},
  ) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  const [sofa, chairs, timber, floor, rug, curtain] = MOOD[style.interior];
  const wall = hexToInt(style.wallColor);
  const trim = hexToInt(style.trimColor);
  const plaster = finishMaterial(style.wall, style.wallColor);
  return {
    plaster,
    inner: m(style.interior === "classic" ? 0xe9dfcc : 0xf2eee6, 0.95),
    slab: m(0x9a958a, 0.9),
    roof: roofMaterial(style),
    fascia: m(trim, 0.7),
    glass: m(0x9fbfcf, 0.06, 0.4, { transparent: true, opacity: 0.38 }),
    frame: m(trim, 0.55, 0.25),
    wood: m(floor, 0.62),
    tile: m(style.interior === "modern" ? 0xe4e1da : 0xd6cfc2, 0.45),
    carpet: m(0xb9ad99, 1),
    steel:
      style.wall === "timber"
        ? finishMaterial("timber", style.wallColor)
        : m(style.source === "default" ? 0x51606a : wall, 0.55, 0.45),
    steelTrim: m(trim === hexToInt(DEFAULT_STYLE.trimColor) ? 0x2c3236 : trim, 0.5, 0.5),
    ply: m(floor, 0.7),
    fabric: m(sofa, 0.95),
    fabric2: m(chairs, 0.95),
    linen: m(0xf4f1ea, 0.95),
    counter: m(style.interior === "modern" ? 0xe9e7e2 : 0x3b3b3b, 0.3, 0.1),
    cabinet: m(style.interior === "classic" ? timber : 0xd8cfbf, 0.6),
    white: m(0xf7f7f5, 0.3),
    dark: m(0x202224, 0.5),
    concrete: m(0xa6a298, 0.95),
    stone: m(0x8f8574, 1),
    rug: m(rug, 1),
    rug2: m(0xcbbfa8, 1),
    art1: m(0xc2703d, 0.8),
    art2: m(0x2f6b74, 0.8),
    art3: m(0xd8b34a, 0.8),
    leaf: m(0x3f6b34, 0.8),
    pot: m(0xa4593a, 0.85),
    curtain: m(curtain, 1, 0, { side: THREE.DoubleSide }),
    lamp: m(0xfff3dc, 0.6, 0, { emissive: 0xffd9a0, emissiveIntensity: 0.15 }),
    mirror: m(0xd9e4ea, 0.05, 1),
    person: m(0x6d6a66, 0.9),
  };
}

/* --------------------------------------------------------------- textures */

const texCache = new Map<string, THREE.Texture>();

/** Seeded random so a texture looks the same every time it is drawn. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shade(hexColor: string, f: number): string {
  const n = hexToInt(hexColor);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

/**
 * A 1 m × 1 m tile for a wall finish, drawn on a canvas in the client's
 * colour. Returns null outside the browser (tests), where plain colours are
 * used instead.
 */
function finishTexture(kind: WallFinish | "roofSheet" | "roofTile", color: string) {
  if (typeof document === "undefined") return null;
  const key = `${kind}|${color}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const S = 512;
  const cv = document.createElement("canvas");
  cv.width = S;
  cv.height = S;
  const g = cv.getContext("2d");
  if (!g) return null;
  const r = rng(kind.length * 977 + hexToInt(color));
  g.fillStyle = shade(color, 1);
  g.fillRect(0, 0, S, S);
  const speckle = (n: number, a: number) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = r() > 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
      g.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 3);
    }
  };
  if (kind === "plaster" || kind === "concrete") {
    speckle(kind === "concrete" ? 9000 : 5000, kind === "concrete" ? 0.07 : 0.04);
    if (kind === "concrete") {
      g.strokeStyle = "rgba(0,0,0,0.18)";
      g.lineWidth = 2;
      g.strokeRect(1, 1, S - 2, S - 2);
      g.fillStyle = "rgba(0,0,0,0.3)";
      for (const [x, y] of [
        [64, 128],
        [448, 128],
        [64, 384],
        [448, 384],
      ])
        (g.beginPath(), g.arc(x, y, 5, 0, Math.PI * 2), g.fill());
    }
  } else if (kind === "brick") {
    const rows = 13;
    const rh = S / rows;
    g.fillStyle = "#cfc8bb";
    g.fillRect(0, 0, S, S);
    for (let y = 0; y < rows; y++) {
      const off = y % 2 ? 64 : 0;
      for (let x = -1; x < 5; x++) {
        g.fillStyle = shade(color, 0.82 + r() * 0.3);
        g.fillRect(x * 128 + off + 4, y * rh + 4, 120, rh - 8);
      }
    }
    speckle(4000, 0.06);
  } else if (kind === "stone") {
    const rows = 4;
    const rh = S / rows;
    g.fillStyle = "#bdb5a6";
    g.fillRect(0, 0, S, S);
    for (let y = 0; y < rows; y++) {
      const off = y % 2 ? 128 : 0;
      for (let x = -1; x < 3; x++) {
        g.fillStyle = shade(color, 0.93 + r() * 0.12);
        g.fillRect(x * 256 + off + 3, y * rh + 3, 250, rh - 6);
        for (let k = 0; k < 40; k++) {
          g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.05})`;
          g.fillRect(
            x * 256 + off + 5 + r() * 240,
            y * rh + 5 + r() * (rh - 14),
            2 + r() * 8,
            1 + r() * 4,
          );
        }
      }
    }
  } else if (kind === "timber") {
    const boards = 6;
    const bw = S / boards;
    for (let i = 0; i < boards; i++) {
      g.fillStyle = shade(color, 0.85 + r() * 0.25);
      g.fillRect(i * bw, 0, bw, S);
      for (let k = 0; k < 26; k++) {
        g.strokeStyle = `rgba(0,0,0,${0.04 + r() * 0.06})`;
        g.lineWidth = 1 + r() * 2;
        const x = i * bw + 4 + r() * (bw - 8);
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + r() * 6 - 3, S / 3, x + r() * 6 - 3, (2 * S) / 3, x, S);
        g.stroke();
      }
      g.fillStyle = "rgba(0,0,0,0.45)";
      g.fillRect(i * bw, 0, 3, S);
    }
  } else if (kind === "roofSheet") {
    // Corrugated iron sheet (mabati): 76 mm ribs.
    const ribs = 13;
    const w = S / ribs;
    for (let i = 0; i < ribs; i++) {
      const grad = g.createLinearGradient(i * w, 0, (i + 1) * w, 0);
      grad.addColorStop(0, shade(color, 0.7));
      grad.addColorStop(0.5, shade(color, 1.12));
      grad.addColorStop(1, shade(color, 0.7));
      g.fillStyle = grad;
      g.fillRect(i * w, 0, w, S);
    }
  } else if (kind === "roofTile") {
    const rows = 8;
    const rh = S / rows;
    for (let y = 0; y < rows; y++) {
      const off = y % 2 ? 32 : 0;
      for (let x = -1; x < 9; x++) {
        const grad = g.createLinearGradient(0, y * rh, 0, (y + 1) * rh);
        grad.addColorStop(0, shade(color, 0.7));
        grad.addColorStop(0.35, shade(color, 1.05 + r() * 0.08));
        grad.addColorStop(1, shade(color, 0.85));
        g.fillStyle = grad;
        g.fillRect(x * 64 + off + 2, y * rh, 60, rh - 2);
      }
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  texCache.set(key, tex);
  return tex;
}

const bumpCache = new Map<string, THREE.CanvasTexture>();

/**
 * A height map for a finish (white = proud, black = recessed), drawn on the
 * same grid as the colour texture: mortar joints, board gaps, sheet ribs and
 * tile laps catch the light instead of being painted flat.
 */
function finishBump(kind: WallFinish | "roofSheet" | "roofTile") {
  if (typeof document === "undefined" || kind === "plaster") return null;
  const hit = bumpCache.get(kind);
  if (hit) return hit;
  const S = 512;
  const cv = document.createElement("canvas");
  cv.width = S;
  cv.height = S;
  const g = cv.getContext("2d");
  if (!g) return null;
  const r = rng(kind.length * 131);
  g.fillStyle = "#c8c8c8";
  g.fillRect(0, 0, S, S);
  const grain = (n: number, a: number) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = r() > 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
      g.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 3);
    }
  };
  if (kind === "concrete") {
    grain(9000, 0.12);
    g.fillStyle = "#555";
    for (const [x, y] of [
      [64, 128],
      [448, 128],
      [64, 384],
      [448, 384],
    ])
      (g.beginPath(), g.arc(x, y, 5, 0, Math.PI * 2), g.fill());
  } else if (kind === "brick" || kind === "stone") {
    const rows = kind === "brick" ? 13 : 4;
    const cols = kind === "brick" ? 4 : 2;
    const rh = S / rows;
    const cw = S / cols;
    const gap = kind === "brick" ? 4 : 3;
    g.fillStyle = "#3a3a3a";
    g.fillRect(0, 0, S, S);
    for (let y = 0; y < rows; y++) {
      const off = y % 2 ? cw / 2 : 0;
      for (let x = -1; x <= cols; x++) {
        const v = kind === "stone" ? 180 + r() * 60 : 200 + r() * 20;
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(x * cw + off + gap, y * rh + gap, cw - gap * 2, rh - gap * 2);
      }
    }
    grain(kind === "stone" ? 7000 : 3000, kind === "stone" ? 0.18 : 0.1);
  } else if (kind === "timber") {
    const bw = S / 6;
    for (let i = 0; i < 6; i++) {
      const grad = g.createLinearGradient(i * bw, 0, (i + 1) * bw, 0);
      grad.addColorStop(0, "#202020");
      grad.addColorStop(0.08, "#d0d0d0");
      grad.addColorStop(0.85, "#b8b8b8");
      grad.addColorStop(1, "#909090");
      g.fillStyle = grad;
      g.fillRect(i * bw, 0, bw, S);
    }
    grain(2500, 0.08);
  } else if (kind === "roofSheet") {
    const w = S / 13;
    for (let i = 0; i < 13; i++) {
      const grad = g.createLinearGradient(i * w, 0, (i + 1) * w, 0);
      grad.addColorStop(0, "#202020");
      grad.addColorStop(0.5, "#f0f0f0");
      grad.addColorStop(1, "#202020");
      g.fillStyle = grad;
      g.fillRect(i * w, 0, w, S);
    }
  } else if (kind === "roofTile") {
    const rh = S / 8;
    for (let y = 0; y < 8; y++) {
      const off = y % 2 ? 32 : 0;
      for (let x = -1; x < 9; x++) {
        const grad = g.createLinearGradient(0, y * rh, 0, (y + 1) * rh);
        grad.addColorStop(0, "#202020");
        grad.addColorStop(0.3, "#e8e8e8");
        grad.addColorStop(1, "#a0a0a0");
        g.fillStyle = grad;
        g.fillRect(x * 64 + off + 2, y * rh, 60, rh - 2);
      }
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  bumpCache.set(kind, tex);
  return tex;
}

/** Bump strength in the units three.js expects (it scales with texel size). */
const BUMP_SCALE: Record<string, number> = {
  concrete: 0.6,
  brick: 2.2,
  stone: 3.0,
  timber: 1.6,
  roofSheet: 2.5,
  roofTile: 3.0,
};

function finishMaterial(kind: WallFinish, color: string): THREE.MeshStandardMaterial {
  const map = finishTexture(kind, color);
  const rough = kind === "timber" ? 0.75 : kind === "concrete" ? 0.95 : 0.9;
  const mat = map
    ? new THREE.MeshStandardMaterial({ map, roughness: rough })
    : new THREE.MeshStandardMaterial({ color: hexToInt(color), roughness: rough });
  const bumpMap = map ? finishBump(kind) : null;
  if (bumpMap) {
    mat.bumpMap = bumpMap;
    mat.bumpScale = BUMP_SCALE[kind] ?? 1;
  }
  mat.userData.worldUv = !!map;
  return mat;
}

function roofMaterial(style: DesignStyle): THREE.MeshStandardMaterial {
  if (style.roof === "flat")
    return new THREE.MeshStandardMaterial({ color: hexToInt(style.roofColor), roughness: 0.9 });
  // Warm reds and browns read as clay tiles; everything else as iron sheet.
  const n = hexToInt(style.roofColor);
  const rr = (n >> 16) & 255;
  const gg = (n >> 8) & 255;
  const bb = n & 255;
  const tiles = rr > gg + 25 && rr > bb + 25 && style.roof !== "mono";
  const map = finishTexture(tiles ? "roofTile" : "roofSheet", style.roofColor);
  const mat = new THREE.MeshStandardMaterial(
    map
      ? { map, roughness: tiles ? 0.7 : 0.45, metalness: tiles ? 0 : 0.35, side: THREE.DoubleSide }
      : { color: n, roughness: 0.55, metalness: 0.3, side: THREE.DoubleSide },
  );
  const kind = tiles ? "roofTile" : "roofSheet";
  const bumpMap = map ? finishBump(kind) : null;
  if (bumpMap) {
    mat.bumpMap = bumpMap;
    mat.bumpScale = BUMP_SCALE[kind];
  }
  mat.userData.worldUv = !!map;
  return mat;
}

/**
 * Re-map a box's UVs to metres in house space, so a textured finish keeps
 * its true size (bricks stay brick-sized) and lines up across wall pieces.
 * BoxGeometry faces: +x, -x, +y, -y, +z, -z, four vertices each.
 */
function worldUv(
  geo: THREE.BoxGeometry,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let f = 0; f < 6; f++) {
    const [su, sv, ou, ov] =
      f < 2
        ? [d, h, z - d / 2, y - h / 2]
        : f < 4
          ? [w, d, x - w / 2, z - d / 2]
          : [w, h, x - w / 2, y - h / 2];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, ou + uv.getX(i) * su, ov + uv.getY(i) * sv);
    }
  }
  uv.needsUpdate = true;
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
  /** Ceiling light points (house-local), collected while furnishing. */
  lights?: THREE.Vector3[];
  /** Ceiling height above the floor finish, for light fittings. */
  ceilingY?: number;
};

function addBox(
  ctx: Ctx,
  w: number,
  h: number,
  d: number,
  mat: THREE.Material | THREE.Material[],
  x: number,
  y: number,
  z: number,
  collide = false,
  parent?: THREE.Object3D,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mats = Array.isArray(mat) ? mat : [mat];
  if (mats.some((m) => m.userData.worldUv))
    worldUv(geo, w, h, d, ctx.ox + x, ctx.oy + y, ctx.oz + z);
  const mesh = new THREE.Mesh(geo, mat);
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
    /**
     * For outside walls: which side is indoors along the wall's normal
     * (+1 or −1). The outer face then keeps `mat` (the client's finish), the
     * inner face gets plaster, and glazed openings get curtains indoors.
     */
    inside?: 1 | -1;
  },
) {
  const { parts, ops } = wallParts(o.from, o.to, o.height, o.openings ?? []);
  let mat: THREE.Material | THREE.Material[] = o.mat;
  if (o.inside) {
    // Face order +x, -x, +y, -y, +z, -z; the normal is z for an x-wall, x for a z-wall.
    const list: THREE.Material[] = Array(6).fill(o.mat);
    const base = o.axis === "x" ? 4 : 0;
    list[o.inside > 0 ? base : base + 1] = ctx.mats.inner;
    mat = list;
  }
  for (const p of parts) {
    const len = p.b - p.a;
    const h = p.y1 - p.y0;
    const c = (p.a + p.b) / 2;
    const y = o.y0 + p.y0 + h / 2;
    if (o.axis === "x") addBox(ctx, len, h, o.thick, mat, c, y, o.at, true, o.parent);
    else addBox(ctx, o.thick, h, len, mat, o.at, y, c, true, o.parent);
  }
  for (const op of ops) {
    if (!op.glass) continue;
    const len = op.b - op.a;
    const h = op.top - op.bottom;
    const c = (op.a + op.b) / 2;
    const y = o.y0 + op.bottom + h / 2;
    const ft = 0.05;
    if (o.inside) {
      // Two curtain panels drawn back either side of the window, indoors.
      const off = o.at + o.inside * (o.thick / 2 + 0.07);
      const ch = Math.min(o.height - 0.05, op.top + 0.25) - Math.max(0, op.bottom - 0.25);
      const cy = o.y0 + Math.max(0, op.bottom - 0.25) + ch / 2;
      for (const e of [op.a - 0.12, op.b + 0.12]) {
        const piece =
          o.axis === "x"
            ? addBox(ctx, 0.32, ch, 0.05, ctx.mats.curtain, e, cy, off, false, o.parent)
            : addBox(ctx, 0.05, ch, 0.32, ctx.mats.curtain, off, cy, e, false, o.parent);
        piece.castShadow = false;
      }
    }
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
      for (const side of [-1, 1]) {
        addBox(ctx, 0.45, 0.5, 0.4, m.cabinet, cx + side * ns, y + 0.25, edge + s * 0.25, true);
        tableLamp(ctx, cx + side * ns, edge + s * 0.25, y + 0.5);
      }
    const rugW = Math.min(width + 1.0, r.x1 - r.x0 - 0.3);
    addBox(ctx, rugW, 0.004, 1.5, m.rug2, cx, y + 0.002, mid + s * 0.55).castShadow = false;
  } else {
    addBox(ctx, len, 0.3, width, m.wood, mid, y + 0.15, cz, true);
    addBox(ctx, len - 0.06, 0.2, width - 0.06, m.linen, mid, y + 0.4, cz);
    addBox(ctx, len * 0.55, 0.06, width - 0.04, m.fabric, mid + s * len * 0.2, y + 0.53, cz);
    addBox(ctx, 0.08, 1.0, width, m.wood, edge + s * 0.05, y + 0.5, cz, true);
    for (const dz of [-0.35, 0.35])
      addBox(ctx, 0.32, 0.12, 0.5, m.white, edge + s * 0.3, y + 0.56, cz + dz * (width / 1.5));
    const ns = width / 2 + 0.3;
    if (r.z1 - r.z0 > width + 1.3)
      for (const side of [-1, 1]) {
        addBox(ctx, 0.4, 0.5, 0.45, m.cabinet, edge + s * 0.25, y + 0.25, cz + side * ns, true);
        tableLamp(ctx, edge + s * 0.25, cz + side * ns, y + 0.5);
      }
    const rugW = Math.min(width + 1.0, r.z1 - r.z0 - 0.3);
    addBox(ctx, 1.5, 0.004, rugW, m.rug2, mid + s * 0.55, y + 0.002, cz).castShadow = false;
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
  // The box sofa sits in its own group so a real model can replace it once
  // loaded (see real-furniture.ts); the side table and rug stay.
  const seat = new THREE.Group();
  seat.name = "sofa";
  seat.userData.realModel = {
    kind: "sofa",
    x: ctx.ox + cx,
    y: ctx.oy + y,
    z: ctx.oz + cz,
    length,
    depth: 0.9,
    rotY:
      facing === "z1"
        ? 0
        : facing === "z0"
          ? Math.PI
          : facing === "x1"
            ? Math.PI / 2
            : -Math.PI / 2,
  };
  ctx.group.add(seat);
  if (alongZ) {
    addBox(ctx, 0.9, 0.42, length, m.fabric, cx, y + 0.21, cz, true, seat);
    addBox(ctx, 0.22, 0.45, length, m.fabric, cx - s * 0.34, y + 0.62, cz, false, seat);
    for (const e of [-1, 1])
      addBox(ctx, 0.9, 0.6, 0.18, m.fabric, cx, y + 0.3, cz + e * (length / 2 - 0.09), false, seat);
    addBox(ctx, 0.5, 0.42, 1.0, m.wood, cx + s * 1.05, y + 0.21, cz, true);
    addBox(ctx, 1.6, 0.003, 2.4, m.rug, cx + s * 0.9, y + 0.002, cz).castShadow = false;
  } else {
    addBox(ctx, length, 0.42, 0.9, m.fabric, cx, y + 0.21, cz, true, seat);
    addBox(ctx, length, 0.45, 0.22, m.fabric, cx, y + 0.62, cz - s * 0.34, false, seat);
    for (const e of [-1, 1])
      addBox(ctx, 0.18, 0.6, 0.9, m.fabric, cx + e * (length / 2 - 0.09), y + 0.3, cz, false, seat);
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

/* ------------------------------------------------------------- decoration */

/**
 * A framed picture hung on a wall. `wall` is the side of the room the wall
 * is on; the picture hangs 30 mm off it, facing into the room.
 */
function wallArt(
  ctx: Ctx,
  r: Rect,
  wall: Side,
  along: number,
  y: number,
  w = 0.8,
  h = 0.6,
  variant = 0,
) {
  const m = ctx.mats;
  const canvas = [m.art1, m.art2, m.art3][variant % 3];
  const s = wall === "x0" || wall === "z0" ? 1 : -1;
  const at = wall === "x0" ? r.x0 : wall === "x1" ? r.x1 : wall === "z0" ? r.z0 : r.z1;
  if (wall === "x0" || wall === "x1") {
    addBox(ctx, 0.03, h, w, m.dark, at + s * 0.03, y, along).castShadow = false;
    addBox(ctx, 0.01, h - 0.08, w - 0.08, canvas, at + s * 0.05, y, along).castShadow = false;
    // A second, smaller print beside it reads as a gallery wall.
    if (variant % 2 === 0)
      addBox(
        ctx,
        0.03,
        h * 0.55,
        w * 0.45,
        m.dark,
        at + s * 0.03,
        y + 0.05,
        along + w * 0.85,
      ).castShadow = false;
  } else {
    addBox(ctx, w, h, 0.03, m.dark, along, y, at + s * 0.03).castShadow = false;
    addBox(ctx, w - 0.08, h - 0.08, 0.01, canvas, along, y, at + s * 0.05).castShadow = false;
    if (variant % 2 === 0)
      addBox(
        ctx,
        w * 0.45,
        h * 0.55,
        0.03,
        m.dark,
        along + w * 0.85,
        y + 0.05,
        at + s * 0.03,
      ).castShadow = false;
  }
}

/** A potted indoor plant, about `size` metres tall. */
function plant(ctx: Ctx, x: number, z: number, y: number, size = 1.1) {
  const m = ctx.mats;
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.32, 14), m.pot);
  pot.position.set(ctx.ox + x, ctx.oy + y + 0.16, ctx.oz + z);
  pot.castShadow = true;
  ctx.group.add(pot);
  const r = rng(Math.round((x * 31 + z * 17) * 100));
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15 + r() * 0.1, 0), m.leaf);
    const a = r() * Math.PI * 2;
    const rad = 0.06 + r() * 0.12;
    leaf.position.set(
      ctx.ox + x + Math.cos(a) * rad,
      ctx.oy + y + 0.4 + (i / 6) * (size - 0.5) + r() * 0.1,
      ctx.oz + z + Math.sin(a) * rad,
    );
    leaf.scale.set(1, 1.4, 1);
    leaf.castShadow = true;
    ctx.group.add(leaf);
  }
  ctx.colliders.push(
    new THREE.Box3(
      new THREE.Vector3(ctx.ox + x - 0.2, ctx.oy + y, ctx.oz + z - 0.2),
      new THREE.Vector3(ctx.ox + x + 0.2, ctx.oy + y + size, ctx.oz + z + 0.2),
    ),
  );
}

/**
 * A ceiling fitting: a flush disc, or a pendant with a drum shade over a
 * table. Registers a light point for the night view.
 */
function ceilingLight(ctx: Ctx, x: number, z: number, y: number, pendant = false) {
  const m = ctx.mats;
  const top = y + (ctx.ceilingY ?? 2.6);
  if (pendant) {
    addBox(ctx, 0.01, 0.6, 0.01, m.dark, x, top - 0.3, z).castShadow = false;
    const shadeMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.26, 0.22, 20, 1, true),
      m.lamp,
    );
    shadeMesh.position.set(ctx.ox + x, ctx.oy + top - 0.7, ctx.oz + z);
    ctx.group.add(shadeMesh);
    ctx.lights?.push(new THREE.Vector3(ctx.ox + x, ctx.oy + top - 0.85, ctx.oz + z));
  } else {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 20), m.lamp);
    disc.position.set(ctx.ox + x, ctx.oy + top - 0.05, ctx.oz + z);
    ctx.group.add(disc);
    ctx.lights?.push(new THREE.Vector3(ctx.ox + x, ctx.oy + top - 0.3, ctx.oz + z));
  }
}

/** A table lamp standing on a surface at height `y`. */
function tableLamp(ctx: Ctx, x: number, z: number, y: number) {
  const m = ctx.mats;
  addBox(ctx, 0.04, 0.3, 0.04, m.dark, x, y + 0.15, z).castShadow = false;
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.18, 16, 1, true), m.lamp);
  s.position.set(ctx.ox + x, ctx.oy + y + 0.36, ctx.oz + z);
  ctx.group.add(s);
}

/** A 1.75 m standing person, for scale. Stands with its feet at y = 0. */
export function scaleFigure(): THREE.Group {
  const g = new THREE.Group();
  g.name = "scale-figure";
  const shirt = new THREE.MeshStandardMaterial({ color: 0x3f6f8f, roughness: 0.9 });
  const trousers = new THREE.MeshStandardMaterial({ color: 0x2b2d33, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x6b4a35, roughness: 0.8 });
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.72, 4, 10), trousers);
    leg.position.set(s * 0.1, 0.43, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.55, 4, 8), shirt);
    arm.position.set(s * 0.25, 1.12, 0);
    g.add(leg, arm);
  }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 6, 12), shirt);
  torso.position.y = 1.16;
  torso.scale.set(1.1, 1, 0.65);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 14), skin);
  head.position.y = 1.64;
  g.add(torso, head);
  g.traverse((o) => (o.castShadow = true));
  return g;
}

/**
 * Real lights at the fittings, off until the viewer switches them on at
 * dusk. Capped: every light costs shader time on every surface, and phones
 * slow down past a handful.
 */
const MAX_LIGHTS = 8;
function makeLights(group: THREE.Group, points: THREE.Vector3[]): THREE.PointLight[] {
  return points.slice(0, MAX_LIGHTS).map((p) => {
    const l = new THREE.PointLight(0xffd9a0, 0, 7, 2);
    l.position.copy(p);
    l.visible = false;
    l.name = "room-light";
    group.add(l);
    return l;
  });
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

/**
 * Furniture, lighting and decoration for one room. `iL` is the inside length
 * of the house, so the room knows which of its end walls are outside walls
 * (those carry windows and are kept clear of pictures).
 */
function furnishMasonryRoom(ctx: Ctx, r: LaidRoom, y: number, iL: number, art: number) {
  const outer: Side = r.strip === "n" ? "z0" : "z1";
  const inner: Side = r.strip === "n" ? "z1" : "z0";
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const innerZ = r.strip === "n" ? r.z1 : r.z0;
  const outerZ = r.strip === "n" ? r.z0 : r.z1;
  const si = r.strip === "n" ? -1 : 1; // from the inner wall into the room
  const extX0 = r.x0 <= -iL / 2 + 0.05;
  const extX1 = r.x1 >= iL / 2 - 0.05;
  switch (r.type) {
    case "bedroom": {
      bed(ctx, r, d >= 2.9 ? outer : "x0", y, w >= 3.2 ? 1.5 : 1.2);
      if (w >= 3.1 && d >= 2.9) wardrobe(ctx, r.x1 - 0.32, innerZ + si * 0.95, 0.6, 1.5, y);
      const side: Side | null = !extX1 ? "x1" : !extX0 ? "x0" : null;
      if (side && d >= 2.9) wallArt(ctx, r, side, outerZ - si * 0.95, y + 1.5, 0.7, 0.5, art);
      if (d >= 2.9 && w >= 2.8) plant(ctx, r.x0 + 0.25, innerZ + si * 0.3, y, 0.9);
      ceilingLight(ctx, cx, cz, y);
      break;
    }
    case "living": {
      if (w >= 5.5) {
        sofa(ctx, r.x1 - 3.2, cz, y, "x1", Math.min(2.2, d - 0.8));
        tvUnit(ctx, r.x1 - 0.25, cz, y, true);
        wallArt(ctx, r, "x1", cz - 0.3, y + 1.95, 1.1, 0.5, art);
        diningSet(ctx, r.x0 + 1.3, cz, y, true);
        ceilingLight(ctx, r.x0 + 1.3, cz, y, true);
        ceilingLight(ctx, r.x1 - 2.4, cz, y);
        plant(ctx, r.x0 + 0.35, outerZ - si * 0.35, y, 1.3);
      } else {
        sofa(ctx, cx, r.strip === "s" ? r.z1 - 0.6 : r.z0 + 0.6, y, inner, Math.min(2.2, w - 0.6));
        if (!extX1) wallArt(ctx, r, "x1", cz, y + 1.6, 0.9, 0.6, art);
        ceilingLight(ctx, cx, cz, y);
      }
      plant(ctx, r.x1 - 0.35, innerZ + si * 0.35, y, 1.2);
      break;
    }
    case "living_kitchen": {
      kitchenRun(ctx, { ...r, x1: r.x0 + Math.min(3.2, w * 0.45) }, outer, y, 3);
      ceilingLight(ctx, r.x0 + Math.min(1.6, w * 0.22), cz, y);
      if (w >= 5.5) {
        sofa(ctx, r.x1 - 3.0, cz, y, "x1", Math.min(2.2, d - 0.8));
        tvUnit(ctx, r.x1 - 0.25, cz, y, true);
        wallArt(ctx, r, "x1", cz - 0.3, y + 1.95, 1.1, 0.5, art);
        ceilingLight(ctx, r.x1 - 2.2, cz, y);
      }
      plant(ctx, r.x1 - 0.35, innerZ + si * 0.35, y, 1.2);
      break;
    }
    case "kitchen":
      kitchenRun(ctx, r, outer, y, 4);
      if (d >= 3.2 && w >= 2.4) {
        diningSet(ctx, cx, innerZ + si * 0.9, y, false, 2);
        ceilingLight(ctx, cx, innerZ + si * 0.9, y, true);
      } else ceilingLight(ctx, cx, cz, y);
      break;
    case "bath":
      bathroom(ctx, r, y, inner);
      ceilingLight(ctx, cx, cz, y);
      break;
    case "bedsit":
      bed(ctx, r, "x0", y, 1.2);
      if (w >= 4.5) sofa(ctx, r.x1 - 1.4, cz, y, "x0", Math.min(1.8, d - 0.6));
      plant(ctx, r.x1 - 0.3, innerZ + si * 0.3, y, 1.1);
      ceilingLight(ctx, cx, cz, y);
      break;
  }
}

/**
 * The roof in the client's form. Returns the meshes (for "See inside") and
 * the height it adds above the wall plate.
 */
function buildRoof(
  ctx: Ctx,
  style: DesignStyle,
  L: number,
  W: number,
  H: number,
): { parts: THREE.Object3D[]; rise: number } {
  const mats = ctx.mats;
  const parts: THREE.Object3D[] = [];
  const add = (mesh: THREE.Mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = "roof";
    ctx.group.add(mesh);
    parts.push(mesh);
  };
  const eave = 0.45;
  if (style.roof === "flat") {
    const slab = addBox(ctx, L + 0.1, 0.22, W + 0.1, mats.roof, 0, H + 0.11, 0);
    slab.name = "roof";
    parts.push(slab);
    const ph = 0.65;
    const t = 0.2;
    for (const sz of [-1, 1])
      parts.push(
        addBox(ctx, L + 0.1, ph, t, mats.plaster, 0, H + ph / 2, sz * (W / 2 + 0.05 - t / 2)),
      );
    for (const sx of [-1, 1])
      parts.push(
        addBox(ctx, t, ph, W - 0.3, mats.plaster, sx * (L / 2 + 0.05 - t / 2), H + ph / 2, 0),
      );
    parts.push(addBox(ctx, L + 0.18, 0.06, W + 0.18, mats.fascia, 0, H + ph + 0.03, 0));
    return { parts, rise: ph };
  }
  const half = W / 2 + eave;
  if (style.roof === "mono") {
    const rise = Math.tan((10 * Math.PI) / 180) * 2 * half;
    const shape = new THREE.Shape();
    shape.moveTo(-half, 0);
    shape.lineTo(half, 0);
    shape.lineTo(half, 0.22);
    shape.lineTo(-half, rise + 0.22);
    shape.lineTo(-half, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: L + 2 * eave, bevelEnabled: false });
    geo.translate(0, 0, -(L + 2 * eave) / 2);
    geo.rotateY(Math.PI / 2);
    const roof = new THREE.Mesh(geo, mats.roof);
    roof.position.y = H;
    add(roof);
    // A band of high windows under the raised (front) edge.
    parts.push(
      addBox(
        ctx,
        L - 0.6,
        Math.max(0.2, rise - 0.15),
        0.03,
        mats.glass,
        0,
        H + rise / 2,
        W / 2 - 0.1,
      ),
    );
    return { parts, rise: rise + 0.22 };
  }
  const rise = Math.tan((ROOF_PITCH_DEG * Math.PI) / 180) * half;
  if (style.roof === "hip") {
    const ex = L / 2 + eave;
    const ez = half;
    const rx = Math.max(0, ex - ez);
    const v = (x: number, y: number, z: number) => [x, y, z];
    const tri = [
      // south and north slopes (two triangles each)
      [v(-ex, 0, ez), v(ex, 0, ez), v(rx, rise, 0)],
      [v(-ex, 0, ez), v(rx, rise, 0), v(-rx, rise, 0)],
      [v(ex, 0, -ez), v(-ex, 0, -ez), v(-rx, rise, 0)],
      [v(ex, 0, -ez), v(-rx, rise, 0), v(rx, rise, 0)],
      // hipped ends
      [v(ex, 0, ez), v(ex, 0, -ez), v(rx, rise, 0)],
      [v(-ex, 0, -ez), v(-ex, 0, ez), v(-rx, rise, 0)],
      // soffit underneath
      [v(-ex, 0, -ez), v(ex, 0, -ez), v(ex, 0, ez)],
      [v(-ex, 0, -ez), v(ex, 0, ez), v(-ex, 0, ez)],
    ];
    const pos: number[] = [];
    const uv: number[] = [];
    tri.forEach((t, i) =>
      t.forEach(([x, y, z]) => {
        pos.push(x, y, z);
        // Ribs and tile courses run down the slope.
        if (i === 4 || i === 5) uv.push(z, x);
        else uv.push(x, z);
      }),
    );
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    const roof = new THREE.Mesh(geo, mats.roof);
    roof.position.y = H;
    add(roof);
    return { parts, rise };
  }
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
  add(roof);
  for (const sz of [-1, 1]) {
    const f = addBox(ctx, L + 2 * eave, 0.2, 0.04, mats.fascia, 0, H - 0.05, sz * half);
    f.name = "roof-fascia";
    parts.push(f);
  }
  return { parts, rise };
}

function floorMat(mats: Mats, t: RoomType) {
  return t === "bedroom" ? mats.wood : t === "bedsit" ? mats.wood : mats.tile;
}

function buildMasonry(typology: string, floorAreaM2: number | null, style: DesignStyle): SiteHouse {
  const area = floorAreaM2 ?? TYPOLOGY_AREA_M2[typology] ?? 110;
  const fp = masonryFootprint(area);
  const L = fp.outerLengthM;
  const W = fp.outerWidthM;
  const T = MASONRY_WALL_M;
  const H = MASONRY_WALL_HEIGHT_M;
  const iL = fp.innerLengthM;
  const iW = fp.innerWidthM;
  const n = bedroomsOf(typology);
  const mats = makeMats(style);
  const group = new THREE.Group();
  const colliders: THREE.Box3[] = [];
  const lightPoints: THREE.Vector3[] = [];
  const FLOOR = 0.12;
  const ctx: Ctx = {
    group,
    colliders,
    mats,
    ox: 0,
    oy: 0,
    oz: 0,
    lights: lightPoints,
    ceilingY: H - 0.02 - FLOOR,
  };
  const large = style.windows === "large";

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
  const win = (r: Rect, width = large ? 2.6 : 1.5): Opening => ({
    at: (r.x0 + r.x1) / 2,
    width: Math.min(width, r.x1 - r.x0 - 0.8),
    bottom: large ? 0.4 : 0.9,
    top: large ? 2.4 : 2.1,
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
      const ww = Math.min(large ? 3.4 : 2.0, w - 2.6);
      if (ww >= 0.8)
        list.push({
          at: r.x0 + 0.4 + ww / 2,
          width: ww,
          bottom: large ? 0.3 : 0.9,
          top: large ? 2.4 : 2.1,
          glass: true,
        });
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
    inside: 1,
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
    inside: -1,
    openings: southOps.map((o) => ({
      ...o,
      bottom: Math.max(0, o.bottom - 0.1),
      top: o.top - 0.1,
    })),
  });
  // End-wall windows light the end rooms, but not living rooms (their end
  // wall carries the TV and pictures) or bathrooms.
  const endRooms = (sx: number) =>
    (["n", "s"] as const)
      .map((st) => {
        const strip = rooms.filter((r) => r.strip === st);
        return sx < 0 ? strip[0] : strip[strip.length - 1];
      })
      .filter((r): r is LaidRoom => !!r && (r.type === "bedroom" || r.type === "kitchen"));
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
      inside: sx < 0 ? 1 : -1,
      openings: endRooms(sx).map((r) => ({
        at: (r.z0 + r.z1) / 2,
        width: Math.min(large ? 2.0 : 1.2, r.z1 - r.z0 - 0.8),
        bottom: large ? 0.3 : 0.8,
        top: large ? 2.3 : 2.0,
        glass: true,
      })),
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

  // Front rooms first, so the living spaces keep their lights if the cap bites.
  [...southRooms, ...northRooms].forEach((r, i) => furnishMasonryRoom(ctx, r, FLOOR, iL, i));
  if (corridor)
    for (let x = -iL / 2 + 1.8; x < iL / 2 - 1; x += 3.6)
      ceilingLight({ ...ctx, lights: undefined }, x, (corridor.z0 + corridor.z1) / 2, FLOOR);

  // Front step and a door leaf standing open.
  // The step runs down into the ground so it never floats on a slope.
  addBox(ctx, 1.4, 1.6, 0.6, mats.concrete, doorX, -0.7, W / 2 + 0.3);
  addBox(ctx, 0.05, 2.0, 0.95, mats.wood, doorX - 0.5, 1.1, W / 2 - T - 0.47);

  // The roof in the client's form, then the ceiling under it.
  const cutaway: THREE.Object3D[] = [];
  const { parts: roofParts, rise } = buildRoof(ctx, style, L, W, H);
  cutaway.push(...roofParts);
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
    lights: makeLights(group, lightPoints),
    lampMaterial: mats.lamp,
    style,
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

/**
 * Furniture, lights and decoration in one container room. `busy` are the
 * x positions of windows and doorways in the long walls; pictures keep clear
 * of them.
 */
function furnishContainerRoom(
  ctx: Ctx,
  name: string,
  r: Rect,
  y: number,
  L: number,
  busy: number[],
  art: number,
) {
  const len = r.x1 - r.x0;
  const cz = (r.z0 + r.z1) / 2;
  const cx = (r.x0 + r.x1) / 2;
  const clear = (x: number) => busy.every((b) => Math.abs(x - b) > 1.6);
  const artX = [cx, r.x0 + 0.7, r.x1 - 0.7].find(
    (x) => x > r.x0 + 0.5 && x < r.x1 - 0.5 && clear(x),
  );
  if (artX !== undefined && name !== "Bathroom" && !name.includes("store"))
    wallArt(ctx, r, "z0", artX, y + 1.55, 0.7, 0.5, art);
  ceilingLight(ctx, cx, cz, y, name === "Lounge / dining");
  if (name === "Living / kitchen" || name === "Study / lounge" || name === "Lounge / dining")
    plant(ctx, r.x0 + 0.3, r.z1 - 0.3, y, 1.1);
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
  style: DesignStyle,
): SiteHouse {
  const { lengthM: L, widthM: W, heightM: H } = CONTAINER_DIMS[structure];
  const is40 = structure === "container_40ft";
  const n = containerCount(typology, structure);
  const levels = stacked && n > 1 ? 2 : 1;
  const groundN = Math.ceil(n / levels);
  const layout = containerLayout(groundN, structure);
  const bedrooms = bedroomsOf(typology);
  const roles = containerRoles(n, bedrooms, is40);
  const mats = makeMats(style);
  const large = style.windows === "large";
  const lightPoints: THREE.Vector3[] = [];
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
    const ctx: Ctx = {
      group: parent,
      colliders,
      mats,
      ox: pos.x,
      oy: level * H,
      oz: pos.z,
      lights: lightPoints,
      ceilingY: H - 0.2,
    };
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
            width: large ? (is40 ? 3.0 : 2.0) : is40 ? 1.8 : 1.2,
            bottom: large ? 0.35 : 0.85,
            top: large ? 2.3 : 2.15,
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
        inside: nb ? undefined : sz < 0 ? 1 : -1,
        openings: longOps(nb).map((o) => ({
          ...o,
          bottom: Math.max(0, o.bottom - 0.1),
          top: o.top - 0.1,
        })),
        parent,
      });
      // Corrugation, unless the client chose timber cladding over the steel.
      if (!nb && style.wall !== "timber") {
        const gap = large ? (is40 ? 1.55 : 1.05) : is40 ? 0.95 : 0.65;
        for (let x = -L / 2 + 0.3; x < L / 2 - 0.25; x += 0.3) {
          if (win40.some((at) => Math.abs(x - at) < gap)) continue;
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
        inside: sx < 0 ? 1 : -1,
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
      furnishContainerRoom(ctx, rm.name, r, 0.12, L - 2 * t, win40, i + k);
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
    lights: makeLights(group, lightPoints),
    lampMaterial: mats.lamp,
    style,
  };
}

/* ------------------------------------------------------------------ public */

export function buildSiteHouse(o: {
  structure: SiteStructure;
  typology: string;
  floorAreaM2: number | null;
  stacked?: boolean;
  /** The client's design language; the HALISIA default when absent. */
  style?: DesignStyle | null;
}): SiteHouse {
  const style = o.style ?? DEFAULT_STYLE;
  if (o.structure === "masonry_stone") return buildMasonry(o.typology, o.floorAreaM2, style);
  return buildContainers(o.structure, o.typology, !!o.stacked, style);
}

/** Switch the house lights on (dusk and night) or off (day). */
export function setHouseLights(h: SiteHouse, on: boolean): void {
  for (const l of h.lights) {
    l.visible = on;
    l.intensity = on ? 3.2 : 0;
  }
  h.lampMaterial.emissiveIntensity = on ? 1.6 : 0.15;
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
