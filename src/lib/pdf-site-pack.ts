/**
 * "Site pack" PDF for the 3D house-on-site view: rendered views, a measured
 * floor plan drawn as vectors, the foundation suggestion, and the cost read
 * from the cost database (or an honest note when there is none).
 *
 * Schematic massing only. Not an architectural drawing, survey, structural
 * design or quote.
 */
import jsPDF from "jspdf";
import { brandFooters, brandPage, getMarkSync, sanitize, PDF, type RGB } from "@/lib/pdf-chrome";
import { deliverPdf } from "@/lib/pdf-delivery";
import type { PlanRect, PlanRoom } from "@/components/halisia/model-lab/site/site-house";
import type { FoundationPlan } from "@/components/halisia/model-lab/site/foundation";
import { addDrawingSet, type DrawingSetInput } from "@/lib/pdf-architectural-drawings";

export type SitePackView = { label: string; dataUrl: string; widthPx: number; heightPx: number };

export type SitePackInput = {
  title: string;
  /** e.g. "-1.583568, 36.918865" or null when no point was given. */
  place: string | null;
  views: SitePackView[];
  house: {
    lengthM: number;
    widthM: number;
    heightM: number;
    floorAreaM2: number;
    levels: number;
    units: number;
    bedrooms: number;
    rooms: PlanRoom[];
    outlines: PlanRect[];
  };
  foundation: FoundationPlan;
  /** One line on where the ground reading came from. */
  ground: string;
  cost: { headline: string; detail: string[] };
  /** The client's design inspiration, when they gave one. */
  inspiration?: { lines: string[]; notes: string[]; thumb: string | null } | null;
  notes: string[];
  /** The full drawing set (plans, elevations, sections, roof, foundation, schedules). */
  drawings?: Omit<DrawingSetInput, "title" | "place" | "issued"> | null;
};

const m2 = (v: number) => `${v.toFixed(1)} m²`;
const m = (v: number) => `${v.toFixed(2)} m`;

export function buildSitePackPdf(o: SitePackInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const mark = getMarkSync();
  brandPage(doc, mark);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const bottom = H - 60;
  let y = M;

  const newPage = () => {
    doc.addPage();
    brandPage(doc, mark);
    y = M;
  };
  const ensure = (h: number) => {
    if (y + h > bottom) newPage();
  };
  const t = (s: string, size = 9, bold = false, color: RGB = PDF.forest) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(sanitize(s), W - 2 * M) as string[];
    ensure(lines.length * size * 1.3);
    doc.text(lines, M, y + size);
    y += lines.length * size * 1.3;
  };
  const gap = (h = 8) => {
    y += h;
  };
  const image = (v: SitePackView, maxH: number) => {
    const w = W - 2 * M;
    const h = Math.min(maxH, (w * v.heightPx) / Math.max(1, v.widthPx));
    const iw = (h * v.widthPx) / Math.max(1, v.heightPx);
    ensure(h + 20);
    doc.addImage(v.dataUrl, "JPEG", M + (w - iw) / 2, y, iw, h, undefined, "FAST");
    y += h + 4;
    t(v.label, 8, false, PDF.stone2);
  };

  // ---- Page 1: what it is, the hero view, the key numbers.
  t("HALISIA SITE PACK  ·  HOUSE ON THIS GROUND", 9, true, PDF.green);
  t(o.title, 18, true);
  t(
    `${o.place ? `Point ${o.place}  |  ` : ""}Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
    8.5,
    false,
    PDF.stone2,
  );
  t(
    "Schematic massing on a coarse public elevation grid. Not an architectural drawing, survey, structural design, valuation or quote.",
    8.5,
    true,
    PDF.red,
  );
  gap(6);
  if (o.views[0]) image(o.views[0], 300);
  gap(4);
  t("Key measurements", 12, true);
  const h = o.house;
  const facts = [
    `Footprint: ${m(h.lengthM)} × ${m(h.widthM)} (${m2(h.lengthM * h.widthM)} of ground covered)`,
    `Floor area: about ${m2(h.floorAreaM2)}${h.levels > 1 ? ` over ${h.levels} levels` : ", single level"}`,
    `Height to the top: about ${m(h.heightM)} above floor level`,
    h.units ? `Container units: ${h.units}` : null,
    `Bedrooms: ${h.bedrooms || "none (open-plan bedsitter)"}`,
  ].filter((x): x is string => !!x);
  facts.forEach((f) => t(`·  ${f}`, 9.5));

  // ---- Page 2: the measured plan and room schedule.
  newPage();
  t("Floor plan with measurements", 14, true);
  t(
    "North is up. Dimensions in metres, outside faces of the walls. Room sizes are inside measurements.",
    8.5,
    false,
    PDF.stone2,
  );
  gap(6);
  const levels = [...new Set(h.outlines.map((r) => r.level))].sort();
  for (const level of levels) {
    drawPlan(
      doc,
      h.outlines.filter((r) => r.level === level),
      h.rooms.filter((r) => r.level === level),
      levels.length > 1 ? (level === 0 ? "Ground level" : "Upper level") : null,
    );
  }

  // ---- Page 3: other views, foundation, cost, notes.
  newPage();
  for (const v of o.views.slice(1)) {
    image(v, 250);
    gap(6);
  }
  t("Suggested foundation", 13, true);
  t(o.foundation.name, 11, true, PDF.goldInk);
  t(o.foundation.summary, 9);
  t(o.foundation.why, 9);
  t(
    `Finished floor about ${Math.round(o.foundation.clearanceM * 1000)} mm above the highest ground under the house.`,
    9,
  );
  o.foundation.checks.forEach((c) => t(`!  ${c}`, 8.5, false, PDF.stone2));
  t(o.ground, 8, false, PDF.stone2);
  gap(8);
  if (o.inspiration) {
    t("Design inspiration", 13, true);
    if (o.inspiration.thumb) {
      ensure(80);
      try {
        doc.addImage(o.inspiration.thumb, "JPEG", M, y + 2, 96, 72, undefined, "FAST");
        y += 80;
      } catch {
        /* a thumbnail that will not decode is skipped */
      }
    }
    o.inspiration.lines.forEach((l) => t(`·  ${l}`, 9));
    o.inspiration.notes.forEach((n) => t(`-  ${n}`, 8.5, false, PDF.stone2));
    t(
      "Inspired by the client's pictures; not a copy of that building or an architect's drawing.",
      8,
      false,
      PDF.stone2,
    );
    gap(8);
  }
  t("Construction cost", 13, true);
  t(o.cost.headline, 10.5, true);
  o.cost.detail.forEach((d) => t(`·  ${d}`, 8.5, false, PDF.stone2));
  gap(8);
  t("Before you build", 13, true);
  o.notes.forEach((n) => t(`·  ${n}`, 8.5));

  // The plan pages flow on their own; drawPlan moves the cursor itself.
  function drawPlan(d: jsPDF, outlines: PlanRect[], rooms: PlanRoom[], heading: string | null) {
    if (!outlines.length) return;
    const minX = Math.min(...outlines.map((r) => r.x0), ...rooms.map((r) => r.x0));
    const maxX = Math.max(...outlines.map((r) => r.x1), ...rooms.map((r) => r.x1));
    const minZ = Math.min(...outlines.map((r) => r.z0), ...rooms.map((r) => r.z0));
    const maxZ = Math.max(...outlines.map((r) => r.z1), ...rooms.map((r) => r.z1));
    const spanX = Math.max(0.1, maxX - minX);
    const spanZ = Math.max(0.1, maxZ - minZ);
    const availW = W - 2 * M - 50;
    const availH = Math.min(330, bottom - M - 60);
    const k = Math.min(availW / spanX, availH / spanZ);
    const ph = spanZ * k;
    ensure(ph + 70);
    if (heading) t(heading, 11, true);
    const ox = M + 40 + (availW - spanX * k) / 2;
    const oy = y + 24;
    const X = (x: number) => ox + (x - minX) * k;
    const Y = (z: number) => oy + (z - minZ) * k;

    // Rooms: light fill, thin lines, names and sizes.
    d.setLineWidth(0.5);
    for (const r of rooms) {
      d.setFillColor(PDF.paper[0], PDF.paper[1], PDF.paper[2]);
      d.setDrawColor(PDF.stone2[0], PDF.stone2[1], PDF.stone2[2]);
      d.rect(X(r.x0), Y(r.z0), (r.x1 - r.x0) * k, (r.z1 - r.z0) * k, "FD");
      const cw = (r.x1 - r.x0) * k;
      const chh = (r.z1 - r.z0) * k;
      const cx = X(r.x0) + cw / 2;
      const cy = Y(r.z0) + chh / 2;
      d.setTextColor(PDF.forest[0], PDF.forest[1], PDF.forest[2]);
      d.setFont("helvetica", "bold");
      const size = Math.max(5, Math.min(8, cw / 9));
      d.setFontSize(size);
      if (cw > 34 && chh > 18) {
        const label = d.splitTextToSize(sanitize(r.name), cw - 4) as string[];
        d.text(label, cx, cy - size * 0.4, { align: "center" });
        d.setFont("helvetica", "normal");
        d.setFontSize(Math.max(4.5, size - 1));
        d.text(
          sanitize(`${(r.x1 - r.x0).toFixed(1)} × ${(r.z1 - r.z0).toFixed(1)} m`),
          cx,
          cy + size * (label.length > 1 ? 1.4 : 0.9),
          { align: "center" },
        );
      }
    }
    // External walls / unit outlines, heavy.
    d.setLineWidth(2);
    d.setDrawColor(PDF.forest[0], PDF.forest[1], PDF.forest[2]);
    for (const r of outlines) d.rect(X(r.x0), Y(r.z0), (r.x1 - r.x0) * k, (r.z1 - r.z0) * k, "S");

    // Overall dimension lines.
    d.setLineWidth(0.6);
    d.setDrawColor(PDF.goldInk[0], PDF.goldInk[1], PDF.goldInk[2]);
    d.setTextColor(PDF.goldInk[0], PDF.goldInk[1], PDF.goldInk[2]);
    d.setFont("helvetica", "bold");
    d.setFontSize(8);
    const ty = Y(minZ) - 12;
    d.line(X(minX), ty, X(maxX), ty);
    d.line(X(minX), ty - 4, X(minX), ty + 4);
    d.line(X(maxX), ty - 4, X(maxX), ty + 4);
    d.text(sanitize(m(spanX)), (X(minX) + X(maxX)) / 2, ty - 4, { align: "center" });
    const lx = X(minX) - 14;
    d.line(lx, Y(minZ), lx, Y(maxZ));
    d.line(lx - 4, Y(minZ), lx + 4, Y(minZ));
    d.line(lx - 4, Y(maxZ), lx + 4, Y(maxZ));
    d.text(sanitize(m(spanZ)), lx - 4, (Y(minZ) + Y(maxZ)) / 2, { align: "center", angle: 90 });
    // North arrow.
    const nx = W - M - 10;
    const ny = oy + 4;
    d.setFillColor(PDF.forest[0], PDF.forest[1], PDF.forest[2]);
    d.triangle(nx, ny, nx - 5, ny + 12, nx + 5, ny + 12, "F");
    d.setTextColor(PDF.forest[0], PDF.forest[1], PDF.forest[2]);
    d.text("N", nx, ny + 22, { align: "center" });

    y = oy + ph + 18;
    // Room schedule under the plan.
    d.setFont("helvetica", "normal");
    const list = rooms
      .filter((r) => r.name !== "Outside stair")
      .map(
        (r) =>
          `${r.name}: ${(r.x1 - r.x0).toFixed(1)} × ${(r.z1 - r.z0).toFixed(1)} m (${((r.x1 - r.x0) * (r.z1 - r.z0)).toFixed(1)} m²)`,
      );
    t(list.join("   ·   "), 7.5, false, PDF.stone);
    gap(10);
  }

  if (o.drawings) {
    newPage();
    t("Architectural drawing set", 14, true);
    t(
      "The next sheets are drawn from this house exactly as it stands in the 3D view, at true scale on A4 landscape: floor plan (A-01), four elevations (A-02), two sections with the construction build-up (A-03), roof plan and truss (S-01), foundation plan and footing detail (S-02), and the door, window, room and finishes schedules (A-04).",
      9,
    );
    t(
      "Footing, slab, beam and roof-member sizes are typical Kenyan practice for budgeting and discussion. They are not an engineer's design: an architect and a structural engineer must design, sign and obtain approval before building.",
      8.5,
      true,
      PDF.red,
    );
    addDrawingSet(doc, {
      ...o.drawings,
      title: o.title,
      place: o.place,
      issued: new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    });
  }

  brandFooters(doc, mark, {
    note: "Schematic massing. Confirm with an architect, engineer and quantity surveyor.",
  });
  return doc;
}

export function downloadSitePackPdf(o: SitePackInput): string {
  const doc = buildSitePackPdf(o);
  const name = `halisia-site-pack-${o.title
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()
    .replace(/^-|-$/g, "")
    .slice(0, 48)}.pdf`;
  deliverPdf(doc, name);
  return name;
}
