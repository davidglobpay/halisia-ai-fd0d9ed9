import { describe, expect, it } from "vitest";
import { buildEvidenceConclusion } from "./passport-conclusion";

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
