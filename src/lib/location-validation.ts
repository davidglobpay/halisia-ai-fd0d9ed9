/**
 * One location checker + one location-confidence model for every pin HALISIA
 * shows. Nothing here upgrades a coordinate: a geocoded place name stays
 * "approximate" no matter how precise the numbers look.
 */
import countiesData from "@/data/kenya-counties.json";

export type LocationStatus =
  | "verified_geometry"
  | "verified_coordinate"
  | "approximate"
  | "administrative"
  | "user_provided"
  | "ai_inferred";

export const STATUS_META: Record<LocationStatus, { label: string; short: string; exact: boolean }> =
  {
    verified_geometry: { label: "Verified parcel geometry", short: "Parcel geometry", exact: true },
    verified_coordinate: { label: "Verified coordinate", short: "Verified point", exact: true },
    approximate: { label: "Approximate / geocoded location", short: "Approximate", exact: false },
    administrative: { label: "Search / administrative area", short: "Area only", exact: false },
    user_provided: { label: "User-provided location", short: "User pin", exact: false },
    ai_inferred: { label: "AI-inferred location", short: "AI-inferred", exact: false },
  };

export const KENYA_BBOX = { minLat: -4.9, maxLat: 5.1, minLng: 33.8, maxLng: 42.0 };

/** Coordinates that usually mean "missing" rather than a real place. */
const DEFAULT_POINTS = [
  { lat: 0, lng: 0, name: "null island (0, 0)" },
  { lat: -1.286389, lng: 36.817223, name: "the Nairobi city-centre default" },
  { lat: -0.0236, lng: 37.9062, name: "the geographic centre of Kenya" },
  { lat: 0.0236, lng: 37.9062, name: "the geographic centre of Kenya" },
];

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

export type CoordCheck = {
  ok: boolean;
  lat: number | null;
  lng: number | null;
  /** True when lat/lng were given swapped and corrected. */
  swapped: boolean;
  issues: string[];
};

/** The sentinel this pair equals, if any. Used before AND after a swap. */
function matchesDefault(lat: number, lng: number): { name: string } | null {
  for (const d of DEFAULT_POINTS) {
    if (Math.abs(lat - d.lat) < 1e-4 && Math.abs(lng - d.lng) < 1e-4) return d;
  }
  return null;
}

function inKenya(lat: number, lng: number) {
  return (
    lat >= KENYA_BBOX.minLat &&
    lat <= KENYA_BBOX.maxLat &&
    lng >= KENYA_BBOX.minLng &&
    lng <= KENYA_BBOX.maxLng
  );
}

export function validateCoordinate(
  latIn: unknown,
  lngIn: unknown,
  opts: { requireKenya?: boolean } = { requireKenya: true },
): CoordCheck {
  const issues: string[] = [];
  const lat = typeof latIn === "string" ? parseFloat(latIn) : (latIn as number);
  const lng = typeof lngIn === "string" ? parseFloat(lngIn) : (lngIn as number);
  if (latIn == null || lngIn == null || latIn === "" || lngIn === "") {
    return {
      ok: false,
      lat: null,
      lng: null,
      swapped: false,
      issues: ["No coordinates supplied."],
    };
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return {
      ok: false,
      lat: null,
      lng: null,
      swapped: false,
      issues: ["Coordinates are not numbers."],
    };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return {
      ok: false,
      lat: null,
      lng: null,
      swapped: false,
      issues: ["Latitude must be −90…90 and longitude −180…180."],
    };
  }
  const hit = matchesDefault(lat, lng);
  if (hit) {
    return {
      ok: false,
      lat,
      lng,
      swapped: false,
      issues: [
        `This coordinate equals ${hit.name}, which usually means the real location is missing.`,
      ],
    };
  }
  if (opts.requireKenya !== false && !inKenya(lat, lng)) {
    if (inKenya(lng, lat)) {
      // Correcting the order must not launder a sentinel. Reversed, the
      // Nairobi city-centre default does NOT look like a default point, so
      // the check above passes it; swapping then produces the exact value
      // that check exists to reject, and it used to be returned ok:true.
      // Every downstream stage — pin, uncertainty ring, county check, the
      // report — would then start from a fabricated position in Nairobi.
      const swappedHit = matchesDefault(lng, lat);
      if (swappedHit) {
        return {
          ok: false,
          lat: lng,
          lng: lat,
          swapped: true,
          issues: [
            `Latitude and longitude were reversed, and the corrected point equals ` +
              `${swappedHit.name}, which usually means the real location is missing.`,
          ],
        };
      }
      return {
        ok: true,
        lat: lng,
        lng: lat,
        swapped: true,
        issues: ["Latitude and longitude were reversed and have been corrected."],
      };
    }
    return { ok: false, lat, lng, swapped: false, issues: ["This point is outside Kenya."] };
  }
  return { ok: true, lat, lng, swapped: false, issues };
}

/* ---------------- county lookup (IEBC-derived county polygons) ---------------- */

type Ring = number[][];
type Feat = {
  properties: { code: number; name: string; lat: number; lng: number };
  geometry:
    { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };
};
const FEATURES = (countiesData as unknown as { features: Feat[] }).features;

function inRing(lng: number, lat: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function countyForPoint(lat: number, lng: number): { code: number; name: string } | null {
  for (const f of FEATURES) {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const p of polys) {
      if (p[0] && inRing(lng, lat, p[0]) && !p.slice(1).some((h) => inRing(lng, lat, h))) {
        return { code: f.properties.code, name: f.properties.name };
      }
    }
  }
  return null;
}

export function countyByName(
  name: string | null | undefined,
): { code: number; name: string } | null {
  if (!name) return null;
  const n = name.toLowerCase().replace(/county|city|\W/g, "");
  if (!n) return null;
  const f = FEATURES.find((x) => x.properties.name.toLowerCase().replace(/\W/g, "") === n);
  return f ? { code: f.properties.code, name: f.properties.name } : null;
}

/* ---------------- confidence model ---------------- */

/**
 * Indicative location confidence. Deliberately coarse — it reflects the
 * precision class of the source, not a measured error radius.
 */
export function locationConfidence(status: LocationStatus, geocodeType?: string | null): number {
  switch (status) {
    case "verified_geometry":
      return 95;
    case "verified_coordinate":
      return 90;
    case "user_provided":
      return 60;
    case "approximate":
      return geocodeType === "ROOFTOP"
        ? 70
        : geocodeType === "RANGE_INTERPOLATED"
          ? 60
          : geocodeType === "GEOMETRIC_CENTER"
            ? 45
            : 30;
    case "administrative":
      return 25;
    case "ai_inferred":
      return 20;
  }
}

export type DeedLocationMatchAssessment = {
  confidencePct: number;
  band: "strong" | "moderate" | "weak";
  evidence: string[];
  limitations: string[];
};

/**
 * Confidence that document location text matched the displayed place.
 * This never measures title validity, ownership, parcel identity or boundary accuracy.
 */
export function assessDeedLocationMatch(input: {
  status: LocationStatus;
  geocodeType?: string | null;
  locationText: string;
  locationTextConfidence?: number | null;
  countyNamed?: string | null;
  countyConflict?: boolean;
  partialMatch?: boolean;
  radiusM?: number | null;
}): DeedLocationMatchAssessment {
  const evidence: string[] = [];
  const limitations: string[] = [
    "A place-name match does not identify a legal parcel, surveyed boundary or owner.",
  ];
  const textConfidence = Math.max(0, Math.min(100, input.locationTextConfidence ?? 50));
  let confidence = Math.min(locationConfidence(input.status, input.geocodeType), textConfidence);

  evidence.push(`Location text used: ${input.locationText}`);
  evidence.push(`Provider precision class: ${input.geocodeType ?? "not supplied"}`);

  if (input.countyNamed) {
    evidence.push(
      input.countyConflict
        ? `County conflict: the matched point falls outside ${input.countyNamed} County.`
        : `County check: the matched point agrees with ${input.countyNamed} County.`,
    );
  } else {
    limitations.push("No county was readable from the record for an administrative cross-check.");
    confidence = Math.min(confidence, 45);
  }

  if (input.partialMatch) {
    limitations.push("The provider matched only part of the submitted location text.");
    confidence = Math.min(confidence, 35);
  }
  if (input.countyConflict) {
    limitations.push("The document county and matched point disagree.");
    confidence = Math.min(confidence, 20);
  }
  if (input.radiusM != null) {
    evidence.push(
      `Provider uncertainty radius: approximately ${Math.round(input.radiusM)} metres.`,
    );
    if (input.radiusM > 5_000) {
      limitations.push("The returned area is too broad for parcel-level use.");
      confidence = Math.min(confidence, 25);
    } else if (input.radiusM > 1_500) {
      confidence = Math.min(confidence, 35);
    }
  } else {
    limitations.push("The provider supplied no uncertainty viewport for this result.");
  }

  const confidencePct = Math.max(0, Math.round(confidence));
  return {
    confidencePct,
    band: confidencePct >= 60 ? "strong" : confidencePct >= 35 ? "moderate" : "weak",
    evidence,
    limitations,
  };
}

/** Title/LR/parcel identifiers are deliberately excluded: they are not geocodable evidence. */
export function deedLocationQuery(input: {
  locationHint?: string | null;
  county?: string | null;
}): string {
  return [input.locationHint, input.county]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .filter(
      (value, index, all) =>
        all.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index,
    )
    .join(", ");
}

/** Approximate radius (m) to draw around a non-exact pin. */
export function uncertaintyRadiusM(status: LocationStatus, geocodeType?: string | null): number {
  if (STATUS_META[status].exact) return 0;
  if (status === "administrative") return 5000;
  // A pin the person dragged onto their own plot is not a provider's guess.
  // There is no geocoder error to draw: they placed it. What remains is how
  // precisely anyone can drop a pin on satellite imagery at high zoom, which
  // is metres, not kilometres. It is deliberately NOT zero, because the pin
  // is a mark and not a measurement — and the honest caveat lives in words on
  // the pin card, not in a 3 km circle that states nothing true.
  if (status === "user_provided") return 25;
  if (geocodeType === "ROOFTOP") return 100;
  if (geocodeType === "RANGE_INTERPOLATED") return 300;
  if (geocodeType === "GEOMETRIC_CENTER") return 1500;
  return 3000;
}

/** Classify a Google geocode hit. Area-level hits never pass as a point. */
export function classifyGeocode(types: string[] = []): LocationStatus {
  const area = [
    "country",
    "administrative_area_level_1",
    "administrative_area_level_2",
    "locality",
    "sublocality",
    "political",
    "colloquial_area",
  ];
  if (types.length && types.every((t) => area.includes(t) || t.startsWith("sublocality")))
    return "administrative";
  return "approximate";
}

export type Discrepancy = {
  sourceA: string;
  sourceB: string;
  distanceKm: number | null;
  detail: string;
  action: string;
};

/** Threshold beyond which two point sources are called discrepant. */
export const DISCREPANCY_KM = 2;

export function comparePoints(
  a: { lat: number; lng: number; source: string },
  b: { lat: number; lng: number; source: string },
): Discrepancy | null {
  const d = haversineKm(a, b);
  if (d <= DISCREPANCY_KM) return null;
  return {
    sourceA: a.source,
    sourceB: b.source,
    distanceKm: Math.round(d * 10) / 10,
    detail: `The two sources are ${d.toFixed(1)} km apart.`,
    action:
      "Confirm the beacons on site with a licensed surveyor and an official Ardhisasa search.",
  };
}

/** Check that a geocoded point falls inside the county named on a deed. */
export function compareCounty(
  point: { lat: number; lng: number },
  deedCounty: string | null | undefined,
  pointSource: string,
): Discrepancy | null {
  const named = countyByName(deedCounty);
  if (!named) return null;
  const actual = countyForPoint(point.lat, point.lng);
  if (!actual || actual.code === named.code) return null;
  return {
    sourceA: `Title document: ${named.name} County`,
    sourceB: `${pointSource}: falls in ${actual.name} County`,
    distanceKm: null,
    detail: `The pin lies in ${actual.name} County, but the document names ${named.name}.`,
    action:
      "Treat the pin as unreliable. Confirm the registry section and parcel location through an official search and a surveyor.",
  };
}
