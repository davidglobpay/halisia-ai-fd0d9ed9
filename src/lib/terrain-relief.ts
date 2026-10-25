/**
 * Relief from a coarse elevation raster, without reporting its noise.
 *
 * A 5x5 ASTER sample is read as "the lie of the land", so the figures taken
 * from it have to survive the raster's own defects. ASTER GDEM carries
 * isolated spikes and pits — a single cell tens of metres away from every
 * neighbour — and `max - min` turns one of those into a headline number.
 *
 * The Usenge export of 22 Oct 2026 is the case this module exists for. Of 25
 * cells, 17 sat at or below 1140 m around a median of 1133 m, which matches
 * the Lake Victoria shoreline. One cell read 1198 m, with 1133 m cells on
 * either side: a 65 m step between neighbours about 1.1 km apart, on a
 * lakeshore flat. The report published "Regional elevation relief: 67 m" as a
 * HALISIA interpretation, in the same panel as a 0.4% slope — which over that
 * grid is a 17.7 m rise. The two numbers disagreed by roughly four times and
 * the wrong one was the one with a label on it.
 *
 * The approach here is spatial, not statistical-in-the-abstract: real terrain
 * is locally smooth, so a cell is judged against its own neighbours rather
 * than against the whole grid. That keeps a genuine ridge along one edge —
 * several high cells that agree with each other — while rejecting a lone
 * spike. A grid that is mostly spikes is not cleaned up; it is declared
 * unusable, because at that point there is no terrain signal left to report.
 */

export type ReliefCell = { row: number; col: number; value: number; neighbourMedian: number };

export type ReliefResult = {
  /** Relief across the cells that survived, metres. Null when unusable. */
  reliefM: number | null;
  /** Lowest and highest surviving cell, metres. Null when unusable. */
  minM: number | null;
  maxM: number | null;
  /** Raw grid extremes, always reported, outliers included. */
  rawMinM: number;
  rawMaxM: number;
  /** Median of the whole grid — robust to the spikes by construction. */
  medianM: number;
  /** Samples flagged as suspected raster artifacts by this heuristic. */
  outliers: ReliefCell[];
  /**
   * False when too much of the grid was rejected to describe terrain at all.
   * The caller must print no relief figure in that case.
   */
  usable: boolean;
  /** One sentence for the report. Never empty. */
  note: string;
};

/** Absolute floor for calling a cell a spike, metres. Below this it is terrain. */
const MIN_SPIKE_M = 25;
/** How many MADs from the neighbour median before a cell is a spike. */
const MAD_MULTIPLE = 6;
/** Above this share of rejected cells the grid is not terrain data. */
const MAX_OUTLIER_SHARE = 0.2;

export function median(values: number[]): number {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Median absolute deviation — a spread that a single wild value cannot move. */
export function mad(values: number[]): number {
  if (!values.length) return NaN;
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m)));
}

function neighbours(grid: number[][], row: number, col: number): number[] {
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (dy === 0 && dx === 0) continue;
      const r = row + dy;
      const c = col + dx;
      if (r < 0 || c < 0 || r >= grid.length || c >= grid[r].length) continue;
      const v = grid[r][c];
      if (Number.isFinite(v)) out.push(v);
    }
  return out;
}

/**
 * Relief across a grid, with raster spikes removed.
 *
 * Returns `usable: false` rather than a cleaned-up number when the grid is
 * too damaged to describe. A refusal is a usable answer; a plausible-looking
 * wrong one is not.
 */
export function robustRelief(grid: number[][]): ReliefResult {
  const flat = grid.flat().filter((v) => Number.isFinite(v));
  if (flat.length < 4)
    return {
      reliefM: null,
      minM: null,
      maxM: null,
      rawMinM: NaN,
      rawMaxM: NaN,
      medianM: NaN,
      outliers: [],
      usable: false,
      note: "The elevation grid returned too few samples to describe relief.",
    };

  const rawMinM = Math.min(...flat);
  const rawMaxM = Math.max(...flat);
  const medianM = median(flat);

  const outliers: ReliefCell[] = [];
  const kept: number[] = [];
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid[r].length; c++) {
      const v = grid[r][c];
      if (!Number.isFinite(v)) continue;
      const nb = neighbours(grid, r, c);
      if (nb.length < 3) {
        kept.push(v);
        continue;
      }
      const nm = median(nb);
      // Distance to the NEAREST neighbour, not to their median. A spike
      // disagrees with every neighbour it has; a cell on the edge of a real
      // rise disagrees with the ones uphill and agrees with the ones beside
      // it. Comparing against the median rejected those edge cells too, which
      // is how a genuine escarpment would get erased as "noise".
      const closest = Math.min(...nb.map((x) => Math.abs(v - x)));
      const spread = mad(nb);
      const limit = Math.max(MIN_SPIKE_M, MAD_MULTIPLE * spread);
      if (closest > limit) outliers.push({ row: r, col: c, value: v, neighbourMedian: nm });
      else kept.push(v);
    }

  const share = outliers.length / flat.length;
  if (!kept.length || share > MAX_OUTLIER_SHARE)
    return {
      reliefM: null,
      minM: null,
      maxM: null,
      rawMinM,
      rawMaxM,
      medianM,
      outliers,
      usable: false,
      note:
        `The elevation grid exceeds the heuristic rejection threshold for samples that disagree with their ` +
        `neighbours: ${outliers.length} of ${flat.length}. No relief figure is reported ` +
        `from it. The raw sample range was ${Math.round(rawMinM)}-${Math.round(rawMaxM)} m, ` +
        `which this model cannot separate from raster error.`,
    };

  const minM = Math.min(...kept);
  const maxM = Math.max(...kept);
  const reliefM = Math.round(maxM - minM);

  return {
    reliefM,
    minM: Math.round(minM),
    maxM: Math.round(maxM),
    rawMinM,
    rawMaxM,
    medianM,
    outliers,
    usable: true,
    note: outliers.length
      ? `Relief of ${reliefM} m across retained model samples, after setting aside ` +
        `${outliers.length} sample${outliers.length === 1 ? "" : "s"} that ` +
        `disagree${outliers.length === 1 ? "s" : ""} with every neighbouring sample by more ` +
        `than ${MIN_SPIKE_M} m. These are suspected artifacts; real terrain features may also be excluded. ` +
        `Including ${outliers.length === 1 ? "it" : "them"} the range would read ` +
        `${Math.round(rawMinM)}-${Math.round(rawMaxM)} m.`
      : `Relief of ${reliefM} m across the sampled grid, with no sample rejected.`,
  };
}

/**
 * Does a relief figure agree with the slope measured on the same grid?
 *
 * A uniform gradient across the grid would raise the ground by
 * `slopePct% x spanM`. Relief far larger than that means the extremes are not
 * on the measured gradient — a basin or a ridge off-centre, or raster error.
 * Either way the two numbers should not be printed side by side as if they
 * described the same surface, which is exactly what the Usenge page did.
 */
export function reliefAgreesWithSlope(
  reliefM: number,
  slopePct: number,
  spanM: number,
  tolerance = 2.5,
): { agrees: boolean; impliedReliefM: number; ratio: number } {
  const impliedReliefM = (slopePct / 100) * spanM;
  const ratio = reliefM / Math.max(impliedReliefM, 1);
  return { agrees: ratio <= tolerance, impliedReliefM, ratio };
}

/** Ground width of a square grid, metres. n cells at `stepDeg` spacing. */
export function gridSpanM(n: number, stepDeg: number, lat: number): number {
  const mPerDeg = 110574;
  return (n - 1) * stepDeg * mPerDeg * Math.cos((lat * Math.PI) / 180);
}
