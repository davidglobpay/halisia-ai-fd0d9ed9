/**
 * Read a surveyor's mutation plan.
 *
 * Measured against a real sheet — "PROPOSED SUBDIVISION ON KONZA SOUTH
 * BLOCK 5/1492", Sheet 14, scale 1:1000 — a Kenyan mutation PDF carries
 * everything needed without tracing a single line:
 *
 *   - a text layer with every dimension and area as extractable text
 *   - each word's position on the page, so an area label can be tied to the
 *     plot it sits inside
 *   - a stated scale, which the drawing's own geometry confirms: the plot
 *     pitch measured 43.33 pt, and 43.33 pt at 1:1000 is 15.29 m against a
 *     printed 15.3 m, 0.08% out
 *
 * So this module reads the numbers rather than reconstructing the drawing.
 * That is deliberate. The plot divisions on a real sheet are DASHED — 178 of
 * the 217 line segments were dashes with a median length of 2.50 m — so no
 * closed plot polygon exists in the file to extract. Rebuilding one would mean
 * merging dash chains into lines, building a planar arrangement and pulling
 * faces out of it, to arrive at numbers the sheet already prints.
 *
 * Nothing here establishes where a parcel is on the ground. A mutation plan
 * carries no coordinates and no north arrow; position and rotation come from
 * the person placing it. This reads the shape and the size, nothing more.
 */

import { parseArea, parseScale, type ParsedArea } from "@/lib/parcel-geometry";

/** One word of the PDF's text layer, with its position on the page. */
export type TextItem = {
  text: string;
  /** Page points from the left. */
  x: number;
  /** Page points from the top. */
  y: number;
};

export type PlanPlot = {
  /** Area as printed on the sheet, in square metres. */
  areaM2: number;
  /** The label exactly as it appeared, e.g. "0.044Ha". */
  label: string;
  x: number;
  y: number;
  /** Dimensions found close enough to this label to belong to it. */
  dimsM: number[];
};

export type MutationPlan = {
  title: string | null;
  /** The parent parcel being subdivided, e.g. "KONZA SOUTH BLOCK 5/1492". */
  block: string | null;
  /** Registry map sheet number, which a title deed also carries. */
  sheet: string | null;
  scale: { ratio: number; metresPerMm: number } | null;
  /** True when the sheet states its linear dimensions are metric. */
  metricDimensions: boolean;
  /**
   * True when the sheet says it is provisional and subject to final survey.
   *
   * This is the single most consequential line on a mutation plan and the
   * easiest to miss: it means the beacons are not fixed and the plot numbers
   * are not registered titles. A buyer shown such a plan is being shown an
   * intention, not a parcel.
   */
  provisional: boolean;
  /** The provisional wording as printed, for quoting back verbatim. */
  provisionalNote: string | null;
  plots: PlanPlot[];
  /** Every distinct linear dimension printed on the sheet, in metres. */
  dimensionsM: number[];
  /** Adjoining parcel numbers printed around the block. */
  neighbours: string[];
};

/** A bare integer of 3–6 digits is an adjoining parcel number on these sheets. */
const PARCEL_NO = /^\d{3,6}$/;
/** A dimension is printed with one decimal place: "15.3", "29.0". */
const DIMENSION = /^\d{1,3}\.\d$/;

function joinNear(items: TextItem[], yTolerance = 3): string {
  if (!items.length) return "";
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const out: string[] = [];
  let lineY = sorted[0].y;
  let line: string[] = [];
  for (const it of sorted) {
    if (Math.abs(it.y - lineY) > yTolerance) {
      out.push(line.join(" "));
      line = [];
      lineY = it.y;
    }
    line.push(it.text);
  }
  out.push(line.join(" "));
  return out.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Parse a mutation plan from its extracted text layer.
 *
 * Takes the words and their positions — whatever produced them, pdf.js in the
 * browser or pdftotext on a server — so this function has no PDF dependency
 * and can be tested against a fixture captured from a real sheet.
 */
export function parseMutationPlan(items: TextItem[]): MutationPlan {
  const all = joinNear(items);

  const titleItem = items.filter((i) => /SUBDIVISION/i.test(i.text));
  const titleLine = titleItem.length
    ? joinNear(items.filter((i) => Math.abs(i.y - titleItem[0].y) <= 3))
    : null;

  // At most two words of place name before BLOCK. An unbounded run of
  // capitals swallows the sheet's own title — on the measured sheet it
  // captured "PROPOSED SUBDIVISION ON KONZA SOUTH_KONZA SOUTH BLOCK 5/1492"
  // all the way back from the first word.
  const blockMatch = all.match(
    /([A-Z][A-Z_]*(?:\s+[A-Z][A-Z_]*){0,2}\s+BLOCK\s*\d+(?:\s*\/\s*\d+)?)/i,
  );
  const sheetMatch = all.match(/SHEET\s*(\d{1,4})/i);
  const scale = parseScale(all);

  const metricDimensions = /dimensions\s+are\s+in\s+met(?:re|er)s/i.test(all);

  // The wording is handwritten into the drawing and is routinely misspelled —
  // the sheet measured here reads "provision and subjevt to final ground
  // survey". Matching has to tolerate that, because the meaning is the point
  // and a typo must never cause the warning to be dropped.
  const provisionalRe =
    /\b(provisional|provision)\b[\s\S]{0,40}?\b(subject|subjevt|subjec)\b[\s\S]{0,40}?\b(final|ground)\b/i;
  const provisionalMatch = all.match(provisionalRe);

  const plots: PlanPlot[] = [];
  const dimensions: number[] = [];
  const neighbours: string[] = [];

  for (const it of items) {
    const t = it.text.trim();
    if (!t) continue;

    if (/\d\s*(ha|m2|m²|sqm)\b/i.test(t) || /\d(?:Ha|HA|ha)$/.test(t)) {
      const parsed: ParsedArea | null = parseArea(t);
      if (parsed && !parsed.ambiguous) {
        plots.push({ areaM2: parsed.m2, label: t, x: it.x, y: it.y, dimsM: [] });
        continue;
      }
    }
    if (DIMENSION.test(t)) {
      // "0.0" appears on the measured sheet as a tick annotation. A zero-length
      // boundary is not a dimension, and carrying it through would put a
      // meaningless entry in the plot's measurements.
      const v = parseFloat(t);
      if (v > 0) dimensions.push(v);
      continue;
    }
    if (PARCEL_NO.test(t)) {
      neighbours.push(t);
    }
  }

  // Tie each dimension to the nearest area label. A dimension printed between
  // two plots genuinely belongs to both boundaries, so proximity is the only
  // honest rule and a dimension too far from any label is left unassigned
  // rather than forced onto the closest one.
  const MAX_TIE_PT = 60;
  for (const it of items) {
    const t = it.text.trim();
    if (!DIMENSION.test(t) || !(parseFloat(t) > 0)) continue;
    let best: PlanPlot | null = null;
    let bestD = Infinity;
    for (const p of plots) {
      const d = Math.hypot(p.x - it.x, p.y - it.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best && bestD <= MAX_TIE_PT) best.dimsM.push(parseFloat(t));
  }

  return {
    title: titleLine,
    block: blockMatch ? blockMatch[1].replace(/\s+/g, " ").trim() : null,
    sheet: sheetMatch ? sheetMatch[1] : null,
    scale,
    metricDimensions,
    provisional: Boolean(provisionalMatch),
    provisionalNote: provisionalMatch ? provisionalMatch[0].replace(/\s+/g, " ").trim() : null,
    plots,
    dimensionsM: [...new Set(dimensions)].sort((a, b) => a - b),
    neighbours: [...new Set(neighbours)],
  };
}

export type DeedPlanAgreement = {
  /** Checks that both documents answered, and whether they agreed. */
  checks: Array<{ name: string; deed: string; plan: string; agrees: boolean }>;
  agreed: number;
  total: number;
  /** A check that disagreed, which is a reason to stop and ask. */
  conflicts: string[];
};

/**
 * Cross-check a title deed against the mutation plan it should belong to.
 *
 * A deed and its mutation plan overlap in three places — the block, the
 * registry map sheet number, and the parcel area — and all three must agree.
 * On the pair measured here they did: deed "Registry Map Sheet No. 14" against
 * the sheet's "SHEET 14", deed "0.0440HA" against a printed "0.044Ha" plot,
 * and both naming Konza South Block 5.
 *
 * Agreement does not make a deed genuine. Both documents can be forged
 * together, and the Beba Freight case turned on a chain that was internally
 * consistent and wholly fabricated. What this catches is the far commoner
 * case: a plan shown alongside a deed it does not belong to.
 */
export function checkDeedAgainstPlan(
  deed: { sheet?: string | null; areaText?: string | null; block?: string | null },
  plan: MutationPlan,
): DeedPlanAgreement {
  const checks: DeedPlanAgreement["checks"] = [];

  if (deed.sheet && plan.sheet) {
    const a = deed.sheet.replace(/\D/g, "");
    const b = plan.sheet.replace(/\D/g, "");
    checks.push({
      name: "Registry map sheet",
      deed: deed.sheet,
      plan: plan.sheet,
      agrees: a === b && a !== "",
    });
  }

  if (deed.areaText) {
    const deedArea = parseArea(deed.areaText);
    if (deedArea && plan.plots.length) {
      // Any plot on the sheet matching the deed's area to within a tenth of a
      // square metre is a match: a sheet of identical plots is the norm, and
      // this says the deed's area appears on the plan, not which plot it is.
      const hit = plan.plots.some((p) => Math.abs(p.areaM2 - deedArea.m2) < 0.1);
      checks.push({
        name: "Parcel area",
        deed: deed.areaText,
        plan: hit ? "present on the sheet" : "no plot of this area on the sheet",
        agrees: hit,
      });
    }
  }

  if (deed.block && plan.block) {
    const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const d = norm(deed.block);
    const p = norm(plan.block);
    checks.push({
      name: "Block",
      deed: deed.block,
      plan: plan.block,
      agrees: d.includes(p) || p.includes(d),
    });
  }

  return {
    checks,
    agreed: checks.filter((c) => c.agrees).length,
    total: checks.length,
    conflicts: checks.filter((c) => !c.agrees).map((c) => c.name),
  };
}
