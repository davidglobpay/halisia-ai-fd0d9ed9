import { describe, expect, it } from "vitest";
import { isVisiblePassportEvidence } from "@/lib/passport-visible-evidence";
import type { EvidenceItem } from "@/lib/passport-evidence";
const direct: EvidenceItem = {
  id: "elev",
  chapter: "physical",
  label: "Elevation",
  value: "1700 m",
  source: "Google Elevation API",
  method: "Single-point sample",
  usedFor: [],
  cls: "measured",
  confidence: "high",
  retrieved: "2026-10-17",
};
describe("conservative Passport presentation", () => {
  it("retains supported direct provider results", () =>
    expect(isVisiblePassportEvidence(direct)).toBe(true));
  it.each([null, "", "   "])("omits missing values (%s)", (value) =>
    expect(isVisiblePassportEvidence({ ...direct, value })).toBe(false),
  );
  it.each(["modelled", "ai", "user", "official", "gap"] as const)(
    "withholds %s rather than promoting it to measured evidence",
    (cls) => expect(isVisiblePassportEvidence({ ...direct, cls })).toBe(false),
  );
  it("does not trust an arbitrary source or a confidence label alone", () => {
    expect(isVisiblePassportEvidence({ ...direct, source: "Copied blog" })).toBe(false);
    expect(isVisiblePassportEvidence({ ...direct, id: "ownership" })).toBe(false);
    expect(isVisiblePassportEvidence({ ...direct, confidence: "low" })).toBe(false);
  });
  it("retains a populated Google place lookup, not an empty search", () => {
    expect(
      isVisiblePassportEvidence({
        ...direct,
        id: "acc-schools",
        source: "Google Places API (New)",
      }),
    ).toBe(true);
    expect(
      isVisiblePassportEvidence({
        ...direct,
        id: "acc-schools",
        source: "Google Places API (New)",
        confidence: "medium",
      }),
    ).toBe(false);
  });
});
