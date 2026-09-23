import { describe, expect, it } from "vitest";
import { ARCHITECTURAL_CATALOGUE, assessArchitecturalAsset, catalogueCoverage } from "@/lib/architectural-catalogue";

describe("architectural catalogue", () => {
  it("reserves five traceable slots for each of six typologies", () => {
    expect(ARCHITECTURAL_CATALOGUE).toHaveLength(30);
    const coverage = catalogueCoverage();
    expect(coverage).toHaveLength(6);
    expect(coverage.every((row) => row.total === 5)).toBe(true);
    expect(coverage.every((row) => row.admitted === 0)).toBe(true);
  });

  it("rejects oversized, unlicensed or dimensionless assets", () => {
    const result = assessArchitecturalAsset({
      bytes: 30_000_000,
      format: "fbx",
      license: null,
      triangleCount: 800_000,
      materialCount: 20,
      hasAuthoredDimensions: false,
    });
    expect(result.admitted).toBe(false);
    expect(result.errors).toHaveLength(4);
  });

  it("admits a small licensed GLB with authored dimensions", () => {
    const result = assessArchitecturalAsset({
      bytes: 5_500_000,
      format: "glb",
      license: "CC-BY-4.0",
      triangleCount: 150_000,
      materialCount: 8,
      hasAuthoredDimensions: true,
    });
    expect(result).toMatchObject({ admitted: true, performance: "light" });
  });
});
