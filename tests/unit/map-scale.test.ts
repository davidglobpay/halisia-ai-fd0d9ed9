import { describe, expect, it } from "vitest";
import {
  metresPerPixel,
  niceScaleBar,
  formatGroundDistance,
  printScaleRatio,
  zoomForGroundResolution,
  zoomToFitBBox,
  EQUATORIAL_CIRCUMFERENCE_M,
} from "@/lib/map-scale";

describe("metres per pixel matches the published Web Mercator table", () => {
  it.each([
    [0, 156543.033928],
    [1, 78271.516964],
    [10, 152.874],
    [19, 0.29858],
  ])("zoom %s on the equator is %s m/px", (zoom, want) => {
    expect(metresPerPixel(0, zoom as number)!).toBeCloseTo(want as number, 2);
  });

  it("shrinks by the cosine of latitude", () => {
    expect(metresPerPixel(60, 0)!).toBeCloseTo(156543.033928 / 2, 1);
    expect(metresPerPixel(-1.286, 19)!).toBeCloseTo(metresPerPixel(1.286, 19)!, 9);
  });

  it("spans the equator in one tile row at zoom 0", () => {
    expect(metresPerPixel(0, 0)! * 256).toBeCloseTo(EQUATORIAL_CIRCUMFERENCE_M, 0);
  });

  it.each([
    [91, 0],
    [0, -1],
    [0, 25],
    [NaN, 5],
  ])("rejects lat %s zoom %s", (lat, zoom) => {
    expect(metresPerPixel(lat as number, zoom as number)).toBeNull();
  });
});

describe("a scale bar always carries a round ground length", () => {
  const m19 = metresPerPixel(-1.286389, 19)!;

  it.each([60, 100, 150, 200, 300])("at a %s px target", (targetPx) => {
    const bar = niceScaleBar(targetPx, m19)!;
    const mantissa = bar.lengthM / 10 ** Math.floor(Math.log10(bar.lengthM));
    expect([1, 2, 5]).toContainEqual(Math.round(mantissa));
    // Never longer than asked for: a bar that overflows its frame misleads.
    expect(bar.lengthPx).toBeLessThanOrEqual(targetPx * 1.001);
  });

  it("labels a wide view in kilometres", () => {
    expect(niceScaleBar(200, metresPerPixel(0, 10)!)!.label).toContain("km");
  });

  it("refuses a zero target or a zero scale", () => {
    expect(niceScaleBar(0, m19)).toBeNull();
    expect(niceScaleBar(100, 0)).toBeNull();
  });
});

describe("ground distance labels", () => {
  it.each([
    [200, "200 m"],
    [1000, "1 km"],
    [1500, "1.5 km"],
    [50, "50 m"],
  ])("%s m reads as %s", (m, want) => expect(formatGroundDistance(m as number)).toBe(want));
});

describe("print scale", () => {
  it("gives about 1:2,500 for 454 m across 515 pt", () => {
    expect(printScaleRatio(454, 515)).toMatch(/^1:2,[45]/);
  });

  it("refuses nonsense", () => {
    expect(printScaleRatio(0, 515)).toBeNull();
    expect(printScaleRatio(100, 0)).toBeNull();
  });
});

describe("choosing a zoom", () => {
  it("finds the zoom that resolves a given ground detail", () => {
    expect(zoomForGroundResolution(-1.286389, 0.6)).toBe(18);
  });

  it("refuses detail finer than the service publishes rather than faking it", () => {
    expect(zoomForGroundResolution(-1.286389, 0.01, 19)).toBeNull();
  });

  it("frames a plot closer than a county", () => {
    const plot = zoomToFitBBox(
      { west: 36.8, south: -1.3, east: 36.801, north: -1.299 },
      { width: 512, height: 320 },
    )!;
    const county = zoomToFitBBox(
      { west: 36.5, south: -1.6, east: 37.2, north: -1.0 },
      { width: 512, height: 320 },
    )!;
    expect(plot).toBeGreaterThan(county);
  });

  it("refuses a degenerate bounding box", () => {
    expect(
      zoomToFitBBox({ west: 1, south: 1, east: 1, north: 1 }, { width: 512, height: 320 }),
    ).toBeNull();
  });
});
