/**
 * Dossier sourcing contract.
 *
 * The location dossier used to publish ten module scores, seven of which had
 * no input: "Legal readiness" was 45 + banks × 3, "Safety" was
 * 50 + (hospitals + banks) × 3, and Community, Market and Future growth fell
 * back to a constant near 55 when nothing was known. Each declared a fixed
 * confidence of 45, 50 or 55 whether or not a single provider had answered,
 * and their source lists named Open-Topo-Data, SoilGrids, Open-Meteo,
 * OpenStreetMap, Ardhisasa, county planning offices, county CIDPs and
 * "HALISIA community reports (planned)" — none of which this engine reads.
 *
 * These tests pin the replacement contract: a module scores only when its
 * data arrived, confidence follows the providers, and no surface may cite a
 * dataset the engine does not call.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  runIntelligenceEngine,
  DOSSIER_SCOPE,
  type ModuleId,
} from "@/lib/intelligence-engine";
import type { LocationIntel } from "@/lib/location-intel.functions";
import type { Wave4Intel } from "@/lib/wave4-intel.functions";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

/** The only three services this engine calls. */
const ALLOWED_SOURCES = [
  "Google Maps Elevation API",
  "Google Air Quality API",
  "Google Places",
] as const;

/** Modules that no amount of provider health can make assessable. */
const NEVER_ASSESSABLE: ModuleId[] = [
  "legal",
  "investment",
  "market",
  "utilities",
  "safety",
  "community",
  "futureGrowth",
];

function places(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `place ${i}` })) as never;
}

function intel(opts: {
  elevation?: number | null;
  aqi?: number | null;
  counts?: number;
  providers?: Partial<LocationIntel["providers"]>;
}): LocationIntel {
  const n = opts.counts ?? 0;
  return {
    ok: true,
    coords: { lat: -1.28, lng: 36.81 },
    elevation: opts.elevation == null ? null : { meters: opts.elevation, resolution: 30 },
    airQuality:
      opts.aqi == null
        ? null
        : { universalAqi: opts.aqi, category: "Good", dominant: "pm25", color: "#0f0" },
    categories: {
      schools: places(n),
      hospitals: places(n),
      groceries: places(n),
      transit: places(n),
      restaurants: places(n),
      banks: places(n),
    },
    photos: [],
    hero: null,
    providers: {
      elevation: { status: opts.elevation == null ? "unavailable" : "ok" },
      airQuality: { status: opts.aqi == null ? "unavailable" : "ok" },
      places: { status: n > 0 ? "ok" : "unavailable" },
      routes: { status: "ok" },
      ...opts.providers,
    },
    snapshot: {} as never,
  } as unknown as LocationIntel;
}

const FULL = intel({ elevation: 1680, aqi: 62, counts: 3 });
const EMPTY = intel({ elevation: null, aqi: null, counts: 0 });

/**
 * A location whose three measurable modules land far apart: dense amenities,
 * poor air, low ground. Used where a test needs the persona weighting to be
 * visible — on a site where the modules happen to score alike, two personas
 * can legitimately agree.
 */
const SPREAD = intel({ elevation: 10, aqi: 20, counts: 8 });

const WAVE4 = {
  breakdown: {
    investment: {
      score: 71,
      confidence: "medium",
      note: "Composite view — not a valuation.",
    },
  },
  sources: [{ label: "OpenStreetMap", url: "https://www.openstreetmap.org", used: true }],
} as Wave4Intel;

describe("a module scores only when its data arrived", () => {
  it("measures terrain, environment and amenity access when every provider answers", () => {
    const d = runIntelligenceEngine(FULL, undefined, "investor");
    const measured = d.modules.filter((m) => m.status === "measured").map((m) => m.id);
    expect(measured.sort()).toEqual(["construction", "environment", "infrastructure"].sort());
    expect(d.measuredCount).toBe(3);
  });

  it("measures nothing when no provider answers", () => {
    const d = runIntelligenceEngine(EMPTY, undefined, "investor");
    expect(d.modules.every((m) => m.status === "not-assessed")).toBe(true);
    expect(d.reading).toBeNull();
    expect(d.grade).toBeNull();
    expect(d.confidencePct).toBeNull();
  });

  it("returns no decision at all when there is no intel object", () => {
    const d = runIntelligenceEngine(undefined, undefined, "investor");
    expect(d.reading).toBeNull();
    expect(d.measuredCount).toBe(0);
  });

  it("never scores a module HALISIA has no data source for", () => {
    for (const fixture of [FULL, EMPTY]) {
      const d = runIntelligenceEngine(fixture, undefined, "developer");
      for (const id of NEVER_ASSESSABLE) {
        const m = d.modules.find((x) => x.id === id)!;
        expect(m.status).toBe("not-assessed");
        expect(m.score).toBeNull();
        expect(m.grade).toBeNull();
        expect(m.confidencePct).toBeNull();
      }
    }
  });

  it("publishes a sourced development-context indicator when public-data coverage supports it", () => {
    const d = runIntelligenceEngine(FULL, undefined, "investor", WAVE4);
    const context = d.modules.find((module) => module.id === "investment");
    expect(context).toMatchObject({
      label: "Development context",
      status: "measured",
      score: 71,
      confidencePct: 60,
    });
    expect(context?.sources).toEqual(["OpenStreetMap"]);
    expect(context?.limitations.join(" ")).toContain("not a valuation");
  });

  it("withholds the context indicator when public-data coverage is low", () => {
    const low = {
      ...WAVE4,
      breakdown: {
        ...WAVE4.breakdown,
        investment: { ...WAVE4.breakdown.investment, confidence: "low" as const },
      },
    };
    const d = runIntelligenceEngine(FULL, undefined, "investor", low);
    expect(d.modules.find((module) => module.id === "investment")?.status).toBe("not-assessed");
  });

  it("drops a module to not-assessed when only its provider fails", () => {
    const noElevation = intel({ elevation: null, aqi: 62, counts: 3 });
    const d = runIntelligenceEngine(noElevation, undefined, "developer");
    expect(d.modules.find((m) => m.id === "construction")!.status).toBe("not-assessed");
    // Environment survives on air quality alone, at reduced confidence.
    const env = d.modules.find((m) => m.id === "environment")!;
    expect(env.status).toBe("measured");
    expect(env.confidencePct).toBeLessThan(100);
  });
});

describe("confidence follows the providers", () => {
  it("is full when every input for the module arrived cleanly", () => {
    const d = runIntelligenceEngine(FULL, undefined, "investor");
    expect(d.modules.find((m) => m.id === "construction")!.confidencePct).toBe(100);
    expect(d.modules.find((m) => m.id === "environment")!.confidencePct).toBe(100);
  });

  it("is reduced when a provider reports degraded", () => {
    const degraded = intel({
      elevation: 1680,
      aqi: 62,
      counts: 3,
      providers: { elevation: { status: "degraded" } },
    });
    const d = runIntelligenceEngine(degraded, undefined, "investor");
    expect(d.modules.find((m) => m.id === "construction")!.confidencePct).toBeLessThan(100);
  });

  it("never publishes a confidence without a score, or a score without one", () => {
    for (const fixture of [FULL, EMPTY]) {
      for (const m of runIntelligenceEngine(fixture, undefined, "farmer").modules) {
        expect(m.score == null).toBe(m.confidencePct == null);
      }
    }
  });
});

describe("no surface cites a dataset the engine does not read", () => {
  it("lists only the three services actually called", () => {
    const d = runIntelligenceEngine(FULL, undefined, "investor");
    for (const m of d.modules) {
      for (const s of m.sources) {
        expect(ALLOWED_SOURCES).toContain(s as (typeof ALLOWED_SOURCES)[number]);
      }
    }
  });

  it("gives an unassessed module no sources at all", () => {
    const d = runIntelligenceEngine(FULL, undefined, "investor");
    for (const m of d.modules.filter((x) => x.status === "not-assessed")) {
      expect(m.sources).toEqual([]);
      expect(m.missing.length).toBeGreaterThan(0);
      expect(m.nextStep.length).toBeGreaterThan(0);
    }
  });

  it("keeps the phantom datasets out of the engine and its renderers", () => {
    const phantoms = [
      "Open-Topo-Data",
      "SoilGrids",
      "Open-Meteo",
      "Ardhisasa (external)",
      "County planning office",
      "County CIDPs (external)",
      "County growth signals",
      "community reports (planned)",
      "OpenStreetMap POIs",
    ];
    const surfaces = [
      "src/lib/intelligence-engine.ts",
      "src/components/halisia/land-intelligence-score.tsx",
      "src/lib/pdf-intelligence.ts",
    ];
    for (const path of surfaces) {
      const src = read(path);
      for (const phantom of phantoms) {
        expect(`${path}: ${src.includes(phantom)}`).toBe(`${path}: false`);
      }
    }
  });
});

describe("the composite is named for its inputs and publishes no verdict", () => {
  it("names the modules it was built from", () => {
    const d = runIntelligenceEngine(FULL, undefined, "investor");
    expect(d.reading).not.toBeNull();
    expect(d.readingLabel.toLowerCase()).not.toContain("land intelligence");
    expect(d.scopeNote).toContain("3 of 10");
  });

  it("withholds a composite when fewer than two modules were measured", () => {
    // Air quality alone: environment can be read, construction and amenity
    // access cannot. Elevation alone would still give two, because the flood
    // proxy in environment is derived from height.
    const onlyAir = intel({ elevation: null, aqi: 55, counts: 0 });
    const d = runIntelligenceEngine(onlyAir, undefined, "investor");
    expect(d.measuredCount).toBe(1);
    expect(d.reading).toBeNull();
    expect(d.headline).toContain("One reading available");
  });

  it("carries no buy or do-not-buy verdict anywhere in the output", () => {
    const d = runIntelligenceEngine(FULL, undefined, "investor");
    const blob = JSON.stringify(d).toLowerCase();
    for (const verdict of [
      "highly recommended",
      "not recommended",
      "consider with caution",
      "recommendation",
    ]) {
      expect(`${verdict}: ${blob.includes(verdict)}`).toBe(`${verdict}: false`);
    }
  });

  it("offers a due-diligence item for every module it could not assess", () => {
    const d = runIntelligenceEngine(FULL, undefined, "home-buyer");
    expect(d.dueDiligence).toHaveLength(d.notAssessedCount);
    for (const item of d.dueDiligence) {
      expect(item.why.length).toBeGreaterThan(0);
      expect(item.who.length).toBeGreaterThan(0);
    }
  });

  it("states the scope of the whole dossier in one place", () => {
    expect(DOSSIER_SCOPE).toContain("Google Places");
    expect(DOSSIER_SCOPE).toContain("does not assert title");
    expect(DOSSIER_SCOPE).toContain("no recommendation");
  });
});

describe("persona weighting still differentiates", () => {
  it("weights the same measured modules differently per persona", () => {
    const farmer = runIntelligenceEngine(SPREAD, undefined, "farmer").reading!;
    const business = runIntelligenceEngine(SPREAD, undefined, "business").reading!;
    // On this site amenities are dense but the air is poor and the ground low.
    // Farmers weight environment far above amenity access; business the reverse,
    // so the business reading must come out materially higher.
    expect(business).toBeGreaterThan(farmer + 10);
  });

  it("renormalises over the measured modules rather than the full ten", () => {
    // Weights across all ten sum to 1, so without renormalisation a composite
    // built from three of them would be roughly a third of its true value.
    const d = runIntelligenceEngine(SPREAD, undefined, "business");
    const measured = d.modules.filter((m) => m.score != null);
    const lowest = Math.min(...measured.map((m) => m.score!));
    const highest = Math.max(...measured.map((m) => m.score!));
    expect(d.reading!).toBeGreaterThanOrEqual(lowest);
    expect(d.reading!).toBeLessThanOrEqual(highest);
  });
});
