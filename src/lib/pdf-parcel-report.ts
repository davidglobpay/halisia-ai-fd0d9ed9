import jsPDF from "jspdf";
import halisiaMark from "@/assets/brand/halisia-mark.png.asset.json";
import {
  PDF,
  brandPage,
  brandFooters,
  prepareMark,
  sanitize,
  tracked,
  wrap,
  type RGB,
} from "@/lib/pdf-chrome";
import {
  areaM2,
  describeArea,
  edges,
  parseArea,
  perimeterM,
  toLocalMetres,
  type LatLng,
  type LocalXY,
} from "@/lib/parcel-geometry";
import { buildableEnvelope, orientedExtent, groundCoveragePct } from "@/lib/buildable";
import type { MutationPlan, DeedPlanAgreement } from "@/lib/mutation-plan";
import { frontEdgeIndexOf, type MassingStudy } from "@/lib/house-brief";
import type { PlanFit } from "@/lib/plan-overlay";
import { deliverPdf } from "@/lib/pdf-delivery";

/**
 * The parcel report: everything the steps established, in one document.
 *
 * This is where the work stops being a session in a browser and becomes
 * something a person can hand to a surveyor, an advocate or a bank. It carries
 * the pin they placed, the plan they uploaded, the boundary they drew with its
 * measurements, what the plot allows them to build, and the brief they wrote.
 *
 * Every page states its own provenance. The rule the whole document is built
 * on: a drawn boundary is a sketch, and this says so on the page that shows
 * it, not only in the small print at the end.
 */

export type ParcelReportInput = {
  /** The reference on the deed, if one was read. */
  reference?: string | null;
  /** What the geocoder matched, for the record. */
  matchedAddress?: string | null;
  /** The geocoded point. */
  geocoded?: { lat: number; lng: number; radiusM?: number | null } | null;
  /** The point the user placed by hand, if they placed one. */
  pinned?: { lat: number; lng: number; movedM: number } | null;
  /** The boundary the user sketched. */
  boundary?: LatLng[];
  /** Area as printed on the deed, e.g. "0.0440HA." */
  deedAreaText?: string | null;
  /** The surveyor's plan, if one was read. */
  plan?: MutationPlan | null;
  agreement?: DeedPlanAgreement | null;
  /** Setbacks the user entered. Never defaults invented here. */
  setbacks?: { frontM: number; sideM: number } | null;
  /** The step 4 brief, already assembled by the UI. */
  briefText?: string | null;
  /** Step 6's massing study, if the household answered the questionnaire. */
  massing?: MassingStudy | null;
  /** Step 6's brief for an architect. */
  massingBriefText?: string | null;
  /**
   * Step 7's placement of the plot from the sheet.
   *
   * The size is the surveyor's; the position and angle are the user's. The
   * page that prints this says so, because a reader who mistakes it for
   * georeferencing has been actively misled.
   */
  placement?: {
    widthM: number;
    depthM: number;
    basis: "dimensions" | "area-and-proportion";
    rotationDeg: number;
    fit: PlanFit | null;
  } | null;
};

const M = 48;

/**
 * The envelope, computed the one way the whole product computes it.
 *
 * Getting the front edge wrong here is not cosmetic. Until this helper
 * existed, both call sites below invoked buildableEnvelope WITHOUT a front
 * edge index, so `setbacks.frontEdgeIndex === i` was never true and the front
 * setback was silently dropped — every boundary got the side figure. On a real
 * 15.3 x 28.8 m Konza plot with a 6 m front and 3 m sides, the screen showed
 * 144 m2 buildable and this document printed 212 m2: the same plot, the same
 * inputs, two different answers, with the paid document being both the wrong
 * one and the more generous one.
 */
function envelopeFor(local: LocalXY[], setbacks: { frontM: number; sideM: number }) {
  return buildableEnvelope(local, {
    allM: setbacks.sideM,
    frontM: setbacks.frontM,
    frontEdgeIndex: frontEdgeIndexOf(local),
  });
}

function heading(doc: jsPDF, text: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(PDF.forest[0], PDF.forest[1], PDF.forest[2]);
  doc.text(sanitize(text), M, y);
  return y + 20;
}

function label(doc: jsPDF, text: string, y: number, color: RGB = PDF.goldInk): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(color[0], color[1], color[2]);
  doc.text(tracked(text), M, y);
  return y + 12;
}

function row(doc: jsPDF, k: string, v: string, y: number, W: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(PDF.stone2[0], PDF.stone2[1], PDF.stone2[2]);
  doc.text(sanitize(k), M, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(PDF.forest[0], PDF.forest[1], PDF.forest[2]);
  doc.text(sanitize(v), W - M, y, { align: "right" });
  return y + 14;
}

/**
 * Draw a ring to scale inside a box, with a scale bar and north arrow.
 *
 * The scale is derived from the ring's own extent and printed, so a reader can
 * measure the drawing and get the same numbers back. Without a printed scale a
 * plan is a picture; with one it is a document.
 */
function drawPlan(
  doc: jsPDF,
  ring: LocalXY[],
  box: { x: number; y: number; w: number; h: number },
  opts: { envelope?: LocalXY[] | null; footprint?: LocalXY[] | null } = {},
) {
  if (ring.length < 3) return;
  const all = [...ring, ...(opts.envelope ?? []), ...(opts.footprint ?? [])];
  const minX = Math.min(...all.map((p) => p.x));
  const maxX = Math.max(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y));
  const maxY = Math.max(...all.map((p) => p.y));
  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);

  const pad = 26;
  // One scale for both axes, or the plot is drawn out of proportion.
  const ptPerM = Math.min((box.w - pad * 2) / spanX, (box.h - pad * 2) / spanY);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  // PDF y grows downward; ground north grows upward. Negating y is what keeps
  // the drawing the same way up as the map the user was looking at.
  const put = (p: LocalXY) => ({
    x: cx + (p.x - midX) * ptPerM,
    y: cy - (p.y - midY) * ptPerM,
  });

  const stroke = (pts: LocalXY[], color: RGB, fillAlpha: number, width: number) => {
    const d = pts.map(put);
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setFillColor(color[0], color[1], color[2]);
    doc.setLineWidth(width);
    const lines: [number, number][] = [];
    for (let i = 1; i < d.length; i++) lines.push([d[i].x - d[i - 1].x, d[i].y - d[i - 1].y]);
    lines.push([d[0].x - d[d.length - 1].x, d[0].y - d[d.length - 1].y]);
    doc.lines(lines, d[0].x, d[0].y, [1, 1], fillAlpha > 0 ? "FD" : "S", true);
  };

  if (opts.envelope && opts.envelope.length >= 3) {
    doc.setFillColor(PDF.greenLight[0], PDF.greenLight[1], PDF.greenLight[2]);
    stroke(opts.envelope, PDF.green, 0.1, 0.8);
  }
  if (opts.footprint && opts.footprint.length >= 3) {
    doc.setFillColor(PDF.gold[0], PDF.gold[1], PDF.gold[2]);
    stroke(opts.footprint, PDF.goldInk, 0.1, 0.8);
  }
  doc.setFillColor(250, 243, 226);
  stroke(ring, PDF.gold, opts.footprint ? 0 : 0.1, 1.4);

  // Corner numbers, so the side table below can be read against the drawing.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(PDF.forest[0], PDF.forest[1], PDF.forest[2]);
  ring.forEach((p, i) => {
    const d = put(p);
    doc.text(String(i + 1), d.x + 3, d.y - 3);
  });

  // North arrow. The local frame is already east/north, so north is up.
  const nx = box.x + box.w - 18;
  const ny = box.y + 16;
  doc.setDrawColor(PDF.stone2[0], PDF.stone2[1], PDF.stone2[2]);
  doc.setLineWidth(0.8);
  doc.line(nx, ny + 12, nx, ny);
  doc.line(nx, ny, nx - 3, ny + 4);
  doc.line(nx, ny, nx + 3, ny + 4);
  doc.setFontSize(7);
  doc.setTextColor(PDF.stone2[0], PDF.stone2[1], PDF.stone2[2]);
  doc.text("N", nx - 2, ny + 21);

  // Scale bar: a round number of metres, drawn at the true scale, and placed
  // under the DRAWING rather than at the box edge. A tall narrow plot uses a
  // fraction of the box width, and a bar pinned to the far left then floats
  // unattached to anything.
  const drawnLeft = cx - (spanX / 2) * ptPerM;
  const drawnRight = cx + (spanX / 2) * ptPerM;
  const drawnBottom = cy + (spanY / 2) * ptPerM;
  const target = Math.max(1, (drawnRight - drawnLeft) / 2 / ptPerM);
  const nice = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500].reduce((b, n) =>
    Math.abs(n - target) < Math.abs(b - target) ? n : b,
  );
  const barPt = nice * ptPerM;
  const bx = Math.max(box.x + 4, (drawnLeft + drawnRight) / 2 - barPt / 2);
  const by = Math.min(box.y + box.h - 6, drawnBottom + 18);
  doc.setDrawColor(PDF.forest[0], PDF.forest[1], PDF.forest[2]);
  doc.setLineWidth(1.2);
  doc.line(bx, by, bx + barPt, by);
  doc.line(bx, by - 3, bx, by + 3);
  doc.line(bx + barPt, by - 3, bx + barPt, by + 3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(PDF.stone2[0], PDF.stone2[1], PDF.stone2[2]);
  doc.text(`${nice} m`, bx + barPt + 5, by + 2.5);
}

export async function generateParcelReport(input: ParcelReportInput): Promise<string> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const mark = await prepareMark(halisiaMark.url);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const issued = new Date().toLocaleDateString("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const ring = input.boundary ?? [];
  const local = ring.length >= 3 ? toLocalMetres(ring, ring[0]) : [];
  const drawnArea = local.length >= 3 ? areaM2(local) : 0;
  const deedArea = input.deedAreaText ? parseArea(input.deedAreaText) : null;

  /* ---------------- page 1: what was established ---------------- */
  doc.setFillColor(PDF.ivory[0], PDF.ivory[1], PDF.ivory[2]);
  doc.rect(0, 0, W, H, "F");
  brandPage(doc, mark);

  let y = 86;
  y = label(doc, "Parcel report", y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(PDF.forest[0], PDF.forest[1], PDF.forest[2]);
  doc.text(sanitize(input.reference || "Unreferenced parcel"), M, y + 10);
  y += 34;
  if (input.matchedAddress) {
    y = wrap(doc, input.matchedAddress, M, y, W - M * 2, { size: 10, color: PDF.stone2 });
  }

  y += 14;
  y = label(doc, "Where this parcel is", y);
  if (input.pinned) {
    y = row(
      doc,
      "Pin placed by hand",
      `${input.pinned.lat.toFixed(6)}, ${input.pinned.lng.toFixed(6)}`,
      y,
      W,
    );
    y = row(doc, "Moved from the search match by", `${Math.round(input.pinned.movedM)} m`, y, W);
  } else if (input.geocoded) {
    y = row(
      doc,
      "Search match only, no pin placed",
      `${input.geocoded.lat.toFixed(6)}, ${input.geocoded.lng.toFixed(6)}`,
      y,
      W,
    );
    if (input.geocoded.radiusM != null) {
      y = row(
        doc,
        "That match could be out by",
        `up to ${Math.round(input.geocoded.radiusM)} m`,
        y,
        W,
      );
    }
  } else {
    y = wrap(doc, "No position was established.", M, y, W - M * 2, { size: 9, color: PDF.stone2 });
  }

  y += 10;
  y = label(doc, "What this document is", y);
  y = wrap(
    doc,
    "A record of what was established in the app, by the person who used it. It is not a title " +
      "search, not a survey, and not a valuation. Where a boundary appears it is a sketch someone " +
      "drew on satellite imagery, and a sketch of the right size in the wrong place is still the " +
      "wrong land. A licensed surveyor fixes beacons. An advocate confirms title.",
    M,
    y,
    W - M * 2,
    { size: 9.5, leading: 13, color: PDF.stone },
  );

  /* ---------------- page 2: the boundary ---------------- */
  if (local.length >= 3) {
    doc.addPage();
    doc.setFillColor(PDF.ivory[0], PDF.ivory[1], PDF.ivory[2]);
    doc.rect(0, 0, W, H, "F");
    brandPage(doc, mark);

    y = heading(doc, "The boundary as drawn", 86);
    const env = input.setbacks ? envelopeFor(local, input.setbacks) : null;

    drawPlan(doc, local, { x: M, y: y, w: W - M * 2, h: 250 }, { envelope: env?.ring ?? null });
    y += 262;

    y = row(doc, "Area", describeArea(drawnArea), y, W);
    y = row(doc, "Perimeter", `${Math.round(perimeterM(local))} m`, y, W);
    y = row(doc, "Corners", String(ring.length), y, W);
    if (deedArea) {
      const diff = ((drawnArea - deedArea.m2) / deedArea.m2) * 100;
      y = row(doc, "Area on the deed", describeArea(deedArea.m2), y, W);
      y = row(
        doc,
        "Sketch against the deed",
        `${Math.abs(diff).toFixed(1)}% ${diff >= 0 ? "larger" : "smaller"}`,
        y,
        W,
      );
    }

    y += 8;
    y = label(doc, "Sides, as a surveyor states them", y);
    const es = edges(local);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    es.forEach((e, i) => {
      if (y > H - 80) return;
      doc.setTextColor(PDF.stone2[0], PDF.stone2[1], PDF.stone2[2]);
      doc.text(`${i + 1} to ${((i + 1) % es.length) + 1}`, M, y);
      doc.setTextColor(PDF.forest[0], PDF.forest[1], PDF.forest[2]);
      doc.text(`${e.lengthM.toFixed(1)} m`, M + 90, y);
      doc.setTextColor(PDF.stone2[0], PDF.stone2[1], PDF.stone2[2]);
      doc.text(`${Math.round(e.bearingDeg)}° ${e.compass}`, M + 150, y);
      y += 12;
    });

    y += 6;
    wrap(
      doc,
      "Drawn to the scale shown. These are measurements of a sketch, not of a survey: they describe " +
        "the shape someone traced on imagery, and nothing about where the legal boundary runs.",
      M,
      y,
      W - M * 2,
      { size: 8.5, leading: 11.5, color: PDF.stone2 },
    );
  }

  /* ---------------- page 3: the surveyor's plan ---------------- */
  if (input.plan) {
    doc.addPage();
    doc.setFillColor(PDF.ivory[0], PDF.ivory[1], PDF.ivory[2]);
    doc.rect(0, 0, W, H, "F");
    brandPage(doc, mark);
    y = heading(doc, "The surveyor's plan", 86);

    if (input.plan.provisional) {
      doc.setFillColor(253, 240, 239);
      doc.rect(M, y - 10, W - M * 2, 58, "F");
      doc.setFillColor(PDF.red[0], PDF.red[1], PDF.red[2]);
      doc.rect(M, y - 10, 3, 58, "F");
      y = label(doc, "This plan is provisional", y + 4, PDF.red);
      y = wrap(
        doc,
        "The sheet states it is subject to a final ground survey. The beacons are not fixed and " +
          "these plot numbers are not registered titles.",
        M + 10,
        y,
        W - M * 2 - 20,
        { size: 9, leading: 12, color: PDF.forest },
      );
      y += 14;
    }

    if (input.plan.block) y = row(doc, "Block", input.plan.block, y, W);
    if (input.plan.sheet) y = row(doc, "Registry map sheet", input.plan.sheet, y, W);
    if (input.plan.scale) y = row(doc, "Scale", `1:${input.plan.scale.ratio}`, y, W);
    y = row(doc, "Plots on the sheet", String(input.plan.plots.length), y, W);
    if (input.plan.neighbours.length) {
      y = row(doc, "Adjoining parcels", input.plan.neighbours.join(", "), y, W);
    }

    if (input.agreement && input.agreement.total > 0) {
      y += 10;
      y = label(
        doc,
        input.agreement.conflicts.length ? "Deed and plan disagree" : "Deed and plan agree",
        y,
        input.agreement.conflicts.length ? PDF.red : PDF.green,
      );
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      for (const c of input.agreement.checks) {
        const tick = c.agrees ? PDF.green : PDF.red;
        doc.setTextColor(tick[0], tick[1], tick[2]);
        doc.text(c.agrees ? "+" : "x", M, y);
        doc.setTextColor(PDF.stone[0], PDF.stone[1], PDF.stone[2]);
        y = wrap(
          doc,
          `${c.name}: deed "${c.deed}" against plan "${c.plan}"`,
          M + 12,
          y,
          W - M * 2 - 12,
          {
            size: 9,
            leading: 12,
            color: PDF.stone,
          },
        );
      }
      y += 4;
      y = wrap(
        doc,
        "Agreement does not make a title genuine. Two documents prepared together will always " +
          "agree. What it rules out is a plan shown beside a deed it does not belong to.",
        M,
        y,
        W - M * 2,
        { size: 8.5, leading: 11.5, color: PDF.stone2 },
      );
    }

    if (input.placement) {
      const pl = input.placement;
      if (y > H - 200) {
        doc.addPage();
        doc.setFillColor(PDF.ivory[0], PDF.ivory[1], PDF.ivory[2]);
        doc.rect(0, 0, W, H, "F");
        brandPage(doc, mark);
        y = 86;
      }
      y += 10;
      y = label(doc, "The plot laid over the land", y);
      y = row(
        doc,
        "Plot from the sheet",
        `${pl.widthM.toFixed(1)} x ${pl.depthM.toFixed(1)} m`,
        y,
        W,
      );
      y = row(
        doc,
        "Shape taken from",
        pl.basis === "dimensions"
          ? "both sides printed on the sheet"
          : "the printed area, proportions chosen by the user",
        y,
        W,
      );
      y = row(doc, "Turned to", `${Math.round(pl.rotationDeg)} degrees from north`, y, W);
      if (pl.fit) {
        y = row(
          doc,
          "Sitting inside the drawn boundary",
          `${Math.round(pl.fit.overlapPct)}%`,
          y,
          W,
        );
        y = row(doc, "Centres apart", `${pl.fit.centroidOffsetM.toFixed(1)} m`, y, W);
      }
      y += 4;
      y = wrap(
        doc,
        "The size is the sheet's. The position and the angle were set by hand by the person using " +
          "the app, because a mutation plan carries no coordinates and no north arrow. Nothing here " +
          "is georeferencing and nothing here is a survey. Agreement between the two outlines means " +
          "the shape drawn matches the shape the surveyor drew; it says nothing about whether " +
          "either one is on the right land." +
          (pl.fit && !pl.fit.exact
            ? " The drawn boundary has a corner that turns inward, so the overlap above is a " +
              "cautious under-estimate."
            : ""),
        M,
        y,
        W - M * 2,
        { size: 8.5, leading: 11.5, color: PDF.stone2 },
      );
    }
  }

  /* ---------------- page 4: what can be built ---------------- */
  if (local.length >= 3 && input.setbacks) {
    const env = envelopeFor(local, input.setbacks);
    doc.addPage();
    doc.setFillColor(PDF.ivory[0], PDF.ivory[1], PDF.ivory[2]);
    doc.rect(0, 0, W, H, "F");
    brandPage(doc, mark);
    y = heading(doc, "What the plot allows", 86);

    y = row(doc, "Front setback used", `${input.setbacks.frontM} m`, y, W);
    y = row(doc, "All other boundaries", `${input.setbacks.sideM} m`, y, W);
    if (env?.buildable) {
      y = row(doc, "Buildable area", describeArea(env.areaM2), y, W);
      const ext = orientedExtent(env.ring);
      if (ext) {
        y = row(
          doc,
          "Room to build in",
          `${ext.alongM.toFixed(1)} m along the longest boundary, ${ext.acrossM.toFixed(1)} m across`,
          y,
          W,
        );
      }
      const cov = groundCoveragePct(drawnArea, env.areaM2);
      if (cov != null) {
        y = row(
          doc,
          "If the whole envelope were built on",
          `${cov.toFixed(0)}% ground coverage`,
          y,
          W,
        );
      }
    } else {
      y = row(doc, "Buildable area", "none at these setbacks", y, W);
    }
    if (env && !env.exact) {
      y = wrap(
        doc,
        "This plot has a corner that turns inward, so the buildable area above is a cautious " +
          "under-estimate rather than an exact figure.",
        M,
        y + 4,
        W - M * 2,
        { size: 8.5, leading: 11.5, color: PDF.stone2 },
      );
    }

    y += 10;
    y = label(doc, "Setbacks are not law in this document", y, PDF.red);
    y = wrap(
      doc,
      "The figures above are the ones entered in the app. Setbacks change by county, by zone and " +
        "by road class. Confirm yours with the county before anyone draws anything. This page does " +
        "not check plot ratio, height, parking or services, and it is not a planning approval.",
      M,
      y,
      W - M * 2,
      { size: 9, leading: 12, color: PDF.stone },
    );

    if (input.briefText) {
      y += 14;
      y = label(doc, "The brief", y);
      doc.setFont("courier", "normal");
      doc.setFontSize(8);
      doc.setTextColor(PDF.stone[0], PDF.stone[1], PDF.stone[2]);
      for (const line of input.briefText.split("\n")) {
        if (y > H - 76) break;
        doc.text(sanitize(line), M, y);
        y += 10;
      }
    }
  }

  /* ---------------- page 5: the massing study ---------------- */
  if (input.massing && input.massing.grossM2 > 0) {
    const ms = input.massing;
    doc.addPage();
    doc.setFillColor(PDF.ivory[0], PDF.ivory[1], PDF.ivory[2]);
    doc.rect(0, 0, W, H, "F");
    brandPage(doc, mark);
    y = heading(doc, "The brief, against the ground", 86);

    y = wrap(
      doc,
      "A massing study: how much floor area this brief needs, and whether that much fits inside " +
        "the setbacks entered. It is not a design. No room is laid out, no stair is placed, " +
        "nothing is oriented, and nothing is positioned on the parcel.",
      M,
      y,
      W - M * 2,
      { size: 9, leading: 12, color: PDF.stone },
    );
    y += 10;

    y = label(doc, "Accommodation asked for", y);
    doc.setFontSize(8.5);
    for (const l of ms.schedule) {
      if (y > H - 200) break;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(PDF.stone2[0], PDF.stone2[1], PDF.stone2[2]);
      doc.text(
        sanitize(l.eachM2 != null ? `${l.count} x ${l.label} at ${l.eachM2} m2` : l.label),
        M,
        y,
      );
      doc.setFont("helvetica", "bold");
      doc.setTextColor(PDF.forest[0], PDF.forest[1], PDF.forest[2]);
      doc.text(`${Math.round(l.totalM2)} m2`, W - M, y, { align: "right" });
      y += 12;
    }

    y += 8;
    y = row(doc, "Total floor area", `${Math.round(ms.grossM2)} m2`, y, W);
    y = row(
      doc,
      "Over",
      `${ms.storeysRequested} ${ms.storeysRequested === 1 ? "floor" : "floors"}`,
      y,
      W,
    );
    y = row(doc, "Ground floor footprint", `${Math.round(ms.footprintM2)} m2`, y, W);
    if (ms.envelopeM2 != null) {
      y = row(doc, "Buildable area after setbacks", `${Math.round(ms.envelopeM2)} m2`, y, W);
    }
    if (ms.coveragePct != null) {
      y = row(doc, "Ground coverage", `${ms.coveragePct.toFixed(0)}% of the plot`, y, W);
    }
    if (ms.fitsByArea != null) {
      y = row(
        doc,
        "Fits by area",
        ms.fitsByArea
          ? "yes"
          : ms.storeysNeeded
            ? `no — needs ${ms.storeysNeeded} floors, or a smaller brief`
            : "no",
        y,
        W,
      );
    }
    if (ms.fitsAsRectangle != null && ms.rect) {
      y = row(
        doc,
        `A ${ms.rect.widthM.toFixed(1)} x ${ms.rect.depthM.toFixed(1)} m block`,
        ms.fitsAsRectangle ? "fits centred and square" : "does not fit centred and square",
        y,
        W,
      );
    }
    y = row(doc, "Massing height", `about ${ms.heightM.toFixed(1)} m to the top floor level`, y, W);

    y += 10;
    y = label(doc, "What this page does not do", y, PDF.red);
    for (const l of ms.limits) {
      if (y > H - 90) break;
      y = wrap(doc, `- ${l}`, M, y, W - M * 2, { size: 8.5, leading: 11, color: PDF.stone2 });
      y += 2;
    }
  }

  /* ---------------- page 6: the brief for an architect ---------------- */
  if (input.massingBriefText && input.massingBriefText.trim()) {
    doc.addPage();
    doc.setFillColor(PDF.ivory[0], PDF.ivory[1], PDF.ivory[2]);
    doc.rect(0, 0, W, H, "F");
    brandPage(doc, mark);
    y = heading(doc, "Brief for an architect", 86);
    y = wrap(
      doc,
      "Hand this page to whoever designs the building. It is the household's own brief and the " +
        "numbers it implies — a starting point for a conversation, not a specification.",
      M,
      y,
      W - M * 2,
      { size: 9, leading: 12, color: PDF.stone },
    );
    y += 8;

    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.setTextColor(PDF.stone[0], PDF.stone[1], PDF.stone[2]);
    for (const line of input.massingBriefText.split("\n")) {
      if (y > H - 76) {
        doc.addPage();
        doc.setFillColor(PDF.ivory[0], PDF.ivory[1], PDF.ivory[2]);
        doc.rect(0, 0, W, H, "F");
        brandPage(doc, mark);
        doc.setFont("courier", "normal");
        doc.setFontSize(8);
        doc.setTextColor(PDF.stone[0], PDF.stone[1], PDF.stone[2]);
        y = 86;
      }
      doc.text(sanitize(line), M, y);
      y += 10;
    }
  }

  brandFooters(doc, mark, {
    note: "A record of what the user established. Not a title search, survey or valuation.",
    issued,
  });

  const slug =
    (input.reference || input.matchedAddress || "parcel")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "parcel";
  const filename = `halisia-parcel-report-${slug}.pdf`;
  deliverPdf(doc, filename);
  return filename;
}
