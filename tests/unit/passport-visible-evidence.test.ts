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
describe("source-backed Passport presentation", () => {
  it("retains direct provider results", () => expect(isVisiblePassportEvidence(direct)).toBe(true));
  it.each([null, "", " ", "NaN m"])("omits missing or invalid values %s", (value) =>
    expect(isVisiblePassportEvidence({ ...direct, value })).toBe(false),
  );
  it("restores labelled soil and climate models", () => {
    expect(
      isVisiblePassportEvidence({
        ...direct,
        id: "soil",
        cls: "modelled",
        source: "ISRIC SoilGrids v2.0",
        confidence: "medium",
      }),
    ).toBe(true);
    expect(
      isVisiblePassportEvidence({
        ...direct,
        id: "rain",
        cls: "modelled",
        source: "Open-Meteo Climate API",
        confidence: "medium",
      }),
    ).toBe(true);
  });
  it.each(["bedrock", "groundwater", "foundation", "owner", "title", "finance"])(
    "does not invent %s from generic rules",
    (id) => expect(isVisiblePassportEvidence({ ...direct, id, cls: "ai" })).toBe(false),
  );
  it("does not promote arbitrary text or zero search placeholders", () => {
    expect(isVisiblePassportEvidence({ ...direct, source: "Copied blog" })).toBe(false);
    expect(
      isVisiblePassportEvidence({
        ...direct,
        id: "acc-schools",
        source: "Google Places API (New)",
        value: "None found in search radius",
      }),
    ).toBe(false);
  });
});
