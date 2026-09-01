import { describe, expect, it, vi } from "vitest";
import {
  absoluteModelUrl,
  canEnableBuildingFit,
  FIXTURE_MODELS,
  IMAGERY_CAPTION,
  KONZA_FIXTURE,
  KONZA_LR,
  looksLikeLandIdentifier,
  resolveFixtureIdentifier,
  sceneViewerHref,
} from "@/lib/testfixtures/konza-lr-fixture";
import { BASELINE_CHECKS } from "@/lib/testfixtures/fixture-log";

describe("Konza LR fixture integrity", () => {
  it("keeps searched title, coordinate and matched parcel structurally separate", () => {
    expect(KONZA_FIXTURE.searchedTitle).toBe(KONZA_LR);
    expect(KONZA_FIXTURE.matchedParcelRecord).toBeNull();
    expect(KONZA_FIXTURE.geometry).toBeNull();
    expect(KONZA_FIXTURE.boundaryEvidence).toBe("NONE");
    expect(KONZA_FIXTURE.modelFit).toBe("UNKNOWN");
    expect(KONZA_FIXTURE.physicalTestCoordinate).toEqual({
      lat: -1.7568583,
      lng: 37.1036167,
      source: "USER_SUPPLIED_PHYSICAL_TEST_POINT",
    });
  });

  it("never matches a parcel and never uses geocode or nearest-parcel fallback (D-29)", () => {
    const r = resolveFixtureIdentifier(KONZA_LR);
    expect(r.matchedParcelRecord).toBeNull();
    expect(r.geocodeUsed).toBe(false);
    expect(r.nearestParcelFallbackUsed).toBe(false);
    expect(r.geocodedPoint).toBeNull();
    expect(["NOT_IN_INDEX", "EXTERNAL_VERIFICATION_REQUIRED"]).toContain(r.resultState);
  });

  it("classifies the LR string as an identifier, not a coordinate", () => {
    expect(looksLikeLandIdentifier(KONZA_LR)).toBe(true);
    expect(looksLikeLandIdentifier("-1.7568583, 37.1036167")).toBe(false);
  });

  it("does not call the geocoder for an identifier query", async () => {
    const mod = await import("@/lib/geocode.functions");
    const spy = vi.spyOn(mod, "geocodeAddress" as never);
    resolveFixtureIdentifier(KONZA_LR);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("generates no polygon from the document-stated area", () => {
    const json = JSON.stringify(KONZA_FIXTURE);
    expect(json).not.toContain("coordinates");
    expect(json).not.toContain("Polygon");
    expect(KONZA_FIXTURE.documentStatedAreaHa).toBe(0.044);
  });

  it("uses no verification language for this fixture", () => {
    const text = [
      JSON.stringify(KONZA_FIXTURE),
      IMAGERY_CAPTION,
      ...BASELINE_CHECKS.map((c) => `${c.label} ${c.detail}`),
    ]
      .join(" ")
      .toLowerCase();
    for (const banned of [
      "verified title",
      "verified parcel",
      "title valid",
      "ownership verified",
      "survey verified",
    ]) {
      expect(text).not.toContain(banned);
    }
  });
});

describe("Konza fixture model cohort", () => {
  it("classifies sky models as environment controls only", () => {
    const sky = FIXTURE_MODELS.filter((m) => m.file.startsWith("SKY_"));
    expect(sky).toHaveLength(2);
    for (const m of sky) expect(m.role).toBe("environment-control");
    expect(FIXTURE_MODELS.filter((m) => m.role === "building-candidate")).toHaveLength(4);
  });

  it("never enables building fit, for any model", () => {
    for (const m of FIXTURE_MODELS) expect(canEnableBuildingFit(m)).toBe(false);
    expect(canEnableBuildingFit(null)).toBe(false);
  });

  it("publishes no USDZ, so Quick Look stays unavailable", () => {
    for (const m of FIXTURE_MODELS) expect(m.usdzUrl).toBeNull();
  });

  it("builds an absolute HTTPS Scene Viewer intent", () => {
    const abs = absoluteModelUrl(FIXTURE_MODELS[2]!.url, "https://example.lovable.app");
    expect(abs).toMatch(/^https:\/\/example\.lovable\.app\/__l5e\//);
    const href = sceneViewerHref(abs);
    expect(href).toContain("intent://arvr.google.com/scene-viewer/1.0?file=");
    expect(href).toContain(encodeURIComponent(abs!));
    expect(href).toContain("package=com.google.ar.core");
  });

  it("fails gracefully when a model asset is unavailable", () => {
    expect(absoluteModelUrl(null, "https://example.lovable.app")).toBeNull();
    expect(sceneViewerHref(null)).toBeNull();
  });
});
