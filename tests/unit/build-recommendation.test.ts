import { describe, expect, it } from "vitest";
import {
  crossSamplePoints,
  recommendBuildSystem,
  slopeFromSamples,
  structureName,
  type SystemResult,
} from "@/lib/build-recommendation";

function sys(
  structure: string,
  total: number | null,
  totalHigh: number | null = total,
  extra: Partial<SystemResult> = {},
): SystemResult {
  return {
    structure,
    total,
    totalHigh,
    totalLines: 30,
    pricedShare: total == null ? 0.5 : 1,
    pricedLines: 30,
    localPricedLines: 30,
    ...extra,
  };
}

describe("picking a building system", () => {
  it("picks the lowest priced total and says when it is clearly cheaper", () => {
    const r = recommendBuildSystem(
      [
        sys("precast", 1_700_000),
        sys("masonry_stone", 1_300_000, 1_500_000),
        sys("eps", 1_600_000),
      ],
      { county: null, slopePct: null },
    );
    expect(r.pick?.structure).toBe("masonry_stone");
    expect(r.runnerUp?.structure).toBe("eps");
    expect(r.clearlyCheapest).toBe(true);
  });

  it("does not call a pick clearly cheaper when the price ranges overlap", () => {
    const r = recommendBuildSystem(
      [sys("masonry_stone", 1_300_000, 2_000_000), sys("eps", 1_500_000, 2_000_000)],
      { county: null, slopePct: null },
    );
    expect(r.pick?.structure).toBe("masonry_stone");
    expect(r.clearlyCheapest).toBe(false);
  });

  it("returns no pick when nothing has a total, and says why for each", () => {
    const r = recommendBuildSystem(
      [sys("eps", null, null, { totalLines: 0 }), sys("precast", null, null)],
      { county: "Kajiado", slopePct: null },
    );
    expect(r.pick).toBeNull();
    expect(r.unpriced).toEqual([
      { structure: "eps", reason: "no_boq" },
      { structure: "precast", reason: "under_gate" },
    ]);
  });

  it("adds the crane check for containers and precast, not for masonry", () => {
    const container = recommendBuildSystem([sys("container_40ft", 900_000)], {
      county: null,
      slopePct: null,
    });
    expect(container.checks.map((c) => c.id)).toContain("crane");
    const stone = recommendBuildSystem([sys("masonry_stone", 900_000)], {
      county: null,
      slopePct: null,
    });
    expect(stone.checks.map((c) => c.id)).not.toContain("crane");
  });

  it("asks for local quotes when most prices come from another county", () => {
    const r = recommendBuildSystem(
      [sys("masonry_block", 1_000_000, 1_000_000, { pricedLines: 30, localPricedLines: 2 })],
      { county: "Kajiado", slopePct: null },
    );
    expect(r.checks.find((c) => c.id === "local-prices")?.text).toContain("outside Kajiado");
  });

  it("always states what the totals leave out", () => {
    const r = recommendBuildSystem([], { county: null, slopePct: null });
    expect(r.checks.map((c) => c.id)).toEqual(["scope"]);
  });
});

describe("ground fall", () => {
  it("combines the north-south and east-west fall over the baseline", () => {
    expect(slopeFromSamples({ n: 1600, s: 1594, e: 1597, w: 1597 }, 100)).toBe(6);
    expect(slopeFromSamples({ n: 1600, s: 1600, e: 1600, w: 1600 }, 100)).toBe(0);
  });

  it("treats a missing (zero) sample as no reading, not a cliff", () => {
    expect(slopeFromSamples({ n: 1600, s: 0, e: 1597, w: 1597 }, 100)).toBeNull();
    expect(slopeFromSamples({ n: Number.NaN, s: 1, e: 1, w: 1 }, 100)).toBeNull();
    expect(slopeFromSamples({ n: 1, s: 1, e: 1, w: 1 }, 0)).toBeNull();
  });

  it("describes steep ground as needing earthworks outside the estimate", () => {
    const r = recommendBuildSystem([sys("masonry_stone", 1)], {
      county: null,
      slopePct: 18,
      slopeSource: "ASTER 30 m",
    });
    const text = r.checks.find((c) => c.id === "slope")?.text ?? "";
    expect(text).toContain("18%");
    expect(text).toContain("ASTER 30 m");
    expect(text).toContain("not a site survey");
    expect(text).toContain("cut-and-fill");
  });

  it("places sample points the requested distance away", () => {
    const [n, s, e, w] = crossSamplePoints(-1.5, 36.95, 50);
    const mPerDegLat = 111_320;
    expect(Math.round((n.lat - s.lat) * mPerDegLat)).toBe(100);
    const mPerDegLng = 111_320 * Math.cos((-1.5 * Math.PI) / 180);
    expect(Math.round((e.lng - w.lng) * mPerDegLng)).toBe(100);
  });
});

describe("system names", () => {
  it("uses the names people use", () => {
    expect(structureName("eps")).toBe("EPS (Styrofoam) panels");
    expect(structureName("masonry_block")).toBe("Hollow block");
    expect(structureName("unknown_kind")).toBe("unknown kind");
  });
});
