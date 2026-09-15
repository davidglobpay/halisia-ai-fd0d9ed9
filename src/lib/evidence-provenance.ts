/**
 * Evidence provenance taxonomy for land-intelligence claims.
 *
 * This module deliberately separates provenance from confidence. A model output
 * can be high-confidence and still is not an official registry fact.
 */
export const EVIDENCE_CLASSES = [
  "OFFICIAL_REGISTRY",
  "LICENSED_PROFESSIONAL",
  "PUBLIC_OPEN_DATA",
  "USER_SUBMISSION",
  "MODEL_INFERENCE",
] as const;

export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

export type EvidenceProvenance = {
  evidenceClass: EvidenceClass;
  sourceLabel: string;
  sourceUrl?: string;
  sourceRecordId?: string;
  retrievedAt?: string;
  observedAt?: string;
  licenceOrAuthority?: string;
};

export type VerificationLabel =
  | "Official record returned"
  | "Professional attestation"
  | "Public-data indicator"
  | "User-submitted"
  | "Model estimate";

const LABELS: Record<EvidenceClass, VerificationLabel> = {
  OFFICIAL_REGISTRY: "Official record returned",
  LICENSED_PROFESSIONAL: "Professional attestation",
  PUBLIC_OPEN_DATA: "Public-data indicator",
  USER_SUBMISSION: "User-submitted",
  MODEL_INFERENCE: "Model estimate",
};

export function verificationLabel(evidenceClass: EvidenceClass): VerificationLabel {
  return LABELS[evidenceClass];
}

export function provenanceGaps(p: EvidenceProvenance): string[] {
  const gaps: string[] = [];
  if (!p.sourceLabel.trim()) gaps.push("sourceLabel");

  if (p.evidenceClass === "OFFICIAL_REGISTRY") {
    if (!p.sourceUrl) gaps.push("sourceUrl");
    if (!p.sourceRecordId) gaps.push("sourceRecordId");
    if (!p.retrievedAt) gaps.push("retrievedAt");
    if (!p.licenceOrAuthority) gaps.push("licenceOrAuthority");
  }

  if (p.evidenceClass === "LICENSED_PROFESSIONAL") {
    if (!p.sourceRecordId) gaps.push("sourceRecordId");
    if (!p.observedAt) gaps.push("observedAt");
    if (!p.licenceOrAuthority) gaps.push("licenceOrAuthority");
  }

  if (p.evidenceClass === "PUBLIC_OPEN_DATA") {
    if (!p.sourceUrl) gaps.push("sourceUrl");
    if (!p.retrievedAt) gaps.push("retrievedAt");
  }

  return gaps;
}

export function canUseVerifiedLanguage(p: EvidenceProvenance): boolean {
  return (
    (p.evidenceClass === "OFFICIAL_REGISTRY" ||
      p.evidenceClass === "LICENSED_PROFESSIONAL") &&
    provenanceGaps(p).length === 0
  );
}
