/**
 * "Which building system for this location?" — without inventing a score.
 *
 * The pick is the system with the lowest priced total in the chosen county.
 * When price ranges overlap, the pick is reported as not clearly cheaper.
 * Alongside it go plain site checks: requirements of each system (cranes,
 * panel transport) and readings taken at the point (ground fall from an
 * elevation grid). Nothing here is a rating; every line is a fact to verify.
 */

export type SystemResult = {
  structure: string;
  /** Lowest total; null when the BoQ is under the 90%-priced gate or missing. */
  total: number | null;
  totalHigh: number | null;
  /** Number of BoQ lines; 0 means there is no bill of quantities yet. */
  totalLines: number;
  pricedShare: number;
  /** Of the priced lines, how many were observed in the chosen county. */
  localPricedLines: number;
  pricedLines: number;
};

export type SiteFacts = {
  county: string | null;
  /** General fall of the land in percent, or null when not measured. */
  slopePct: number | null;
  /** Elevation dataset the slope came from, for the label. */
  slopeSource?: string | null;
};

export type SiteCheck = { id: string; text: string };

export type BuildRecommendation = {
  pick: SystemResult | null;
  /** False when the next system's low end is below the pick's high end. */
  clearlyCheapest: boolean;
  runnerUp: SystemResult | null;
  /** Systems that have no total, and why. */
  unpriced: Array<{ structure: string; reason: "no_boq" | "under_gate" }>;
  checks: SiteCheck[];
};

const STRUCTURE_NAMES: Record<string, string> = {
  container_20ft: "20 ft container",
  container_40ft: "40 ft container",
  masonry_stone: "Masonry stone",
  masonry_block: "Hollow block",
  precast: "Precast panels",
  eps: "EPS (Styrofoam) panels",
};

export function structureName(structure: string): string {
  return STRUCTURE_NAMES[structure] ?? structure.replaceAll("_", " ");
}

/** Ground fall over a baseline from four samples N, S, E, W of the point. */
export function slopeFromSamples(
  samples: { n: number; s: number; e: number; w: number },
  baselineM: number,
): number | null {
  const vals = [samples.n, samples.s, samples.e, samples.w];
  // The elevation endpoint reports a missing sample as 0 m; inland Kenya is
  // never at sea level, so a zero (or anything non-finite) means no reading.
  if (!(baselineM > 0) || vals.some((v) => !Number.isFinite(v) || v <= 0)) return null;
  const ns = Math.abs(samples.n - samples.s) / baselineM;
  const ew = Math.abs(samples.e - samples.w) / baselineM;
  return Math.round(Math.hypot(ns, ew) * 1000) / 10;
}

/** Points `halfM` metres N, S, E and W of a location (WGS84, small-offset approximation). */
export function crossSamplePoints(lat: number, lng: number, halfM: number) {
  const dLat = halfM / 111_320;
  const dLng = halfM / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [
    { lat: lat + dLat, lng },
    { lat: lat - dLat, lng },
    { lat, lng: lng + dLng },
    { lat, lng: lng - dLng },
  ];
}

function systemChecks(structure: string): SiteCheck[] {
  if (structure === "container_20ft" || structure === "container_40ft") {
    return [
      {
        id: "crane",
        text: "Containers arrive on a lorry and are lifted by crane: check the access road width, turning space and overhead power lines. Road transport is not in this estimate.",
      },
      {
        id: "level-pads",
        text: "Containers sit on level pads or strip footings; the ground must be levelled under each unit.",
      },
    ];
  }
  if (structure === "precast") {
    return [
      {
        id: "crane",
        text: "Precast panels need lorry access and usually a crane: check the road to the plot.",
      },
      {
        id: "shell-scope",
        text: "The precast price is a shell price from a 2024 article; ask a supplier what the shell includes (foundation, roof) before relying on it.",
      },
    ];
  }
  if (structure === "eps") {
    return [
      {
        id: "eps-transport",
        text: "The EPS panel price is from NHC's Mavoko factory (Machakos); add transport to your plot.",
      },
      {
        id: "eps-plaster",
        text: "EPS panels are plastered (shotcrete) on both faces on site; confirm the contractor has done it before.",
      },
    ];
  }
  return [
    {
      id: "local-walling",
      text: "Stone and block prices vary by quarry and block yard; get a delivered price for your area.",
    },
  ];
}

function slopeCheck(site: SiteFacts): SiteCheck | null {
  if (site.slopePct == null) return null;
  const pct = site.slopePct;
  const src = site.slopeSource ? ` (${site.slopeSource})` : "";
  const base = `The land falls about ${pct}% around this point${src}, read from an elevation grid over about 100 m, not a site survey.`;
  if (pct >= 15)
    return {
      id: "slope",
      text: `${base} That is steep: budget for cut-and-fill or stepped foundations, which this estimate does not include.`,
    };
  if (pct >= 5)
    return {
      id: "slope",
      text: `${base} Expect some levelling or deeper footings on the low side.`,
    };
  return { id: "slope", text: `${base} Little levelling is expected; confirm with a survey.` };
}

export function recommendBuildSystem(
  results: SystemResult[],
  site: SiteFacts,
): BuildRecommendation {
  const priced = results
    .filter((r) => r.total != null)
    .sort((a, b) => (a.total as number) - (b.total as number));
  const unpriced = results
    .filter((r) => r.total == null)
    .map((r) => ({
      structure: r.structure,
      reason: r.totalLines === 0 ? ("no_boq" as const) : ("under_gate" as const),
    }));
  const pick = priced[0] ?? null;
  const runnerUp = priced[1] ?? null;
  const pickHigh = pick ? (pick.totalHigh ?? pick.total) : null;
  const clearlyCheapest =
    !!pick && (!runnerUp || (pickHigh as number) < (runnerUp.total as number));

  const checks: SiteCheck[] = [];
  if (pick) {
    checks.push(...systemChecks(pick.structure));
    if (site.county && pick.pricedLines > 0 && pick.localPricedLines / pick.pricedLines < 0.5) {
      checks.push({
        id: "local-prices",
        text: `Most of these prices were observed outside ${site.county}; get local quotes before budgeting.`,
      });
    }
  }
  const slope = slopeCheck(site);
  if (slope) checks.push(slope);
  checks.push({
    id: "scope",
    text: "Totals cover only the listed lines. Basic templates leave out plastering, ceilings, floor finishes, electrical cable and fittings, external works, approvals and contractor margin.",
  });
  return { pick, clearlyCheapest, runnerUp, unpriced, checks };
}
