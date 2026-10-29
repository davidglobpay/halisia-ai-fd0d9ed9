/**
 * Turns a provider reading into an append-only evidence observation.
 *
 * location_intel_slices is a cache: one row per place and dataset, overwritten
 * on refresh, so it can say what is true now but not what changed. Every
 * reading written to the cache is also appended here to resource_observations,
 * which keeps the source, retrieval time, method and a content hash. That is
 * the history behind "why does HALISIA say this?".
 *
 * Pure: no database or network access, so it is unit-tested directly.
 */
import type { IntelSlice } from "@/lib/intel-snapshot.types";

export type EvidenceDomain =
  | "LAND"
  | "AGRICULTURE"
  | "MINERALS"
  | "ENERGY"
  | "WATER"
  | "CLIMATE"
  | "INFRASTRUCTURE";

/** Which evidence domain each cached dataset belongs to. */
export const SLICE_DOMAIN: Record<IntelSlice, EvidenceDomain> = {
  elevation: "LAND",
  air_quality: "CLIMATE",
  places: "INFRASTRUCTURE",
};

/** Plain-language names used by the "why" panel. */
export const INDICATOR_LABEL: Record<string, string> = {
  elevation: "Elevation",
  air_quality: "Air quality",
  places: "Nearby services and travel times",
};

/** Larger payloads are summarised so one busy area cannot bloat the table. */
export const MAX_VALUE_BYTES = 20_000;

export type ObservationRow = {
  subject_type: "area" | "parcel";
  subject_ref: string;
  parcel_id: string | null;
  domain: EvidenceDomain;
  indicator: string;
  value_json: unknown;
  observed_at: string;
  retrieved_at: string;
  valid_from: string;
  valid_to: string;
  source_id: string;
  source_record_id: string;
  methodology: string;
  algorithm_version: string;
  epistemic_tier: "OBSERVED_THIRD_PARTY";
  confidence_pct: null;
  verification_state: "unverified";
  provenance_hash: string;
  metadata: Record<string, unknown>;
};

/**
 * A parcel-keyed reading belongs to the parcel (readable by its owner); a
 * coordinate-keyed reading is about a public place (readable when signed in).
 */
export function subjectFor(locationKey: string, parcelId?: string | null) {
  if (parcelId) {
    return { subject_type: "parcel" as const, subject_ref: locationKey, parcel_id: parcelId };
  }
  return { subject_type: "area" as const, subject_ref: locationKey, parcel_id: null };
}

/** Keeps small payloads whole; replaces large ones with a shape summary. */
export function summarisePayload(payload: unknown, maxBytes = MAX_VALUE_BYTES): unknown {
  let text: string;
  try {
    text = JSON.stringify(payload ?? null);
  } catch {
    return { unserialisable: true };
  }
  if (text.length <= maxBytes) return payload ?? null;
  const summary: Record<string, unknown> = { truncated: true, bytes: text.length };
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const counts: Record<string, number | string> = {};
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      if (Array.isArray(v)) counts[k] = v.length;
      else if (v && typeof v === "object") counts[k] = Object.keys(v).length;
      else if (typeof v === "number" || typeof v === "string") counts[k] = v;
    }
    summary.fields = counts;
  } else if (Array.isArray(payload)) {
    summary.items = payload.length;
  }
  return summary;
}

/** Stable text the provenance hash is computed over. */
export function provenanceText(parts: {
  sourceSystem: string;
  locationKey: string;
  indicator: string;
  retrievedAt: string;
  value: unknown;
}): string {
  return [
    parts.sourceSystem,
    parts.locationKey,
    parts.indicator,
    parts.retrievedAt,
    JSON.stringify(parts.value ?? null),
  ].join("|");
}

/** SHA-256 hex. Uses Web Crypto, available in Node 20+ and Workers. */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildSliceObservation(args: {
  locationKey: string;
  lat: number;
  lng: number;
  parcelId?: string | null;
  slice: IntelSlice;
  status: "ok" | "degraded";
  reason?: string | null;
  payload: unknown;
  retrievedAt: string;
  expiresAt: string;
  sourceId: string;
  sourceSystem: string;
  method: string;
  version: string;
}): Promise<ObservationRow> {
  const value = summarisePayload(args.payload);
  const hash = await sha256Hex(
    provenanceText({
      sourceSystem: args.sourceSystem,
      locationKey: args.locationKey,
      indicator: args.slice,
      retrievedAt: args.retrievedAt,
      value,
    }),
  );
  return {
    ...subjectFor(args.locationKey, args.parcelId),
    domain: SLICE_DOMAIN[args.slice],
    indicator: args.slice,
    value_json: value,
    // Providers report current conditions; the reading is as of retrieval.
    observed_at: args.retrievedAt,
    retrieved_at: args.retrievedAt,
    valid_from: args.retrievedAt,
    valid_to: args.expiresAt,
    source_id: args.sourceId,
    source_record_id: args.locationKey,
    methodology: args.method,
    algorithm_version: args.version,
    epistemic_tier: "OBSERVED_THIRD_PARTY",
    // No provider here returns a calibrated confidence; none is invented.
    confidence_pct: null,
    verification_state: "unverified",
    provenance_hash: hash,
    metadata: {
      status: args.status,
      reason: args.reason ?? null,
      lat: Number(args.lat.toFixed(5)),
      lng: Number(args.lng.toFixed(5)),
    },
  };
}

/** One line per dataset for the "why" panel: latest reading plus its history. */
export type EvidenceTrailRow = {
  indicator: string;
  label: string;
  latestAt: string;
  firstAt: string;
  readings: number;
  source: { authority: string; url: string | null; licence: string | null } | null;
  method: string;
  tier: string;
  verification: string;
  degraded: boolean;
};

export function summariseTrail(
  rows: Array<{
    indicator: string;
    retrieved_at: string;
    methodology: string;
    epistemic_tier: string;
    verification_state: string;
    metadata: unknown;
    resource_sources?: {
      authority: string;
      source_url: string | null;
      licence: string | null;
    } | null;
  }>,
): EvidenceTrailRow[] {
  const by = new Map<string, EvidenceTrailRow>();
  for (const r of rows) {
    const t = r.retrieved_at;
    const prev = by.get(r.indicator);
    const status = (r.metadata as { status?: string } | null)?.status;
    if (!prev) {
      by.set(r.indicator, {
        indicator: r.indicator,
        label: INDICATOR_LABEL[r.indicator] ?? r.indicator,
        latestAt: t,
        firstAt: t,
        readings: 1,
        source: r.resource_sources
          ? {
              authority: r.resource_sources.authority,
              url: r.resource_sources.source_url,
              licence: r.resource_sources.licence,
            }
          : null,
        method: r.methodology,
        tier: r.epistemic_tier,
        verification: r.verification_state,
        degraded: status === "degraded",
      });
      continue;
    }
    prev.readings += 1;
    if (t > prev.latestAt) {
      prev.latestAt = t;
      prev.method = r.methodology;
      prev.degraded = status === "degraded";
    }
    if (t < prev.firstAt) prev.firstAt = t;
  }
  return [...by.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Plain-language meaning of an evidence tier. */
export const TIER_LABEL: Record<string, string> = {
  UNKNOWN: "Origin not recorded",
  INFERRED: "Inferred by a model",
  OBSERVED_THIRD_PARTY: "Reported by a third-party data provider",
  AUTHORITATIVE_SOURCE: "From an official source",
  FIELD_OBSERVED: "Observed on site",
  PROFESSIONALLY_REVIEWED: "Reviewed by a professional",
  REGULATOR_VERIFIED: "Verified by a regulator",
};
