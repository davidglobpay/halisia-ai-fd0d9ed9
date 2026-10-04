import { describe, expect, it } from "vitest";
import { canDeclareInvestmentReady, evidenceGate, mayPromote } from "../../src/lib/resource-intelligence";

describe("resource intelligence evidence rules", () => {
  it("AI can never self-promote evidence to regulator verified", () => {
    expect(mayPromote("INFERRED", "REGULATOR_VERIFIED", "ai")).toBe(false);
  });

  it("missing required evidence blocks publication even when weighted coverage is high", () => {
    const result = evidenceGate(
      [
        { key: "land", required: true, weight: 20, acceptedTiers: ["AUTHORITATIVE_SOURCE"] },
        { key: "energy", required: false, weight: 80, acceptedTiers: ["AUTHORITATIVE_SOURCE"] },
      ],
      [
        { key: "land", tier: "UNKNOWN", present: false },
        { key: "energy", tier: "AUTHORITATIVE_SOURCE", present: true },
      ],
    );
    expect(result.coverage).toBe(0.8);
    expect(result.publishable).toBe(false);
    expect(result.state).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("investment-ready requires technical, financial and land evidence plus professional review", () => {
    expect(
      canDeclareInvestmentReady({
        state: "PROFESSIONALLY_REVIEWED",
        regulatorOrProfessionalReview: true,
        financialFeasibilityPresent: false,
        technicalFeasibilityPresent: true,
        legalTenureEvidencePresent: true,
        unresolvedBlockingRisk: false,
      }),
    ).toBe(false);
  });
});
