import type { DeedFields } from "@/lib/deed-extract.functions";

export type DeedLocationPrecision = "exact-coordinate" | "verified-boundary" | "locality" | "unlocated";

export type DeedEvidenceAssessment = {
  precision: DeedLocationPrecision;
  coordinates: { lat: number; lng: number } | null;
  areaSqm: number | null;
  mayRenderBoundary: boolean;
  mayRunSiteFit: boolean;
  message: string;
};

function validKenyaCoordinate(lat: number, lng: number) {
  return lat >= -5.2 && lat <= 5.2 && lng >= 33.5 && lng <= 42.5;
}

export function extractKenyaCoordinates(text: string) {
  const matches = text.match(/(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)/g) ?? [];
  for (const match of matches) {
    const values = match.split(/[, ]+/).map(Number);
    const [lat, lng] = values;
    if (Number.isFinite(lat) && Number.isFinite(lng) && validKenyaCoordinate(lat!, lng!)) {
      return { lat: lat!, lng: lng! };
    }
  }
  return null;
}

export function parseRegisteredArea(value: string | null): number | null {
  if (!value) return null;
  const match = value.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(ha|hectares?|acres?|m2|sqm|sq\s*m)/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2]!.toLowerCase().replace(/\s/g, "");
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (unit.startsWith("ha") || unit.startsWith("hectare")) return amount * 10_000;
  if (unit.startsWith("acre")) return amount * 4046.8564224;
  return amount;
}

export function assessDeedEvidence(
  fields: DeedFields,
  rawText: string,
  verifiedBoundary = false,
): DeedEvidenceAssessment {
  const coordinates = extractKenyaCoordinates(rawText);
  const areaSqm = parseRegisteredArea(fields.registeredArea);

  if (verifiedBoundary) {
    return {
      precision: "verified-boundary",
      coordinates,
      areaSqm,
      mayRenderBoundary: true,
      mayRunSiteFit: true,
      message: "Verified parcel geometry is available for boundary rendering and site-fit checks.",
    };
  }
  if (coordinates) {
    return {
      precision: "exact-coordinate",
      coordinates,
      areaSqm,
      mayRenderBoundary: false,
      mayRunSiteFit: false,
      message: "A coordinate was extracted, but the legal parcel boundary remains unverified.",
    };
  }
  if (fields.locationHint || fields.registry || fields.county) {
    return {
      precision: "locality",
      coordinates: null,
      areaSqm,
      mayRenderBoundary: false,
      mayRunSiteFit: false,
      message: "Only locality context is available. This point is not the parcel location or boundary.",
    };
  }
  return {
    precision: "unlocated",
    coordinates: null,
    areaSqm,
    mayRenderBoundary: false,
    mayRunSiteFit: false,
    message: "The document does not contain enough evidence to locate this parcel.",
  };
}
