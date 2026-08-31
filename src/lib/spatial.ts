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
  /** Evidence-backed verification workflow state (never inferred from data completeness). */
  verificationState: VerificationState;
  /** 0–100 confidence recorded by a human reviewer; 0 while unverified. */
  verificationConfidence: number;
  verificationMethod: string | null;
  verificationEvidenceRef: string | null;
  verificationUpdatedAt: string | null;
  /** Superseded identifiers kept so historical searches still resolve. */
  legacyParcelCode: string | null;
  legacyTitleDeedNo: string | null;
  beacons: SpatialBeacon[];

  /**
   * Coordinate sanity of the stored survey geometry. "out-of-bounds" usually
   * means the source data is in a projected CRS (e.g. Arc 1960 / UTM 37S).
   */
  coordinateIssue?: CoordinateIssue;
};

export type CoordinateIssue = "none" | "out-of-bounds" | "invalid";

/**
 * Verification lifecycle. Only "evidence_backed" may ever be presented as
 * verified, and only when a reviewer recorded survey/registry/legal evidence.
 */
export type VerificationState =
  | "unverified"
  | "submitted"
  | "in_review"
  | "evidence_backed"
  | "rejected";

export const VERIFICATION_STATES: readonly VerificationState[] = [
  "unverified",
  "submitted",
  "in_review",
  "evidence_backed",
  "rejected",
];

export function toVerificationState(value: unknown): VerificationState {
  return VERIFICATION_STATES.includes(value as VerificationState)
    ? (value as VerificationState)
    : "unverified";
}

/** Truthful label + badge tone for a verification state. */
export function verificationDisplay(parcel: {
  verificationState: VerificationState;
  verificationConfidence: number;
  verificationMethod: string | null;
}): { label: string; tone: "verified" | "pending" | "expired"; detail: string } {
  switch (parcel.verificationState) {
    case "evidence_backed":
      return {
        label: "Evidence-backed",
        tone: "verified",
        detail: `Reviewer confidence ${parcel.verificationConfidence}%${
          parcel.verificationMethod ? ` · ${parcel.verificationMethod}` : ""
        }.`,
      };
    case "in_review":
      return {
        label: "In review",
        tone: "pending",
        detail: "A reviewer is assessing the submitted evidence.",
      };
    case "submitted":
      return {
        label: "Evidence submitted",
        tone: "pending",
        detail: "Evidence submitted, not yet reviewed.",
      };
    case "rejected":
      return {
        label: "Verification rejected",
        tone: "expired",
        detail: "Submitted evidence did not support the claimed title or survey.",
      };
    default:
      return {
        label: "Unverified",
        tone: "pending",
        detail: "No survey, registry or legal evidence has been reviewed for this parcel.",
      };
  }
}


/** WGS84 envelope covering the Republic of Kenya (with a small margin). */
export const KENYA_BOUNDS = {
  minLat: -5.0,
  maxLat: 5.5,
  minLng: 33.5,
  maxLng: 42.0,
} as const;

/** True when a coordinate is finite WGS84 lat/lng inside the Kenya envelope. */
export function isPlausibleKenyaLatLng(p: LatLng): boolean {
  if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return false;
  return (
    p.lat >= KENYA_BOUNDS.minLat &&
    p.lat <= KENYA_BOUNDS.maxLat &&
    p.lng >= KENYA_BOUNDS.minLng &&
    p.lng <= KENYA_BOUNDS.maxLng
  );
}

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
  // NOAA convention: afternoon (hourAngle > 0) → (az + 180) % 360,
  // morning (hourAngle <= 0) → (540 - az) % 360.
  azimuth = hourAngle > 0 ? (azimuth + 180) % 360 : (540 - azimuth) % 360;
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

/* ---------------- geometry / stored-area reconciliation ---------------- */

export type AreaReconciliation = {
  /** Area computed from the stored boundary ring, in m². */
  ringAreaSqm: number;
  /** Area recorded on the parcel record, in m². */
  storedAreaSqm: number;
  /** Signed difference as a percentage of the stored area. */
  deltaPct: number;
  /** True when ring and record disagree by more than 5%. */
  mismatch: boolean;
};

/**
 * Compares the stored boundary polygon against the recorded area. Returns null
 * when either side is missing, so callers can stay silent rather than guess.
 */
export function reconcileArea(parcel: SpatialParcel): AreaReconciliation | null {
  if (parcel.ring.length < 3 || !(parcel.areaSqm > 0)) return null;
  const ringAreaSqm = polygonAreaSqm(ringToLocal(parcel.ring, parcel.centroid));
  if (!(ringAreaSqm > 0)) return null;
  const deltaPct = ((ringAreaSqm - parcel.areaSqm) / parcel.areaSqm) * 100;
  return {
    ringAreaSqm,
    storedAreaSqm: parcel.areaSqm,
    deltaPct,
    mismatch: Math.abs(deltaPct) > 5,
  };
}

/* ---------------- digital land passport (factual only) ---------------- */

export type PassportFact = { key: string; label: string; value: string };

/**
 * Factual record summary for the Digital Land Passport. There is deliberately
 * NO synthetic score here: completeness, beacon count, elevation or valuation
 * density are not evidence of title validity, ownership or boundary position.
 */
export function passportFacts(parcel: SpatialParcel): PassportFact[] {
  const verification = verificationDisplay(parcel);
  const area = reconcileArea(parcel);
  const fmt = (n: number) => Math.round(n).toLocaleString("en-KE");
  return [
    {
      key: "verification",
      label: "Verification state",
      value: `${verification.label} — ${verification.detail}`,
    },
    {
      key: "identifiers",
      label: "Identifiers",
      value: [
        parcel.titleDeedNo || null,
        parcel.parcelCode || null,
        parcel.legacyTitleDeedNo ? `superseded title ${parcel.legacyTitleDeedNo}` : null,
        parcel.legacyParcelCode ? `superseded code ${parcel.legacyParcelCode}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    {
      key: "area",
      label: "Recorded area",
      value: area
        ? area.mismatch
          ? `${fmt(area.storedAreaSqm)} m² recorded · boundary polygon encloses ${fmt(area.ringAreaSqm)} m² (indicative, non-cadastral geometry).`
          : `${fmt(area.storedAreaSqm)} m² recorded · boundary polygon agrees within 5%.`
        : parcel.areaSqm > 0
          ? `${fmt(parcel.areaSqm)} m² recorded · no boundary polygon to cross-check.`
          : "No area recorded.",
    },
    {
      key: "survey",
      label: "Boundary data",
      value: `${parcel.beacons.length} georeferenced beacon${
        parcel.beacons.length === 1 ? "" : "s"
      } on file. Rendered boundaries are indicative and not a cadastral survey.`,
    },
    {
      key: "zoning",
      label: "Zoning on record",
      value: parcel.zoningType
        ? `${parcel.zoningType}${parcel.maxHeightM ? ` · ${parcel.maxHeightM} m height cap` : ""}`
        : "No zoning class recorded.",
    },
    {
      key: "setbacks",
      label: "Setbacks on record",
      value: `Road ${parcel.roadSetbackM ?? "—"} m · riparian ${parcel.riparianSetbackM ?? "—"} m. Applied uniformly as an indicative visualisation proxy.`,
    },
    {
      key: "geo",
      label: "Elevation",
      value: parcel.elevationMasl != null ? `${parcel.elevationMasl} m above sea level.` : "Not recorded.",
    },
  ];
}

/** Mandatory disclaimer shown wherever passport facts appear. */
export const PASSPORT_DISCLAIMER =
  "Not assessed here: title validity \u00b7 ownership \u00b7 legal boundary position.";

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
      // Reject non-finite values and coordinates outside the Kenya WGS84
      // envelope (e.g. Arc 1960 / UTM 37S eastings/northings).
      return isPlausibleKenyaLatLng({ lat, lng }) ? { lat, lng } : null;
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
