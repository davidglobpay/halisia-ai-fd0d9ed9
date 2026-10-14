/**
 * P0-C — coverage gating, and the absence of any score behind it.
 *
 * The dossier and the passport withhold any group whose coverage is "low".
 * These tests pin the contract that decides that flag, in particular the audit
 * case where climate coverage is good while the OpenStreetMap-derived groups
 * have nothing mapped at all.
 *
 * The gating logic is unchanged. What changed underneath it is that there is
 * no longer a score to gate: the indicators out of 100 are gone, and the last
 * block here is what stops them coming back. The `confidence` field is kept
 * under its old name and now means how well mapped this area is — a fact about
 * the dataset, never a verdict on the place.
 */
import { describe, it, expect } from "vitest";
import { coverage, type Wave4Facility } from "@/lib/wave4-intel.functions";

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
    const { breakdown } = coverage(facilities({}), NO_CLIMATE);
    expect(breakdown.accessibility.confidence).toBe("low");
    expect(breakdown.infrastructure.confidence).toBe("low");
    expect(breakdown.development.confidence).toBe("low");
    expect(breakdown.environment.confidence).toBe("low");
    expect(breakdown.investment.confidence).toBe("low");
  });

  it("keeps climate confidence independent of OpenStreetMap coverage", () => {
    const { breakdown } = coverage(facilities({}), GOOD_CLIMATE);
    expect(breakdown.environment.confidence).toBe("high");
  });

  it("withholds the investment composite when climate is supported but OSM is sparse", () => {
    const { breakdown } = coverage(facilities({}), GOOD_CLIMATE);
    expect(breakdown.environment.confidence).toBe("high");
    expect(breakdown.investment.confidence).toBe("low");
  });

  it("withholds the composite when one required OSM component has no coverage", () => {
    // Services are well covered; transport and markets have literally nothing
    // mapped. Nothing may be published on top of a group with no coverage.
    const { breakdown } = coverage(
      facilities({ schools: 10, hospitals: 4, banks: 3 }),
      GOOD_CLIMATE,
    );
    expect(breakdown.infrastructure.confidence).not.toBe("low");
    expect(breakdown.accessibility.confidence).toBe("low");
    expect(breakdown.development.confidence).toBe("low");
    expect(breakdown.investment.confidence).toBe("low");
    // This used to assert `scores.accessibility === 25` — the bare formula
    // constant an unmapped area still scored. There is no constant now and no
    // score; the count is zero and says so.
    expect(breakdown.accessibility.factors.every((f) => f.value === 0)).toBe(true);
  });

  it("withholds the composite when infrastructure has no coverage", () => {
    const { breakdown } = coverage(facilities({ transit: 12, markets: 4, fuel: 3 }), GOOD_CLIMATE);
    expect(breakdown.accessibility.confidence).not.toBe("low");
    expect(breakdown.infrastructure.confidence).toBe("low");
    expect(breakdown.investment.confidence).toBe("low");
  });

  it("publishes the composite when every required component is covered", () => {
    const { breakdown, scores } = coverage(
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
    // Previously `scores.investment > 0`. Full coverage must now produce real
    // counts and still no score.
    expect(scores.investment).toBeNull();
    expect(breakdown.investment.factors.some((f) => f.value > 0)).toBe(true);
  });

  it("never reports a confidence stronger than its weakest required input", () => {
    const { breakdown } = coverage(
      facilities({ transit: 7, fuel: 1, hospitals: 20, schools: 20, banks: 10 }),
      GOOD_CLIMATE,
    );
    expect(breakdown.accessibility.confidence).toBe("medium");
    expect(breakdown.infrastructure.confidence).toBe("high");
    expect(breakdown.investment.confidence).toBe("medium");
  });
});

describe("no score survives anywhere in the wave 4 output", () => {
  const FULL = facilities({
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
  });

  it("returns null for every top-level score, even at full coverage", () => {
    const { scores } = coverage(FULL, GOOD_CLIMATE);
    for (const [key, value] of Object.entries(scores)) {
      expect(value, `scores.${key} must be null`).toBeNull();
    }
  });

  it("returns null for every group score", () => {
    const { breakdown } = coverage(FULL, GOOD_CLIMATE);
    for (const [key, ex] of Object.entries(breakdown)) {
      expect(ex.score, `breakdown.${key}.score must be null`).toBeNull();
    }
  });

  it("describes its method in words rather than arithmetic", () => {
    const { breakdown } = coverage(FULL, GOOD_CLIMATE);
    for (const [key, ex] of Object.entries(breakdown)) {
      expect(ex.method.length, `${key} must explain itself`).toBeGreaterThan(40);
      // The old formulas: "25 + transit·6 + fuel·4", "0.35·access + …".
      expect(ex.method, `${key} must not print arithmetic`).not.toMatch(/[·*]\s*\d|\d\s*[·*]/);
      for (const f of ex.factors) {
        expect(f.unit.length, `${key}/${f.label} needs a unit`).toBeGreaterThan(0);
        // `unit` replaced `weight`; a multiplier here would be the old field back.
        expect(f.unit, `${key}/${f.label} must not carry a weight`).not.toMatch(/^[×x]\s*[\d.]+$/);
      }
    }
  });

  it("admits the cap instead of reporting a capped count as a total", () => {
    // extractFacilities keeps the 12 nearest per category, so 12 means "12+".
    const { breakdown } = coverage(facilities({ transit: 12 }), GOOD_CLIMATE);
    const transit = breakdown.accessibility.factors.find((f) => f.label === "Transit stops")!;
    expect(transit.value).toBe(12);
    expect(transit.unit).toMatch(/or more/i);
  });

  it("does not invent a climate reading when the archive returned nothing", () => {
    // `environment` used to start at 55 and stay there when climate was absent.
    const { breakdown, scores } = coverage(FULL, NO_CLIMATE);
    expect(scores.environment).toBeNull();
    expect(breakdown.environment.confidence).toBe("low");
    for (const f of breakdown.environment.factors) {
      // Null, not zero. These were `climate.meanTempC ?? 0`, so a point the
      // archive knew nothing about published "0 °C" — a fabricated reading
      // wearing the same typography as a real one.
      expect(f.value, `${f.label} must be null, not zero`).toBeNull();
      expect(f.unit).toMatch(/not returned/);
    }
  });

  it("reports a real climate reading as itself", () => {
    const { breakdown } = coverage(FULL, GOOD_CLIMATE);
    const temp = breakdown.environment.factors.find((f) => f.label === "Mean temperature")!;
    const rain = breakdown.environment.factors.find((f) => f.label === "Annual rainfall")!;
    expect(temp.value).toBe(19);
    expect(rain.value).toBe(900);
    expect(temp.unit).toMatch(/2010–2020/);
  });

  it("never represents a missing reading as a zero anywhere in the output", () => {
    const { breakdown } = coverage(facilities({}), NO_CLIMATE);
    for (const [key, ex] of Object.entries(breakdown)) {
      for (const f of ex.factors) {
        // A count of zero is a fact: nothing of that kind is mapped. A climate
        // reading of zero is not — it is an absence wearing a number.
        if (/not returned/.test(f.unit)) {
          expect(f.value, `${key}/${f.label} absent reading must be null`).toBeNull();
        } else {
          expect(typeof f.value, `${key}/${f.label} count must be a number`).toBe("number");
        }
      }
    }
  });
});
