/**
 * Authority-aware provenance for land-intelligence claims.
 *
 * Evidence class, confidence and authority assurance are independent. Merely
 * supplying complete metadata never authenticates a title, registry response,
 * professional licence or source. Authority assurance must be supplied by a
 * separate verification workflow; this module only enforces the display gate.
 */
export const EVIDENCE_CLASSES = [
  "OFFICIAL_REGISTRY",
  "LICENSED_PROFESSIONAL",
  "PUBLIC_OPEN_DATA",
  "USER_SUBMISSION",
  "MODEL_INFERENCE",
] as const;

export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

export const ASSURANCE_STATES = [
  "UNVERIFIED",
  "SOURCE_RECORDED",
  "AUTHORITY_CONFIRMED",
  "PROFESSIONAL_ATTESTED",
] as const;

export type AssuranceState = (typeof ASSURANCE_STATES)[number];

export type EvidenceProvenance = {
  evidenceClass: EvidenceClass;
  assurance: AssuranceState;
  sourceLabel: string;
  sourceUrl?: string;
  sourceRecordId?: string;
  retrievedAt?: string;
  observedAt?: string;
  authorityName?: string;
};

export type EvidenceDisplayLabel =
  | "Official registry record"
  | "Unverified registry submission"
  | "Licensed-professional attestation"
  | "Unverified professional submission"
  | "Public/open-data indicator"
  | "User-submitted"
  | "Model inference";

const ISO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function nonBlank(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function httpUrl(value: string | undefined): value is string {
  if (!nonBlank(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function isoTimestamp(value: string | undefined): value is string {
  return nonBlank(value) && ISO_TIMESTAMP.test(value) && Number.isFinite(Date.parse(value));
}

/** Structural gaps only. An empty result does not prove that a source is false or authentic. */
export function provenanceGaps(p: EvidenceProvenance): string[] {
  const gaps: string[] = [];
  if (!nonBlank(p.sourceLabel)) gaps.push("sourceLabel");

  if (p.evidenceClass === "OFFICIAL_REGISTRY") {
    if (!httpUrl(p.sourceUrl)) gaps.push("sourceUrl");
    if (!nonBlank(p.sourceRecordId)) gaps.push("sourceRecordId");
    if (!isoTimestamp(p.retrievedAt)) gaps.push("retrievedAt");
    if (!nonBlank(p.authorityName)) gaps.push("authorityName");
  }

  if (p.evidenceClass === "LICENSED_PROFESSIONAL") {
    if (!nonBlank(p.sourceRecordId)) gaps.push("sourceRecordId");
    if (!isoTimestamp(p.observedAt)) gaps.push("observedAt");
    if (!nonBlank(p.authorityName)) gaps.push("authorityName");
  }

  if (p.evidenceClass === "PUBLIC_OPEN_DATA") {
    if (!httpUrl(p.sourceUrl)) gaps.push("sourceUrl");
    if (!isoTimestamp(p.retrievedAt)) gaps.push("retrievedAt");
  }

  return gaps;
}

/**
 * "Official registry record" is allowed only after a separate workflow has
 * positively confirmed the response with the authority.
 */
export function canUseOfficialRecordLanguage(p: EvidenceProvenance): boolean {
  return (
    p.evidenceClass === "OFFICIAL_REGISTRY" &&
    p.assurance === "AUTHORITY_CONFIRMED" &&
    provenanceGaps(p).length === 0
  );
}

/** Professional evidence is attested, not upgraded to an official registry fact. */
export function canUseProfessionalAttestationLanguage(p: EvidenceProvenance): boolean {
  return (
    p.evidenceClass === "LICENSED_PROFESSIONAL" &&
    p.assurance === "PROFESSIONAL_ATTESTED" &&
    provenanceGaps(p).length === 0
  );
}

export function evidenceDisplayLabel(p: EvidenceProvenance): EvidenceDisplayLabel {
  switch (p.evidenceClass) {
    case "OFFICIAL_REGISTRY":
      return canUseOfficialRecordLanguage(p)
        ? "Official registry record"
        : "Unverified registry submission";
    case "LICENSED_PROFESSIONAL":
      return canUseProfessionalAttestationLanguage(p)
        ? "Licensed-professional attestation"
        : "Unverified professional submission";
    case "PUBLIC_OPEN_DATA":
      return "Public/open-data indicator";
    case "USER_SUBMISSION":
      return "User-submitted";
    case "MODEL_INFERENCE":
      return "Model inference";
  }
}
