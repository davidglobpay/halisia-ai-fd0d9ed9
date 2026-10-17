export type EvidenceClass =
  | "official_registry"
  | "professional_attestation"
  | "open_data"
  | "user_submission"
  | "model_inference";
export type EvidencePosition = {
  lat: number;
  lng: number;
  accuracyM: number | null;
};
export type MapEvidence = {
  id: string;
  label: string;
  finding: string;
  evidenceClass: EvidenceClass;
  source: string;
  capturedAt: string | null;
  position: EvidencePosition | null;
  positionScope?: "place" | "sample" | "supplied";
  supports: string;
  limitations: string;
  method?: string;
  confidence?: string;
  retrievedAt?: string | null;
};
export const EVIDENCE_CLASS_LABELS: Record<EvidenceClass, string> = {
  official_registry: "Official registry record",
  professional_attestation: "Licensed-professional attestation",
  open_data: "Open-data indicator",
  user_submission: "User submission",
  model_inference: "Model inference",
};
/** Provider reference layers are context, never a site survey or risk finding. */
export const MAP_CONTEXT_LAYERS = {
  slope: {
    label: "Terrain hillshade",
    limitation: "Shaded relief context, not a measured slope.",
  },
  drainage: {
    label: "Mapped watercourses",
    limitation: "Hydrographic reference, not a site drainage or flood assessment.",
  },
} as const;
export function evidenceTarget(item: MapEvidence): EvidencePosition | null {
  const p = item.position;
  if (
    !p ||
    !Number.isFinite(p.lat) ||
    !Number.isFinite(p.lng) ||
    p.lat < -90 ||
    p.lat > 90 ||
    p.lng < -180 ||
    p.lng > 180
  )
    return null;
  if (p.accuracyM !== null && (!Number.isFinite(p.accuracyM) || p.accuracyM < 0)) return null;
  if (!item.source.trim() || !item.supports.trim() || !item.limitations.trim()) return null;
  return p;
}
