/**
 * Multi-storey massing for the larger building types on the plot planner:
 * floors stacked with slab edges and windows (apartments), curtain-wall glass
 * (offices), glass shopfronts under a canopy (shops), a flat roof with a
 * parapet and plant, a lift core when asked for, and an open or glass-roofed
 * courtyard cut into the middle when it fits.
 *
 * Massing for planning, not a design. The building's front faces −z, towards
 * the plot's road edge; its ground floor sits at y = 0.
 */
import * as THREE from "three";
import { BUILDING_SPECS, type BuildingPlan } from "@/lib/building-types";
import type { DesignStyle } from "@/components/halisia/model-lab/site/design-style";

export type BuildingMassing = {
  group: THREE.Group;
  lengthM: number;
  widthM: number;
  heightM: number;
};

type Facade = "apartments" | "offices" | "shops";

/** Bay width of the facade pattern, metres. */
const BAY_M = 3.6;

const texCache = new Map<string, THREE.CanvasTexture | null>();

/** One bay by one floor of facade, painted on a canvas and repeated by the material. */
function facadeTexture(kind: Facade, wall: string, frame: string): THREE.CanvasTexture | null {
  const key = `${kind}|${wall}|${frame}`;
  if (texCache.has(key)) return texCache.get(key) ?? null;
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 256;
  const g = cv.getContext("2d");
  if (!g) {
    texCache.set(key, null);
    return null;
  }
  const glass = (x: number, y: number, w: number, h: number) => {
    const grd = g.createLinearGradient(x, y, x + w, y + h);
    grd.addColorStop(0, "#5f7d90");
    grd.addColorStop(0.55, "#9fb8c6");
    grd.addColorStop(1, "#47606f");
    g.fillStyle = grd;
    g.fillRect(x, y, w, h);
  };
  if (kind === "offices") {
    glass(0, 0, 256, 256);
    g.fillStyle = frame;
    for (const x of [0, 126, 252]) g.fillRect(x, 0, 4, 256);
    g.fillRect(0, 0, 256, 6);
    g.fillRect(0, 196, 256, 6);
    // Spandrel band at the slab.
    g.fillStyle = "#3e4a52";
    g.fillRect(0, 202, 256, 54);
  } else if (kind === "shops") {
    g.fillStyle = wall;
    g.fillRect(0, 0, 256, 256);
    glass(14, 40, 228, 200);
    g.fillStyle = frame;
    g.fillRect(14, 40, 228, 5);
    g.fillRect(126, 40, 4, 200);
    // Sign band.
    g.fillStyle = "#2b2f33";
    g.fillRect(0, 6, 256, 26);
  } else {
    g.fillStyle = wall;
    g.fillRect(0, 0, 256, 256);
    // Slab edge band.
    g.fillStyle = "rgba(0,0,0,0.12)";
    g.fillRect(0, 228, 256, 28);
    // Two windows per bay, one full-height door to a balcony.
    g.fillStyle = frame;
    g.fillRect(22, 58, 92, 128);
    g.fillRect(146, 26, 88, 196);
    glass(28, 64, 80, 116);
    glass(152, 32, 76, 184);
    g.fillStyle = frame;
    g.fillRect(66, 64, 4, 116);
    g.fillRect(28, 118, 80, 4);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  texCache.set(key, tex);
  return tex;
}

/** A box whose four sides repeat the facade per bay and per floor. */
function storeyBox(
  kind: Facade,
  l: number,
  w: number,
  h: number,
  wall: string,
  frame: string,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(l, h, w);
  const base = facadeTexture(kind, wall, frame);
  const side = (len: number) => {
    if (!base)
      return new THREE.MeshStandardMaterial({ color: kind === "offices" ? 0x7f98a8 : wall });
    const t = base.clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(1, Math.round(len / BAY_M)), 1);
    return new THREE.MeshStandardMaterial({
      map: t,
      roughness: kind === "offices" ? 0.25 : 0.75,
      metalness: kind === "offices" ? 0.35 : 0.05,
    });
  };
  const top = new THREE.MeshStandardMaterial({ color: 0xbfbab0, roughness: 0.9 });
  // BoxGeometry face order: +x, −x, +y, −y, +z, −z.
  const mats = [side(w), side(w), top, top, side(l), side(l)];
  const mesh = new THREE.Mesh(geo, mats);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Rectangles that make up the floor plate: whole, or four wings round a court. */
function plateRects(plan: BuildingPlan): Array<{ x: number; z: number; l: number; w: number }> {
  const L = plan.lengthM;
  const W = plan.widthM;
  if (!plan.court) return [{ x: 0, z: 0, l: L, w: W }];
  const cl = plan.court.lengthM;
  const cw = plan.court.widthM;
  const wingL = (L - cl) / 2;
  const wingW = (W - cw) / 2;
  return [
    { x: 0, z: -W / 2 + wingW / 2, l: L, w: wingW }, // front wing
    { x: 0, z: W / 2 - wingW / 2, l: L, w: wingW }, // back wing
    { x: -L / 2 + wingL / 2, z: 0, l: wingL, w: cw }, // left wing
    { x: L / 2 - wingL / 2, z: 0, l: wingL, w: cw }, // right wing
  ];
}

export function buildBuildingMassing(
  plan: BuildingPlan,
  style: DesignStyle | null | undefined,
): BuildingMassing {
  const spec = BUILDING_SPECS[plan.type];
  const group = new THREE.Group();
  group.name = "plot-building";
  const custom = style && style.source !== "default";
  const wall = custom ? style.wallColor : plan.type.startsWith("com") ? "#d8d4cb" : "#eee6d6";
  const frame = custom ? style.trimColor : "#2f3336";
  const rects = plateRects(plan);
  let y = 0;
  plan.floorHeightsM.forEach((fh, i) => {
    const kind: Facade =
      i === 0
        ? spec.uses.ground === "shops"
          ? "shops"
          : spec.uses.upper === "offices"
            ? "offices"
            : "apartments"
        : spec.uses.upper === "offices"
          ? "offices"
          : "apartments";
    for (const r of rects) {
      const box = storeyBox(kind, r.l, r.w, fh, wall, frame);
      box.position.set(r.x, y + fh / 2, r.z);
      group.add(box);
    }
    // Slab edge between floors, a little proud of the face.
    if (i > 0) {
      const slabMat = new THREE.MeshStandardMaterial({ color: 0xe7e3da, roughness: 0.8 });
      for (const r of rects) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(r.l + 0.12, 0.22, r.w + 0.12), slabMat);
        slab.position.set(r.x, y, r.z);
        slab.castShadow = true;
        group.add(slab);
      }
    }
    // Balconies on the front of apartment floors.
    if (kind === "apartments" && i > 0) {
      const bal = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.7 });
      const rail = new THREE.MeshStandardMaterial({
        color: 0x9fb8c6,
        transparent: true,
        opacity: 0.45,
        roughness: 0.1,
      });
      const front = rects[0];
      const n = Math.max(1, Math.floor(front.l / (BAY_M * 2)));
      for (let k = 0; k < n; k++) {
        const bx = front.x - front.l / 2 + BAY_M * (2 * k + 1.5);
        if (bx > front.x + front.l / 2 - 1.2) break;
        const slab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 1.4), bal);
        slab.position.set(bx, y + 0.08, front.z - front.w / 2 - 0.7);
        slab.castShadow = true;
        group.add(slab);
        const glassRail = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 0.04), rail);
        glassRail.position.set(bx, y + 0.66, front.z - front.w / 2 - 1.38);
        group.add(glassRail);
      }
    }
    y += fh;
  });
  // Shop canopy along the front at the top of the ground floor.
  if (spec.uses.ground === "shops") {
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(plan.lengthM, 0.18, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.6 }),
    );
    canopy.position.set(0, plan.floorHeightsM[0] - 0.4, -plan.widthM / 2 - 1.1);
    canopy.castShadow = true;
    group.add(canopy);
  }
  // Roof: parapets round each part, plant on the roof.
  const parapetMat = new THREE.MeshStandardMaterial({ color: 0xe2ded5, roughness: 0.85 });
  for (const r of rects) {
    for (const [px, pz, pl, pw] of [
      [r.x, r.z - r.w / 2 + 0.1, r.l, 0.2],
      [r.x, r.z + r.w / 2 - 0.1, r.l, 0.2],
      [r.x - r.l / 2 + 0.1, r.z, 0.2, r.w],
      [r.x + r.l / 2 - 0.1, r.z, 0.2, r.w],
    ] as const) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(pl, 1.1, pw), parapetMat);
      p.position.set(px, y + 0.55, pz);
      p.castShadow = true;
      group.add(p);
    }
  }
  const plant = new THREE.MeshStandardMaterial({ color: 0x9a9a96, roughness: 0.6, metalness: 0.3 });
  const back = rects[plan.court ? 1 : 0];
  for (let k = 0; k < Math.min(4, Math.floor(back.l / 6)); k++) {
    const unit = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 1.4), plant);
    unit.position.set(back.x - back.l / 2 + 3 + k * 5, y + 0.6, back.z + back.w / 4);
    unit.castShadow = true;
    group.add(unit);
  }
  // Lift core: a concrete shaft through every floor, rising above the roof.
  if (plan.lifts > 0) {
    const coreMat = new THREE.MeshStandardMaterial({ color: 0xb9b4aa, roughness: 0.9 });
    const coreL = 2.4 * plan.lifts + 2.6; // lift cars plus a stair
    const core = new THREE.Mesh(new THREE.BoxGeometry(coreL, y + 3.2, 5.2), coreMat);
    core.position.set(back.x, (y + 3.2) / 2, back.z + Math.min(0, back.w / 2 - 3.2));
    core.castShadow = true;
    core.name = "lift-core";
    group.add(core);
  }
  // Courtyard: paving, planters and a tree inside; glass roof if it is an atrium.
  if (plan.court) {
    const c = plan.court;
    const pave = new THREE.Mesh(
      new THREE.BoxGeometry(c.lengthM, 0.08, c.widthM),
      new THREE.MeshStandardMaterial({ color: 0xcfc6b4, roughness: 0.95 }),
    );
    pave.position.y = 0.04;
    pave.receiveShadow = true;
    group.add(pave);
    const lawn = new THREE.Mesh(
      new THREE.BoxGeometry(c.lengthM * 0.55, 0.1, c.widthM * 0.55),
      new THREE.MeshStandardMaterial({ color: 0x5f8f3e, roughness: 1 }),
    );
    lawn.position.y = 0.09;
    lawn.receiveShadow = true;
    group.add(lawn);
    group.add(tree(0, 0.1, 0, Math.min(6, Math.min(c.lengthM, c.widthM) * 0.5)));
    if (c.roofed) {
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(c.lengthM, 0.12, c.widthM),
        new THREE.MeshStandardMaterial({
          color: 0xbfd6e2,
          transparent: true,
          opacity: 0.35,
          roughness: 0.05,
          metalness: 0.2,
        }),
      );
      glass.position.y = y + 0.4;
      glass.name = "atrium-roof";
      group.add(glass);
      const ribs = new THREE.MeshStandardMaterial({ color: 0x3a3f43 });
      for (let k = 1; k < Math.max(2, Math.round(c.lengthM / 3)); k++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, c.widthM), ribs);
        rib.position.set(
          -c.lengthM / 2 + (c.lengthM * k) / Math.max(2, Math.round(c.lengthM / 3)),
          y + 0.42,
          0,
        );
        group.add(rib);
      }
    }
  } else if (plan.lantern) {
    // Atrium that does not fit: a glass lantern over the centre of the roof.
    const lantern = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(8, plan.lengthM / 3), 1.6, Math.min(6, plan.widthM / 3)),
      new THREE.MeshStandardMaterial({
        color: 0xbfd6e2,
        transparent: true,
        opacity: 0.55,
        roughness: 0.05,
      }),
    );
    lantern.position.set(0, y + 0.8, 0);
    lantern.name = "atrium-lantern";
    group.add(lantern);
  }
  return { group, lengthM: plan.lengthM, widthM: plan.widthM, heightM: y + 1.1 };
}

/** A simple tree: trunk and a few overlapping crowns. */
export function tree(x: number, y: number, z: number, h = 5): THREE.Group {
  const t = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12 * (h / 5), 0.18 * (h / 5), h * 0.45, 7),
    new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 1 }),
  );
  trunk.position.y = h * 0.225;
  trunk.castShadow = true;
  t.add(trunk);
  const leaf = new THREE.MeshStandardMaterial({ color: 0x3f6f2f, roughness: 0.95 });
  for (const [dx, dy, dz, r] of [
    [0, 0.62, 0, 0.32],
    [0.18, 0.72, 0.1, 0.24],
    [-0.15, 0.78, -0.08, 0.22],
  ] as const) {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(h * r, 1), leaf);
    crown.position.set(dx * h, dy * h, dz * h);
    crown.castShadow = true;
    t.add(crown);
  }
  t.position.set(x, y, z);
  return t;
}
