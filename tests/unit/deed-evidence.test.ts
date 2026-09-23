import { describe, expect, it } from "vitest";
import { assessDeedEvidence, extractKenyaCoordinates, parseRegisteredArea } from "@/lib/deed-evidence";
import type { DeedFields } from "@/lib/deed-extract.functions";

const fields = (overrides: Partial<DeedFields> = {}): DeedFields => ({
  titleNumber: "KONZA SOUTH/BLOCK 5/14726",
  lrNumber: null,
  parcelNumber: "14726",
  registry: "Kajiado",
  county: "Machakos",
  registeredArea: "2 acres",
  surveyNumber: null,
  leaseTerm: null,
  registrationDate: null,
  registeredOwner: null,
  locationHint: "Konza",
  confidence: 70,
  notes: null,
  fieldConfidence: {},
  validationSteps: [],
  ...overrides,
});

describe("deed evidence", () => {
  it("normalizes supported land-area units without inventing a shape", () => {
    expect(parseRegisteredArea("2 acres")).toBeCloseTo(8093.7128448);
    expect(parseRegisteredArea("0.5 ha")).toBe(5000);
    expect(parseRegisteredArea("2")).toBeNull();
  });

  it("extracts valid Kenya coordinates", () => {
    expect(extractKenyaCoordinates("Site -1.7568583, 37.1036167")).toEqual({
      lat: -1.7568583,
      lng: 37.1036167,
    });
    expect(extractKenyaCoordinates("Site 51.5, -0.1")).toBeNull();
  });

  it("never treats a locality or stated area as a parcel boundary", () => {
    const result = assessDeedEvidence(fields(), "Konza, Machakos");
    expect(result.precision).toBe("locality");
    expect(result.mayRenderBoundary).toBe(false);
    expect(result.mayRunSiteFit).toBe(false);
  });

  it("keeps coordinates separate from verified geometry", () => {
    const result = assessDeedEvidence(fields(), "-1.7568583, 37.1036167");
    expect(result.precision).toBe("exact-coordinate");
    expect(result.mayRenderBoundary).toBe(false);
  });
});
