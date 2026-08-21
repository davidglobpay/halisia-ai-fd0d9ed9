/**
 * HALISIA — Intelligence Snapshot V1.
 *
 * Persists factual provider outputs per location so repeated analysis of the
 * same point reuses stored intelligence instead of re-querying every provider.
 *
 * Design notes:
 * - Keyed by normalised coordinates (~11 m grid) and optionally a parcel id.
 * - One row per dataset "slice", so freshness is dataset-specific and a single
 *   failing provider never invalidates the rest of the snapshot.
 * - Only factual provider payloads and provenance are stored. No API keys and
 *   no key-bearing URLs (photo URLs are rebuilt at read time from refs).
 * - A slice is only written when the provider actually answered. A provider
 *   failure is never stamped as a fresh successful retrieval.
 */

import type { IntelSlice, SliceProvenance } from "@/lib/intel-snapshot.types";

export type { IntelSlice, SliceProvenance };


/** Dataset-specific freshness, per project data policy. */
export const SLICE_TTL_MS: Record<IntelSlice, number> = {
  // Terrain is stable until the source DEM/version changes.
  elevation: 365 * 24 * 3600_000,
  // Air quality is an hours-scale signal.
  air_quality: 3 * 3600_000,
  // POIs / amenities / travel times refresh monthly.
  places: 30 * 24 * 3600_000,
};

export const SLICE_META: Record<IntelSlice, { provider: string; method: string; version: string }> =
  {
    elevation: {
      provider: "google_elevation",
      method: "gateway_elevation_lookup",
      version: "v1",
    },
    air_quality: {
      provider: "google_air_quality",
      method: "current_conditions_lookup",
      version: "v1",
    },
    places: {
      provider: "google_places_routes",
      method: "nearby_search_plus_route_matrix",
      version: "v1",
    },
  };

export type SliceProvenance = {
  slice: IntelSlice;
  provider: string;
  status: "ok" | "degraded" | "unavailable";
  reason?: string | null;
  method: string;
  version: string;
  retrievedAt: string;
  expiresAt: string;
  /** True when served from the persisted snapshot rather than a live call. */
  cached: boolean;
};

export type SnapshotRow<T> = {
  payload: T;
  provenance: SliceProvenance;
};

/** ~11 m grid — safe, stable key for coordinate-level reuse. */
export function locationKey(lat: number, lng: number, parcelId?: string | null): string {
  if (parcelId) return `parcel:${parcelId}`;
  return `geo:${lat.toFixed(4)},${lng.toFixed(4)}`;
}

type AnyDb = {
  from: (t: string) => any;
};

async function db(): Promise<AnyDb | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin as unknown as AnyDb;
  } catch {
    // Snapshot persistence is an optimisation: never break live intelligence.
    return null;
  }
}

/** Read every non-expired slice for a location. */
export async function readSnapshot(
  key: string,
): Promise<Partial<Record<IntelSlice, SnapshotRow<unknown>>>> {
  const client = await db();
  if (!client) return {};
  try {
    const { data, error } = await client
      .from("location_intel_slices")
      .select("slice, provider, status, reason, payload, method, version, retrieved_at, expires_at")
      .eq("location_key", key)
      .gt("expires_at", new Date().toISOString());
    if (error || !data) return {};
    const out: Partial<Record<IntelSlice, SnapshotRow<unknown>>> = {};
    for (const r of data as Array<Record<string, any>>) {
      const slice = r.slice as IntelSlice;
      if (!(slice in SLICE_TTL_MS)) continue;
      // Only successful/partial retrievals are reusable.
      if (r.status === "unavailable") continue;
      out[slice] = {
        payload: r.payload,
        provenance: {
          slice,
          provider: r.provider,
          status: r.status,
          reason: r.reason,
          method: r.method ?? SLICE_META[slice].method,
          version: r.version ?? SLICE_META[slice].version,
          retrievedAt: r.retrieved_at,
          expiresAt: r.expires_at,
          cached: true,
        },
      };
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Persist one slice. Only called when the provider genuinely answered —
 * a zero-result answer is stored (it is real data), a failure is not.
 */
export async function writeSlice(args: {
  key: string;
  lat: number;
  lng: number;
  parcelId?: string | null;
  slice: IntelSlice;
  status: "ok" | "degraded";
  reason?: string | null;
  payload: unknown;
  confidence?: number | null;
}): Promise<SliceProvenance> {
  const meta = SLICE_META[args.slice];
  const now = new Date();
  const expires = new Date(now.getTime() + SLICE_TTL_MS[args.slice]);
  const provenance: SliceProvenance = {
    slice: args.slice,
    provider: meta.provider,
    status: args.status,
    reason: args.reason ?? null,
    method: meta.method,
    version: meta.version,
    retrievedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    cached: false,
  };

  const client = await db();
  if (!client) return provenance;
  try {
    await client.from("location_intel_slices").upsert(
      {
        location_key: args.key,
        latitude: args.lat,
        longitude: args.lng,
        parcel_id: args.parcelId ?? null,
        slice: args.slice,
        provider: meta.provider,
        status: args.status,
        reason: args.reason ?? null,
        payload: args.payload as Record<string, unknown>,
        confidence: args.confidence ?? null,
        method: meta.method,
        version: meta.version,
        retrieved_at: provenance.retrievedAt,
        expires_at: provenance.expiresAt,
        updated_at: provenance.retrievedAt,
      },
      { onConflict: "location_key,slice" },
    );
  } catch {
    /* cache write failures must never break the response */
  }
  return provenance;
}

/** Provenance for a provider that failed — nothing is persisted for it. */
export function failedProvenance(slice: IntelSlice, reason?: string): SliceProvenance {
  const meta = SLICE_META[slice];
  return {
    slice,
    provider: meta.provider,
    status: "unavailable",
    reason: reason ?? null,
    method: meta.method,
    version: meta.version,
    retrievedAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
    cached: false,
  };
}
