/**
 * P0-C — composite confidence gating.
 *
 * The dossier withholds any indicator whose confidence is "low". These tests
 * pin the contract that decides that flag, in particular the audit case where
 * climate coverage is good while the OpenStreetMap-derived components that the
 * investment composite is built from have no coverage at all.
 *
 * Scoring arithmetic is deliberately NOT changed by these tests — only the
 * confidence each component is allowed to claim.
 */
import { describe, it, expect } from "vitest";
import { score, type Wave4Facility } from "@/lib/wave4-intel.functions";

const CATEGORIES = [
  "hospitals",
  "schools",
  "police",
  "fire",
  "banks",
  "fuel",
  "markets",
  "worship",
  "transit",
  "government",
] as const;

function facilities(counts: Partial<Record<(typeof CATEGORIES)[number], number>>) {
  const out: Record<string, Wave4Facility[]> = {};
  for (const key of CATEGORIES) {
    const n = counts[key] ?? 0;
    out[key] = Array.from({ length: n }, (_, i) => ({
      id: `node/${key}-${i}`,
      name: `${key} ${i}`,
      category: key,
      lat: -1.28,
      lng: 36.81,
      distanceKm: 0.4,
    }));
  }
  return out;
}

const GOOD_CLIMATE = {
  annualRainfallMm: 900,
  meanTempC: 19,
  tempMinC: 11,
  tempMaxC: 28,
};

const NO_CLIMATE = {
  annualRainfallMm: null,
  meanTempC: null,
  tempMinC: null,
  tempMaxC: null,
};

describe("wave4 confidence gating", () => {
  it("withholds every OSM-derived component when nothing is mapped", () => {
    const { breakdown } = score(facilities({}), NO_CLIMATE);
    expect(breakdown.accessibility.confidence).toBe("low");
    expect(breakdown.infrastructure.confidence).toBe("low");
    expect(breakdown.development.confidence).toBe("low");
    expect(breakdown.environment.confidence).toBe("low");
    expect(breakdown.investment.confidence).toBe("low");
  });

  it("keeps climate confidence independent of OpenStreetMap coverage", () => {
    const { breakdown } = score(facilities({}), GOOD_CLIMATE);
    expect(breakdown.environment.confidence).toBe("high");
  });

  it("withholds the investment composite when climate is supported but OSM is sparse", () => {
    const { breakdown } = score(facilities({}), GOOD_CLIMATE);
    expect(breakdown.environment.confidence).toBe("high");
    expect(breakdown.investment.confidence).toBe("low");
  });

  it("withholds the composite when one required OSM component has no coverage", () => {
    // Infrastructure is well covered; accessibility has literally nothing
    // mapped, so its score would be the bare formula constant. The composite
    // must not be published on top of an unevidenced component.
    const { breakdown, scores } = score(
      facilities({ schools: 10, hospitals: 4, banks: 3 }),
      GOOD_CLIMATE,
    );
    expect(breakdown.infrastructure.confidence).not.toBe("low");
    expect(breakdown.accessibility.confidence).toBe("low");
    expect(breakdown.development.confidence).toBe("low");
    expect(breakdown.investment.confidence).toBe("low");
    // The arithmetic itself is unchanged — accessibility is still the constant.
    expect(scores.accessibility).toBe(25);
  });

  it("withholds the composite when infrastructure has no coverage", () => {
    const { breakdown } = score(facilities({ transit: 12, markets: 4, fuel: 3 }), GOOD_CLIMATE);
    expect(breakdown.accessibility.confidence).not.toBe("low");
    expect(breakdown.infrastructure.confidence).toBe("low");
    expect(breakdown.investment.confidence).toBe("low");
  });

  it("publishes the composite when every required component is covered", () => {
    const { breakdown, scores } = score(
      facilities({
        transit: 14,
        fuel: 5,
        markets: 4,
        hospitals: 6,
        schools: 8,
        banks: 5,
        police: 2,
        fire: 1,
        government: 2,
        worship: 6,
      }),
      GOOD_CLIMATE,
    );
    expect(breakdown.accessibility.confidence).toBe("high");
    expect(breakdown.infrastructure.confidence).toBe("high");
    expect(breakdown.development.confidence).toBe("high");
    expect(breakdown.investment.confidence).toBe("high");
    expect(scores.investment).toBeGreaterThan(0);
  });

  it("never reports a confidence stronger than its weakest required input", () => {
    const { breakdown } = score(
      facilities({ transit: 7, fuel: 1, hospitals: 20, schools: 20, banks: 10 }),
      GOOD_CLIMATE,
    );
    expect(breakdown.accessibility.confidence).toBe("medium");
    expect(breakdown.infrastructure.confidence).toBe("high");
    expect(breakdown.investment.confidence).toBe("medium");
  });
});
