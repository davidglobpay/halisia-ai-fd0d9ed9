import type {
  AssessmentState,
  EpistemicTier,
  EvidenceGateResult,
  EvidenceInput,
  EvidenceRequirement,
} from "./resource-intelligence.types";

const tierRank: Record<EpistemicTier, number> = {
  UNKNOWN: 0,
  INFERRED: 1,
  OBSERVED_THIRD_PARTY: 2,
  AUTHORITATIVE_SOURCE: 3,
  FIELD_OBSERVED: 4,
  PROFESSIONALLY_REVIEWED: 5,
  REGULATOR_VERIFIED: 6,
};

export function mayPromote(from: EpistemicTier, to: EpistemicTier, actor: "ai" | "field" | "professional" | "regulator"): boolean {
  if (tierRank[to] < tierRank[from]) return true;
  if (to === "REGULATOR_VERIFIED") return actor === "regulator";
  if (to === "PROFESSIONALLY_REVIEWED") return actor === "professional" || actor === "regulator";
  if (to === "FIELD_OBSERVED") return actor === "field" || actor === "professional" || actor === "regulator";
  if (actor === "ai") return tierRank[to] <= tierRank.INFERRED;
  return true;
}

export function evidenceGate(
  requirements: EvidenceRequirement[],
  inputs: EvidenceInput[],
  threshold = 0.7,
): EvidenceGateResult {
  const byKey = new Map(inputs.map((i) => [i.key, i]));
  const totalWeight = requirements.reduce((sum, r) => sum + Math.max(0, r.weight), 0) || 1;
  let coveredWeight = 0;
  const missingRequired: string[] = [];

  for (const requirement of requirements) {
    const input = byKey.get(requirement.key);
    const accepted = Boolean(input?.present && requirement.acceptedTiers.includes(input.tier));
    if (accepted) coveredWeight += Math.max(0, requirement.weight);
    if (requirement.required && !accepted) missingRequired.push(requirement.key);
  }

  const coverage = coveredWeight / totalWeight;
  const publishable = missingRequired.length === 0 && coverage >= threshold;
  return {
    publishable,
    coverage,
    missingRequired,
    state: publishable ? "PRELIMINARY" : "INSUFFICIENT_EVIDENCE",
  };
}

export function canDeclareInvestmentReady(args: {
  state: AssessmentState;
  regulatorOrProfessionalReview: boolean;
  financialFeasibilityPresent: boolean;
  technicalFeasibilityPresent: boolean;
  legalTenureEvidencePresent: boolean;
  unresolvedBlockingRisk: boolean;
}): boolean {
  return (
    args.state === "PROFESSIONALLY_REVIEWED" &&
    args.regulatorOrProfessionalReview &&
    args.financialFeasibilityPresent &&
    args.technicalFeasibilityPresent &&
    args.legalTenureEvidencePresent &&
    !args.unresolvedBlockingRisk
  );
}
