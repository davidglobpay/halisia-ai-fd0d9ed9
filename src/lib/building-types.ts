/**
 * Larger building types for the plot planner: low- and high-rise residential
 * and commercial, and mixed-use. Pure numbers (no three.js), unit tested.
 *
 * Sizes are planning rules of thumb, not a design. The footprint fills the
 * plot inside assumed setbacks; the county's zoning sets the real building
 * lines, ground coverage, plot ratio and height limit, and an architect and
 * engineer size the floors, cores and lifts.
 */

export const BUILDING_TYPES = ["res_low", "res_high", "com_low", "com_high", "mixed"] as const;
export type BuildingType = (typeof BUILDING_TYPES)[number];

export type BuildingSpec = {
  label: string;
  /** One line on what it is. */
  blurb: string;
  floors: { min: number; max: number; default: number };
  /** Ground-floor and upper-floor heights, floor to floor, metres. */
  groundFloorM: number;
  upperFloorM: number;
  /** Setbacks assumed for the drawing, metres: front, sides, back. */
  setback: { front: number; side: number; back: number };
  /** Largest sensible floor plate (along the frontage × along the depth). */
  maxPlate: { lengthM: number; widthM: number };
  /** Depth of a wing round a courtyard (daylight reaches about this far). */
  wingM: number;
  /** What the floors hold, for the readout. */
  uses: { ground: "homes" | "shops" | "offices"; upper: "homes" | "offices" };
};

export const BUILDING_SPECS: Record<BuildingType, BuildingSpec> = {
  res_low: {
    label: "Residential low-rise (apartments)",
    blurb: "Walk-up apartment block",
    floors: { min: 2, max: 5, default: 4 },
    groundFloorM: 3.0,
    upperFloorM: 3.0,
    setback: { front: 6, side: 3, back: 3 },
    maxPlate: { lengthM: 36, widthM: 18 },
    wingM: 10,
    uses: { ground: "homes", upper: "homes" },
  },
  res_high: {
    label: "Residential high-rise (apartments)",
    blurb: "Apartment tower with lifts",
    floors: { min: 6, max: 30, default: 12 },
    groundFloorM: 3.6,
    upperFloorM: 3.0,
    setback: { front: 9, side: 4.5, back: 4.5 },
    maxPlate: { lengthM: 34, widthM: 22 },
    wingM: 10,
    uses: { ground: "homes", upper: "homes" },
  },
  com_low: {
    label: "Commercial low-rise (offices, shops)",
    blurb: "Shops below, offices above",
    floors: { min: 1, max: 5, default: 3 },
    groundFloorM: 4.5,
    upperFloorM: 3.6,
    setback: { front: 6, side: 3, back: 3 },
    maxPlate: { lengthM: 45, widthM: 25 },
    wingM: 12,
    uses: { ground: "shops", upper: "offices" },
  },
  com_high: {
    label: "Commercial high-rise (office tower)",
    blurb: "Office tower with lifts",
    floors: { min: 6, max: 40, default: 15 },
    groundFloorM: 5.0,
    upperFloorM: 3.8,
    setback: { front: 9, side: 4.5, back: 4.5 },
    maxPlate: { lengthM: 40, widthM: 28 },
    wingM: 12,
    uses: { ground: "shops", upper: "offices" },
  },
  mixed: {
    label: "Mixed-use (shops below, homes above)",
    blurb: "Shops on the street, apartments above",
    floors: { min: 3, max: 20, default: 6 },
    groundFloorM: 4.5,
    upperFloorM: 3.0,
    setback: { front: 6, side: 3, back: 3 },
    maxPlate: { lengthM: 40, widthM: 20 },
    wingM: 10,
    uses: { ground: "shops", upper: "homes" },
  },
};

export function isBuildingType(t: string): t is BuildingType {
  return (BUILDING_TYPES as readonly string[]).includes(t);
}

export type SiteFeatures = {
  elevator: boolean;
  fountain: boolean;
  courtyardOutdoor: boolean;
  courtyardIndoor: boolean;
  gardens: boolean;
};

export const NO_FEATURES: SiteFeatures = {
  elevator: false,
  fountain: false,
  courtyardOutdoor: false,
  courtyardIndoor: false,
  gardens: false,
};

export const FEATURE_LABEL: Record<keyof SiteFeatures, string> = {
  elevator: "Elevator (lift)",
  fountain: "Fountain",
  courtyardOutdoor: "Courtyard, open to the sky",
  courtyardIndoor: "Indoor courtyard (glass-roofed atrium)",
  gardens: "Manicured landscaped gardens",
};

/** Which features make sense for a type; a reason when one does not. */
export function featureAvailability(
  typology: string,
  floors: number,
): Record<keyof SiteFeatures, string | null> {
  const building = isBuildingType(typology);
  return {
    elevator: !building
      ? "For buildings of 3 floors or more. Houses here are single-storey."
      : floors < 3
        ? "Needs 3 floors or more."
        : null,
    fountain: null,
    courtyardOutdoor: null,
    courtyardIndoor: building ? null : "For the larger building types.",
    gardens: null,
  };
}

export type BuildingPlan = {
  type: BuildingType;
  floors: number;
  /** Footprint along the frontage (x) and along the depth (z), metres. */
  lengthM: number;
  widthM: number;
  heightM: number;
  /** Floor-to-floor heights, ground first. */
  floorHeightsM: number[];
  /** Courtyard (open or glazed) inside the footprint, when it fits. */
  court: { lengthM: number; widthM: number; roofed: boolean } | null;
  /** An atrium was asked for but does not fit: a glass lantern over a central hall instead. */
  lantern: boolean;
  /** An open courtyard was asked for but does not fit: it goes in the garden instead. */
  courtInGarden: boolean;
  /** Footprint area less any open courtyard, m². */
  footprintM2: number;
  /** Gross floor area, all floors, m². */
  gfaM2: number;
  coveragePct: number;
  plotRatio: number;
  /** Apartments of about 85 m² (net 80% of the residential floors). */
  homes: number;
  /** Lettable shop or office area, m² (net 80%). */
  lettableM2: number;
  lifts: number;
  /** Plain-language warnings: plot too small, height, no room for the court. */
  warnings: string[];
};

const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Size a building on a plot: fill the plot inside the setbacks, cap the floor
 * plate, stack the floors, and cut a courtyard if one was asked for and fits.
 */
export function planBuilding(
  type: BuildingType,
  floorsIn: number,
  plot: { widthM: number; depthM: number },
  features: Pick<SiteFeatures, "courtyardOutdoor" | "courtyardIndoor" | "elevator">,
): BuildingPlan {
  const spec = BUILDING_SPECS[type];
  const floors = Math.min(
    spec.floors.max,
    Math.max(spec.floors.min, Math.round(floorsIn) || spec.floors.default),
  );
  const warnings: string[] = [];
  const s = spec.setback;
  // A building wrapped round a courtyard needs a deeper plate than a single
  // block; use the larger plate only when the court then actually fits.
  const wantsCourt = features.courtyardOutdoor || features.courtyardIndoor;
  const fitL = plot.widthM - 2 * s.side;
  const fitW = plot.depthM - s.front - s.back;
  const minCourtPlate = 2 * spec.wingM + 10;
  const courtFits = wantsCourt && fitL >= 2 * spec.wingM + 6 && fitW >= 2 * spec.wingM + 6;
  const capL = courtFits ? Math.max(spec.maxPlate.lengthM, minCourtPlate) : spec.maxPlate.lengthM;
  const capW = courtFits ? Math.max(spec.maxPlate.widthM, minCourtPlate) : spec.maxPlate.widthM;
  let lengthM = Math.min(capL, fitL);
  let widthM = Math.min(capW, fitW);
  if (lengthM < 8 || widthM < 8) {
    warnings.push(
      `The plot is too small for this building inside the assumed setbacks (front ${s.front} m, sides ${s.side} m, back ${s.back} m). It is drawn at the smallest workable size, 8 × 8 m, and will cross the boundary lines. Choose a bigger plot.`,
    );
    lengthM = Math.max(8, lengthM);
    widthM = Math.max(8, widthM);
  }
  lengthM = r1(lengthM);
  widthM = r1(widthM);
  const floorHeightsM = Array.from({ length: floors }, (_, i) =>
    i === 0 ? spec.groundFloorM : spec.upperFloorM,
  );
  const heightM = r1(floorHeightsM.reduce((a, b) => a + b, 0) + 1.1); // + parapet
  // A courtyard needs a wing all round and at least 6 m of open court.
  let court: BuildingPlan["court"] = null;
  if (wantsCourt) {
    const cl = lengthM - 2 * spec.wingM;
    const cw = widthM - 2 * spec.wingM;
    if (cl >= 6 && cw >= 6)
      court = { lengthM: r1(cl), widthM: r1(cw), roofed: !features.courtyardOutdoor };
    else
      warnings.push(
        features.courtyardOutdoor
          ? `The footprint (${lengthM} × ${widthM} m) is too small to wrap the building round an open courtyard; the courtyard is set in the garden instead. About ${2 * spec.wingM + 6} m each way is needed.`
          : "The footprint is too small for an atrium with rooms all round; it is shown as a glass roof lantern over a central hall instead.",
      );
  }
  const plotM2 = plot.widthM * plot.depthM;
  const openCourt = court && !court.roofed ? court.lengthM * court.widthM : 0;
  const plateM2 = lengthM * widthM - (court ? court.lengthM * court.widthM : 0);
  const footprintM2 = Math.round(lengthM * widthM - openCourt);
  const gfaM2 = Math.round(plateM2 * floors);
  const homeFloors =
    spec.uses.upper === "homes" ? floors - (spec.uses.ground === "homes" ? 0 : 1) : 0;
  const shopFloors = floors - homeFloors;
  const homes = Math.floor((plateM2 * homeFloors * 0.8) / 85);
  const lettableM2 = Math.round(plateM2 * shopFloors * 0.8);
  // Rule of thumb only: offices about one lift per 2,500 m², homes about one per 60 flats, minimum 1, 2 above 8 floors.
  let lifts = 0;
  if (features.elevator && floors >= 3) {
    const byArea = Math.ceil(lettableM2 / 2500);
    const byHomes = Math.ceil(homes / 60);
    lifts = Math.max(floors > 8 ? 2 : 1, byArea + byHomes);
  }
  if (floors >= 5 && !features.elevator)
    warnings.push(
      `${floors} floors without a lift is hard to let and may not be approved; most counties expect lifts in buildings of this height. Tick "Elevator" to show the lift core.`,
    );
  return {
    type,
    floors,
    lengthM,
    widthM,
    heightM,
    floorHeightsM,
    court,
    lantern: features.courtyardIndoor && !court?.roofed,
    courtInGarden: features.courtyardOutdoor && !court,
    footprintM2,
    gfaM2,
    coveragePct: Math.round((footprintM2 / plotM2) * 1000) / 10,
    plotRatio: Math.round((gfaM2 / plotM2) * 100) / 100,
    homes,
    lettableM2,
    lifts,
    warnings,
  };
}

/**
 * Where the building sits by default: centred across the plot and set back the
 * assumed front distance from the road edge. Returned in the plot's own frame
 * (u across, v along the depth, front edge at v = −depth/2).
 */
export function defaultBuildingOffset(
  type: BuildingType,
  plan: Pick<BuildingPlan, "widthM">,
  plot: { depthM: number },
): { u: number; v: number } {
  const front = BUILDING_SPECS[type].setback.front;
  return { u: 0, v: -plot.depthM / 2 + front + plan.widthM / 2 };
}
