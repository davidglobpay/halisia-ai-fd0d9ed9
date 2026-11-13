/**
 * The neighbourhood around the plot in 3D: OpenStreetMap buildings at their
 * recorded (or default) heights, and the roads, railways and power lines that
 * serve them.
 *
 * Two looks:
 * - "real": plain massing over the satellite photo, roads as a light tint so
 *   the photo still shows through;
 * - "model": the same look as the design itself (light walls with windows,
 *   pitched roofs on small buildings, flat roofs with parapets on large ones,
 *   solid roads and paths on a calm ground), so the new design and its
 *   surroundings read as one model.
 *
 * Shapes come from OpenStreetMap; where no height is recorded the building is
 * drawn 3 m tall and the readout says so. Nothing here is a survey.
 */
import * as THREE from "three";

export type ContextStyle = "real" | "model";

export type LocalBuilding = {
  id: number;
  ring: Array<{ x: number; z: number }>;
  heightM: number;
  defaulted: boolean;
};

export type LocalInfra = {
  id: number;
  kind: "major" | "road" | "minor" | "track" | "path" | "rail" | "power";
  widthM: number;
  name: string | null;
  points: Array<{ x: number; z: number }>;
};

type HeightFn = (x: number, z: number) => number;

const ROOF_COLOURS = [0x8f4a34, 0x5b6168, 0x7d8a8e, 0x6f3b2b, 0x4f5f52, 0x9a8a78];

let windowTex: THREE.CanvasTexture | null | undefined;
/** One 3.6 m bay by 3 m storey of light wall with a window, tiling in world units. */
function modelWallTexture(): THREE.CanvasTexture | null {
  if (windowTex !== undefined) return windowTex;
  if (typeof document === "undefined") return (windowTex = null);
  const cv = document.createElement("canvas");
  cv.width = 128;
  cv.height = 128;
  const g = cv.getContext("2d");
  if (!g) return (windowTex = null);
  g.fillStyle = "#efe9dc";
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = "rgba(0,0,0,0.08)";
  g.fillRect(0, 118, 128, 10);
  g.fillStyle = "#2f3336";
  g.fillRect(36, 34, 56, 58);
  const grd = g.createLinearGradient(40, 38, 88, 88);
  grd.addColorStop(0, "#6f8b9c");
  grd.addColorStop(1, "#a9bfcb");
  g.fillStyle = grd;
  g.fillRect(40, 38, 48, 50);
  windowTex = new THREE.CanvasTexture(cv);
  windowTex.colorSpace = THREE.SRGBColorSpace;
  windowTex.wrapS = THREE.RepeatWrapping;
  windowTex.wrapT = THREE.RepeatWrapping;
  // ExtrudeGeometry gives side faces UVs in metres; one tile is 3.6 × 3 m.
  windowTex.repeat.set(1 / 3.6, 1 / 3);
  return windowTex;
}

function ringArea(r: Array<{ x: number; z: number }>): number {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i];
    const q = r[(i + 1) % r.length];
    a += p.x * q.z - q.x * p.z;
  }
  return Math.abs(a) / 2;
}

/** A hipped roof on any footprint: the eaves ring drawn in towards its centre and raised. */
function hipRoof(
  ring: Array<{ x: number; z: number }>,
  base: number,
  rise: number,
): THREE.BufferGeometry {
  const cx = ring.reduce((s, p) => s + p.x, 0) / ring.length;
  const cz = ring.reduce((s, p) => s + p.z, 0) / ring.length;
  const k = 0.3;
  const pos: number[] = [];
  const eave = ring.map((p) => [cx + (p.x - cx) * 1.04, base, cz + (p.z - cz) * 1.04]);
  const top = ring.map((p) => [cx + (p.x - cx) * k, base + rise, cz + (p.z - cz) * k]);
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    pos.push(...eave[i], ...eave[j], ...top[j], ...eave[i], ...top[j], ...top[i]);
  }
  for (let i = 1; i < ring.length - 1; i++) pos.push(...top[0], ...top[i], ...top[i + 1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export function buildNeighbours(
  buildings: LocalBuilding[],
  height: HeightFn,
  style: ContextStyle,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "neighbour-buildings";
  const recorded = new THREE.MeshStandardMaterial({ color: 0xe9e3d5, roughness: 0.9 });
  const defaulted = new THREE.MeshStandardMaterial({ color: 0xd3ccbc, roughness: 0.9 });
  const tex = style === "model" ? modelWallTexture() : null;
  const modelWall = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex ?? undefined,
    roughness: 0.85,
  });
  if (!tex) modelWall.color.set(0xefe9dc);
  const modelTop = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.9 });
  const roofMats = ROOF_COLOURS.map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, side: THREE.DoubleSide }),
  );
  for (const b of buildings) {
    const shape = new THREE.Shape(b.ring.map((p) => new THREE.Vector2(p.x, -p.z)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: b.heightM, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    // Sit on the lowest ground under the footprint, sunk a little so slopes
    // never leave a gap under the walls.
    const base = Math.min(...b.ring.map((p) => height(p.x, p.z))) - 0.3;
    const mesh =
      style === "model"
        ? new THREE.Mesh(geo, [modelTop, modelWall])
        : new THREE.Mesh(geo, b.defaulted ? defaulted : recorded);
    mesh.position.y = base;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.building = b;
    group.add(mesh);
    if (style === "model") {
      const area = ringArea(b.ring);
      const top = base + b.heightM;
      if (area < 260 && b.heightM <= 7 && b.ring.length <= 8) {
        const rise = Math.min(2.4, 0.22 * Math.sqrt(area));
        const roof = new THREE.Mesh(
          hipRoof(b.ring, top, rise),
          roofMats[Math.abs(b.id) % roofMats.length],
        );
        roof.castShadow = true;
        roof.userData.building = b;
        group.add(roof);
      } else {
        // Parapet round a flat roof.
        const pts = b.ring.map((p) => new THREE.Vector3(p.x, top + 0.6, p.z));
        pts.push(pts[0].clone());
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: 0xbab3a3 }),
        );
        group.add(line);
      }
    }
  }
  return group;
}

const ROAD_COLOUR: Record<LocalInfra["kind"], number> = {
  major: 0x3f4245,
  road: 0x4a4d50,
  minor: 0x5d6063,
  track: 0x9c8462,
  path: 0xcfc6b2,
  rail: 0x5a4f46,
  power: 0x333333,
};

/** A ribbon of `width` along a polyline, draped on the ground. */
function ribbon(
  pts: Array<{ x: number; z: number }>,
  width: number,
  height: HeightFn,
  lift: number,
): THREE.BufferGeometry | null {
  // Resample every ~4 m so the ribbon follows the terrain.
  const dense: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 4));
    for (let k = 0; k < n; k++)
      dense.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
  }
  dense.push(pts[pts.length - 1]);
  if (dense.length < 2) return null;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < dense.length; i++) {
    const p = dense[i];
    const q = dense[Math.min(dense.length - 1, i + 1)];
    const o = dense[Math.max(0, i - 1)];
    let dx = q.x - o.x;
    let dz = q.z - o.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    const nx = -dz * (width / 2);
    const nz = dx * (width / 2);
    for (const s of [1, -1]) {
      const x = p.x + nx * s;
      const z = p.z + nz * s;
      pos.push(x, height(x, z) + lift, z);
    }
    if (i < dense.length - 1) {
      const v = i * 2;
      idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildInfrastructure(
  lines: LocalInfra[],
  height: HeightFn,
  style: ContextStyle,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "infrastructure";
  const order: LocalInfra["kind"][] = ["path", "track", "minor", "road", "major", "rail"];
  for (const l of lines) {
    if (l.kind === "power") continue;
    const geo = ribbon(l.points, l.widthM, height, 0.14 + order.indexOf(l.kind) * 0.015);
    if (!geo) continue;
    const mat = new THREE.MeshStandardMaterial({
      color: ROAD_COLOUR[l.kind],
      roughness: 0.95,
      transparent: style === "real",
      opacity: style === "real" ? (l.kind === "path" || l.kind === "track" ? 0.35 : 0.55) : 1,
      depthWrite: style !== "real",
      polygonOffset: true,
      polygonOffsetFactor: -2,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.userData.infra = l;
    group.add(mesh);
    if (l.kind === "rail") {
      for (const off of [-0.72, 0.72]) {
        const rail = ribbon(
          l.points.map((p, i, a) => {
            const q = a[Math.min(a.length - 1, i + 1)];
            const o = a[Math.max(0, i - 1)];
            const len = Math.hypot(q.x - o.x, q.z - o.z) || 1;
            return { x: p.x - ((q.z - o.z) / len) * off, z: p.z + ((q.x - o.x) / len) * off };
          }),
          0.12,
          height,
          0.32,
        );
        if (rail)
          group.add(
            new THREE.Mesh(
              rail,
              new THREE.MeshStandardMaterial({
                color: 0xc9c9c9,
                metalness: 0.6,
                side: THREE.DoubleSide,
              }),
            ),
          );
      }
    }
    // A centre line on the larger roads, in the model style.
    if (style === "model" && (l.kind === "major" || l.kind === "road")) {
      const line = ribbon(l.points, 0.18, height, 0.25);
      if (line)
        group.add(
          new THREE.Mesh(
            line,
            new THREE.MeshBasicMaterial({ color: 0xf1ead2, side: THREE.DoubleSide }),
          ),
        );
    }
  }
  // Power lines: poles about every 40 m and a sagging cable at about 9 m.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x6b5a48, roughness: 0.9 });
  const cableMat = new THREE.LineBasicMaterial({ color: 0x222222 });
  for (const l of lines.filter((q) => q.kind === "power")) {
    const poles: THREE.Vector3[] = [];
    for (let i = 0; i < l.points.length - 1; i++) {
      const a = l.points[i];
      const b = l.points[i + 1];
      const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 40));
      for (let k = 0; k < n; k++) {
        const x = a.x + ((b.x - a.x) * k) / n;
        const z = a.z + ((b.z - a.z) * k) / n;
        poles.push(new THREE.Vector3(x, height(x, z), z));
      }
    }
    const last = l.points[l.points.length - 1];
    poles.push(new THREE.Vector3(last.x, height(last.x, last.z), last.z));
    for (const p of poles) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 9.5, 6), poleMat);
      pole.position.set(p.x, p.y + 4.75, p.z);
      pole.castShadow = true;
      group.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), poleMat);
      arm.position.set(p.x, p.y + 9.2, p.z);
      group.add(arm);
    }
    const cable: THREE.Vector3[] = [];
    for (let i = 0; i < poles.length - 1; i++) {
      const a = poles[i];
      const b = poles[i + 1];
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        const sag = 4 * t * (1 - t) * 0.8;
        cable.push(
          new THREE.Vector3(
            a.x + (b.x - a.x) * t,
            a.y + (b.y - a.y) * t + 9.2 - sag,
            a.z + (b.z - a.z) * t,
          ),
        );
      }
    }
    if (cable.length > 1)
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(cable), cableMat));
  }
  return group;
}

/** Plain words for a tapped building: its height and where that came from. */
export function describeBuilding(b: LocalBuilding): string {
  const floors = Math.max(1, Math.round(b.heightM / 3));
  return b.defaulted
    ? "Building from OpenStreetMap. No height is recorded, so it is drawn 3 m tall (one floor)."
    : `Building from OpenStreetMap, about ${b.heightM.toFixed(1)} m tall (about ${floors} floor${floors === 1 ? "" : "s"}), from its recorded height or floor count.`;
}
