import { describe, expect, it } from "vitest";
import {
  EVIDENCE_CLASSES,
  canUseVerifiedLanguage,
  provenanceGaps,
  verificationLabel,
  type EvidenceProvenance,
} from "@/lib/evidence-provenance";

describe("evidence provenance taxonomy", () => {
  it("keeps all five evidence classes distinct", () => {
    expect(new Set(EVIDENCE_CLASSES).size).toBe(5);
  });

  it.each([
    ["OFFICIAL_REGISTRY", "Official record returned"],
    ["LICENSED_PROFESSIONAL", "Professional attestation"],
    ["PUBLIC_OPEN_DATA", "Public-data indicator"],
    ["USER_SUBMISSION", "User-submitted"],
    ["MODEL_INFERENCE", "Model estimate"],
  ] as const)("labels %s without upgrading its authority", (kind, label) => {
    expect(verificationLabel(kind)).toBe(label);
  });

  it("requires complete official provenance before verified language", () => {
    const incomplete: EvidenceProvenance = {
      evidenceClass: "OFFICIAL_REGISTRY",
      sourceLabel: "Ardhisasa response",
    };
    expect(canUseVerifiedLanguage(incomplete)).toBe(false);
    expect(provenanceGaps(incomplete)).toEqual([
      "sourceUrl",
      "sourceRecordId",
      "retrievedAt",
      "licenceOrAuthority",
    ]);

    expect(
      canUseVerifiedLanguage({
        ...incomplete,
        sourceUrl: "https://ardhisasa.lands.go.ke/",
        sourceRecordId: "TEST-REFERENCE-NOT-A-REAL-RECORD",
        retrievedAt: "2026-09-15T00:00:00.000Z",
        licenceOrAuthority: "State Department for Lands",
      }),
    ).toBe(true);
  });

  it.each(["PUBLIC_OPEN_DATA", "USER_SUBMISSION", "MODEL_INFERENCE"] as const)(
    "never upgrades %s to verified language",
    (evidenceClass) => {
      expect(
        canUseVerifiedLanguage({
          evidenceClass,
          sourceLabel: "Fixture",
          sourceUrl: "https://example.test/source",
          sourceRecordId: "fixture",
          retrievedAt: "2026-09-15T00:00:00.000Z",
          observedAt: "2026-09-15T00:00:00.000Z",
          licenceOrAuthority: "fixture",
        }),
      ).toBe(false);
    },
  );
});
