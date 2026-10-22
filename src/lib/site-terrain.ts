/**
 * Terrain description for a drawn site, and a guard on what may be drawn.
 *
 * The elevation this reads comes from ASTER 30 m, which the project already
 * samples in terrain-grid.ts. That raster has a horizontal post spacing of
 * about 30 m and a vertical error on the order of ten metres. Both numbers set
 * hard limits on what can honestly be derived from it, and this module's main
 * job is to enforce them rather than to produce output.
 */

export type SlopeBand = {
  id: "level" | "gentle" | "moderate" | "strong" | "steep";
  label: string;
  rangeLabel: string;
  note: string;
};

/**
 * Conventional land-capability slope bands.
 *
 * These are the bands used in general land-capability description. They are
 * NOT a buildability rating and NOT specific to this site: a 3% slope on
 * expansive clay can be harder to build on than a 12% slope on rock. The band
 * describes the gradient and nothing else.
 */
const BANDS: readonly SlopeBand[] = [
  { id: "level", label: "Nearly level", rangeLabel: "under 2%",
    note: "Surface water moves slowly; drainage design matters more than earthworks." },
  { id: "gentle", label: "Gentle", rangeLabel: "2–5%",
    note: "Falls away enough to shed water without large cut and fill." },
  { id: "moderate", label: "Moderate", rangeLabel: "5–10%",
    note: "Access and platform levelling start to shape what a layout can do." },
  { id: "strong", label: "Strong", rangeLabel: "10–15%",
    note: "Terracing or stepped platforms are usually involved." },
  { id: "steep", label: "Steep", rangeLabel: "over 15%",
    note: "Earthworks and access dominate. A survey is needed before any layout." },
] as const;

export function classifySlope(slopePct: number | null | undefined): (SlopeBand & {
  slopePct: number;
  slopeDeg: number;
  basis: string;
}) | null {
  if (slopePct == null || !Number.isFinite(slopePct) || slopePct < 0) return null;
  const band =
    slopePct < 2 ? BANDS[0] : slopePct < 5 ? BANDS[1] : slopePct < 10 ? BANDS[2] : slopePct < 15 ? BANDS[3] : BANDS[4];
  return {
    ...band,
    slopePct,
    slopeDeg: (Math.atan(slopePct / 100) * 180) / Math.PI,
    basis:
      "Conventional land-capability band describing gradient only. Not a buildability rating, and not specific to this ground.",
  };
}

export type ContourVerdict =
  | { ok: true; intervalM: number; approxLines: number; caveat: string }
  | { ok: false; reason: string };

/**
 * Whether contour lines may honestly be drawn from this elevation sample.
 *
 * Two independent refusals, and both matter:
 *
 *   1. An interval finer than the data's vertical error draws noise as if it
 *      were topography. ASTER's vertical error is on the order of ten metres,
 *      so a 1 m contour off it is a picture of the error term.
 *   2. Too little relief across the sample leaves nothing to contour. One line
 *      through the middle of a flat field tells a reader nothing and looks
 *      like a finding.
 *
 * Returning a refusal with its reason is the point of this function. A caller
 * that wants a picture regardless should not get one from here.
 */
export function contourEligibility(input: {
  gridSpacingM: number;
  verticalAccuracyM: number;
  reliefM: number;
  proposedIntervalM: number;
  siteSpanM?: number;
}): ContourVerdict {
  const { gridSpacingM, verticalAccuracyM, reliefM, proposedIntervalM, siteSpanM } = input;
  for (const [v, name] of [
    [gridSpacingM, "grid spacing"], [verticalAccuracyM, "vertical accuracy"],
    [reliefM, "relief"], [proposedIntervalM, "proposed interval"],
  ] as const) {
    if (!Number.isFinite(v) || v <= 0)
      return { ok: false, reason: `Cannot assess contours: ${name} was not supplied.` };
  }
  if (proposedIntervalM < verticalAccuracyM)
    return {
      ok: false,
      reason: `A ${proposedIntervalM} m contour interval is finer than the elevation source's vertical error (about ${verticalAccuracyM} m). Lines drawn at that interval would describe the error, not the ground.`,
    };
  if (reliefM < proposedIntervalM * 3)
    return {
      ok: false,
      reason: `Relief across the sample is ${reliefM.toFixed(1)} m, under three intervals of ${proposedIntervalM} m. There is not enough fall here to contour meaningfully.`,
    };
  if (siteSpanM != null && Number.isFinite(siteSpanM) && siteSpanM < gridSpacingM * 3)
    return {
      ok: false,
      reason: `The site spans about ${siteSpanM.toFixed(0)} m, fewer than three ${gridSpacingM} m elevation posts across. The raster cannot resolve a shape at this size.`,
    };
  return {
    ok: true,
    intervalM: proposedIntervalM,
    approxLines: Math.floor(reliefM / proposedIntervalM),
    caveat: `Interpolated from a ${gridSpacingM} m elevation raster with roughly ${verticalAccuracyM} m vertical error. Indicative shape only — not surveyed contours, and not suitable for earthworks quantities.`,
  };
}

/** The smallest interval this source can honestly carry, rounded up to 1/2/5/10. */
export function smallestHonestInterval(verticalAccuracyM: number): number | null {
  if (!Number.isFinite(verticalAccuracyM) || verticalAccuracyM <= 0) return null;
  for (const step of [1, 2, 5, 10, 20, 25, 50, 100]) if (step >= verticalAccuracyM) return step;
  return Math.ceil(verticalAccuracyM / 100) * 100;
}

/** ASTER GDEM, the source terrain-grid.ts already uses. */
export const ASTER_30M = { gridSpacingM: 30, verticalAccuracyM: 10 } as const;
