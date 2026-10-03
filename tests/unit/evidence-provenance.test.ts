import { describe, expect, it } from "vitest";
import {
  EVIDENCE_CLASSES,
  canUseOfficialRecordLanguage,
  canUseProfessionalAttestationLanguage,
  evidenceDisplayLabel,
  provenanceGaps,
  type EvidenceProvenance,
} from "@/lib/evidence-provenance";

const official = (assurance: EvidenceProvenance["assurance"]): EvidenceProvenance => ({
  evidenceClass: "OFFICIAL_REGISTRY",
  assurance,
  sourceLabel: "Synthetic registry fixture",
  sourceUrl: "https://example.test/registry",
  sourceRecordId: "TEST-REFERENCE-NOT-A-REAL-RECORD",
  retrievedAt: "2026-09-28T00:00:00.000Z",
  authorityName: "Synthetic authority fixture",
});

describe("authority-aware evidence provenance", () => {
  it("keeps all five evidence classes distinct", () => {
    expect(new Set(EVIDENCE_CLASSES).size).toBe(5);
  });

  it("does not treat complete-looking metadata as authority confirmation", () => {
    const submitted = official("SOURCE_RECORDED");
    expect(provenanceGaps(submitted)).toEqual([]);
    expect(canUseOfficialRecordLanguage(submitted)).toBe(false);
    expect(evidenceDisplayLabel(submitted)).toBe("Unverified registry submission");
  });

  it("permits official-record language only after explicit authority confirmation", () => {
    const confirmed = official("AUTHORITY_CONFIRMED");
    expect(canUseOfficialRecordLanguage(confirmed)).toBe(true);
    expect(evidenceDisplayLabel(confirmed)).toBe("Official registry record");
  });

  it("rejects malformed official provenance even when marked confirmed", () => {
    const malformed: EvidenceProvenance = {
      ...official("AUTHORITY_CONFIRMED"),
      sourceUrl: "javascript:alert(1)",
      retrievedAt: "2026-09-28",
      authorityName: " ",
    };
    expect(provenanceGaps(malformed)).toEqual(["sourceUrl", "retrievedAt", "authorityName"]);
    expect(canUseOfficialRecordLanguage(malformed)).toBe(false);
  });

  it("keeps professional attestation separate from official registry evidence", () => {
    const professional: EvidenceProvenance = {
      evidenceClass: "LICENSED_PROFESSIONAL",
      assurance: "PROFESSIONAL_ATTESTED",
      sourceLabel: "Synthetic survey fixture",
      sourceRecordId: "TEST-ATTESTATION",
      observedAt: "2026-09-28T00:00:00.000Z",
      authorityName: "Synthetic licensing fixture",
    };
    expect(canUseProfessionalAttestationLanguage(professional)).toBe(true);
    expect(canUseOfficialRecordLanguage(professional)).toBe(false);
    expect(evidenceDisplayLabel(professional)).toBe("Licensed-professional attestation");
  });

  it.each(["PUBLIC_OPEN_DATA", "USER_SUBMISSION", "MODEL_INFERENCE"] as const)(
    "never upgrades %s to official-record language",
    (evidenceClass) => {
      const p: EvidenceProvenance = {
        evidenceClass,
        assurance: "AUTHORITY_CONFIRMED",
        sourceLabel: "Synthetic fixture",
        sourceUrl: "https://example.test/source",
        retrievedAt: "2026-09-28T00:00:00.000Z",
      };
      expect(canUseOfficialRecordLanguage(p)).toBe(false);
    },
  );
});
