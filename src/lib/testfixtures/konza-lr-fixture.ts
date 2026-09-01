/**
 * EPHEMERAL, DEVELOPER-ONLY TEST FIXTURE — NOT A PARCEL RECORD.
 *
 * This module describes an isolated preview-only test case for a land
 * reference that has NO exact row in the `parcels` index and NO evidence-backed
 * cadastral polygon. Nothing here is written to the database, and nothing here
 * may be presented as a verified title, verified parcel or survey evidence.
 *
 * Hard invariants (asserted in tests):
 *  - matchedParcelRecord === null
 *  - geometry === null
 *  - boundaryEvidence === "NONE"
 *  - identifier resolution never geocodes and never falls back to a nearest
 *    parcel record
 *  - the document-stated area is never converted into a polygon
 */

export type FixtureResultState = "NOT_IN_INDEX" | "EXTERNAL_VERIFICATION_REQUIRED";

export type ModelRole = "environment-control" | "building-candidate";

export type FixtureModel = {
  /** Original uploaded file name. */
  file: string;
  label: string;
  role: ModelRole;
  /** Public HTTPS source URL for the test model, or null when unavailable. */
  url: string | null;
  /** No USDZ exists for the fixture cohort — Quick Look stays UNKNOWN. */
  usdzUrl: null;
};

export type KonzaFixture = {
  readonly kind: "EPHEMERAL_TEST_FIXTURE";
  /** Exactly what the operator searched — never rewritten to a place name. */
  readonly searchedTitle: string;
  /** Document-derived, unverified. */
  readonly documentStatedAreaHa: number;
  readonly documentStatedRegistryMapSheet: string;
  /** Independent, user-supplied physical test point. Not a boundary. */
  readonly physicalTestCoordinate: {
    readonly lat: number;
    readonly lng: number;
    readonly source: "USER_SUPPLIED_PHYSICAL_TEST_POINT";
  };
  /** Structurally separate slot — stays null for this fixture. */
  readonly matchedParcelRecord: null;
  readonly resultState: FixtureResultState;
  readonly boundaryEvidence: "NONE";
  readonly geometry: null;
  /** Fit of any massing against a legal boundary is unknowable here. */
  readonly modelFit: "UNKNOWN";
};

export const KONZA_LR = "KONZA SOUTH/KONZA SOUTH BLOCK 5 (KONZA)/14726";

export const KONZA_FIXTURE: KonzaFixture = Object.freeze({
  kind: "EPHEMERAL_TEST_FIXTURE",
  searchedTitle: KONZA_LR,
  documentStatedAreaHa: 0.044,
  documentStatedRegistryMapSheet: "14",
  physicalTestCoordinate: Object.freeze({
    lat: -1.7568583,
    lng: 37.1036167,
    source: "USER_SUPPLIED_PHYSICAL_TEST_POINT",
  }),
  matchedParcelRecord: null,
  resultState: "EXTERNAL_VERIFICATION_REQUIRED",
  boundaryEvidence: "NONE",
  geometry: null,
  modelFit: "UNKNOWN",
} as const);

export const FIXTURE_DISCLAIMER =
  "Not assessed here: title validity · ownership · legal boundary position.";

export const IMAGERY_CAPTION =
  "Location imagery centred on the user-supplied test coordinate. Not cadastral evidence and not a title boundary.";

const SOURCE_BASE =
  "https://raw.githubusercontent.com/SpectraStudios/SourceCityToolkit_glb/main";

/**
 * Fixture model cohort — referenced read-only at their public source URLs.
 * Nothing is copied into the repository and the five protected `_massing`
 * assets are neither read nor modified by this harness.
 */
export const FIXTURE_MODELS: readonly FixtureModel[] = Object.freeze([
  {
    file: "SKY_Apartment_2_sky_day_ar.glb",
    label: "Sky / day environment",
    role: "environment-control",
    url: `${SOURCE_BASE}/SKY_Apartment_2_sky_day_ar.glb`,
    usdzUrl: null,
  },
  {
    file: "SKY_Apartment_2_sky_night_ar.glb",
    label: "Sky / night environment",
    role: "environment-control",
    url: `${SOURCE_BASE}/SKY_Apartment_2_sky_night_ar.glb`,
    usdzUrl: null,
  },
  {
    file: "Apartment_3.glb",
    label: "Apartment 3",
    role: "building-candidate",
    url: `${SOURCE_BASE}/Apartment_3.glb`,
    usdzUrl: null,
  },
  {
    file: "Apartment_1_2.glb",
    label: "Apartment 1_2",
    role: "building-candidate",
    url: `${SOURCE_BASE}/Apartment_1_2.glb`,
    usdzUrl: null,
  },
  {
    file: "Market_Day.glb",
    label: "Market Day",
    role: "building-candidate",
    url: `${SOURCE_BASE}/Market_Day.glb`,
    usdzUrl: null,
  },
  {
    file: "Apartment_6_Rooftop_Bar.glb",
    label: "Apartment 6 — Rooftop Bar",
    role: "building-candidate",
    url: `${SOURCE_BASE}/Apartment_6_Rooftop_Bar.glb`,
    usdzUrl: null,
  },
]);

export const HARNESS_LABEL =
  "Compatibility harness — not the production Spatial renderer.";

/** Environment/sky controls can never unlock a building-fit status. */
export function canEnableBuildingFit(model: FixtureModel | null): false {
  void model;
  return false;
}

/** Shape test for a land-reference / LR / title identifier. */
export function looksLikeLandIdentifier(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  if (/^\s*-?\d{1,2}(\.\d+)?\s*[, ]\s*-?\d{1,3}(\.\d+)?\s*$/.test(q)) return false;
  return /\//.test(q) || /\b(l\.?r\.?|block)\b/i.test(q) || /\d{3,}/.test(q);
}

export type IdentifierResolution = {
  searchedTitle: string;
  matchedParcelRecord: null;
  resultState: FixtureResultState;
  /** Guard flags: both must stay false for identifier queries. */
  geocodeUsed: false;
  nearestParcelFallbackUsed: false;
  /** Never populated from an identifier query (D-29 substitution guard). */
  geocodedPoint: null;
  note: string;
};

/**
 * Exact-match-only resolution for the fixture identifier.
 *
 * Deliberately has NO geocoding branch and NO nearest-parcel branch, so an
 * identifier can never be silently substituted with a locality (defect D-29).
 */
export function resolveFixtureIdentifier(
  query: string,
  exactRowExists = false,
): IdentifierResolution {
  return {
    searchedTitle: query.trim(),
    matchedParcelRecord: null,
    resultState: exactRowExists ? "NOT_IN_INDEX" : "EXTERNAL_VERIFICATION_REQUIRED",
    geocodeUsed: false,
    nearestParcelFallbackUsed: false,
    geocodedPoint: null,
    note: "No exact parcel row for this land reference. External verification required; no boundary evidence is unlocked.",
  };
}

/** Absolute HTTPS URL for native AR handoffs (Scene Viewer requires one). */
export function absoluteModelUrl(url: string | null, origin?: string): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  if (!base) return null;
  return `${base}${url}`;
}

/**
 * Scene Viewer intent, reproducing the already-established construction used by
 * the Spatial studio. No Spatial code is imported or modified.
 */
export function sceneViewerHref(absoluteGlb: string | null): string | null {
  if (!absoluteGlb) return null;
  return `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(
    absoluteGlb,
  )}&mode=ar_preferred#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;end;`;
}
