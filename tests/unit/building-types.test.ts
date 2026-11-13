import { describe, expect, it } from "vitest";

import {
  BUILDING_SPECS,
  BUILDING_TYPES,
  defaultBuildingOffset,
  featureAvailability,
  isBuildingType,
  planBuilding,
} from "@/lib/building-types";
import { layoutFeatures, toLocal, toWorld, yards } from "@/lib/site-layout";

const FT = 0.3048;
const plot50x100 = { widthM: 50 * FT, depthM: 100 * FT };
const halfAcre = { widthM: 100 * FT, depthM: 217.8 * FT };
const acre = { widthM: 208.7 * FT, depthM: 208.7 * FT };
const none = { courtyardOutdoor: false, courtyardIndoor: false, elevator: false };

describe("building types", () => {
  it("knows its five types and not the house types", () => {
    expect(BUILDING_TYPES).toHaveLength(5);
    expect(isBuildingType("res_high")).toBe(true);
    expect(isBuildingType("3br")).toBe(false);
  });

  it("fills the plot inside the setbacks, capped at the floor plate", () => {
    const p = planBuilding("res_low", 4, plot50x100, none);
    // 15.24 − 2 × 3 = 9.2 m across; 30.48 − 6 − 3 = 21.5 → capped at 18 m deep.
    expect(p.lengthM).toBeCloseTo(9.2, 1);
    expect(p.widthM).toBe(18);
    expect(p.floors).toBe(4);
    expect(p.gfaM2).toBe(Math.round(p.lengthM * p.widthM * 4));
    expect(p.heightM).toBeCloseTo(4 * 3 + 1.1, 5);
  });

  it("clamps floors to the type's range", () => {
    expect(planBuilding("res_low", 40, halfAcre, none).floors).toBe(5);
    expect(planBuilding("com_high", 1, halfAcre, none).floors).toBe(6);
  });

  it("warns when the plot is too small", () => {
    const p = planBuilding("com_high", 15, plot50x100, none);
    expect(p.warnings.join(" ")).toMatch(/too small/);
    expect(p.lengthM).toBe(8);
  });

  it("puts shops on the ground floor of mixed-use and homes above", () => {
    const p = planBuilding("mixed", 6, halfAcre, none);
    expect(p.floorHeightsM[0]).toBe(BUILDING_SPECS.mixed.groundFloorM);
    expect(p.homes).toBeGreaterThan(0);
    expect(p.lettableM2).toBe(Math.round(p.lengthM * p.widthM * 0.8));
  });

  it("sizes lifts only when asked, two above eight floors", () => {
    expect(planBuilding("res_high", 12, halfAcre, none).lifts).toBe(0);
    expect(
      planBuilding("res_high", 12, halfAcre, { ...none, elevator: true }).lifts,
    ).toBeGreaterThanOrEqual(2);
    expect(planBuilding("res_low", 4, halfAcre, { ...none, elevator: true }).lifts).toBe(1);
    expect(planBuilding("res_high", 12, halfAcre, none).warnings.join(" ")).toMatch(/lift/);
  });

  it("cuts a courtyard when it fits, and says where it went when it does not", () => {
    const big = planBuilding("com_low", 3, acre, { ...none, courtyardOutdoor: true });
    expect(big.court).not.toBeNull();
    expect(big.court!.roofed).toBe(false);
    expect(big.footprintM2).toBe(
      Math.round(big.lengthM * big.widthM - big.court!.lengthM * big.court!.widthM),
    );
    const small = planBuilding("res_low", 4, plot50x100, { ...none, courtyardOutdoor: true });
    expect(small.court).toBeNull();
    expect(small.courtInGarden).toBe(true);
    const atrium = planBuilding("res_low", 4, plot50x100, { ...none, courtyardIndoor: true });
    expect(atrium.lantern).toBe(true);
  });

  it("explains which features a house cannot have", () => {
    const a = featureAvailability("3br", 1);
    expect(a.elevator).toMatch(/3 floors/);
    expect(a.courtyardIndoor).toBeTruthy();
    expect(a.gardens).toBeNull();
    expect(featureAvailability("res_low", 2).elevator).toMatch(/3 floors/);
    expect(featureAvailability("res_high", 12).elevator).toBeNull();
  });

  it("sets the building back the front setback from the road", () => {
    const p = planBuilding("res_low", 4, halfAcre, none);
    const off = defaultBuildingOffset("res_low", p, halfAcre);
    expect(off.v - p.widthM / 2 + halfAcre.depthM / 2).toBeCloseTo(6, 5);
  });
});

describe("garden layout", () => {
  const plot = halfAcre;
  const pp = { x: 0, z: 0, rotationDeg: 30 };

  it("converts between the plot frame and the world", () => {
    const w = toWorld(pp, 3, -7);
    const l = toLocal(pp, w.x, w.z);
    expect(l.u).toBeCloseTo(3, 6);
    expect(l.v).toBeCloseTo(-7, 6);
  });

  it("measures the front and back yards", () => {
    const fp = { lengthM: 20, widthM: 18 };
    const centre = toWorld(pp, 0, -plot.depthM / 2 + 6 + 9);
    const y = yards({
      plot,
      plotPlacement: pp,
      house: { ...centre, rotationDeg: 30 },
      footprint: fp,
    });
    expect(y.front).toBeCloseTo(6, 5);
    expect(y.back).toBeCloseTo(plot.depthM - 6 - 18, 5);
  });

  it("places a fountain only where the front yard is deep enough", () => {
    const fp = { lengthM: 20, widthM: 18 };
    const at = (front: number) => {
      const c = toWorld(pp, 0, -plot.depthM / 2 + front + 9);
      return { plot, plotPlacement: pp, house: { ...c, rotationDeg: 30 }, footprint: fp };
    };
    const roomy = layoutFeatures(at(9), { fountain: true, gardens: true }, true);
    expect(roomy.fountain).not.toBeNull();
    expect(roomy.court).not.toBeNull();
    expect(roomy.notes.join(" ")).toMatch(/Fountain: about/);
    const tight = layoutFeatures(at(3), { fountain: true, gardens: false }, false);
    expect(tight.fountain).toBeNull();
    expect(tight.notes[0]).toMatch(/not placed/);
  });
});
