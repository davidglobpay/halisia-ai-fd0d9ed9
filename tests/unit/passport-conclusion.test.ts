import { describe, expect, it } from "vitest";
import { buildEvidenceConclusion } from "@/lib/passport-conclusion";

describe("buildEvidenceConclusion", () => {
  it("returns an empty string when every input line is empty", () => {
    expect(buildEvidenceConclusion([false, null, undefined, "", "   "])).toBe("");
  });

  it("joins non-empty evidence summaries without inventing a verdict", () => {
    expect(buildEvidenceConclusion(["Slope is 4.2%.", null, "Elevation spans 120–138 m."])).toBe(
      "Slope is 4.2%. Elevation spans 120–138 m.",
    );
  });

  it.each([
    "rating",
    "grade",
    "score",
    "suitable",
    "bearing capacity",
    "water table",
    "KSh 2,000",
    "KES 2500",
    "$300",
  ])("blocks conclusion text containing %s", (unsafeText) => {
    expect(buildEvidenceConclusion([unsafeText])).toBe("");
  });
});

describe("limitations are not verdicts", () => {
  it("keeps the Passport soil disclaimer", () => {
    const soil =
      "Bedrock depth, water table and bearing capacity are not measured and cannot be derived from a composition model. A site investigation by a licensed professional is required before any foundation or earthworks decision.";
    expect(buildEvidenceConclusion(["Clay content is 38% at 0–5 cm.", soil])).toContain(
      "bearing capacity are not measured",
    );
  });

  it.each([
    "The water table is shallow here.",
    "Bearing capacity is adequate for two storeys.",
    "The site is not suitable for building.",
    "Suitability cannot be assessed, but the plot is suitable for housing.",
    "Value is not measured; expect KES 2,500,000.",
  ])("still blocks %s", (text) => {
    expect(buildEvidenceConclusion([text])).toBe("");
  });

  it("blocks the whole box if any sentence is a verdict", () => {
    expect(buildEvidenceConclusion(["Slope is 4.2%.", "The plot is suitable for a villa."])).toBe(
      "",
    );
  });
});
