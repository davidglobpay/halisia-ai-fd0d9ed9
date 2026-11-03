import { describe, expect, it } from "vitest";
import {
  PLOT_SHAPES,
  containerCount,
  containerLayout,
  edgeDistances,
  houseFootprint,
  imageryTiles,
  metresPerPixel,
  typologyName,
} from "@/lib/plot-placement";

describe("house footprints", () => {
  it("uses the cost templates' container counts", () => {
    expect(containerCount("bedsitter", "container_20ft")).toBe(1);
    expect(containerCount("1br", "container_20ft")).toBe(3);
    expect(containerCount("3br", "container_40ft")).toBe(4);
    expect(containerCount("6br", "container_20ft")).toBe(18);
  });

  it("lays containers side by side in rows of four", () => {
    const one = containerLayout(1, "container_20ft");
    expect(one.units).toEqual([{ x: 0, z: 0 }]);
    expect(one.lengthM).toBeCloseTo(6.058, 3);
    const five = containerLayout(5, "container_40ft");
    expect(five.units).toHaveLength(5);
    expect(five.widthM).toBeCloseTo(4 * 2.438, 3);
    expect(five.lengthM).toBeCloseTo(2 * 12.192 + 1.5, 3);
  });

  it("sizes slab houses from the template floor area", () => {
    const f = houseFootprint("3br", "masonry_block");
    expect(f.floorAreaM2).toBe(110);
    // inner 12.41 × 8.86 m plus 200 mm walls
    expect(f.lengthM).toBeCloseTo(12.81, 1);
    expect(f.widthM).toBeCloseTo(9.26, 1);
  });
});

describe("plot shapes", () => {
  it("draws 50×100 ft as 15.24 × 30.48 m and an acre as a square", () => {
    const fifty = PLOT_SHAPES.find((p) => p.key === "50x100")!;
    expect(fifty.widthM).toBeCloseTo(15.24, 2);
    expect(fifty.depthM).toBeCloseTo(30.48, 2);
    const acre = PLOT_SHAPES.find((p) => p.key === "acre")!;
    expect(acre.widthM).toBeCloseTo(acre.depthM, 6);
    expect(acre.widthM * acre.depthM).toBeCloseTo(4046.86, 0);
  });
});

describe("satellite imagery tiles", () => {
  it("gives about 0.3 m per pixel at zoom 19 near the equator", () => {
    expect(metresPerPixel(-1.5, 19)).toBeCloseTo(0.2985, 3);
  });

  it("returns a 5×5 block with the point inside the centre tile", () => {
    const t = imageryTiles(-1.502157, 36.955288, 19)!;
    expect(t.tiles).toHaveLength(25);
    expect(t.sizePx).toBe(1280);
    expect(t.pointPx.x).toBeGreaterThanOrEqual(512);
    expect(t.pointPx.x).toBeLessThan(768);
    expect(t.pointPx.y).toBeGreaterThanOrEqual(512);
    expect(t.pointPx.y).toBeLessThan(768);
    expect(t.tiles[0].src).toMatch(/World_Imagery\/MapServer\/tile\/19\/\d+\/\d+(\?token=[^&]+)?$/);
  });

  it("refuses impossible coordinates", () => {
    expect(imageryTiles(91, 0, 19)).toBeNull();
    expect(imageryTiles(Number.NaN, 0, 19)).toBeNull();
  });
});

describe("gaps to the plot edges", () => {
  const plot = { x: 0, z: 0, rotationDeg: 0 };
  const plotSize = { widthM: 15.24, depthM: 30.48 };

  it("measures each side for a centred house", () => {
    const d = edgeDistances(
      { x: 0, z: 0, rotationDeg: 0 },
      { lengthM: 10, widthM: 8 },
      plot,
      plotSize,
    );
    // house length runs along x (plot width 15.24): (15.24-10)/2 = 2.6
    expect(d.left).toBe(2.6);
    expect(d.right).toBe(2.6);
    expect(d.front).toBe(11.2);
    expect(d.back).toBe(11.2);
    expect(d.inside).toBe(true);
    expect(d.coveragePct).toBeCloseTo(17.2, 1);
  });

  it("goes negative when the house crosses an edge", () => {
    const d = edgeDistances(
      { x: 5, z: 0, rotationDeg: 0 },
      { lengthM: 10, widthM: 8 },
      plot,
      plotSize,
    );
    expect(d.right).toBeLessThan(0);
    expect(d.inside).toBe(false);
  });

  it("follows the house's rotation", () => {
    const d = edgeDistances(
      { x: 0, z: 0, rotationDeg: 90 },
      { lengthM: 10, widthM: 8 },
      plot,
      plotSize,
    );
    // rotated: 8 m across the 15.24 m width
    expect(d.left).toBe(3.6);
    expect(d.front).toBe(10.2);
  });

  it("measures in the plot's frame when the plot is rotated", () => {
    const d = edgeDistances(
      { x: 0, z: 0, rotationDeg: 30 },
      { lengthM: 10, widthM: 8 },
      { x: 0, z: 0, rotationDeg: 30 },
      plotSize,
    );
    expect(d.left).toBe(2.6);
    expect(d.front).toBe(11.2);
  });
});

describe("labels", () => {
  it("does not repeat a size already in the plot name", () => {
    expect(PLOT_SHAPES.map((p) => p.label)).toEqual([
      "50×100 ft",
      "1/8 acre (50×109 ft)",
      "1/4 acre (100×109 ft)",
      "1/2 acre (100×218 ft)",
      "1 acre (209×209 ft)",
    ]);
  });

  it("names house types the way people say them", () => {
    expect(typologyName("bedsitter")).toBe("Bedsitter");
    expect(typologyName("1br")).toBe("1 bedroom");
    expect(typologyName("3br")).toBe("3 bedrooms");
    expect(typologyName("odd")).toBe("odd");
  });
});
