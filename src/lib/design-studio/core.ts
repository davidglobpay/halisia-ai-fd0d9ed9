/**
 * HALISIA Generative Development / Design Studio — deterministic core.
 *
 * Pure functions only: no React, no three.js, no network. Every number this
 * module returns carries a provenance label and an explicit formula string so
 * the UI can never present an assumption as evidence.
 *
 * HARD RULES encoded here:
 *  - A document-stated area is NEVER converted into a polygon or boundary.
 *  - Simulation geometry is always PROPOSED_TEST_GEOMETRY and can never be
 *    promoted to cadastral/title evidence.
 *  - Planning inputs default to UNKNOWN and only become PROPOSED when a user
 *    explicitly types them in.
 */

export type Provenance = "VERIFIED" | "MEASURED" | "ESTIMATED" | "PROPOSED" | "UNKNOWN";

export type GeometryProvenance = "PROPOSED_TEST_GEOMETRY" | "NONE";

export type Valued<T> = {
  value: T | null;
  provenance: Provenance;
  /** Formula or source note shown next to the number. */
  basis: string;
};

export function valued<T>(value: T | null, provenance: Provenance, basis: string): Valued<T> {
  return { value: value === null || value === undefined ? null : value, provenance, basis };
}

export function unknown<T>(basis = "Not supplied."): Valued<T> {
  return { value: null, provenance: "UNKNOWN", basis };
}

/* ------------------------------------------------------------------ */
/* Land evidence                                                       */
/* ------------------------------------------------------------------ */

export const SQM_PER_HA = 10_000;

/** Hectares -> square metres. Display-only; never a geometry factory. */
export function haToSqm(ha: number): number {
  return round(ha * SQM_PER_HA, 3);
}

/**
 * Document-stated area is a *number on a document*, not a shape. This helper
 * exists so callers have no reason to reach for a polygon builder.
 */
export function documentStatedArea(ha: number): Valued<number> {
  return valued(
    haToSqm(ha),
    "UNKNOWN",
    `Document-stated ${ha} ha × ${SQM_PER_HA} = ${haToSqm(ha)} m². Area only — no boundary, shape or dimensions are implied.`,
  );
}

/* ------------------------------------------------------------------ */
/* Simulation boundary                                                 */
/* ------------------------------------------------------------------ */

export type SimulationBoundary = {
  widthM: number;
  depthM: number;
  /** Degrees clockwise from north for the long/front edge. */
  orientationDeg: number;
  provenance: GeometryProvenance;
};

export function makeSimulationBoundary(
  widthM: number,
  depthM: number,
  orientationDeg = 0,
): SimulationBoundary | null {
  if (!isPositive(widthM) || !isPositive(depthM)) return null;
  return {
    widthM: round(widthM, 3),
    depthM: round(depthM, 3),
    orientationDeg: ((orientationDeg % 360) + 360) % 360,
    provenance: "PROPOSED_TEST_GEOMETRY",
  };
}

export function simulationArea(b: SimulationBoundary | null): Valued<number> {
  if (!b) return unknown("No simulation boundary entered.");
  return valued(
    round(b.widthM * b.depthM, 2),
    "PROPOSED",
    `${b.widthM} m × ${b.depthM} m = ${round(b.widthM * b.depthM, 2)} m² (PROPOSED_TEST_GEOMETRY — not a title boundary).`,
  );
}

export type AreaDelta = {
  simulationSqm: number;
  documentSqm: number;
  deltaSqm: number;
  deltaPct: number;
  note: string;
};

/** Compares test geometry against a document-stated area. Never a legal fit. */
export function areaDelta(simSqm: number | null, docSqm: number | null): AreaDelta | null {
  if (simSqm === null || docSqm === null || !isPositive(docSqm)) return null;
  const deltaSqm = round(simSqm - docSqm, 2);
  return {
    simulationSqm: round(simSqm, 2),
    documentSqm: round(docSqm, 2),
    deltaSqm,
    deltaPct: round((deltaSqm / docSqm) * 100, 2),
    note: "Numeric comparison only. This does not confirm the test geometry matches the titled parcel.",
  };
}

/* ------------------------------------------------------------------ */
/* Constraints                                                         */
/* ------------------------------------------------------------------ */

export type IntendedUse = "residential" | "mixed" | "commercial";

export type Constraints = {
  frontSetbackM: number | null;
  rearSetbackM: number | null;
  sideSetbackM: number | null;
  maxFloors: number | null;
  maxCoveragePct: number | null;
  parkingPerUnit: number | null;
  intendedUse: IntendedUse;
  budgetKes: number | null;
  roadEdge: "north" | "south" | "east" | "west";
};

export const EMPTY_CONSTRAINTS: Constraints = {
  frontSetbackM: null,
  rearSetbackM: null,
  sideSetbackM: null,
  maxFloors: null,
  maxCoveragePct: null,
  parkingPerUnit: null,
  intendedUse: "residential",
  budgetKes: null,
  roadEdge: "north",
};

/** Any user-entered planning number is PROPOSED; absent stays UNKNOWN. */
export function constraintProvenance(v: number | null): Provenance {
  return v === null ? "UNKNOWN" : "PROPOSED";
}

/* ------------------------------------------------------------------ */
/* Buildable envelope                                                  */
/* ------------------------------------------------------------------ */

export type Envelope = {
  /** Buildable rectangle after setbacks. */
  widthM: Valued<number>;
  depthM: Valued<number>;
  buildableAreaSqm: Valued<number>;
  siteAreaSqm: Valued<number>;
  maxFootprintSqm: Valued<number>;
  maxGfaSqm: Valued<number>;
  openSpaceSqm: Valued<number>;
  parkingCapacity: Valued<number>;
  warnings: string[];
};

/** Square metres of site per surface parking bay incl. circulation. */
export const PARKING_BAY_SQM = 25;

export function computeEnvelope(b: SimulationBoundary | null, c: Constraints): Envelope {
  const warnings: string[] = [];
  const site = simulationArea(b);

  if (!b) {
    return {
      widthM: unknown("Requires a simulation boundary."),
      depthM: unknown("Requires a simulation boundary."),
      buildableAreaSqm: unknown("Requires a simulation boundary."),
      siteAreaSqm: site,
      maxFootprintSqm: unknown("Requires a simulation boundary."),
      maxGfaSqm: unknown("Requires a simulation boundary and max floors."),
      openSpaceSqm: unknown("Requires a simulation boundary."),
      parkingCapacity: unknown("Requires a simulation boundary."),
      warnings: ["No simulation boundary entered — no envelope can be calculated."],
    };
  }

  const front = c.frontSetbackM ?? 0;
  const rear = c.rearSetbackM ?? 0;
  const side = c.sideSetbackM ?? 0;
  if (c.frontSetbackM === null || c.rearSetbackM === null || c.sideSetbackM === null)
    warnings.push("One or more setbacks are UNKNOWN and were treated as 0 m for this simulation.");

  const rawW = b.widthM - side * 2;
  const rawD = b.depthM - front - rear;
  const w = Math.max(0, round(rawW, 3));
  const d = Math.max(0, round(rawD, 3));
  if (rawW <= 0 || rawD <= 0)
    warnings.push("Setbacks consume the whole simulation boundary — nothing is buildable.");

  const buildable = round(w * d, 2);
  const siteSqm = site.value ?? 0;

  const coverage = c.maxCoveragePct;
  const coverageCap = coverage === null ? null : round((siteSqm * coverage) / 100, 2);
  if (coverage === null)
    warnings.push("Max site coverage is UNKNOWN — footprint is limited by the setback area only.");
  const maxFootprint = coverageCap === null ? buildable : Math.min(buildable, coverageCap);

  const floors = c.maxFloors;
  if (floors === null) warnings.push("Max floors is UNKNOWN — gross floor area cannot be derived.");

  const open = round(Math.max(0, siteSqm - maxFootprint), 2);

  return {
    widthM: valued(
      w,
      "PROPOSED",
      `${b.widthM} − 2 × ${side} m side setback = ${w} m (setbacks are PROPOSED assumptions).`,
    ),
    depthM: valued(d, "PROPOSED", `${b.depthM} − ${front} m front − ${rear} m rear = ${d} m.`),
    buildableAreaSqm: valued(buildable, "PROPOSED", `${w} m × ${d} m = ${buildable} m².`),
    siteAreaSqm: site,
    maxFootprintSqm: valued(
      round(maxFootprint, 2),
      "PROPOSED",
      coverageCap === null
        ? `Setback area ${buildable} m² (no coverage limit supplied).`
        : `min(setback area ${buildable} m², ${coverage}% of ${siteSqm} m² = ${coverageCap} m²).`,
    ),
    maxGfaSqm:
      floors === null
        ? unknown("Max floors is UNKNOWN.")
        : valued(
            round(maxFootprint * floors, 2),
            "PROPOSED",
            `${round(maxFootprint, 2)} m² footprint × ${floors} floors = ${round(maxFootprint * floors, 2)} m².`,
          ),
    openSpaceSqm: valued(
      open,
      "PROPOSED",
      `Site ${siteSqm} m² − footprint ${round(maxFootprint, 2)} m² = ${open} m².`,
    ),
    parkingCapacity: valued(
      Math.floor(open / PARKING_BAY_SQM),
      "ESTIMATED",
      `Open space ${open} m² ÷ ${PARKING_BAY_SQM} m² per surface bay (incl. circulation) = ${Math.floor(open / PARKING_BAY_SQM)} bays.`,
    ),
    warnings,
  };
}

/* ------------------------------------------------------------------ */
/* Development options                                                 */
/* ------------------------------------------------------------------ */

export type OptionId = "A" | "B" | "C";

export type DevelopmentOption = {
  id: OptionId;
  name: string;
  useType: string;
  buildingCount: number;
  floors: number;
  footprintSqm: number;
  gfaSqm: number;
  unitCount: number;
  avgUnitSqm: number;
  parkingSpaces: number;
  openSpaceSqm: number;
  coveragePct: number;
  orientation: string;
  constructionAreaSqm: number;
  warnings: string[];
  provenance: "PROPOSED";
  source: "deterministic" | "ai-validated";
};

const OPTION_SPECS: Array<{
  id: OptionId;
  name: string;
  useType: string;
  buildings: number;
  floorShare: number;
  footprintShare: number;
  avgUnitSqm: number;
}> = [
  {
    id: "A",
    name: "Option A — Low-density residential",
    useType: "Residential (low density)",
    buildings: 2,
    floorShare: 0.4,
    footprintShare: 0.55,
    avgUnitSqm: 110,
  },
  {
    id: "B",
    name: "Option B — Higher-density residential",
    useType: "Residential (higher density)",
    buildings: 1,
    floorShare: 1,
    footprintShare: 0.9,
    avgUnitSqm: 55,
  },
  {
    id: "C",
    name: "Option C — Mixed use / investment",
    useType: "Ground-floor commercial + residential above",
    buildings: 1,
    floorShare: 0.75,
    footprintShare: 0.75,
    avgUnitSqm: 70,
  },
];

/** Efficiency factor from gross floor area to sellable/lettable area. */
export const NET_EFFICIENCY = 0.8;

export function generateOptions(env: Envelope, c: Constraints): DevelopmentOption[] {
  const maxFootprint = env.maxFootprintSqm.value;
  const site = env.siteAreaSqm.value;
  if (!maxFootprint || !site || maxFootprint <= 0) return [];

  const declaredFloors = c.maxFloors;
  const floorsCap = declaredFloors ?? 1;

  return OPTION_SPECS.map((s) => {
    const warnings: string[] = [];
    if (declaredFloors === null)
      warnings.push("Max floors UNKNOWN — assumed 1 storey. Confirm with the county.");
    const floors = clampInt(Math.round(floorsCap * s.floorShare), 1, floorsCap);
    const footprint = round(maxFootprint * s.footprintShare, 2);
    const gfa = round(footprint * floors, 2);
    const netArea = gfa * NET_EFFICIENCY;
    const units = Math.max(1, Math.floor(netArea / s.avgUnitSqm));
    const parkingNeeded = c.parkingPerUnit === null ? 0 : Math.ceil(units * c.parkingPerUnit);
    const open = round(Math.max(0, site - footprint), 2);
    const parkingPossible = Math.floor(open / PARKING_BAY_SQM);
    const parking =
      c.parkingPerUnit === null ? parkingPossible : Math.min(parkingNeeded, parkingPossible);
    if (c.parkingPerUnit === null)
      warnings.push(
        "Parking requirement UNKNOWN — showing what the open space could physically hold.",
      );
    else if (parkingNeeded > parkingPossible)
      warnings.push(
        `Parking conflict: ${parkingNeeded} bays required, only ~${parkingPossible} fit on grade.`,
      );
    if (c.maxCoveragePct !== null && (footprint / site) * 100 > c.maxCoveragePct + 0.01)
      warnings.push("Footprint exceeds the stated coverage limit.");
    if (c.intendedUse === "commercial" && s.id === "A")
      warnings.push(
        "Intended use is commercial — this low-density residential option is off-brief.",
      );

    return {
      id: s.id,
      name: s.name,
      useType: s.useType,
      buildingCount: s.buildings,
      floors,
      footprintSqm: footprint,
      gfaSqm: gfa,
      unitCount: units,
      avgUnitSqm: s.avgUnitSqm,
      parkingSpaces: parking,
      openSpaceSqm: open,
      coveragePct: round((footprint / site) * 100, 2),
      orientation: `Frontage to the ${c.roadEdge}`,
      constructionAreaSqm: gfa,
      warnings,
      provenance: "PROPOSED" as const,
      source: "deterministic" as const,
    };
  });
}

/* ------------------------------------------------------------------ */
/* AI proposal validation                                              */
/* ------------------------------------------------------------------ */

export type AiOptionPatch = {
  id?: string;
  name?: string;
  useType?: string;
  floors?: number;
  footprintSqm?: number;
  unitCount?: number;
  rationale?: string;
};

export type ValidatedAi = {
  options: DevelopmentOption[];
  warnings: string[];
};

/**
 * AI may only *re-describe and re-shuffle within* the deterministic envelope.
 * It can never raise a value above the calculated maximum, never touch
 * provenance, and never introduce geometry.
 */
export function applyAiPatches(
  base: DevelopmentOption[],
  patches: AiOptionPatch[],
  env: Envelope,
  c: Constraints,
): ValidatedAi {
  const warnings: string[] = [];
  const maxFootprint = env.maxFootprintSqm.value ?? 0;
  const maxFloors = c.maxFloors ?? 1;
  const site = env.siteAreaSqm.value ?? 0;

  const options = base.map((opt) => {
    const p = patches.find((x) => String(x.id ?? "").toUpperCase() === opt.id);
    if (!p) return opt;

    let floors = opt.floors;
    if (typeof p.floors === "number" && Number.isFinite(p.floors)) {
      const clamped = clampInt(Math.round(p.floors), 1, maxFloors);
      if (clamped !== Math.round(p.floors))
        warnings.push(`Option ${opt.id}: AI floors ${p.floors} clamped to ${clamped}.`);
      floors = clamped;
    }

    let footprint = opt.footprintSqm;
    if (typeof p.footprintSqm === "number" && Number.isFinite(p.footprintSqm)) {
      const clamped = round(Math.min(Math.max(1, p.footprintSqm), maxFootprint), 2);
      if (Math.abs(clamped - p.footprintSqm) > 0.01)
        warnings.push(
          `Option ${opt.id}: AI footprint ${round(p.footprintSqm, 2)} m² clamped to envelope maximum ${clamped} m².`,
        );
      footprint = clamped;
    }

    const gfa = round(footprint * floors, 2);
    const derivedUnits = Math.max(1, Math.floor((gfa * NET_EFFICIENCY) / opt.avgUnitSqm));
    let units = derivedUnits;
    if (typeof p.unitCount === "number" && Number.isFinite(p.unitCount)) {
      const clamped = clampInt(Math.round(p.unitCount), 1, derivedUnits);
      if (clamped !== Math.round(p.unitCount))
        warnings.push(
          `Option ${opt.id}: AI unit count ${p.unitCount} exceeds what ${gfa} m² supports — clamped to ${clamped}.`,
        );
      units = clamped;
    }

    const open = round(Math.max(0, site - footprint), 2);
    const parkingPossible = Math.floor(open / PARKING_BAY_SQM);
    const parking =
      c.parkingPerUnit === null
        ? parkingPossible
        : Math.min(Math.ceil(units * c.parkingPerUnit), parkingPossible);

    return {
      ...opt,
      name: sanitizeText(p.name) ?? opt.name,
      useType: sanitizeText(p.useType) ?? opt.useType,
      floors,
      footprintSqm: footprint,
      gfaSqm: gfa,
      constructionAreaSqm: gfa,
      unitCount: units,
      parkingSpaces: parking,
      openSpaceSqm: open,
      coveragePct: site > 0 ? round((footprint / site) * 100, 2) : opt.coveragePct,
      provenance: "PROPOSED" as const,
      source: "ai-validated" as const,
    };
  });

  return { options, warnings };
}

/* ------------------------------------------------------------------ */
/* Massing plan (pure — consumed by the three.js renderer)             */
/* ------------------------------------------------------------------ */

export type MassingBlock = {
  /** Centre position in metres, site-local (x east, z south of the front edge). */
  x: number;
  z: number;
  widthM: number;
  depthM: number;
  heightM: number;
};

export type MassingPlan = {
  site: { widthM: number; depthM: number };
  envelope: { widthM: number; depthM: number; offsetZ: number };
  blocks: MassingBlock[];
  parking: { x: number; z: number; widthM: number; depthM: number } | null;
  label: "CONCEPT MASSING — NOT SURVEY / NOT APPROVED DESIGN";
};

export const FLOOR_HEIGHT_M = 3;

export function massingPlan(
  b: SimulationBoundary | null,
  env: Envelope,
  c: Constraints,
  option: DevelopmentOption | null,
): MassingPlan | null {
  if (!b || !option) return null;
  const ew = env.widthM.value ?? 0;
  const ed = env.depthM.value ?? 0;
  if (ew <= 0 || ed <= 0) return null;

  const front = c.frontSetbackM ?? 0;
  const rear = c.rearSetbackM ?? 0;
  // Envelope centre offset along depth when front/rear setbacks differ.
  const offsetZ = round((front - rear) / 2, 3);

  const count = Math.max(1, option.buildingCount);
  const perFootprint = option.footprintSqm / count;
  const gap = count > 1 ? Math.min(6, ed * 0.1) : 0;
  const slotDepth = (ed - gap * (count - 1)) / count;

  const blocks: MassingBlock[] = [];
  for (let i = 0; i < count; i += 1) {
    const depth = Math.max(1, Math.min(slotDepth * 0.85, Math.sqrt(perFootprint)));
    const width = Math.max(1, Math.min(ew, perFootprint / depth));
    const zStart = -ed / 2 + offsetZ;
    const z = round(zStart + slotDepth * (i + 0.5) + gap * i, 3);
    blocks.push({
      x: 0,
      z,
      widthM: round(width, 3),
      depthM: round(depth, 3),
      heightM: round(option.floors * FLOOR_HEIGHT_M, 3),
    });
  }

  const parking =
    option.parkingSpaces > 0
      ? {
          x: 0,
          z: round(-b.depthM / 2 + Math.max(front, 3) / 2, 3),
          widthM: round(Math.min(b.widthM * 0.8, ew), 3),
          depthM: round(Math.max(2.5, Math.min(front || 5, 8)), 3),
        }
      : null;

  return {
    site: { widthM: b.widthM, depthM: b.depthM },
    envelope: { widthM: ew, depthM: ed, offsetZ },
    blocks,
    parking,
    label: "CONCEPT MASSING — NOT SURVEY / NOT APPROVED DESIGN",
  };
}

/* ------------------------------------------------------------------ */
/* Feasibility                                                         */
/* ------------------------------------------------------------------ */

export type FeasibilityInputs = {
  buildCostPerSqmKes: number | null;
  salePricePerSqmKes: number | null;
  monthlyRentPerUnitKes: number | null;
  contingencyPct: number | null;
};

export type Feasibility = {
  buildCostKes: Valued<number>;
  contingencyKes: Valued<number>;
  totalCostKes: Valued<number>;
  grossSalesKes: Valued<number>;
  annualRentKes: Valued<number>;
  grossMarginKes: Valued<number>;
  grossYieldPct: Valued<number>;
  disclaimer: string;
};

export const FEASIBILITY_DISCLAIMER =
  "Indicative arithmetic on your own assumptions. ESTIMATED figures, not a valuation, quotation, appraisal or financial advice.";

export function computeFeasibility(
  option: DevelopmentOption | null,
  f: FeasibilityInputs,
): Feasibility {
  const none = <T>(m: string) => unknown<T>(m);
  if (!option)
    return {
      buildCostKes: none("Select an option."),
      contingencyKes: none("Select an option."),
      totalCostKes: none("Select an option."),
      grossSalesKes: none("Select an option."),
      annualRentKes: none("Select an option."),
      grossMarginKes: none("Select an option."),
      grossYieldPct: none("Select an option."),
      disclaimer: FEASIBILITY_DISCLAIMER,
    };

  const gfa = option.gfaSqm;
  const cost = f.buildCostPerSqmKes === null ? null : round(gfa * f.buildCostPerSqmKes, 2);
  const contPct = f.contingencyPct;
  const cont = cost === null || contPct === null ? null : round((cost * contPct) / 100, 2);
  const total = cost === null ? null : round(cost + (cont ?? 0), 2);

  const netArea = gfa * NET_EFFICIENCY;
  const sales = f.salePricePerSqmKes === null ? null : round(netArea * f.salePricePerSqmKes, 2);
  const rent =
    f.monthlyRentPerUnitKes === null
      ? null
      : round(option.unitCount * f.monthlyRentPerUnitKes * 12, 2);

  const margin = sales === null || total === null ? null : round(sales - total, 2);
  const yieldPct =
    rent === null || total === null || total <= 0 ? null : round((rent / total) * 100, 2);

  return {
    buildCostKes: valued(
      cost,
      cost === null ? "UNKNOWN" : "ESTIMATED",
      cost === null
        ? "Enter a build cost per m²."
        : `${gfa} m² GFA × KES ${f.buildCostPerSqmKes}/m² = KES ${cost}.`,
    ),
    contingencyKes: valued(
      cont,
      cont === null ? "UNKNOWN" : "ESTIMATED",
      cont === null ? "Enter a contingency %." : `${contPct}% of KES ${cost}.`,
    ),
    totalCostKes: valued(
      total,
      total === null ? "UNKNOWN" : "ESTIMATED",
      total === null ? "Requires build cost." : `Build cost + contingency = KES ${total}.`,
    ),
    grossSalesKes: valued(
      sales,
      sales === null ? "UNKNOWN" : "ESTIMATED",
      sales === null
        ? "Enter a sale price per m²."
        : `${round(netArea, 2)} m² net (${NET_EFFICIENCY * 100}% of GFA) × KES ${f.salePricePerSqmKes}/m².`,
    ),
    annualRentKes: valued(
      rent,
      rent === null ? "UNKNOWN" : "ESTIMATED",
      rent === null
        ? "Enter a monthly rent per unit."
        : `${option.unitCount} units × KES ${f.monthlyRentPerUnitKes} × 12 months.`,
    ),
    grossMarginKes: valued(
      margin,
      margin === null ? "UNKNOWN" : "ESTIMATED",
      margin === null
        ? "Requires sales value and total cost."
        : "Gross sales − total cost, before financing and tax.",
    ),
    grossYieldPct: valued(
      yieldPct,
      yieldPct === null ? "UNKNOWN" : "ESTIMATED",
      yieldPct === null
        ? "Requires annual rent and total cost."
        : "Annual gross rent ÷ total cost × 100.",
    ),
    disclaimer: FEASIBILITY_DISCLAIMER,
  };
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

export function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function isPositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function sanitizeText(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim().slice(0, 90);
  if (!t) return null;
  // AI copy may never assert legal/verification status.
  if (/\b(verified|approved|cadastral|title deed|legally)\b/i.test(t)) return null;
  return t;
}
