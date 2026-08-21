/** Client-safe provenance types for the intelligence snapshot layer. */

export type IntelSlice = "elevation" | "air_quality" | "places";

export type SliceProvenance = {
  slice: IntelSlice;
  provider: string;
  status: "ok" | "degraded" | "unavailable";
  reason?: string | null;
  method: string;
  version: string;
  /** When the provider actually answered. */
  retrievedAt: string;
  /** When this slice becomes stale under its dataset-specific policy. */
  expiresAt: string;
  /** True when served from the persisted snapshot rather than a live call. */
  cached: boolean;
};

export type SnapshotMeta = {
  key: string;
  slices: Partial<Record<IntelSlice, SliceProvenance>>;
};
