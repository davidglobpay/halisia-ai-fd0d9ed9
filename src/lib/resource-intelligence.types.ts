export const RESOURCE_DOMAINS = [
  "LAND",
  "AGRICULTURE",
  "MINERALS",
  "ENERGY",
  "WATER",
  "CLIMATE",
  "INFRASTRUCTURE",
] as const;
export type ResourceDomain = (typeof RESOURCE_DOMAINS)[number];

export const EPISTEMIC_TIERS = [
  "UNKNOWN",
  "INFERRED",
  "OBSERVED_THIRD_PARTY",
  "AUTHORITATIVE_SOURCE",
  "FIELD_OBSERVED",
  "PROFESSIONALLY_REVIEWED",
  "REGULATOR_VERIFIED",
] as const;
export type EpistemicTier = (typeof EPISTEMIC_TIERS)[number];

export const ASSESSMENT_STATES = [
  "NOT_ASSESSED",
  "INSUFFICIENT_EVIDENCE",
  "PRELIMINARY",
  "SCREENED",
  "PROFESSIONALLY_REVIEWED",
  "INVESTMENT_READY",
] as const;
export type AssessmentState = (typeof ASSESSMENT_STATES)[number];

export type ResourceObservation = {
  id: string;
  subjectType: "parcel" | "area" | "project" | "licence";
  subjectRef: string;
  parcelId?: string | null;
  domain: ResourceDomain;
  indicator: string;
  value: unknown;
  unit?: string | null;
  observedAt?: string | null;
  retrievedAt: string;
  validFrom?: string | null;
  validTo?: string | null;
  sourceAuthority: string;
  sourceSystem: string;
  sourceRecordId?: string | null;
  sourceUrl?: string | null;
  sourceClass: "model" | "third_party" | "government" | "field" | "professional" | "regulator";
  licence?: string | null;
  spatialResolution?: string | null;
  temporalResolution?: string | null;
  methodology: string;
  algorithmVersion?: string | null;
  modelVersion?: string | null;
  epistemicTier: EpistemicTier;
  confidencePct?: number | null;
  verificationState: "unverified" | "evidence_backed" | "professionally_reviewed" | "regulator_verified";
  provenanceHash: string;
};

export type EvidenceRequirement = {
  key: string;
  required: boolean;
  weight: number;
  acceptedTiers: EpistemicTier[];
};

export type EvidenceInput = {
  key: string;
  tier: EpistemicTier;
  confidencePct?: number | null;
  present: boolean;
};

export type EvidenceGateResult = {
  publishable: boolean;
  coverage: number;
  missingRequired: string[];
  state: AssessmentState;
};
