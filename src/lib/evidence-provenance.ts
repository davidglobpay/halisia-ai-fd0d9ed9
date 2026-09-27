/**
 * Evidence provenance taxonomy for land-intelligence claims.
 *
 * Provenance and confidence are deliberately separate: a high-confidence
 * model output is still not an official registry fact. These checks establish
 * structural completeness only; they do not authenticate a record or source.
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

const ISO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function isNonBlank(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isHttpUrl(value: string | undefined): value is string {
  if (!isNonBlank(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function isIsoTimestamp(value: string | undefined): value is string {
  return (
    isNonBlank(value) &&
    ISO_TIMESTAMP.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

export function verificationLabel(evidenceClass: EvidenceClass): VerificationLabel {
  return LABELS[evidenceClass];
}

export function provenanceGaps(p: EvidenceProvenance): string[] {
  const gaps: string[] = [];
  if (!isNonBlank(p.sourceLabel)) gaps.push("sourceLabel");

  if (p.evidenceClass === "OFFICIAL_REGISTRY") {
    if (!isHttpUrl(p.sourceUrl)) gaps.push("sourceUrl");
    if (!isNonBlank(p.sourceRecordId)) gaps.push("sourceRecordId");
    if (!isIsoTimestamp(p.retrievedAt)) gaps.push("retrievedAt");
    if (!isNonBlank(p.licenceOrAuthority)) gaps.push("licenceOrAuthority");
  }

  if (p.evidenceClass === "LICENSED_PROFESSIONAL") {
    if (!isNonBlank(p.sourceRecordId)) gaps.push("sourceRecordId");
    if (!isIsoTimestamp(p.observedAt)) gaps.push("observedAt");
    if (!isNonBlank(p.licenceOrAuthority)) gaps.push("licenceOrAuthority");
  }

  if (p.evidenceClass === "PUBLIC_OPEN_DATA") {
    if (!isHttpUrl(p.sourceUrl)) gaps.push("sourceUrl");
    if (!isIsoTimestamp(p.retrievedAt)) gaps.push("retrievedAt");
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
