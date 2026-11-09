import { describe, expect, it } from "vitest";

import {
  ease,
  tourLength,
  tourPose,
  type TourSite,
} from "@/components/halisia/model-lab/site/film-tour";

const flat: TourSite = {
  lengthM: 12.8,
  widthM: 9.3,
  heightM: 4.7,
  floorY: 0.15,
  doorX: 3.2,
  groundAt: () => 0,
};

describe("film tour", () => {
  it("eases in and out and stays within 0..1", () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5);
    expect(ease(-1)).toBe(0);
    expect(ease(2)).toBe(1);
  });

  it("runs 35 s for a masonry house and skips the inside shot for containers", () => {
    expect(tourLength(flat)).toBe(35);
    expect(tourLength({ ...flat, doorX: null })).toBe(28);
  });

  it("ends after the last shot", () => {
    expect(tourPose(flat, 34.9)).not.toBeNull();
    expect(tourPose(flat, 35.1)).toBeNull();
    expect(tourPose(flat, -1)).toBeNull();
  });

  it("never puts the camera under the ground outside the house", () => {
    const hill: TourSite = { ...flat, floorY: 2.4, groundAt: (x, z) => 2 + 0.08 * z - 0.03 * x };
    for (let t = 0; t < tourLength(hill); t += 0.25) {
      const p = tourPose(hill, t)!;
      const inside = Math.abs(p.pos.x) < hill.lengthM / 2 && Math.abs(p.pos.z) < hill.widthM / 2;
      if (!inside) expect(p.pos.y).toBeGreaterThan(hill.groundAt(p.pos.x, p.pos.z) + 1);
    }
  });

  it("stands inside the living room, at eye height, for the inside shot", () => {
    // Shot 4 starts at 21 s (6 + 9 + 6).
    const p = tourPose(flat, 24)!;
    expect(p.shot).toBe(3);
    expect(Math.abs(p.pos.z)).toBeLessThan(flat.widthM / 2);
    expect(p.pos.y - flat.floorY).toBeCloseTo(0.12 + 1.65, 5);
  });
});
