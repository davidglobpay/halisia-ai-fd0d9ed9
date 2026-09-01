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
  /** CDN-hosted GLB path, or null when the asset could not be obtained. */
  url: string | null;
  /** Byte size of the obtained GLB, or null when unavailable. */
  sizeBytes: number | null;
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

/**
 * Fixture model cohort. URLs point at CDN-hosted copies of the supplied GLBs;
 * the matching `.asset.json` pointers live beside this file in `./models`.
 * A null `url` means the asset could not be obtained — no substitute is used.
 */
export const FIXTURE_MODELS: readonly FixtureModel[] = Object.freeze([
  {
    file: "SKY_Apartment_2_sky_day_ar.glb",
    label: "Sky / day environment",
    role: "environment-control",
    url: "/__l5e/assets-v1/cb1f60b5-2765-42bf-b14a-afdb62f53fb0/SKY_Apartment_2_sky_day_ar.glb",
    sizeBytes: 923680,
    usdzUrl: null,
  },
  {
    file: "SKY_Apartment_2_sky_night_ar.glb",
    label: "Sky / night environment",
    role: "environment-control",
    url: "/__l5e/assets-v1/ce70e7fb-b5d0-46ca-849f-45f534c38b26/SKY_Apartment_2_sky_night_ar.glb",
    sizeBytes: 1437464,
    usdzUrl: null,
  },
  {
    file: "Apartment_3.glb",
    label: "Apartment 3",
    role: "building-candidate",
    url: "/__l5e/assets-v1/df0f94f2-ea10-4534-b3dd-3d9065e9a92a/Apartment_3.glb",
    sizeBytes: 23739464,
    usdzUrl: null,
  },
  {
    file: "Apartment_1_2.glb",
    label: "Apartment 1_2",
    role: "building-candidate",
    url: "/__l5e/assets-v1/fb863632-343a-40d3-adf6-9cd8804087e7/Apartment_1_2.glb",
    sizeBytes: 25503336,
    usdzUrl: null,
  },
  {
    file: "Market_Day.glb",
    label: "Market Day (commercial stress)",
    role: "building-candidate",
    url: "/__l5e/assets-v1/b28f966d-6342-4ae4-9b8f-14f7b1cbde05/Market_Day.glb",
    sizeBytes: 17786532,
    usdzUrl: null,
  },
  {
    file: "Apartment_6_Rooftop_Bar.glb",
    label: "Apartment 6 — Rooftop Bar (stress)",
    role: "building-candidate",
    url: "/__l5e/assets-v1/618a632b-a378-4056-8bf4-3dfe4a80b3e0/Apartment_6_Rooftop_Bar.glb",
    sizeBytes: 29030476,
    usdzUrl: null,
  },
]);

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
