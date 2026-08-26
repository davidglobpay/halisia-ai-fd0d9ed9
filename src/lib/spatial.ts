/**
 * HALISIA Spatial engine — pure geometry + solar math shared by the
 * WebXR canvas, the VR masterplan and the digital land passport.
 * No browser or server APIs here so it stays testable and SSR-safe.
 */

export type LatLng = { lat: number; lng: number };
export type Vec2 = { x: number; y: number };

export type SpatialBeacon = {
  id: string;
  code: string;
  lat: number;
  lng: number;
  elevationM: number | null;
  ordinal: number;
};

export type SpatialParcel = {
  id: string;
  titleDeedNo: string;
  parcelCode: string;
  county: string | null;
  centroid: LatLng;
  ring: LatLng[];
  areaSqm: number;
  elevationMasl: number | null;
  zoningType: string | null;
  maxHeightM: number | null;
  roadSetbackM: number | null;
  riparianSetbackM: number | null;
  valuationKes: number | null;
  status: string | null;
  surveyVerifiedOn: string | null;
  deedHash: string | null;
  beacons: SpatialBeacon[];
};

export type SpatialPrototype = {
  id: string;
  title: string;
  category: string | null;
  footprintSqm: number | null;
  heightM: number | null;
  floors: number | null;
  estimatedCostKes: number | null;
  gltfUrl: string | null;
  usdzUrl: string | null;
};

const EARTH_M_PER_DEG_LAT = 110_574;
const EARTH_M_PER_DEG_LNG = 111_320;

/** GPS (WGS84) → local ENU metres, origin at `origin`. East = +x, North = +y. */
export function gpsToLocal(point: LatLng, origin: LatLng): Vec2 {
  const latRad = (origin.lat * Math.PI) / 180;
  return {
    x: (point.lng - origin.lng) * EARTH_M_PER_DEG_LNG * Math.cos(latRad),
    y: (point.lat - origin.lat) * EARTH_M_PER_DEG_LAT,
  };
}

/** Inverse of {@link gpsToLocal}. */
export function localToGps(v: Vec2, origin: LatLng): LatLng {
  const latRad = (origin.lat * Math.PI) / 180;
  return {
    lat: origin.lat + v.y / EARTH_M_PER_DEG_LAT,
    lng: origin.lng + v.x / (EARTH_M_PER_DEG_LNG * Math.cos(latRad)),
  };
}

export function ringToLocal(ring: LatLng[], origin: LatLng): Vec2[] {
  return ring.map((p) => gpsToLocal(p, origin));
}

const EARTH_RADIUS_M = 6_371_000;

/**
 * Great-circle (haversine) distance in metres between two WGS84 points.
 * The single distance helper for every GPS feature — never approximate with
 * raw degree differences (longitude degrees shrink with latitude, so
 * `hypot(dLat, dLng) * 111_320` mismeasures east–west movement).
 */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Single ENU → Three.js world convention shared by every Spatial mesh:
 * east = +X, up = +Y, north = −Z. Shape/extrude geometries must bake the same
 * convention with `rotateX(-Math.PI / 2)` so their shape-space +Y (north) axis
 * lands on world −Z exactly like this mapping — never rotate meshes by +PI/2.
 */
export function enuToThree(p: Vec2, y = 0): { x: number; y: number; z: number } {
  return { x: p.x, y, z: -p.y };
}

/** Signed area (m²) — positive when the ring winds counter-clockwise. */
export function signedArea(ring: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export function polygonAreaSqm(ring: Vec2[]): number {
  return Math.abs(signedArea(ring));
}

export function polygonPerimeterM(ring: Vec2[]): number {
  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    total += Math.hypot(q.x - p.x, q.y - p.y);
  }
  return total;
}

export function centroidOf(ring: Vec2[]): Vec2 {
  const n = ring.length || 1;
  return {
    x: ring.reduce((s, p) => s + p.x, 0) / n,
    y: ring.reduce((s, p) => s + p.y, 0) / n,
  };
}

/**
 * Inward offset (setback ribbon) using per-vertex angle bisectors with a
 * miter clamp. Falls back to a centroid contraction when the miter would
 * self-intersect on very thin parcels.
 */
export function offsetRingInward(ring: Vec2[], distance: number): Vec2[] {
  if (ring.length < 3 || distance <= 0) return ring.slice();
  const ccw = signedArea(ring) > 0;
  const out: Vec2[] = [];
  for (let i = 0; i < ring.length; i++) {
    const prev = ring[(i - 1 + ring.length) % ring.length]!;
    const cur = ring[i]!;
    const next = ring[(i + 1) % ring.length]!;
    const n1 = edgeNormal(prev, cur, ccw);
    const n2 = edgeNormal(cur, next, ccw);
    let bx = n1.x + n2.x;
    let by = n1.y + n2.y;
    const len = Math.hypot(bx, by);
    if (len < 1e-6) {
      out.push({ x: cur.x + n1.x * distance, y: cur.y + n1.y * distance });
      continue;
    }
    bx /= len;
    by /= len;
    const cosHalf = Math.max(0.2, bx * n1.x + by * n1.y);
    const miter = Math.min(distance / cosHalf, distance * 4);
    out.push({ x: cur.x + bx * miter, y: cur.y + by * miter });
  }
  // Guard against inversion: if the offset flipped winding or collapsed the
  // area, contract towards the centroid instead.
  const before = polygonAreaSqm(ring);
  const after = polygonAreaSqm(out);
  if (after < 1 || after > before || signedArea(out) * signedArea(ring) < 0) {
    const c = centroidOf(ring);
    const shrink = Math.max(0.1, 1 - (distance * polygonPerimeterM(ring)) / Math.max(before, 1));
    return ring.map((p) => ({ x: c.x + (p.x - c.x) * shrink, y: c.y + (p.y - c.y) * shrink }));
  }
  return out;
}

function edgeNormal(a: Vec2, b: Vec2, ccw: boolean): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Inward normal depends on the winding direction.
  return ccw ? { x: -dy / len, y: dx / len } : { x: dy / len, y: -dx / len };
}

/** Buildable envelope for a parcel: setback footprint + permitted height. */
export function buildableEnvelope(parcel: SpatialParcel): {
  ring: Vec2[];
  footprint: Vec2[];
  setbackM: number;
  heightM: number;
  buildableSqm: number;
  coveragePct: number;
} {
  const ring = ringToLocal(parcel.ring, parcel.centroid);
  const setbackM = Math.max(parcel.roadSetbackM ?? 0, parcel.riparianSetbackM ?? 0, 0);
  const footprint = offsetRingInward(ring, setbackM);
  const buildableSqm = polygonAreaSqm(footprint);
  const total = polygonAreaSqm(ring) || parcel.areaSqm || 1;
  return {
    ring,
    footprint,
    setbackM,
    heightM: parcel.maxHeightM ?? 12,
    buildableSqm,
    coveragePct: Math.round((buildableSqm / total) * 100),
  };
}

/* ---------------- solar geometry (NOAA simplified) ---------------- */

export type SunPosition = { altitudeDeg: number; azimuthDeg: number; isDay: boolean };

/**
 * Sun altitude/azimuth for a location at a given local (Africa/Nairobi, UTC+3)
 * decimal hour and day-of-year. Azimuth is measured clockwise from north.
 */
export function sunPosition(
  lat: number,
  lng: number,
  dayOfYear: number,
  localHour: number,
  utcOffsetHours = 3,
): SunPosition {
  const rad = Math.PI / 180;
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (localHour - 12) / 24);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const timeOffset = eqTime + 4 * lng - 60 * utcOffsetHours;
  const trueSolarTime = (localHour * 60 + timeOffset + 1440) % 1440;
  const hourAngle = (trueSolarTime / 4 - 180) * rad;
  const latR = lat * rad;
  const cosZenith =
    Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(hourAngle);
  const zenith = Math.acos(Math.min(1, Math.max(-1, cosZenith)));
  const altitude = 90 - zenith / rad;
  let azimuth =
    Math.acos(
      Math.min(
        1,
        Math.max(
          -1,
          (Math.sin(latR) * Math.cos(zenith) - Math.sin(decl)) /
            (Math.cos(latR) * Math.sin(zenith) || 1e-6),
        ),
      ),
    ) / rad;
  azimuth = hourAngle > 0 ? (540 - azimuth) % 360 : azimuth;
  return { altitudeDeg: altitude, azimuthDeg: azimuth, isDay: altitude > 0 };
}

/** Unit vector pointing from the scene towards the sun (three.js Y-up). */
export function sunVector(sun: SunPosition): { x: number; y: number; z: number } {
  const alt = (sun.altitudeDeg * Math.PI) / 180;
  const az = (sun.azimuthDeg * Math.PI) / 180;
  const horizontal = Math.cos(alt);
  return {
    x: horizontal * Math.sin(az),
    y: Math.sin(alt),
    z: -horizontal * Math.cos(az),
  };
}

/* ---------------- digital land passport scoring ---------------- */

export type PassportMetric = { key: string; label: string; score: number; detail: string };

export function passportMetrics(parcel: SpatialParcel): PassportMetric[] {
  const verified = parcel.status === "verified";
  const beacons = parcel.beacons.length;
  const density = parcel.valuationKes && parcel.areaSqm ? parcel.valuationKes / parcel.areaSqm : 0;
  return [
    {
      key: "title",
      label: "Title integrity",
      score: verified ? 94 : parcel.status === "pending" ? 62 : 40,
      detail: verified
        ? "Survey verified against registry record."
        : "Registry verification pending.",
    },
    {
      key: "survey",
      label: "Survey precision",
      score: Math.min(100, 45 + beacons * 12),
      detail: `${beacons} georeferenced beacon${beacons === 1 ? "" : "s"} captured.`,
    },
    {
      key: "zoning",
      label: "Zoning clarity",
      score: parcel.zoningType ? (parcel.maxHeightM ? 90 : 70) : 45,
      detail: parcel.zoningType
        ? `${parcel.zoningType}${parcel.maxHeightM ? ` · ${parcel.maxHeightM} m cap` : ""}`
        : "No zoning class recorded.",
    },
    {
      key: "setbacks",
      label: "Setback compliance",
      score: parcel.roadSetbackM && parcel.riparianSetbackM ? 88 : parcel.roadSetbackM ? 68 : 40,
      detail: `Road ${parcel.roadSetbackM ?? "—"} m · riparian ${parcel.riparianSetbackM ?? "—"} m.`,
    },
    {
      key: "value",
      label: "Value signal",
      score: Math.max(30, Math.min(96, Math.round(Math.log10(Math.max(density, 1)) * 24))),
      detail: density
        ? `KES ${Math.round(density).toLocaleString("en-KE")} per m².`
        : "No valuation on file.",
    },
    {
      key: "geo",
      label: "Geospatial anchor",
      score: parcel.elevationMasl ? 86 : 66,
      detail: parcel.elevationMasl
        ? `${parcel.elevationMasl} m above sea level.`
        : "Elevation not surveyed.",
    },
  ];
}

export function passportScore(metrics: PassportMetric[]): number {
  if (!metrics.length) return 0;
  return Math.round(metrics.reduce((s, m) => s + m.score, 0) / metrics.length);
}

/** Deterministic short hash used as the human-readable passport reference. */
export function passportRef(parcel: SpatialParcel): string {
  const src = `${parcel.titleDeedNo}|${parcel.parcelCode}|${parcel.deedHash ?? ""}`;
  let h = 2166136261;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `HAL-${(h >>> 0).toString(36).toUpperCase().padStart(7, "0").slice(0, 7)}`;
}

/** GeoJSON polygon (from the DB) → ordered lat/lng ring. */
export function geometryToRing(geometry: unknown): LatLng[] {
  const g = geometry as { type?: string; coordinates?: unknown } | null;
  if (!g || !Array.isArray(g.coordinates)) return [];
  const outer = (g.type === "Polygon" ? g.coordinates[0] : g.coordinates) as unknown;
  if (!Array.isArray(outer)) return [];
  const ring = outer
    .map((pair) => {
      if (!Array.isArray(pair) || pair.length < 2) return null;
      const [lng, lat] = pair as [number, number];
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    })
    .filter((p): p is LatLng => p !== null);
  // Drop the duplicated closing vertex if present.
  if (ring.length > 2) {
    const first = ring[0]!;
    const last = ring[ring.length - 1]!;
    if (first.lat === last.lat && first.lng === last.lng) ring.pop();
  }
  return ring;
}
