/**
 * Preliminary development scenarios. Deterministic, assumption-led and
 * never a planning approval, valuation or return forecast.
 */
export type ScenarioKey = "residential" | "rental" | "mixed_use" | "commercial" | "agri" | "hold";

export type ScenarioContext = {
  urban: boolean | null;
  slopeHigh: boolean | null;
  floodFlag: boolean | null;
  amenitiesNearby: number | null;
};

export type Scenario = {
  key: ScenarioKey;
  label: string;
  fit: "possible" | "check_first" | "unlikely";
  why: string;
  scale: string;
  costNote: string;
  income: string | null;
  infrastructure: string;
  regulatory: string;
  risks: string;
  professionals: string[];
};

const BASE: Omit<Scenario, "fit" | "why">[] = [
  {
    key: "residential",
    label: "Own home / residential",
    scale: "Typically 1 house per 1/8 acre in peri-urban zones; check county density rules.",
    costNote: "Assumes KES 35,000–60,000 per m² built (varies by finish and site).",
    income: null,
    infrastructure: "Water, power connection, access road, on-site sewer or septic.",
    regulatory: "County building approval, NEMA if above thresholds, NCA registration.",
    risks: "Title issues, unconfirmed boundaries, slope or drainage costs.",
    professionals: ["architect", "surveyor", "lawyer"],
  },
  {
    key: "rental",
    label: "Rental apartments",
    scale: "Depends on plot ratio and height limits set by the county.",
    costNote: "Assumes KES 45,000–75,000 per m² built plus parking and services.",
    income: "Monthly rent per unit minus maintenance, vacancy and management.",
    infrastructure: "Adequate water supply, sewer connection, 3-phase power.",
    regulatory: "Change of user may be needed; NEMA EIA; fire and structural approvals.",
    risks: "Demand not measured by HALISIA; construction overruns; financing cost.",
    professionals: ["architect", "quantity_surveyor", "engineer", "valuer"],
  },
  {
    key: "mixed_use",
    label: "Mixed use (shops + homes)",
    scale: "Ground-floor retail with residential above, where zoning permits.",
    costNote: "Assumes KES 50,000–80,000 per m² built.",
    income: "Retail and residential rent streams.",
    infrastructure: "Road frontage, parking, loading, sewer and power.",
    regulatory: "Zoning must permit commercial use; change of user likely.",
    risks: "Footfall is not measured; tenant mix risk.",
    professionals: ["planner", "architect", "quantity_surveyor"],
  },
  {
    key: "commercial",
    label: "Commercial",
    scale: "Offices, warehouse or retail sized to access and zoning.",
    costNote: "Assumes KES 40,000–90,000 per m² depending on type.",
    income: "Lease income; depends on tenant covenant.",
    infrastructure: "Strong road access, parking, 3-phase power.",
    regulatory: "Commercial zoning, NEMA, traffic assessment for larger schemes.",
    risks: "Vacancy and market depth are not measured by HALISIA.",
    professionals: ["planner", "engineer", "valuer"],
  },
  {
    key: "agri",
    label: "Agricultural use",
    scale: "Crop, greenhouse or livestock use sized to soil and water.",
    costNote: "Setup varies widely; a soil and water test comes first.",
    income: "Produce sales; depends on yields and markets.",
    infrastructure: "Water source (borehole/irrigation), farm access.",
    regulatory: "Land Control Board consent for agricultural land transactions.",
    risks: "Rainfall variability, soil suitability not tested.",
    professionals: ["environmental_consultant", "surveyor"],
  },
  {
    key: "hold",
    label: "Long-term holding",
    scale: "No construction; maintain fencing and rates.",
    costNote: "Annual land rates, rent and security costs.",
    income: null,
    infrastructure: "Fencing and occasional site visits.",
    regulatory: "Keep rates current; watch for compulsory acquisition notices.",
    risks: "Future value is not predicted or guaranteed; encroachment risk.",
    professionals: ["lawyer", "surveyor"],
  },
];

export function buildScenarios(c: ScenarioContext): Scenario[] {
  return BASE.map((b) => {
    let fit: Scenario["fit"] = "possible";
    const reasons: string[] = [];
    if (c.floodFlag && b.key !== "hold" && b.key !== "agri") {
      fit = "check_first";
      reasons.push("low-lying terrain signal — confirm drainage");
    }
    if (c.slopeHigh && b.key !== "hold") {
      fit = "check_first";
      reasons.push("steeper slope may raise foundation costs");
    }
    if (c.urban === false && (b.key === "commercial" || b.key === "mixed_use")) {
      fit = fit === "check_first" ? "unlikely" : "check_first";
      reasons.push("rural setting — commercial demand unconfirmed");
    }
    if (c.urban === true && b.key === "agri") {
      fit = "check_first";
      reasons.push("urban setting — zoning may not permit farming");
    }
    if ((c.amenitiesNearby ?? 0) >= 5 && (b.key === "residential" || b.key === "rental")) {
      reasons.push(`${c.amenitiesNearby} mapped facilities nearby`);
    }
    return {
      ...b,
      fit,
      why: reasons.length
        ? reasons.join("; ")
        : "No blocking signal in the data HALISIA holds; zoning not confirmed.",
    };
  });
}

export const SCENARIO_DISCLAIMER =
  "Preliminary scenarios from available data and stated assumptions. Not planning approval, construction drawings, a valuation or a return forecast.";
