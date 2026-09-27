import { describe, expect, it } from "vitest";
import {
  STUDIO_CONCEPTS,
  STUDIO_DISCLAIMER,
  validSimulationDimension,
} from "@/components/halisia/design-studio/catalog";

describe("Design Studio catalog", () => {
  it("contains five distinct local concept assets", () => {
    expect(STUDIO_CONCEPTS).toHaveLength(5);
    expect(new Set(STUDIO_CONCEPTS.map((x) => x.modelUrl)).size).toBe(5);
    expect(STUDIO_CONCEPTS.every((x) => x.modelUrl.startsWith("/_massing/"))).toBe(true);
  });

  it("accepts only controlled simulation dimensions", () => {
    expect(validSimulationDimension(12)).toBe(true);
    expect(validSimulationDimension(500)).toBe(true);
    expect(validSimulationDimension(11.9)).toBe(false);
    expect(validSimulationDimension(Number.NaN)).toBe(false);
  });

  it("keeps the concept limitations explicit", () => {
    expect(STUDIO_DISCLAIMER).toMatch(/not a surveyed parcel/i);
    expect(STUDIO_DISCLAIMER).toMatch(/planning approval/i);
  });
});