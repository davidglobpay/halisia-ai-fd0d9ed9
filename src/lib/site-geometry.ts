/**
 * Geometry for a site boundary the user drew on a map.
 *
 * WHAT THIS IS, AND WHAT IT IS NOT
 *
 * Every figure here is computed from coordinates a person placed by eye on a
 * raster basemap. That makes it an estimate of the shape they drew, not a
 * measurement of a parcel: it carries the basemap's georeferencing error, the
 * zoom they drew at, and wherever they judged the edge to be. A surveyed area
 * comes from a licensed surveyor and a cadastral instrument, and nothing in
 * this file can stand in for one. Callers must label output accordingly — the
 * Passport's "modelled"/"user-provided" classes exist for exactly this.
 *
 * No dependency is taken. The three things needed — geodesic area, geodesic
 * length and point-in-polygon — are short, stable and testable, and this
 * project carries no geospatial library today. Adding one for eighty lines
 * would cost bundle weight for no accuracy gain at plot scale.
 */

export type LngLat = { lng: number; lat: number };

/** WGS-84 authalic (equal-area) mean radius, metres. */
const R = 6371007.181;
const D2R = Math.PI / 180;

/** Square metres in one acre and one hectare, for the conversions below. */
export const SQM_PER_ACRE = 4046.8564224;
export const SQM_PER_HECTARE = 10000;

function isFiniteCoord(p: LngLat): boolean {
  return (
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}

/**
 * Normalise a drawn ring: drop a repeated closing vertex, reject anything that
 * is not a usable polygon. Returns null rather than throwing, because a
 * half-drawn shape is a normal state in an editor, not an error.
 */
export function normalizeRing(ring: readonly LngLat[]): LngLat[] | null {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  if (!ring.every(isFiniteCoord)) return null;
  const out = ring.slice();
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 3 && first.lat === last.lat && first.lng === last.lng) out.pop();
  return out.length >= 3 ? out : null;
}

/**
 * Geodesic area of a ring on a sphere, in square metres, always positive.
 *
 * This is the standard spherical-excess formula. At plot and estate scale the
 * difference between a sphere and the WGS-84 ellipsoid is far below the error
 * introduced by drawing the boundary by hand, so the sphere is the honest
 * level of precision to work at.
 */
export function ringAreaSqM(ring: readonly LngLat[]): number | null {
  const r = normalizeRing(ring);
  if (!r) return null;
  let total = 0;
  const n = r.length;
  for (let i = 0; i < n; i++) {
    const a = r[i];
    const b = r[(i + 1) % n];
    total += (b.lng - a.lng) * D2R * (2 + Math.sin(a.lat * D2R) + Math.sin(b.lat * D2R));
  }
  return Math.abs((total * R * R) / 2);
}

/** Great-circle distance between two points, metres. */
export function haversineM(a: LngLat, b: LngLat): number | null {
  if (!isFiniteCoord(a) || !isFiniteCoord(b)) return null;
  const dLat = (b.lat - a.lat) * D2R;
  const dLng = (b.lng - a.lng) * D2R;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * D2R) * Math.cos(b.lat * D2R) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Total length of an open path, metres. A ring's perimeter closes it first. */
export function pathLengthM(points: readonly LngLat[]): number | null {
  if (!Array.isArray(points) || points.length < 2) return null;
  if (!points.every(isFiniteCoord)) return null;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const seg = haversineM(points[i - 1], points[i]);
    if (seg == null) return null;
    total += seg;
  }
  return total;
}

export function ringPerimeterM(ring: readonly LngLat[]): number | null {
  const r = normalizeRing(ring);
  if (!r) return null;
  return pathLengthM([...r, r[0]]);
}

/** Centroid of the ring's vertices. Adequate for placing a label or a pin. */
export function ringCentroid(ring: readonly LngLat[]): LngLat | null {
  const r = normalizeRing(ring);
  if (!r) return null;
  const lat = r.reduce((s, p) => s + p.lat, 0) / r.length;
  const lng = r.reduce((s, p) => s + p.lng, 0) / r.length;
  return { lat, lng };
}

export type BBox = { west: number; south: number; east: number; north: number };

export function ringBBox(ring: readonly LngLat[]): BBox | null {
  const r = normalizeRing(ring);
  if (!r) return null;
  return {
    west: Math.min(...r.map((p) => p.lng)),
    east: Math.max(...r.map((p) => p.lng)),
    south: Math.min(...r.map((p) => p.lat)),
    north: Math.max(...r.map((p) => p.lat)),
  };
}

/** Ray casting. Points exactly on an edge are not guaranteed either way. */
export function pointInRing(point: LngLat, ring: readonly LngLat[]): boolean {
  const r = normalizeRing(ring);
  if (!r || !isFiniteCoord(point)) return false;
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const yi = r[i].lat,
      xi = r[i].lng,
      yj = r[j].lat,
      xj = r[j].lng;
    if (yi > point.lat !== yj > point.lat) {
      const x = ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
      if (point.lng < x) inside = !inside;
    }
  }
  return inside;
}

export type SiteMeasurement = {
  areaSqM: number;
  areaAcres: number;
  areaHectares: number;
  perimeterM: number;
  centroid: LngLat;
  bbox: BBox;
  vertices: number;
  /** Always this string. It travels with the numbers so a caller cannot print
   *  them as a survey by forgetting to add a caveat of its own. */
  provenance: "Drawn by hand on a raster basemap — an estimate of the drawn shape, not a surveyed area";
};

/** Everything a drawn boundary supports, or null if it does not support it. */
export function measureSite(ring: readonly LngLat[]): SiteMeasurement | null {
  const r = normalizeRing(ring);
  if (!r) return null;
  const areaSqM = ringAreaSqM(r);
  const perimeterM = ringPerimeterM(r);
  const centroid = ringCentroid(r);
  const bbox = ringBBox(r);
  if (areaSqM == null || perimeterM == null || !centroid || !bbox) return null;
  return {
    areaSqM,
    areaAcres: areaSqM / SQM_PER_ACRE,
    areaHectares: areaSqM / SQM_PER_HECTARE,
    perimeterM,
    centroid,
    bbox,
    vertices: r.length,
    provenance:
      "Drawn by hand on a raster basemap — an estimate of the drawn shape, not a surveyed area",
  };
}

/**
 * Format an area the way a Kenyan buyer reads one: acres above a tenth of an
 * acre, square metres below it. Both are shown wherever space allows, because
 * plots are advertised in both and the two audiences do not overlap neatly.
 */
export function formatArea(areaSqM: number): string {
  if (!Number.isFinite(areaSqM) || areaSqM <= 0) return "not available";
  const acres = areaSqM / SQM_PER_ACRE;
  if (acres >= 0.1)
    return `${acres.toFixed(2)} acres (${Math.round(areaSqM).toLocaleString("en-KE")} m2)`;
  return `${Math.round(areaSqM).toLocaleString("en-KE")} m2 (${acres.toFixed(3)} acres)`;
}
