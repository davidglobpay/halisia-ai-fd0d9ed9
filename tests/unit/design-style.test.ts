import { describe, expect, it } from "vitest";

import {
  DEFAULT_STYLE,
  describeStyle,
  extractPalette,
  isScenery,
  sanitizeStyle,
  styleFromPalette,
} from "@/components/halisia/model-lab/site/design-style";

/** An image made of solid blocks: [r, g, b, pixelCount]. */
function image(blocks: Array<[number, number, number, number]>): Uint8ClampedArray {
  const total = blocks.reduce((s, b) => s + b[3], 0);
  const out = new Uint8ClampedArray(total * 4);
  let i = 0;
  for (const [r, g, b, n] of blocks)
    for (let k = 0; k < n; k++) {
      out[i++] = r;
      out[i++] = g;
      out[i++] = b;
      out[i++] = 255;
    }
  return out;
}

describe("design style sanitiser", () => {
  it("keeps valid values and maps roof synonyms", () => {
    const s = sanitizeStyle({
      roof: "Hipped",
      wall: "stone",
      windows: "large",
      interior: "modern",
      wallColor: "#ABC",
      roofColor: "#112233",
      trimColor: "nonsense",
      notes: ["Clay tile roof", 42, "  Stone   plinth "],
      source: "ai",
    });
    expect(s.roof).toBe("hip");
    expect(s.wall).toBe("stone");
    expect(s.windows).toBe("large");
    expect(s.interior).toBe("modern");
    expect(s.wallColor).toBe("#aabbcc");
    expect(s.roofColor).toBe("#112233");
    expect(s.trimColor).toBe(DEFAULT_STYLE.trimColor);
    expect(s.notes).toEqual(["Clay tile roof", "Stone plinth"]);
    expect(s.source).toBe("ai");
  });
  it("never throws on junk and falls back to the defaults", () => {
    for (const junk of [null, undefined, 3, "x", [], { roof: { a: 1 } }]) {
      const s = sanitizeStyle(junk);
      expect(s.roof).toBe(DEFAULT_STYLE.roof);
      expect(s.wall).toBe(DEFAULT_STYLE.wall);
    }
  });
  it("maps skillion and shed roofs to mono-pitch", () => {
    expect(sanitizeStyle({ roof: "skillion" }).roof).toBe("mono");
    expect(sanitizeStyle({ roof: "shed" }).roof).toBe("mono");
  });
  it("describes every choice in plain words", () => {
    const lines = describeStyle({ ...DEFAULT_STYLE, roof: "flat", wall: "brick" });
    expect(lines.join(" ")).toMatch(/Flat with parapet/);
    expect(lines.join(" ")).toMatch(/Brick/);
  });
});

describe("palette reader", () => {
  it("finds the main colours, largest first, deterministically", () => {
    const img = image([
      [235, 228, 210, 600], // cream walls
      [150, 60, 40, 250], // terracotta roof
      [40, 40, 42, 100], // dark frames
    ]);
    const a = extractPalette(img, 3);
    const b = extractPalette(img, 3);
    expect(a.map((c) => c.hex)).toEqual(b.map((c) => c.hex));
    expect(a[0].hex).toBe("#ebe4d2");
    expect(a[0].share).toBeCloseTo(600 / 950, 5);
  });
  it("treats sky and greenery as scenery", () => {
    expect(isScenery([120, 170, 230])).toBe(true);
    expect(isScenery([70, 130, 60])).toBe(true);
    expect(isScenery([235, 228, 210])).toBe(false);
  });
  it("builds a style from the building's colours, not the sky or lawn", () => {
    const img = image([
      [130, 180, 235, 900], // sky, the biggest area
      [80, 140, 60, 500], // lawn
      [235, 228, 210, 400], // walls
      [150, 60, 40, 200], // roof
      [35, 35, 38, 80], // frames
    ]);
    const s = styleFromPalette(extractPalette(img, 5));
    expect(s.source).toBe("colours");
    expect(s.wallColor).toBe("#ebe4d2");
    expect(s.roofColor).toBe("#963c28");
    expect(s.trimColor).toBe("#232326");
  });
  it("returns the base style for an empty image", () => {
    expect(styleFromPalette([]).wallColor).toBe(DEFAULT_STYLE.wallColor);
  });
});
