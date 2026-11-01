/**
 * Real-ground context for the plot planner: terrain from a coarse public
 * elevation grid and neighbouring buildings from OpenStreetMap.
 *
 * Both are reference context, not survey: the terrain grid is ~30–90 m data
 * sampled every ~40 m, and building heights are OSM tags where recorded and a
 * labelled 3 m default otherwise.
 */

export const TERRAIN_GRID_N = 10;
export const BUILDING_DEFAULT_HEIGHT_M = 3;
export const METRES_PER_LEVEL = 3;

const M_PER_DEG_LAT = 111_320;

/** Local metres from an origin: x east, z south (matches the 3D scene). */
export function toLocalMetres(lat: number, lng: number, originLat: number, originLng: number) {
  return {
    x: (lng - originLng) * M_PER_DEG_LAT * Math.cos((originLat * Math.PI) / 180),
    z: -(lat - originLat) * M_PER_DEG_LAT,
  };
}

/** n×n sample points over a square of `spanM` centred on the point, rows north→south, columns west→east. */
export function terrainGridPoints(lat: number, lng: number, spanM: number, n = TERRAIN_GRID_N) {
  const out: Array<{ lat: number; lng: number }> = [];
  const step = spanM / (n - 1);
  const mLng = M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const north = spanM / 2 - r * step;
      const east = -spanM / 2 + c * step;
      out.push({ lat: lat + north / M_PER_DEG_LAT, lng: lng + east / mLng });
    }
  }
  return out;
}

export type TerrainGrid = {
  n: number;
  spanM: number;
  /** Heights relative to the centre of the grid, row-major (north→south, west→east). */
  heights: number[];
  /** Highest minus lowest sample, metres. */
  reliefM: number;
  /** Absolute elevation at the centre, metres above sea level. */
  centreElevationM: number;
};

/**
 * Turn raw elevation samples into a terrain grid, or null when the samples
 * cannot be trusted: wrong count, a missing (zero or non-finite) value, or a
 * spike more than 150 m from the median, which a 30–90 m grid over a few
 * hundred metres does not produce on real ground.
 */
export function terrainFromSamples(
  elevations: readonly number[],
  spanM: number,
  n = TERRAIN_GRID_N,
): TerrainGrid | null {
  if (elevations.length !== n * n) return null;
  if (elevations.some((e) => !Number.isFinite(e) || e <= 0)) return null;
  const sorted = [...elevations].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (elevations.some((e) => Math.abs(e - median) > 150)) return null;
  const centre = bilinear(elevations, n, (n - 1) / 2, (n - 1) / 2);
  return {
    n,
    spanM,
    heights: elevations.map((e) => e - centre),
    reliefM: Math.round((sorted[sorted.length - 1] - sorted[0]) * 10) / 10,
    centreElevationM: Math.round(centre),
  };
}

function bilinear(values: readonly number[], n: number, row: number, col: number) {
  const r0 = Math.max(0, Math.min(n - 1, Math.floor(row)));
  const c0 = Math.max(0, Math.min(n - 1, Math.floor(col)));
  const r1 = Math.min(n - 1, r0 + 1);
  const c1 = Math.min(n - 1, c0 + 1);
  const fr = Math.max(0, Math.min(1, row - r0));
  const fc = Math.max(0, Math.min(1, col - c0));
  const v = (r: number, c: number) => values[r * n + c];
  const top = v(r0, c0) * (1 - fc) + v(r0, c1) * fc;
  const bottom = v(r1, c0) * (1 - fc) + v(r1, c1) * fc;
  return top * (1 - fr) + bottom * fr;
}

/** Ground height (relative to the centre) at local x (east) and z (south); edges clamp. */
export function heightAt(t: TerrainGrid | null, x: number, z: number): number {
  if (!t) return 0;
  const step = t.spanM / (t.n - 1);
  const col = (x + t.spanM / 2) / step;
  const row = (z + t.spanM / 2) / step;
  return bilinear(t.heights, t.n, row, col);
}

export type HeightSource = "height" | "levels" | "default";

/** Building height from OSM tags: `height`, else `building:levels` × 3 m, else 3 m. */
export function buildingHeightM(tags: Record<string, string | undefined> | undefined): {
  heightM: number;
  source: HeightSource;
} {
  const clamp = (v: number) => Math.min(150, Math.max(2.5, v));
  const h = tags?.height?.trim().match(/^(\d+(?:\.\d+)?)\s*(m|metres|meters)?$/i);
  if (h) return { heightM: clamp(Number(h[1])), source: "height" };
  const levels = Number(tags?.["building:levels"]);
  if (Number.isFinite(levels) && levels > 0) {
    return { heightM: clamp(levels * METRES_PER_LEVEL), source: "levels" };
  }
  return { heightM: BUILDING_DEFAULT_HEIGHT_M, source: "default" };
}

export type NearbyBuilding = {
  id: number;
  ring: Array<{ lat: number; lng: number }>;
  heightM: number;
  heightSource: HeightSource;
};

type OverpassWay = {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
};

/** Building ways from an Overpass `out tags geom` response; drops degenerate rings. */
export function parseOverpassBuildings(
  json: { elements?: OverpassWay[] } | null | undefined,
  limit = 400,
): NearbyBuilding[] {
  const out: NearbyBuilding[] = [];
  for (const el of json?.elements ?? []) {
    if (el.type !== "way" || !el.tags?.building || !el.geometry) continue;
    const ring = el.geometry
      .filter((g) => Number.isFinite(g.lat) && Number.isFinite(g.lon))
      .map((g) => ({ lat: g.lat, lng: g.lon }));
    if (ring.length > 1) {
      const a = ring[0];
      const b = ring[ring.length - 1];
      if (a.lat === b.lat && a.lng === b.lng) ring.pop();
    }
    if (ring.length < 3) continue;
    const h = buildingHeightM(el.tags);
    out.push({ id: el.id, ring, heightM: h.heightM, heightSource: h.source });
    if (out.length >= limit) break;
  }
  return out;
}

/** Plain summary for the legend: how many heights were recorded vs defaulted. */
export function buildingHeightSummary(buildings: readonly NearbyBuilding[]) {
  const recorded = buildings.filter((b) => b.heightSource !== "default").length;
  return { total: buildings.length, recorded, defaulted: buildings.length - recorded };
}
