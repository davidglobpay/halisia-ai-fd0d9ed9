import { describe, expect, it } from "vitest";
import {
  classifySlope, contourEligibility, smallestHonestInterval, ASTER_30M,
} from "@/lib/site-terrain";

describe("slope bands", () => {
  it.each([
    [0, "level"], [1.0, "level"], [1.99, "level"],
    [2, "gentle"], [4.99, "gentle"],
    [5, "moderate"], [9.99, "moderate"],
    [10, "strong"], [14.99, "strong"],
    [15, "steep"], [60, "steep"],
  ])("puts %s%% in the %s band", (pct, id) => {
    expect(classifySlope(pct as number)?.id).toBe(id);
  });

  it("states that a band is not a buildability rating", () => {
    expect(classifySlope(1)!.basis).toContain("Not a buildability rating");
  });

  it.each([null, undefined, NaN, -1])("returns null for %s", (bad) => {
    expect(classifySlope(bad as number)).toBeNull();
  });
});

describe("contour guard — the refusals are the feature", () => {
  it("refuses an interval finer than the source's vertical error", () => {
    const v = contourEligibility({ ...ASTER_30M, reliefM: 120, proposedIntervalM: 1 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain("finer than");
  });

  it("refuses the Katani case: 27 m of relief is under three 10 m intervals", () => {
    // Real figures from the 20 Oct Katani Land Passport export.
    const v = contourEligibility({ ...ASTER_30M, reliefM: 27, proposedIntervalM: 10 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain("not enough fall");
  });

  it("refuses a site too small for the raster to resolve", () => {
    const v = contourEligibility({ ...ASTER_30M, reliefM: 120, proposedIntervalM: 10, siteSpanM: 45 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain("elevation posts");
  });

  it("allows real relief over a large enough site, and still caveats it", () => {
    const v = contourEligibility({ ...ASTER_30M, reliefM: 120, proposedIntervalM: 10, siteSpanM: 400 });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.approxLines).toBe(12);
      expect(v.caveat).toContain("not surveyed contours");
    }
  });

  it.each([
    ["no relief", { ...ASTER_30M, reliefM: 0, proposedIntervalM: 10 }],
    ["no interval", { ...ASTER_30M, reliefM: 120, proposedIntervalM: 0 }],
    ["no grid spacing", { gridSpacingM: NaN, verticalAccuracyM: 10, reliefM: 120, proposedIntervalM: 10 }],
  ])("refuses when %s was supplied", (_label, input) => {
    const v = contourEligibility(input);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/^Cannot assess/);
  });

  it("is load-bearing: loosening the accuracy flips the verdict", () => {
    const strict = contourEligibility({ ...ASTER_30M, reliefM: 27, proposedIntervalM: 10 });
    const loose = contourEligibility({ gridSpacingM: 30, verticalAccuracyM: 0.1, reliefM: 27, proposedIntervalM: 1 });
    expect(strict.ok).toBe(false);
    expect(loose.ok).toBe(true);
  });
});

describe("smallest honest interval", () => {
  it.each([[10, 10], [8, 10], [2, 2], [0.5, 1], [17, 20], [120, 200]])(
    "rounds %s m of error up to a %s m interval",
    (acc, want) => expect(smallestHonestInterval(acc)).toBe(want),
  );

  it("returns null when the accuracy is unusable", () => {
    expect(smallestHonestInterval(0)).toBeNull();
  });
});
