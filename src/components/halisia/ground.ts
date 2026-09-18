import * as THREE from "three";

import { fetchElevationGrid, type ElevationGrid } from "@/lib/terrain-grid";

/**
 * Ground for the Model Lab.
 *
 * Until now the viewer placed a building at y = 0 with nothing at y = 0 to
 * stand on and no shadow under it, so every model read as floating in a
 * coloured void. This module supplies the missing surface in two forms:
 *
 *   • a studio ground — a plain, endless plane, used while terrain loads or
 *     when the elevation service cannot be reached;
 *   • a terrain ground — real ASTER 30 m elevation for a chosen coordinate,
 *     so the land actually undulates under the building.
 *
 * The terrain is a reference surface, not a site survey. The sampled grid is
 * far coarser than a plot, and no parcel is matched, so nothing here may be
 * presented as cadastral placement.
 */

export const MODEL_LAB_TERRAIN_NOTE =
  "Indicative terrain from ASTER 30 m elevation, sampled on a 9 × 9 grid across about 800 m and smoothed between samples. It shows the shape of the wider ground, not the plot, and it is not a survey.";

export type TerrainSite = {
  readonly id: string;
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
  /** What the ground does here, so the picker means something. */
  readonly relief: string;
};

/** Kenyan sites chosen for the range of ground they cover, gentle to steep. */
export const TERRAIN_SITES: readonly TerrainSite[] = Object.freeze([
  {
    id: "ruiru",
    name: "Ruiru, Kiambu",
    lat: -1.1469,
    lng: 36.9611,
    relief: "Gently rolling, typical of the Nairobi development belt",
  },
  {
    id: "ngong",
    name: "Ngong Hills, Kajiado",
    lat: -1.3897,
    lng: 36.644,
    relief: "Steep escarpment with strong relief",
  },
  {
    id: "kitengela",
    name: "Kitengela, Kajiado",
    lat: -1.4783,
    lng: 36.9597,
    relief: "Broad, near-flat plain",
  },
  {
    id: "naivasha",
    name: "Naivasha, Nakuru",
    lat: -0.7167,
    lng: 36.4333,
    relief: "Rift valley floor rising toward the shoulder",
  },
  {
    id: "mtwapa",
    name: "Mtwapa, Kilifi",
    lat: -3.9333,
    lng: 39.7333,
    relief: "Low coastal ground, very little fall",
  },
]);

export const DEFAULT_TERRAIN_SITE = TERRAIN_SITES[0];

/**
 * Sampling geometry. Open-Topo-Data's public endpoint accepts at most 100
 * points per request, so the grid stays at 9 × 9 (81 points) and detail comes
 * from interpolating between samples rather than from asking for more.
 */
const GRID_N = 9;
const STEP_DEG = 0.0009; // about 100 m at the equator
const MESH_SEGMENTS = 96; // display resolution of the interpolated surface
const METRES_PER_DEG_LAT = 111_320;

/** Smoothstep, so interpolated ground has no visible facets between samples. */
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Height in metres at normalised position (u, v) across the sampled grid. */
function sampleGrid(grid: ElevationGrid, u: number, v: number): number {
  const n = grid.n;
  const fx = Math.min(Math.max(u, 0), 1) * (n - 1);
  const fy = Math.min(Math.max(v, 0), 1) * (n - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, n - 1);
  const y1 = Math.min(y0 + 1, n - 1);
  const tx = smooth(fx - x0);
  const ty = smooth(fy - y0);
  const a = grid.values[y0][x0];
  const b = grid.values[y0][x1];
  const c = grid.values[y1][x0];
  const d = grid.values[y1][x1];
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

/**
 * Earthy ramp from valley to ridge, kept inside the brand's forest-and-stone
 * range so the terrain never fights the building it carries.
 */
function terrainColour(t: number, slope: number, out: THREE.Color): THREE.Color {
  const stops: Array<[number, [number, number, number]]> = [
    [0, [0x3f / 255, 0x50 / 255, 0x3a / 255]],
    [0.45, [0x5c / 255, 0x6f / 255, 0x4c / 255]],
    [0.75, [0x8c / 255, 0x8a / 255, 0x68 / 255]],
    [1, [0xb8 / 255, 0xad / 255, 0x8d / 255]],
  ];
  const c = Math.min(Math.max(t, 0), 1);
  let r = stops[stops.length - 1][1];
  for (let i = 1; i < stops.length; i++) {
    if (c <= stops[i][0]) {
      const [t0, a] = stops[i - 1];
      const [t1, b] = stops[i];
      const k = (c - t0) / (t1 - t0);
      r = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
      break;
    }
  }
  // Steep faces read as exposed rock and soil rather than grass.
  const rock = Math.min(1, slope * 2.2);
  return out.setRGB(
    r[0] * (1 - rock) + 0.52 * rock,
    r[1] * (1 - rock) + 0.47 * rock,
    r[2] * (1 - rock) + 0.4 * rock,
  );
}

export type GroundHandle = {
  /** Add this to the scene; remove and dispose it through `disposeSubtree`. */
  readonly group: THREE.Group;
  /** Metres of fall across the sampled square, or null for the studio ground. */
  readonly reliefM: number | null;
  /** Elevation at the point the building stands on, or null. */
  readonly centreElevationM: number | null;
  /** Width of the ground square in metres. */
  readonly spanM: number;
  readonly kind: "studio" | "terrain";
};

/**
 * A plain ground plane. Deliberately large: with scene fog set to the
 * background colour it reads as ground running to the horizon rather than as
 * a slab the building sits on the edge of.
 */
export function buildStudioGround(spanM = 2400): GroundHandle {
  const group = new THREE.Group();
  group.name = "model-lab-ground";

  const mat = new THREE.MeshStandardMaterial({
    color: 0x6f7360,
    roughness: 0.98,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(spanM, spanM, 1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  mesh.name = "model-lab-ground-plane";
  group.add(mesh);

  return { group, reliefM: null, centreElevationM: null, spanM, kind: "studio" };
}

/**
 * Real ground for a coordinate. Heights are true metres, shifted so the
 * sampled centre sits at y = 0 — the same height the building's wrapper is
 * offset to, so the model stands on the ground rather than through it.
 */
export async function buildTerrainGround(
  site: { lat: number; lng: number },
  opts: { signal?: AbortSignal } = {},
): Promise<GroundHandle> {
  const grid = await fetchElevationGrid(
    site.lat,
    site.lng,
    GRID_N,
    STEP_DEG,
    opts.signal,
    "contour-grid",
  );

  const latSpanM = STEP_DEG * (GRID_N - 1) * METRES_PER_DEG_LAT;
  const lngSpanM = latSpanM * Math.cos((site.lat * Math.PI) / 180);
  const spanM = Math.max(latSpanM, lngSpanM);

  // One mesh, five times wider than the sampled square. The middle fifth
  // carries the real samples; beyond it `sampleGrid` clamps, so the edge
  // heights simply run on to the horizon. That leaves no cliff at the edge of
  // the data and no second mesh to seam against.
  const OUTRUN = 5;
  const geo = new THREE.PlaneGeometry(
    lngSpanM * OUTRUN,
    latSpanM * OUTRUN,
    MESH_SEGMENTS,
    MESH_SEGMENTS,
  );
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const centre = sampleGrid(grid, 0.5, 0.5);

  // PlaneGeometry is built in XY and rotated into place below, so the height
  // goes on Z here and becomes Y once the mesh is laid flat.
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / lngSpanM + 0.5;
    // Grid rows run north to south; the plane's +Y runs the other way.
    const v = 0.5 - pos.getY(i) / latSpanM;
    pos.setZ(i, sampleGrid(grid, u, v) - centre);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  // Colour every vertex by how high it sits and how steeply it falls.
  const range = Math.max(1, grid.max - grid.min);
  const normals = geo.attributes.normal as THREE.BufferAttribute;
  const colours = new Float32Array(pos.count * 3);
  const scratch = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const height = pos.getZ(i) + centre;
    // The plane's own normal is +Z before rotation, so that component is "up".
    const slope = 1 - Math.min(1, Math.abs(normals.getZ(i)));
    terrainColour((height - grid.min) / range, slope, scratch);
    colours[i * 3] = scratch.r;
    colours[i * 3 + 1] = scratch.g;
    colours[i * 3 + 2] = scratch.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colours, 3));

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.97,
      metalness: 0,
      flatShading: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  mesh.name = "model-lab-terrain";

  const group = new THREE.Group();
  group.name = "model-lab-ground";
  group.add(mesh);

  return {
    group,
    reliefM: Math.round(grid.max - grid.min),
    centreElevationM: Math.round(centre),
    spanM,
    kind: "terrain",
  };
}

/**
 * Points the sun at the model and sizes its shadow camera to it. Without this
 * the default shadow frustum is far too small, and the contact shadow — the
 * cue that actually makes a building look planted — never appears.
 */
export function configureSunShadow(sun: THREE.DirectionalLight, modelExtentM: number) {
  const reach = Math.max(40, modelExtentM * 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera as THREE.OrthographicCamera;
  cam.left = -reach;
  cam.right = reach;
  cam.top = reach;
  cam.bottom = -reach;
  cam.near = 0.5;
  cam.far = reach * 6;
  cam.updateProjectionMatrix();
  // Softens the stair-stepping that otherwise shows on large flat roofs.
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.6;
}

/** Fog colour per environment, so ground and sky meet instead of butting. */
export function fogForEnv(mode: "day" | "night" | "neutral"): THREE.Fog {
  if (mode === "day") return new THREE.Fog(0xdfe9f2, 220, 1600);
  if (mode === "night") return new THREE.Fog(0x0d1420, 140, 1100);
  return new THREE.Fog(0xf1ece0, 220, 1600);
}
