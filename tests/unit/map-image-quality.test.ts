import { describe, expect, it } from "vitest";
import { hasMapDetail } from "@/lib/map-image-quality";
describe("map availability before overlays", () => {
  it("rejects empty, transparent and uniform placeholders", () => {
    expect(hasMapDetail(new Uint8ClampedArray())).toBe(false);
    expect(hasMapDetail(new Uint8ClampedArray(400))).toBe(false);
    expect(
      hasMapDetail(
        new Uint8ClampedArray(Array.from({ length: 100 }, () => [220, 220, 220, 255]).flat()),
      ),
    ).toBe(false);
  });
  it("accepts opaque varying map detail", () => {
    expect(
      hasMapDetail(
        new Uint8ClampedArray(
          Array.from({ length: 100 }, (_, i) => [i * 2, i * 2, i * 2, 255]).flat(),
        ),
      ),
    ).toBe(true);
  });
});
