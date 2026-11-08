/**
 * Architectural drawing set for the 3D house on the site: floor plan,
 * four elevations, two sections, roof plan with a truss detail, foundation
 * plan with footing details, and schedules.
 *
 * Every line is drawn from the house as it is built in the 3D view (walls,
 * doors, windows, rooms, roof form and pitch), at a true printed scale on A4
 * landscape. Construction sizes (footings, slab, ring beam, truss members)
 * are typical Kenyan practice for a single-storey house, given so the client
 * can discuss and budget. They are not an engineer's design, and every sheet
 * says so: a dimensioned drawing looks authoritative, so the limit has to be
 * on the drawing itself, not in a separate note.
 */
import type jsPDF from "jspdf";
import { PDF, sanitize, type RGB } from "@/lib/pdf-chrome";
import type {
  DrawnWall,
  HouseDrawing,
  PlanRect,
  PlanRoom,
} from "@/components/halisia/model-lab/site/site-house";
import type { FoundationPlan } from "@/components/halisia/model-lab/site/foundation";
import type { SiteStructure } from "@/components/halisia/model-lab/site/site-params";
import {
  CEILING_LABEL,
  FLOOR_LABEL,
  ROOF_LABEL,
  WALL_LABEL,
  roofCoverKind,
  type DesignStyle,
} from "@/components/halisia/model-lab/site/design-style";

/* ------------------------------------------------------------------ input */

export type DrawingSetInput = {
  title: string;
  place: string | null;
  structure: SiteStructure;
  lengthM: number;
  widthM: number;
  heightM: number;
  levels: number;
  units: number;
  rooms: PlanRoom[];
  outlines: PlanRect[];
  drawing?: HouseDrawing;
  style: DesignStyle;
  foundation: FoundationPlan;
  /** Ground fall under the footprint, metres (null when unknown). */
  dropM: number | null;
  /** Issue date, e.g. "8 Nov 2026". */
  issued: string;
};

/* --------------------------------------------------------------- numbers */

/** Points per metre at 1:s on paper. */
export const ptPerM = (s: number) => (1000 / s) * (72 / 25.4);

/** Standard architectural scales, largest first. */
export const SCALES = [20, 25, 50, 75, 100, 125, 150, 200, 250] as const;

/** The largest standard scale at which a span of w × h metres fits in a box of bw × bh points. */
export function pickScale(wM: number, hM: number, bw: number, bh: number): number {
  for (const s of SCALES) {
    const k = ptPerM(s);
    if (wM * k <= bw && hM * k <= bh) return s;
  }
  return 500;
}

/** Typical construction sizes (metres) used across the set. */
export const TYPICAL = {
  footingW: 0.6,
  footingInnerW: 0.45,
  footingT: 0.2,
  footingDepth: 1.0,
  hardcore: 0.23,
  blinding: 0.05,
  slab: 0.1,
  screed: 0.03,
  ringBeam: 0.2,
  lintel: 0.2,
  wallPlate: 0.05,
  tieBeam: 0.15,
  rafter: 0.15,
  purlin: 0.05,
  parapet: 0.65,
  roofSlab: 0.15,
};

/** Truss spacing on centres: closer under tiles (heavier), wider under iron sheet. */
export function trussSpacingM(cover: "flat" | "tiles" | "sheet"): number {
  return cover === "tiles" ? 0.9 : 1.2;
}

/** A Fink (W) truss above a 6.5 m clear span, a king-post truss below it. */
export function trussType(spanM: number): "fink" | "kingpost" {
  return spanM > 6.5 ? "fink" : "kingpost";
}

/** Positions of trusses along a run of `lengthM`, starting and ending on the walls. */
export function trussPositions(lengthM: number, spacingM: number): number[] {
  const n = Math.max(1, Math.ceil(lengthM / spacingM));
  return Array.from({ length: n + 1 }, (_, i) => (lengthM * i) / n);
}

type Op = { at: number; width: number; bottom: number; top: number; glass: boolean };

export type ScheduleItem = {
  mark: string;
  kind: "door" | "window" | "opening";
  width: number;
  height: number;
  sill: number;
  count: number;
  /** In an outside wall (security doors, burglar bars). */
  outside: boolean;
};

/** Door and window types grouped by size, marked D1, D2… and W1, W2…. */
export function openingSchedule(walls: DrawnWall[]): ScheduleItem[] {
  const groups = new Map<string, Omit<ScheduleItem, "mark">>();
  for (const w of walls)
    for (const o of w.openings) {
      const kind = openingKind(w, o);
      const width = Math.round(o.width * 20) / 20;
      const height = Math.round((o.top - Math.max(0, o.bottom)) * 20) / 20;
      const sill = kind === "window" ? Math.round(o.bottom * 20) / 20 : 0;
      const outside = w.exterior;
      const key = `${kind}|${width}|${height}|${sill}|${outside}`;
      const g = groups.get(key);
      if (g) g.count++;
      else groups.set(key, { kind, width, height, sill, count: 1, outside });
    }
  const list = [...groups.values()].sort(
    (a, b) =>
      a.kind.localeCompare(b.kind) ||
      Number(b.outside) - Number(a.outside) ||
      b.width - a.width ||
      b.height - a.height,
  );
  const n = { door: 0, window: 0, opening: 0 };
  return list.map((g) => {
    n[g.kind]++;
    const p = g.kind === "door" ? "D" : g.kind === "window" ? "W" : "O";
    return { ...g, mark: `${p}${n[g.kind]}` };
  });
}

function openingKind(w: DrawnWall, o: Op): ScheduleItem["kind"] {
  if (o.glass) return "window";
  // A wide gap in an inside wall is an open archway, not a door.
  if (!w.exterior && o.width > 1.45) return "opening";
  return "door";
}

/* ----------------------------------------------------------------- sheet */

const PW = 841.89;
const PH = 595.28;
const FM = 22; // frame margin
const TB_W = 168; // title block width
const DRAW = { x: FM + 10, y: FM + 26, w: PW - 2 * FM - TB_W - 20, h: PH - 2 * FM - 70 };

type Ctx = { doc: jsPDF; o: DrawingSetInput; sheet: number; total: number };

const col = (doc: jsPDF, c: RGB) => {
  doc.setDrawColor(c[0], c[1], c[2]);
  doc.setTextColor(c[0], c[1], c[2]);
};
const INK: RGB = [24, 28, 26];
const GREY: RGB = [120, 126, 122];
const POCHE: RGB = [70, 76, 72];
const POCHE_IN: RGB = [150, 156, 150];
const HATCH: RGB = [150, 150, 140];

function text(
  doc: jsPDF,
  s: string,
  x: number,
  y: number,
  size = 7,
  bold = false,
  opts: Record<string, unknown> = {},
) {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.text(sanitize(s), x, y, opts);
}

function newSheet(c: Ctx, no: string, title: string, scales: string) {
  const { doc, o } = c;
  doc.addPage("a4", "landscape");
  c.sheet++;
  col(doc, INK);
  doc.setLineWidth(1);
  doc.rect(FM, FM, PW - 2 * FM, PH - 2 * FM - 22);
  // Title block down the right.
  const tx = PW - FM - TB_W;
  const ty = FM;
  const th = PH - 2 * FM - 22;
  doc.setLineWidth(0.6);
  doc.line(tx, ty, tx, ty + th);
  let y = ty + 16;
  doc.setTextColor(PDF.green[0], PDF.green[1], PDF.green[2]);
  text(doc, "HALISIA.AI", tx + 10, y, 9, true);
  y += 11;
  col(doc, GREY);
  text(doc, "Architectural drawing set", tx + 10, y, 7);
  y += 18;
  col(doc, INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  const proj = doc.splitTextToSize(sanitize(o.title), TB_W - 20) as string[];
  text(doc, proj.slice(0, 3).join("\n"), tx + 10, y, 8.5, true);
  y += 11 * Math.min(3, proj.length) + 2;
  if (o.place) {
    col(doc, GREY);
    text(doc, `Point ${o.place}`, tx + 10, y, 6.5);
    y += 12;
  }
  const row = (label: string, value: string, big = false) => {
    doc.setDrawColor(200, 200, 194);
    doc.setLineWidth(0.4);
    doc.line(tx, y - 8, tx + TB_W, y - 8);
    col(doc, GREY);
    text(doc, label.toUpperCase(), tx + 10, y, 5.5, true);
    col(doc, INK);
    const size = big ? 11 : 6.8;
    doc.setFont("helvetica", big ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(sanitize(value), TB_W - 20) as string[];
    text(doc, lines.join("\n"), tx + 10, y + size + 3, size, big);
    y += size + 15 + (lines.length - 1) * size * 1.15;
  };
  y += 6;
  row("Drawing", title);
  row("Sheet", `${no}   (${c.sheet} of ${c.total})`, true);
  row("Scale at A4", scales);
  row("Issued", o.issued);
  row("Units", "Metres, unless marked mm. Do not scale off the paper; use the figures.");
  // The limit, on every sheet.
  const by = ty + th - 128;
  doc.setFillColor(253, 236, 234);
  doc.setDrawColor(PDF.red[0], PDF.red[1], PDF.red[2]);
  doc.setLineWidth(0.8);
  doc.rect(tx + 8, by, TB_W - 16, 70, "FD");
  doc.setTextColor(PDF.red[0], PDF.red[1], PDF.red[2]);
  text(doc, "INDICATIVE - NOT FOR CONSTRUCTION", tx + 14, by + 12, 6.5, true);
  doc.setTextColor(PDF.stone[0], PDF.stone[1], PDF.stone[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.6);
  const warn = doc.splitTextToSize(
    sanitize(
      "Drawn from the HALISIA 3D massing. Sizes of footings, slab, beams and roof members are typical practice for budgeting. A registered architect and structural engineer must design, sign and obtain county approval before work starts.",
    ),
    TB_W - 28,
  ) as string[];
  text(doc, warn.join("\n"), tx + 14, by + 22, 5.6);
  // Sign-off boxes.
  const sy = ty + th - 52;
  doc.setDrawColor(GREY[0], GREY[1], GREY[2]);
  doc.setLineWidth(0.4);
  const half = (TB_W - 16) / 2;
  for (const [i, who] of ["Architect (BORAQS)", "Engineer (EBK)"].entries()) {
    doc.rect(tx + 8 + i * half, sy, half, 44);
    col(doc, GREY);
    text(doc, who, tx + 12 + i * half, sy + 8, 5.2, true);
    text(doc, "Name, reg. no., sign", tx + 12 + i * half, sy + 40, 4.8);
  }
  // Sheet heading over the drawing area.
  col(doc, INK);
  text(doc, title.toUpperCase(), FM + 10, FM + 16, 10, true);
}

/** A labelled drawing title under a view: "1  FLOOR PLAN   1:100". */
function viewTitle(
  doc: jsPDF,
  n: string,
  label: string,
  scale: number | string,
  x: number,
  y: number,
): number {
  col(doc, INK);
  doc.setLineWidth(0.8);
  doc.circle(x + 6, y - 2.5, 6, "S");
  text(doc, n, x + 6, y, 7, true, { align: "center" });
  text(doc, label.toUpperCase(), x + 16, y, 8, true);
  const w = doc.getTextWidth(sanitize(label.toUpperCase()));
  doc.setLineWidth(0.5);
  doc.line(x + 16, y + 2.5, x + 16 + w, y + 2.5);
  col(doc, GREY);
  const sl = typeof scale === "number" ? `1:${scale}` : scale;
  text(doc, sl, x + 22 + w, y, 7);
  return x + 22 + w + doc.getTextWidth(sanitize(sl));
}

function scaleBar(doc: jsPDF, s: number, x: number, y: number) {
  const k = ptPerM(s);
  const step = s <= 25 ? 0.25 : s <= 75 ? 1 : 2;
  const n = 4;
  col(doc, INK);
  doc.setLineWidth(0.4);
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) doc.setFillColor(INK[0], INK[1], INK[2]);
    else doc.setFillColor(255, 255, 255);
    doc.rect(x + i * step * k, y, step * k, 3, "FD");
  }
  for (let i = 0; i <= n; i++)
    text(doc, `${+(i * step).toFixed(2)}`, x + i * step * k, y + 9, 5, false, { align: "center" });
  text(doc, "m", x + n * step * k + 6, y + 9, 5);
}

function northArrow(doc: jsPDF, x: number, y: number) {
  col(doc, INK);
  doc.setLineWidth(0.6);
  doc.circle(x, y, 10, "S");
  doc.setFillColor(INK[0], INK[1], INK[2]);
  doc.triangle(x, y - 9, x - 4, y + 6, x, y + 3, "F");
  doc.triangle(x, y - 9, x + 4, y + 6, x, y + 3, "S");
  text(doc, "N", x, y - 13, 7, true, { align: "center" });
}

/** Architectural dimension chain: extension lines, 45° ticks, figures in mm. */
function dimChain(
  doc: jsPDF,
  pts: number[],
  fixed: number,
  horizontal: boolean,
  values: number[],
  extFrom?: number,
) {
  col(doc, INK);
  doc.setLineWidth(0.35);
  const a = pts[0];
  const b = pts[pts.length - 1];
  if (horizontal) doc.line(a - 3, fixed, b + 3, fixed);
  else doc.line(fixed, a - 3, fixed, b + 3);
  pts.forEach((p) => {
    if (horizontal) {
      doc.line(p - 2, fixed + 2, p + 2, fixed - 2);
      if (extFrom != null) doc.line(p, extFrom, p, fixed + (extFrom > fixed ? 3 : -3));
    } else {
      doc.line(fixed - 2, p + 2, fixed + 2, p - 2);
      if (extFrom != null) doc.line(extFrom, p, fixed + (extFrom > fixed ? 3 : -3), p);
    }
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.6);
  for (let i = 0; i < values.length; i++) {
    const span = Math.abs(pts[i + 1] - pts[i]);
    const label = String(Math.round(values[i] * 1000));
    if (span < doc.getTextWidth(label) + 2) continue;
    const mid = (pts[i] + pts[i + 1]) / 2;
    if (horizontal) doc.text(label, mid, fixed - 2, { align: "center" });
    else doc.text(label, fixed - 2, mid, { align: "center", angle: 90 });
  }
}

/** A level marker: open triangle on a line, label to the right. */
function levelMark(doc: jsPDF, x: number, y: number, label: string, value: number, below = false) {
  col(doc, INK);
  doc.setLineWidth(0.4);
  doc.line(x - 8, y, x + 26, y);
  if (below) doc.triangle(x, y, x - 3.5, y + 5, x + 3.5, y + 5, "S");
  else doc.triangle(x, y, x - 3.5, y - 5, x + 3.5, y - 5, "S");
  const v =
    Math.abs(value) < 0.0005 ? "±0.000" : `${value > 0 ? "+" : "-"}${Math.abs(value).toFixed(3)}`;
  text(doc, `${v}  ${label}`, x + 6, below ? y + 6.5 : y - 2, 5.6, true);
}

/** Diagonal hatch inside a rectangle (page points). */
function hatch(doc: jsPDF, x: number, y: number, w: number, h: number, gap = 3, c: RGB = HATCH) {
  doc.setDrawColor(c[0], c[1], c[2]);
  doc.setLineWidth(0.25);
  for (let d = gap; d < w + h; d += gap) {
    // Line x + y = const, clipped to the box.
    const x0 = x + Math.max(0, d - h);
    const y0 = y + Math.min(h, d);
    const x1 = x + Math.min(w, d);
    const y1 = y + Math.max(0, d - w);
    doc.line(x0, y0, x1, y1);
  }
}

/** Stipple for hardcore and earth. */
function stipple(doc: jsPDF, x: number, y: number, w: number, h: number, density = 0.05) {
  doc.setFillColor(HATCH[0], HATCH[1], HATCH[2]);
  let seed = Math.floor(x * 7 + y * 13 + w);
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const n = Math.min(900, Math.floor(w * h * density));
  for (let i = 0; i < n; i++) doc.circle(x + rnd() * w, y + rnd() * h, 0.35 + rnd() * 0.5, "F");
}

/** Ground: a heavy line with earth hatching below. */
function groundLine(doc: jsPDF, x0: number, x1: number, y: number, depth = 10) {
  col(doc, INK);
  doc.setLineWidth(1.2);
  doc.line(x0, y, x1, y);
  doc.setDrawColor(HATCH[0], HATCH[1], HATCH[2]);
  doc.setLineWidth(0.3);
  for (let x = x0; x < x1 - 4; x += 5) doc.line(x, y + depth, x + 4, y + 1);
}

function polyline(
  doc: jsPDF,
  pts: Array<[number, number]>,
  closed = false,
  style: "S" | "F" | "FD" = "S",
) {
  if (pts.length < 2) return;
  const d: number[][] = [];
  for (let i = 1; i < pts.length; i++)
    d.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
  doc.lines(d, pts[0][0], pts[0][1], [1, 1], style, closed);
}

function arc(doc: jsPDF, cx: number, cy: number, r: number, a0: number, a1: number) {
  const pts: Array<[number, number]> = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  polyline(doc, pts);
}

/** Numbered callout bubble with a leader. */
function callout(doc: jsPDF, n: number, x: number, y: number, tx: number, ty: number) {
  col(doc, PDF.goldInk);
  doc.setLineWidth(0.35);
  doc.line(x, y, tx, ty);
  doc.setFillColor(255, 255, 255);
  doc.circle(tx, ty, 4.2, "FD");
  text(doc, String(n), tx, ty + 1.9, 5.4, true, { align: "center" });
  doc.setFillColor(PDF.goldInk[0], PDF.goldInk[1], PDF.goldInk[2]);
  doc.circle(x, y, 0.9, "F");
}

function keyList(doc: jsPDF, items: string[], x: number, y: number, w: number, size = 5.8): number {
  let yy = y;
  items.forEach((it, i) => {
    col(doc, PDF.goldInk);
    text(doc, `${i + 1}`, x, yy, size, true);
    col(doc, INK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(sanitize(it), w - 12) as string[];
    text(doc, lines.join("\n"), x + 10, yy, size);
    yy += lines.length * size * 1.25 + 2;
  });
  return yy;
}

/* -------------------------------------------------------------- geometry */

type Model = {
  L: number;
  W: number;
  walls: DrawnWall[];
  H: number;
  floor: number;
  roof: HouseDrawing["roof"];
  cover: "flat" | "tiles" | "sheet";
  /** Datum offset: ground (±0.000) sits this far below the underside of the slab... negative means above. */
  plinth: number;
  masonry: boolean;
  levelH: number;
};

/** Walls for a container house (no recorded walls): the unit outlines, thin. */
function containerWalls(outlines: PlanRect[]): DrawnWall[] {
  const out: DrawnWall[] = [];
  for (const r of outlines.filter((q) => q.level === 0)) {
    const t = 0.05;
    out.push(
      { axis: "x", at: r.z0 + t / 2, from: r.x0, to: r.x1, thick: t, exterior: true, openings: [] },
      { axis: "x", at: r.z1 - t / 2, from: r.x0, to: r.x1, thick: t, exterior: true, openings: [] },
      {
        axis: "z",
        at: r.x0 + t / 2,
        from: r.z0 + t,
        to: r.z1 - t,
        thick: t,
        exterior: true,
        openings: [],
      },
      {
        axis: "z",
        at: r.x1 - t / 2,
        from: r.z0 + t,
        to: r.z1 - t,
        thick: t,
        exterior: true,
        openings: [],
      },
    );
  }
  return out;
}

function model(o: DrawingSetInput): Model {
  const masonry = !!o.drawing;
  const levelH = masonry ? o.drawing!.wallHeightM : o.heightM / Math.max(1, o.levels);
  return {
    L: o.lengthM,
    W: o.widthM,
    walls: o.drawing?.walls ?? containerWalls(o.outlines),
    H: o.drawing?.wallHeightM ?? o.heightM,
    floor: o.drawing?.floorM ?? 0,
    roof: o.drawing?.roof ?? { form: "flat", pitchDeg: 0, eaveM: 0, riseM: 0 },
    cover: masonry ? roofCoverKind(o.style) : "sheet",
    plinth: masonry
      ? Math.max(0, o.foundation.clearanceM - (o.drawing?.floorM ?? 0))
      : o.foundation.clearanceM,
    masonry,
    levelH,
  };
}

/* ------------------------------------------------------------------ plan */

function sheetPlan(c: Ctx, m: Model) {
  const { doc, o } = c;
  const margin = 3.2; // metres around the house for dimensions and grids
  const s = pickScale(m.L + 2 * margin, m.W + 2 * margin, DRAW.w, DRAW.h - 20);
  newSheet(c, "A-01", "Ground floor plan", `1:${s}`);
  const k = ptPerM(s);
  const minX = Math.min(-m.L / 2, ...o.outlines.map((r) => r.x0));
  const maxX = Math.max(m.L / 2, ...o.outlines.map((r) => r.x1));
  const minZ = Math.min(-m.W / 2, ...o.outlines.map((r) => r.z0));
  const maxZ = Math.max(m.W / 2, ...o.outlines.map((r) => r.z1));
  const ox = DRAW.x + (DRAW.w - (maxX - minX) * k) / 2;
  const oy = DRAW.y + 10 + (DRAW.h - 30 - (maxZ - minZ) * k) / 2;
  const X = (x: number) => ox + (x - minX) * k;
  const Y = (z: number) => oy + (z - minZ) * k;
  const ground = (r: PlanRect) => r.level === 0;

  // Room fills and labels.
  const sched = openingSchedule(m.walls);
  for (const r of o.rooms.filter(ground)) {
    doc.setFillColor(252, 250, 244);
    doc.rect(X(r.x0), Y(r.z0), (r.x1 - r.x0) * k, (r.z1 - r.z0) * k, "F");
  }
  // Walls: solid between openings.
  for (const w of m.walls) {
    const segs: Array<[number, number]> = [];
    let cur = w.from;
    for (const op of [...w.openings].sort((a, b) => a.at - b.at)) {
      const a = op.at - op.width / 2;
      const b = op.at + op.width / 2;
      if (a > cur) segs.push([cur, a]);
      cur = Math.max(cur, b);
    }
    if (cur < w.to) segs.push([cur, w.to]);
    const fillC = w.exterior ? POCHE : POCHE_IN;
    doc.setFillColor(fillC[0], fillC[1], fillC[2]);
    doc.setDrawColor(INK[0], INK[1], INK[2]);
    doc.setLineWidth(0.5);
    for (const [a, b] of segs) {
      if (w.axis === "x") doc.rect(X(a), Y(w.at - w.thick / 2), (b - a) * k, w.thick * k, "FD");
      else doc.rect(X(w.at - w.thick / 2), Y(a), w.thick * k, (b - a) * k, "FD");
    }
    // Openings.
    for (const op of w.openings) {
      const kind = openingKind(w, op);
      const a = op.at - op.width / 2;
      const b = op.at + op.width / 2;
      const t = w.thick;
      const mark = sched.find(
        (q) =>
          q.kind === kind &&
          q.outside === w.exterior &&
          Math.abs(q.width - Math.round(op.width * 20) / 20) < 0.01 &&
          Math.abs(q.height - Math.round((op.top - Math.max(0, op.bottom)) * 20) / 20) < 0.01,
      )?.mark;
      col(doc, INK);
      if (kind === "window") {
        doc.setLineWidth(0.3);
        for (const f of [-0.5, -0.12, 0.12, 0.5]) {
          if (w.axis === "x") doc.line(X(a), Y(w.at + f * t), X(b), Y(w.at + f * t));
          else doc.line(X(w.at + f * t), Y(a), X(w.at + f * t), Y(b));
        }
        if (w.axis === "x") {
          doc.line(X(a), Y(w.at - t / 2), X(a), Y(w.at + t / 2));
          doc.line(X(b), Y(w.at - t / 2), X(b), Y(w.at + t / 2));
        } else {
          doc.line(X(w.at - t / 2), Y(a), X(w.at + t / 2), Y(a));
          doc.line(X(w.at - t / 2), Y(b), X(w.at + t / 2), Y(b));
        }
      } else if (kind === "opening") {
        doc.setLineDashPattern([2, 1.5], 0);
        doc.setLineWidth(0.3);
        if (w.axis === "x") {
          doc.line(X(a), Y(w.at - t / 2), X(b), Y(w.at - t / 2));
          doc.line(X(a), Y(w.at + t / 2), X(b), Y(w.at + t / 2));
        } else {
          doc.line(X(w.at - t / 2), Y(a), X(w.at - t / 2), Y(b));
          doc.line(X(w.at + t / 2), Y(a), X(w.at + t / 2), Y(b));
        }
        doc.setLineDashPattern([], 0);
      } else {
        // Door leaf and swing, opening inwards (towards the house centre for
        // outside doors, away from the corridor for inside doors).
        const sign = w.exterior ? (w.at > 0 ? -1 : 1) : w.at >= 0 ? 1 : -1;
        const leaf = Math.min(op.width, 1.0);
        doc.setLineWidth(0.5);
        if (w.axis === "x") {
          const hz = w.at + (sign * t) / 2;
          doc.line(X(a), Y(hz), X(a), Y(hz + sign * leaf));
          doc.setLineWidth(0.25);
          arc(doc, X(a), Y(hz), leaf * k, sign > 0 ? 0 : -Math.PI / 2, sign > 0 ? Math.PI / 2 : 0);
          if (op.width > leaf + 0.05) {
            doc.setLineWidth(0.5);
            doc.line(X(b), Y(hz), X(b), Y(hz + sign * (op.width - leaf)));
          }
        } else {
          const hx = w.at + (sign * t) / 2;
          doc.line(X(hx), Y(a), X(hx + sign * leaf), Y(a));
          doc.setLineWidth(0.25);
          arc(
            doc,
            X(hx),
            Y(a),
            leaf * k,
            sign > 0 ? 0 : Math.PI / 2,
            sign > 0 ? Math.PI / 2 : Math.PI,
          );
        }
      }
      if (mark) {
        // Tag outside the wall line.
        const off = (t / 2 + 0.35) * k * (w.exterior ? (w.at > 0 ? 1 : -1) : 1);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(GREY[0], GREY[1], GREY[2]);
        doc.setLineWidth(0.3);
        const px = w.axis === "x" ? X(op.at) : X(w.at) + off;
        const py = w.axis === "x" ? Y(w.at) + off : Y(op.at);
        if (w.exterior || kind !== "opening") {
          if (kind === "window") doc.rect(px - 5.5, py - 3.4, 11, 6.4, "FD");
          else doc.circle(px, py, 3.8, "FD");
          col(doc, INK);
          text(doc, mark, px, py + 1.6, 4.4, true, { align: "center" });
        }
      }
    }
  }
  // Room names, areas and sizes.
  for (const r of o.rooms.filter(ground)) {
    const cw = (r.x1 - r.x0) * k;
    const chh = (r.z1 - r.z0) * k;
    if (cw < 30 || chh < 22) continue;
    const cx = X(r.x0) + cw / 2;
    const cy = Y(r.z0) + chh / 2;
    col(doc, INK);
    text(doc, r.name.toUpperCase(), cx, cy - 3, Math.min(6.5, cw / 9), true, { align: "center" });
    col(doc, GREY);
    text(doc, `${((r.x1 - r.x0) * (r.z1 - r.z0)).toFixed(1)} m²`, cx, cy + 4, 5.4, false, {
      align: "center",
    });
    text(
      doc,
      `${(r.x1 - r.x0).toFixed(2)} x ${(r.z1 - r.z0).toFixed(2)}`,
      cx,
      cy + 10,
      4.8,
      false,
      { align: "center" },
    );
  }
  // Upper level outlines (stacked containers), dashed.
  const upper = o.outlines.filter((r) => r.level > 0);
  if (upper.length) {
    col(doc, GREY);
    doc.setLineDashPattern([4, 2], 0);
    doc.setLineWidth(0.5);
    for (const r of upper) doc.rect(X(r.x0), Y(r.z0), (r.x1 - r.x0) * k, (r.z1 - r.z0) * k);
    doc.setLineDashPattern([], 0);
    text(doc, "Dashed: upper level above", X(upper[0].x0) + 2, Y(upper[0].z0) - 3, 5);
  }

  // Grid lines on outside wall centrelines and partitions.
  const xs = [...new Set(m.walls.filter((w) => w.axis === "z").map((w) => +w.at.toFixed(3)))].sort(
    (a, b) => a - b,
  );
  const zs = [...new Set(m.walls.filter((w) => w.axis === "x").map((w) => +w.at.toFixed(3)))].sort(
    (a, b) => a - b,
  );
  const gTop = Y(minZ) - 2.4 * k;
  const gLeft = X(minX) - 2.4 * k;
  doc.setLineDashPattern([6, 2, 1, 2], 0);
  doc.setLineWidth(0.25);
  doc.setDrawColor(GREY[0], GREY[1], GREY[2]);
  for (const x of xs) doc.line(X(x), gTop + 5, X(x), Y(maxZ) + 0.6 * k);
  for (const z of zs) doc.line(gLeft + 5, Y(z), X(maxX) + 0.6 * k, Y(z));
  doc.setLineDashPattern([], 0);
  xs.forEach((x, i) => {
    col(doc, INK);
    doc.setFillColor(255, 255, 255);
    doc.circle(X(x), gTop, 5, "FD");
    text(doc, String(i + 1), X(x), gTop + 2, 5.6, true, { align: "center" });
  });
  zs.forEach((z, i) => {
    col(doc, INK);
    doc.setFillColor(255, 255, 255);
    doc.circle(gLeft, Y(z), 5, "FD");
    text(doc, String.fromCharCode(65 + i), gLeft, Y(z) + 2, 5.6, true, { align: "center" });
  });

  // Dimension chains: overall and wall-to-wall on top; openings on the front; rooms on the left.
  dimChain(doc, [X(minX), X(maxX)], Y(minZ) - 1.6 * k, true, [maxX - minX], Y(minZ) - 0.2 * k);
  if (xs.length > 2) {
    const xb = [minX, ...xs.slice(1, -1), maxX];
    dimChain(
      doc,
      xb.map(X),
      Y(minZ) - 1.0 * k,
      true,
      xb.slice(1).map((v, i) => v - xb[i]),
    );
  }
  dimChain(doc, [Y(minZ), Y(maxZ)], X(minX) - 1.6 * k, false, [maxZ - minZ], X(minX) - 0.2 * k);
  if (zs.length > 2) {
    const zb = [minZ, ...zs.slice(1, -1), maxZ];
    dimChain(
      doc,
      zb.map(Y),
      X(minX) - 1.0 * k,
      false,
      zb.slice(1).map((v, i) => v - zb[i]),
    );
  }
  const front = m.walls.find((w) => w.exterior && w.axis === "x" && w.at > 0);
  if (front && front.openings.length) {
    const pts = [minX];
    for (const op of [...front.openings].sort((a, b) => a.at - b.at))
      pts.push(op.at - op.width / 2, op.at + op.width / 2);
    pts.push(maxX);
    dimChain(
      doc,
      pts.map(X),
      Y(maxZ) + 1.0 * k,
      true,
      pts.slice(1).map((v, i) => v - pts[i]),
      Y(maxZ) + 0.2 * k,
    );
  }

  // Section marks: A-A across the width, B-B along the length.
  const ax = sectionAX(o);
  const bz = sectionBZ(m, o);
  doc.setDrawColor(PDF.red[0], PDF.red[1], PDF.red[2]);
  doc.setLineWidth(0.7);
  doc.setLineDashPattern([8, 2, 2, 2], 0);
  doc.line(X(ax), Y(minZ) - 0.6 * k, X(ax), Y(maxZ) + 0.6 * k);
  doc.line(X(minX) - 0.6 * k, Y(bz), X(maxX) + 0.6 * k, Y(bz));
  doc.setLineDashPattern([], 0);
  const tag = (x: number, y: number, l: string, dx: number, dy: number) => {
    doc.setFillColor(PDF.red[0], PDF.red[1], PDF.red[2]);
    doc.circle(x, y, 4.6, "F");
    doc.setTextColor(255, 255, 255);
    text(doc, l, x, y + 1.9, 5.6, true, { align: "center" });
    doc.triangle(
      x + dx * 4,
      y + dy * 4,
      x + dx * 8 + dy * 3,
      y + dy * 8 + dx * 3,
      x + dx * 8 - dy * 3,
      y + dy * 8 - dx * 3,
      "F",
    );
  };
  // Both sections look west / north.
  tag(X(ax), Y(minZ) - 0.6 * k - 5, "A", -1, 0);
  tag(X(ax), Y(maxZ) + 0.6 * k + 5, "A", -1, 0);
  tag(X(minX) - 0.6 * k - 5, Y(bz), "B", 0, -1);
  tag(X(maxX) + 0.6 * k + 5, Y(bz), "B", 0, -1);

  northArrow(doc, DRAW.x + DRAW.w - 14, DRAW.y + 14);
  const vy = PH - FM - 42;
  const end = viewTitle(
    doc,
    "1",
    o.levels > 1 ? "Ground floor plan (upper level dashed)" : "Floor plan",
    s,
    DRAW.x,
    vy,
  );
  scaleBar(doc, s, end + 24, vy - 6);
  col(doc, GREY);
  text(
    doc,
    `Plan cut at 1.2 m. Walls: outside ${Math.round((m.walls.find((w) => w.exterior)?.thick ?? 0.2) * 1000)} mm, inside ${Math.round((m.walls.find((w) => !w.exterior)?.thick ?? 0.1) * 1000)} mm. Room sizes are inside faces. D = door, W = window (see schedule).`,
    DRAW.x,
    vy + 11,
    5.6,
  );
}

function sectionAX(o: DrawingSetInput): number {
  // Through the middle of the room nearest the centre, so the cut misses partitions.
  const r = [...o.rooms.filter((q) => q.level === 0)].sort(
    (a, b) => Math.abs((a.x0 + a.x1) / 2) - Math.abs((b.x0 + b.x1) / 2),
  )[0];
  return r ? (r.x0 + r.x1) / 2 + Math.min(0.4, (r.x1 - r.x0) / 4) : 0;
}

function sectionBZ(m: Model, o: DrawingSetInput): number {
  const south = o.rooms.filter((q) => q.level === 0 && q.z0 >= -0.01);
  if (south.length) return south[0].z0 + (south[0].z1 - south[0].z0) * 0.3;
  return m.W / 4;
}

/* ------------------------------------------------------------ elevations */

type Face = "south" | "north" | "east" | "west";

/** Horizontal coordinate on an elevation, metres, left to right as seen. */
function faceU(face: Face, x: number, z: number) {
  if (face === "south") return x;
  if (face === "north") return -x;
  if (face === "east") return -z;
  return z;
}

function roofProfile(m: Model, face: Face): Array<[number, number]> {
  const long = face === "south" || face === "north";
  const e = m.roof.eaveM;
  const halfL = m.L / 2 + e;
  const halfW = m.W / 2 + e;
  const H = m.H;
  const r = m.roof.riseM;
  if (m.roof.form === "flat") {
    const half = long ? m.L / 2 + 0.05 : m.W / 2 + 0.05;
    return [
      [-half, H],
      [-half, H + r],
      [half, H + r],
      [half, H],
    ];
  }
  if (m.roof.form === "gable") {
    if (long)
      return [
        [-halfL, H - 0.05],
        [-halfL, H + r],
        [halfL, H + r],
        [halfL, H - 0.05],
      ];
    return [
      [-halfW, H - 0.05],
      [0, H + r],
      [halfW, H - 0.05],
    ];
  }
  if (m.roof.form === "hip") {
    if (long) {
      const rx = Math.max(0, halfL - halfW);
      return [
        [-halfL, H],
        [-rx, H + r],
        [rx, H + r],
        [halfL, H],
      ];
    }
    return [
      [-halfW, H],
      [0, H + r],
      [halfW, H],
    ];
  }
  // Mono: high along the south (front).
  const lo = H + 0.22;
  const hi = H + r;
  if (face === "south")
    return [
      [-halfL, H],
      [-halfL, hi],
      [halfL, hi],
      [halfL, H],
    ];
  if (face === "north")
    return [
      [-halfL, H],
      [-halfL, lo],
      [halfL, lo],
      [halfL, H],
    ];
  // East looks west: south on the left (u = -z → south is negative u).
  const sL: [number, number] = [-halfW, hi];
  const nR: [number, number] = [halfW, lo];
  return face === "east"
    ? [[-halfW, H], sL, nR, [halfW, H]]
    : [
        [-halfW, H],
        [-halfW, lo],
        [halfW, hi],
        [halfW, H],
      ];
}

function drawElevation(
  c: Ctx,
  m: Model,
  face: Face,
  box: { x: number; y: number; w: number; h: number },
  s: number,
  n: string,
) {
  const { doc, o } = c;
  const k = ptPerM(s);
  const long = face === "south" || face === "north";
  const span = (long ? m.L : m.W) + 2 * m.roof.eaveM;
  const topY = m.H + m.roof.riseM;
  const cx = box.x + box.w / 2;
  const gy = box.y + box.h - 26; // ground line
  const U = (u: number) => cx + u * k;
  const V = (v: number) => gy - (v + m.plinth) * k; // v: metres above the underside of the slab

  // Wall face(s).
  const wallC: RGB = [236, 230, 214];
  doc.setFillColor(wallC[0], wallC[1], wallC[2]);
  col(doc, INK);
  doc.setLineWidth(0.7);
  if (m.masonry) {
    const half = (long ? m.L : m.W) / 2;
    doc.rect(U(-half), V(m.H), 2 * half * k, (m.H + m.plinth) * k, "FD");
    // Plinth band.
    doc.setFillColor(205, 198, 182);
    doc.rect(U(-half), V(m.floor), 2 * half * k, (m.floor + m.plinth) * k, "FD");
    // Gable infill on the end walls.
    if (!long && m.roof.form === "gable") {
      doc.setFillColor(wallC[0], wallC[1], wallC[2]);
      doc.triangle(U(-half), V(m.H), U(half), V(m.H), U(0), V(m.H + m.roof.riseM - 0.05), "FD");
    }
  } else {
    // Container units as seen, every level.
    for (const r of o.outlines) {
      const a = faceU(face, r.x0, r.z0);
      const b = faceU(face, r.x1, r.z1);
      const u0 = long ? Math.min(faceU(face, r.x0, 0), faceU(face, r.x1, 0)) : Math.min(a, b);
      const u1 = long ? Math.max(faceU(face, r.x0, 0), faceU(face, r.x1, 0)) : Math.max(a, b);
      const v0 = r.level * m.levelH;
      doc.setFillColor(150, 112, 78);
      doc.rect(U(u0), V(v0 + m.levelH), (u1 - u0) * k, m.levelH * k, "FD");
      doc.setDrawColor(110, 80, 55);
      doc.setLineWidth(0.2);
      for (let u = u0 + 0.28; u < u1 - 0.1; u += 0.28)
        doc.line(U(u), V(v0 + m.levelH - 0.08), U(u), V(v0 + 0.08));
      col(doc, INK);
      doc.setLineWidth(0.7);
    }
  }
  // Openings on this face.
  const faceWall = m.walls.filter(
    (w) =>
      w.exterior &&
      ((face === "south" && w.axis === "x" && w.at > 0) ||
        (face === "north" && w.axis === "x" && w.at < 0) ||
        (face === "east" && w.axis === "z" && w.at > 0) ||
        (face === "west" && w.axis === "z" && w.at < 0)),
  );
  for (const w of faceWall)
    for (const op of w.openings) {
      const ua =
        w.axis === "x"
          ? faceU(face, op.at - op.width / 2, 0)
          : faceU(face, 0, op.at - op.width / 2);
      const ub =
        w.axis === "x"
          ? faceU(face, op.at + op.width / 2, 0)
          : faceU(face, 0, op.at + op.width / 2);
      const u0 = Math.min(ua, ub);
      const u1 = Math.max(ua, ub);
      const b = Math.max(m.floor, op.bottom);
      if (op.glass) {
        doc.setFillColor(196, 214, 222);
        doc.setLineWidth(0.6);
        doc.rect(U(u0), V(op.top), (u1 - u0) * k, (op.top - b) * k, "FD");
        doc.setLineWidth(0.3);
        const panes = Math.max(1, Math.round((u1 - u0) / 0.6));
        for (let i = 1; i < panes; i++)
          doc.line(
            U(u0 + ((u1 - u0) * i) / panes),
            V(op.top),
            U(u0 + ((u1 - u0) * i) / panes),
            V(b),
          );
        if (op.top - b > 1.2)
          doc.line(U(u0), V(b + (op.top - b) * 0.68), U(u1), V(b + (op.top - b) * 0.68));
        // Sill.
        doc.setLineWidth(0.6);
        doc.line(U(u0) - 2, V(b) + 1.5, U(u1) + 2, V(b) + 1.5);
      } else {
        doc.setFillColor(122, 86, 58);
        doc.setLineWidth(0.6);
        doc.rect(U(u0), V(op.top), (u1 - u0) * k, (op.top - m.floor) * k, "FD");
        doc.setDrawColor(90, 62, 40);
        doc.setLineWidth(0.3);
        doc.rect(U(u0) + 2, V(op.top) + 2, (u1 - u0) * k - 4, (op.top - m.floor) * k - 4);
        col(doc, INK);
      }
    }
  // Roof (containers carry their own steel roof, drawn as the unit tops).
  const prof = m.masonry
    ? roofProfile(m, face).map(([u, v]) => [U(u), V(v)] as [number, number])
    : [];
  if (prof.length) {
    doc.setFillColor(
      m.cover === "tiles" ? 150 : 110,
      m.cover === "tiles" ? 72 : 112,
      m.cover === "tiles" ? 52 : 118,
    );
    col(doc, INK);
    doc.setLineWidth(0.8);
    polyline(doc, prof, true, "FD");
    // Sheet ribs or tile courses on sloped faces seen face-on.
    if (m.roof.form !== "flat" && prof.length === 4) {
      doc.setDrawColor(70, 50, 40);
      doc.setLineWidth(0.15);
      const [p0, p1, p2, p3] = prof;
      const yTop = Math.min(p1[1], p2[1]);
      const yBot = p0[1];
      if (m.cover === "sheet") {
        for (
          let u = Math.min(p0[0], p1[0]) + 2;
          u < Math.max(p2[0], p3[0]) - 1;
          u += Math.max(1.2, 0.2 * k)
        ) {
          const tt = (u - p0[0]) / Math.max(1, p3[0] - p0[0]);
          doc.line(u, yBot - 0.5, u, Math.max(yTop, p1[1] + (p2[1] - p1[1]) * tt) + 0.5);
        }
      } else
        for (let v = yBot - 0.32 * k; v > yTop; v -= 0.32 * k)
          doc.line(Math.min(p0[0], p1[0]) + 1, v, Math.max(p2[0], p3[0]) - 1, v);
    }
    if (m.masonry && m.roof.form === "flat") {
      doc.setFillColor(200, 196, 186);
      col(doc, INK);
      doc.setLineWidth(0.5);
      doc.rect(prof[1][0] - 1.5, prof[1][1] - 2.5, prof[2][0] - prof[1][0] + 3, 2.5, "FD");
    }
  }
  if (m.masonry && m.roof.form === "mono" && face === "south") {
    // High windows under the raised edge.
    doc.setFillColor(196, 214, 222);
    doc.rect(
      U(-m.L / 2 + 0.3),
      V(m.H + m.roof.riseM - 0.3),
      (m.L - 0.6) * k,
      Math.max(0.15, m.roof.riseM - 0.45) * k,
      "FD",
    );
  }
  // Ground and levels.
  groundLine(doc, box.x + 6, box.x + box.w - 6, gy);
  const lx = U(span / 2) + 14;
  levelMark(doc, lx, gy, "GL", 0, true);
  levelMark(doc, lx, V(m.floor), "FFL", m.floor + m.plinth);
  if (m.masonry)
    levelMark(doc, lx, V(m.H), m.roof.form === "flat" ? "roof slab" : "wall plate", m.H + m.plinth);
  levelMark(
    doc,
    lx,
    V(topY),
    !m.masonry
      ? "top of units"
      : m.roof.form === "flat"
        ? "parapet"
        : m.roof.form === "mono"
          ? "high eave"
          : "ridge",
    topY + m.plinth,
  );
  // Overall length under the ground line, heights on the left.
  const half = (long ? m.L : m.W) / 2;
  dimChain(doc, [U(-half), U(half)], gy + 14, true, [2 * half]);
  const vx = U(-span / 2) - 16;
  if (m.masonry) dimChain(doc, [V(topY), V(m.H), gy], vx, false, [topY - m.H, m.H + m.plinth]);
  else dimChain(doc, [V(topY), gy], vx, false, [topY + m.plinth]);
  viewTitle(
    doc,
    n,
    `${face[0].toUpperCase()}${face.slice(1)} elevation${face === "south" ? " (front)" : ""}`,
    s,
    box.x + 4,
    box.y + 10,
  );
}

function sheetElevations(c: Ctx, m: Model, pair: [Face, Face], no: string, first: number) {
  const top = m.H + m.roof.riseM + m.plinth;
  const cellW = DRAW.w;
  const cellH = DRAW.h / 2 - 6;
  // Both sheets share one scale so the four elevations compare directly.
  const s = pickScale(
    Math.max(m.L, m.W) + 2 * m.roof.eaveM + 1,
    top + 1.4,
    cellW - 150,
    cellH - 50,
  );
  const long = pair[0] === "south";
  newSheet(c, no, long ? "Elevations: front and rear" : "Elevations: sides", `1:${s}`);
  pair.forEach((face, i) =>
    drawElevation(
      c,
      m,
      face,
      { x: DRAW.x, y: DRAW.y + i * (cellH + 8), w: cellW, h: cellH },
      s,
      String(first + i),
    ),
  );
  col(c.doc, GREY);
  const wall = WALL_LABEL[c.o.style.wall];
  const roof =
    m.cover === "tiles"
      ? "clay / concrete tiles"
      : m.cover === "sheet"
        ? "pre-painted iron sheet"
        : "flat roof slab with parapet";
  text(
    c.doc,
    m.masonry
      ? `Finishes: walls ${wall.toLowerCase()} (${c.o.style.wallColor}); roof ${roof} (${c.o.style.roofColor}); window and door frames ${c.o.style.trimColor}. Levels in metres above the ground at the house (±0.000).`
      : "Finishes: ISO container steel, painted. Door and window cut-outs are placed by the designer per unit and framed in steel box section. Levels in metres above the ground at the house (±0.000).",
    DRAW.x,
    PH - FM - 26,
    5.8,
  );
}

/* -------------------------------------------------------------- sections */

/** Walls cut by a section line and their heights. */
function cutWalls(m: Model, axis: "x" | "z", at: number) {
  // A section across the width (A-A at x = at) cuts the x-walls; B-B (z = at) cuts the z-walls.
  return m.walls
    .filter((w) => w.axis === axis && at >= w.from - 1e-6 && at <= w.to + 1e-6)
    .map((w) => ({ w, op: w.openings.find((op) => Math.abs(at - op.at) <= op.width / 2) ?? null }));
}

function drawSection(
  c: Ctx,
  m: Model,
  which: "A" | "B",
  box: { x: number; y: number; w: number; h: number },
  s: number,
  n: string,
): string[] {
  const { doc, o } = c;
  const k = ptPerM(s);
  const across = which === "A";
  const at = across ? sectionAX(o) : sectionBZ(m, o);
  const half = (across ? m.W : m.L) / 2;
  const e = m.roof.eaveM;
  const cx = box.x + box.w / 2 - 20;
  const gy = box.y + box.h - 30 - TYPICAL.footingDepth * k;
  // u along the cut; A-A looks west (south on the left), B-B looks north (west on the left).
  const U = (v: number) => cx + (across ? -v : v) * k;
  const V = (v: number) => gy - (v + m.plinth) * k;
  const key: string[] = [];
  const note = (txt: string) => {
    key.push(txt);
    return key.length;
  };

  if (!m.masonry) return drawContainerSection(c, m, which, box, s, n);
  // Earth and footings.
  groundLine(
    doc,
    Math.min(U(-half - 1.4), U(half + 1.4)),
    Math.max(U(-half - 1.4), U(half + 1.4)),
    gy,
  );
  const cuts = cutWalls(m, across ? "x" : "z", at);
  const fd = TYPICAL.footingDepth;
  const columns = o.foundation.kind === "columns_beams";
  const nFoot = columns
    ? note(
        "Columns 300 x 300 mm on 1000 x 1000 x 350 mm pad footings, tied by 250 x 400 mm ground beams that carry the walls and a suspended floor slab (engineer to design).",
      )
    : note(
        `Strip footing: C15 (1:3:6) concrete, ${Math.round(TYPICAL.footingW * 1000)} x ${Math.round(TYPICAL.footingT * 1000)} mm under outside walls, ${Math.round(TYPICAL.footingInnerW * 1000)} mm under inside walls; bottom at least ${fd.toFixed(1)} m below ground on firm soil (engineer to confirm).`,
      );
  const nWall = note(
    columns
      ? "Ground beam under every wall, walling built off the beam with a damp-proof course at floor level."
      : "Foundation walling: 200 mm machine-cut stone in cement mortar 1:4 up to the plinth, with a damp-proof course (DPC) at floor level.",
  );
  const nHard = note(
    `Floor build-up: ${Math.round(TYPICAL.hardcore * 1000)} mm hardcore well compacted, ${Math.round(TYPICAL.blinding * 1000)} mm murram blinding, anti-termite treatment, 1000-gauge polythene DPM, ${Math.round(TYPICAL.slab * 1000)} mm C20 slab with A142 mesh, screed and the chosen floor finish.`,
  );
  for (const { w } of cuts) {
    if (!m.masonry) break;
    const fw = columns ? 1.0 : w.exterior ? TYPICAL.footingW : TYPICAL.footingInnerW;
    const ft = columns ? 0.35 : TYPICAL.footingT;
    const uC = U(w.at);
    const fx = uC - (fw * k) / 2;
    doc.setFillColor(214, 214, 206);
    col(doc, INK);
    doc.setLineWidth(0.5);
    doc.rect(fx, gy + (fd - ft) * k, fw * k, ft * k, "FD");
    hatch(doc, fx, gy + (fd - ft) * k, fw * k, ft * k, 2.4);
    // Foundation wall up to the slab.
    doc.setFillColor(POCHE_IN[0], POCHE_IN[1], POCHE_IN[2]);
    col(doc, INK);
    doc.rect(
      uC - (w.thick * k) / 2,
      V(0),
      w.thick * k,
      gy + (fd - TYPICAL.footingT) * k - V(0),
      "FD",
    );
  }
  if (!m.masonry) {
    // Container pads under the unit edges.
    for (const u of [-half + 0.2, half - 0.2]) {
      doc.setFillColor(214, 214, 206);
      col(doc, INK);
      doc.rect(U(u) - 0.45 * k, gy + (0.6 - 0.3) * k, 0.9 * k, 0.3 * k, "FD");
      hatch(doc, U(u) - 0.45 * k, gy + 0.3 * k, 0.9 * k, 0.3 * k, 2.4);
      doc.rect(U(u) - 0.25 * k, V(0), 0.5 * k, gy + 0.3 * k - V(0), "FD");
    }
  }
  // Slab layers between the outside walls.
  if (m.masonry) {
    const inner = half - (m.walls.find((w) => w.exterior)?.thick ?? 0.2);
    const a = Math.min(U(-inner), U(inner));
    const wdt = 2 * inner * k;
    const yHard = V(-TYPICAL.hardcore - TYPICAL.blinding);
    stipple(doc, a, yHard, wdt, TYPICAL.hardcore * k, 0.08);
    doc.setFillColor(214, 214, 206);
    col(doc, INK);
    doc.setLineWidth(0.4);
    doc.rect(a, V(0), wdt, TYPICAL.slab * k, "FD");
    hatch(doc, a, V(0), wdt, TYPICAL.slab * k, 3);
    doc.setDrawColor(INK[0], INK[1], INK[2]);
    doc.setLineWidth(0.6);
    doc.line(a, V(m.floor), a + wdt, V(m.floor));
    callout(doc, nHard, a + wdt * 0.62, V(-0.1), a + wdt * 0.62, gy + 0.55 * k);
  }
  // Cut walls up to the plate, with the opening gap if the cut passes one.
  const nRing = note(
    `Ring beam: ${Math.round(TYPICAL.ringBeam * 1000)} x ${Math.round(TYPICAL.ringBeam * 1000)} mm C20, 4 Y12 bars with R8 links at 200 mm, all round at wall-plate level; ${Math.round(TYPICAL.lintel * 1000)} mm RC lintels over openings, 225 mm bearing each side.`,
  );
  for (const { w, op } of cuts) {
    if (!m.masonry) break;
    const uC = U(w.at);
    const x0 = uC - (w.thick * k) / 2;
    const fillC = w.exterior ? POCHE : POCHE_IN;
    doc.setFillColor(fillC[0], fillC[1], fillC[2]);
    col(doc, INK);
    doc.setLineWidth(0.5);
    const h = m.H;
    if (op) {
      if (op.bottom > m.floor + 0.02)
        doc.rect(x0, V(op.bottom), w.thick * k, (op.bottom - 0) * k, "FD");
      doc.rect(x0, V(h), w.thick * k, (h - op.top) * k, "FD");
      if (op.glass) {
        doc.setFillColor(196, 214, 222);
        doc.rect(uC - 1, V(op.top), 2, (op.top - op.bottom) * k, "F");
      }
    } else doc.rect(x0, V(h), w.thick * k, h * k, "FD");
    if (w.exterior) {
      doc.setFillColor(214, 214, 206);
      doc.rect(x0, V(h), w.thick * k, TYPICAL.ringBeam * k, "FD");
      hatch(doc, x0, V(h), w.thick * k, TYPICAL.ringBeam * k, 1.6);
    }
  }
  const outer = cuts.find((q) => q.w.exterior);
  if (outer && m.masonry) {
    const uC = U(outer.w.at);
    const out = Math.sign(uC - cx) || 1;
    const tx = uC + out * 1.0 * k;
    callout(doc, nFoot, uC, gy + (fd - 0.1) * k, tx, gy + (fd + 0.25) * k);
    callout(doc, nWall, uC, gy + 0.3 * k, tx, gy + 0.3 * k);
    callout(doc, nRing, uC, V(m.H - 0.1), uC - out * 0.9 * k, V(m.H - 0.7));
  }
  // Ceiling.
  if (m.masonry) {
    const inner = half - 0.2;
    doc.setDrawColor(PDF.goldInk[0], PDF.goldInk[1], PDF.goldInk[2]);
    doc.setLineWidth(0.8);
    const cy = V(m.H - 0.02);
    doc.line(Math.min(U(-inner), U(inner)), cy, Math.max(U(-inner), U(inner)), cy);
    const nCeil = note(
      `Ceiling: ${CEILING_LABEL[o.style.ceiling].toLowerCase()}${o.style.ceiling === "slab" ? "" : " on 50 x 50 mm brandering at 600 mm centres"}.`,
    );
    callout(doc, nCeil, U(inner * 0.3), cy, U(inner * 0.3), cy + 0.5 * k);
  }
  // Roof in section.
  const H = m.H;
  if (m.roof.form === "flat") {
    const n1 = note(
      `Roof: ${Math.round(TYPICAL.roofSlab * 1000)} mm RC slab (C25), screed to falls of 1:80, torch-on waterproof membrane turned up the parapet; ${Math.round(TYPICAL.parapet * 1000)} mm parapet with a concrete coping.`,
    );
    doc.setFillColor(214, 214, 206);
    col(doc, INK);
    doc.rect(
      Math.min(U(-half), U(half)),
      V(H + TYPICAL.roofSlab),
      2 * half * k,
      TYPICAL.roofSlab * k,
      "FD",
    );
    hatch(
      doc,
      Math.min(U(-half), U(half)),
      V(H + TYPICAL.roofSlab),
      2 * half * k,
      TYPICAL.roofSlab * k,
      2.4,
    );
    for (const sx of [-1, 1]) {
      doc.setFillColor(POCHE[0], POCHE[1], POCHE[2]);
      doc.rect(
        U(sx * (half - 0.1)) - 0.1 * k,
        V(H + TYPICAL.parapet),
        0.2 * k,
        (TYPICAL.parapet - TYPICAL.roofSlab) * k,
        "FD",
      );
    }
    callout(doc, n1, U(0), V(H + 0.08), U(0), V(H + 1.1));
  } else if (across && (m.roof.form === "gable" || m.roof.form === "hip")) {
    // A full truss in section.
    const span = 2 * half;
    const r = m.roof.riseM;
    const tt = trussType(span);
    const n1 = note(
      `${tt === "fink" ? "Fink (W)" : "King-post"} timber truss in treated cypress or pine at ${trussSpacingM(m.cover) * 1000} mm centres: rafters and tie beam 50 x 150 mm, struts and ${tt === "fink" ? "webs" : "king post"} 50 x 100 mm, joints with galvanised nail plates or bolts.`,
    );
    const n2 = note(
      "Wall plate 100 x 50 mm bedded on the ring beam and held down with 30 x 3 mm hoop-iron straps cast in at every truss.",
    );
    const n3 = note(
      m.cover === "tiles"
        ? "Roof cover: clay or concrete tiles on 50 x 25 mm battens at the tile gauge, over breathable underlay; ridge tiles bedded in mortar."
        : "Roof cover: pre-painted box-profile iron sheet (gauge 28 or heavier) on 50 x 50 mm purlins at 900 mm, screwed with washers; ridge capping and sisal-kraft insulation.",
    );
    const n4 = note(
      `Eaves: ${Math.round(e * 1000)} mm overhang, 25 x 225 mm fascia board, PVC gutter to downpipes.`,
    );
    col(doc, INK);
    doc.setLineWidth(1.6);
    const L0: [number, number] = [
      U(-half - e),
      V(H - Math.tan((m.roof.pitchDeg * Math.PI) / 180) * e),
    ];
    const R0: [number, number] = [
      U(half + e),
      V(H - Math.tan((m.roof.pitchDeg * Math.PI) / 180) * e),
    ];
    const apex: [number, number] = [U(0), V(H + r - (r * e) / (half + e))];
    doc.setDrawColor(150, 104, 58);
    doc.line(L0[0], L0[1], apex[0], apex[1]);
    doc.line(R0[0], R0[1], apex[0], apex[1]);
    doc.setLineWidth(1.2);
    doc.line(U(-half), V(H), U(half), V(H));
    doc.setLineWidth(0.8);
    const rafterY = (u: number) => V(H) + (apex[1] - V(H)) * (1 - Math.abs(u) / half);
    if (tt === "kingpost") {
      doc.line(U(0), V(H), apex[0], apex[1]);
      for (const sx of [-1, 1]) doc.line(U(0), V(H), U(sx * half * 0.5), rafterY(sx * half * 0.5));
    } else {
      for (const sx of [-1, 1]) {
        const third = (half * 2) / 3;
        doc.line(U(sx * third), V(H), U(sx * half * 0.5), rafterY(sx * half * 0.5));
        doc.line(U(sx * third), V(H), apex[0], apex[1]);
      }
    }
    // Roof cover line just above the rafters, and fascias.
    col(doc, INK);
    doc.setLineWidth(0.6);
    doc.line(L0[0], L0[1] - 2.2, apex[0], apex[1] - 2.2);
    doc.line(R0[0], R0[1] - 2.2, apex[0], apex[1] - 2.2);
    doc.setFillColor(255, 255, 255);
    doc.rect(L0[0] - 1.2, L0[1] - 2, 2.4, 0.225 * k, "FD");
    doc.rect(R0[0] - 1.2, R0[1] - 2, 2.4, 0.225 * k, "FD");
    // Purlins as dots.
    doc.setFillColor(INK[0], INK[1], INK[2]);
    for (let f = 0.08; f < 1; f += 0.9 / Math.max(2, Math.round((half + e) / 0.9)))
      for (const p of [L0, R0])
        doc.rect(p[0] + (apex[0] - p[0]) * f - 1, p[1] + (apex[1] - p[1]) * f - 3.6, 2, 2, "F");
    callout(doc, n1, U(half * 0.25), rafterY(half * 0.25) + 3, U(half * 0.15), apex[1] - 14);
    callout(doc, n2, U(across ? -half + 0.1 : half - 0.1), V(H) + 1, U(-half - e) - 6, V(H) - 6);
    callout(
      doc,
      n3,
      U(-half * 0.6),
      rafterY(-half * 0.6) - 3,
      U(-half * 0.75),
      rafterY(-half * 0.6) - 20,
    );
    callout(doc, n4, L0[0], L0[1], L0[0] - 10, L0[1] + 10);
  } else {
    // Long section, or a mono-pitch roof: the roof outline as seen.
    const prof = roofProfile(m, across ? "east" : "north").map(
      ([u, v]) => [cx + u * k * (across ? 1 : 1), V(v)] as [number, number],
    );
    doc.setFillColor(
      m.cover === "tiles" ? 196 : 176,
      m.cover === "tiles" ? 150 : 180,
      m.cover === "tiles" ? 136 : 184,
    );
    col(doc, INK);
    doc.setLineWidth(0.6);
    polyline(doc, prof, true, "FD");
    if (!across && m.roof.form !== "mono") {
      const n1 = note(
        `Trusses at ${trussSpacingM(m.cover) * 1000} mm centres along the house (see S-01).`,
      );
      doc.setDrawColor(150, 104, 58);
      doc.setLineWidth(0.6);
      const pos = trussPositions(m.L - 0.2, trussSpacingM(m.cover)).map((p) => p - (m.L - 0.2) / 2);
      for (const p of pos) doc.line(U(p), V(H), U(p), V(H + m.roof.riseM * 0.92));
      callout(
        doc,
        n1,
        U(pos[1] ?? 0),
        V(H + m.roof.riseM * 0.5),
        U(pos[1] ?? 0) + 20,
        V(H + m.roof.riseM + 0.5),
      );
    } else if (m.roof.form === "mono") {
      note(
        "Mono-pitch: 50 x 150 mm rafters (or light steel channels) at 600 mm centres, falling 10 degrees to the back; iron sheet on 50 x 50 mm purlins.",
      );
    }
  }
  // Room names in the cut.
  const rooms = o.rooms.filter(
    (r) => r.level === 0 && (across ? at >= r.x0 && at <= r.x1 : at >= r.z0 && at <= r.z1),
  );
  for (const r of rooms) {
    const a = across ? r.z0 : r.x0;
    const b = across ? r.z1 : r.x1;
    col(doc, GREY);
    text(doc, r.name.toUpperCase(), (U(a) + U(b)) / 2, V(m.H * 0.45), 5.4, true, {
      align: "center",
    });
  }
  // Heights: floor to ceiling, overall.
  const lx = Math.max(U(half + e), U(-half - e)) + 12;
  levelMark(doc, lx, gy, "GL", 0, true);
  levelMark(doc, lx, V(m.floor), "FFL", m.floor + m.plinth);
  if (m.masonry) levelMark(doc, lx, V(m.H - 0.02), "ceiling", m.H - 0.02 + m.plinth);
  const top = m.H + m.roof.riseM;
  levelMark(doc, lx, V(top), m.roof.form === "flat" ? "parapet" : "top", top + m.plinth);
  dimChain(doc, [V(top), V(m.floor), gy], lx + 70, false, [top - m.floor, m.floor + m.plinth]);
  if (m.masonry)
    dimChain(doc, [gy, gy + TYPICAL.footingDepth * k], lx + 70, false, [TYPICAL.footingDepth]);
  viewTitle(
    doc,
    n,
    `Section ${which}-${which} (looking ${across ? "west" : "north"})`,
    s,
    box.x + 4,
    box.y + 10,
  );
  return key;
}

/** Section through container units: pads, piers and the steel boxes, every level. */
function drawContainerSection(
  c: Ctx,
  m: Model,
  which: "A" | "B",
  box: { x: number; y: number; w: number; h: number },
  s: number,
  n: string,
): string[] {
  const { doc, o } = c;
  const k = ptPerM(s);
  const across = which === "A";
  const at = across ? sectionAX(o) : sectionBZ(m, o);
  const cuts = o.outlines.filter((r) =>
    across ? at >= r.x0 && at <= r.x1 : at >= r.z0 && at <= r.z1,
  );
  const lo = Math.min(...cuts.map((r) => (across ? r.z0 : r.x0)), 0);
  const hi = Math.max(...cuts.map((r) => (across ? r.z1 : r.x1)), 0);
  const cx = box.x + box.w / 2 - 20;
  const gy = box.y + box.h - 30 - 0.6 * k;
  const U = (v: number) => cx + (across ? -(v - (lo + hi) / 2) : v - (lo + hi) / 2) * k;
  const V = (v: number) => gy - (v + m.plinth) * k;
  groundLine(doc, Math.min(U(lo), U(hi)) - 1.2 * k, Math.max(U(lo), U(hi)) + 1.2 * k, gy);
  const key = [
    "Pad footing 900 x 900 x 300 mm C25 under every corner casting (and mid-length on 40 ft units), on firm ground below the topsoil.",
    `${o.foundation.kind === "container_piers" ? "Pier 400 x 400 mm" : "Plinth 550 x 550 mm"} C25 with a 10 mm steel plate cast in; the corner casting is welded or bolted to it.`,
    "ISO container shell: corrugated steel walls and roof, steel floor bearers with a 28 mm marine-ply floor.",
    "Inside: 50 mm insulation and lining boards on timber or steel battens to walls and ceiling.",
    ...(o.levels > 1
      ? ["Upper unit locked to the lower with twist-locks or welded plates at all four corners."]
      : []),
  ];
  for (const r of cuts) {
    const a = across ? r.z0 : r.x0;
    const b = across ? r.z1 : r.x1;
    const v0 = r.level * m.levelH;
    const x0 = Math.min(U(a), U(b));
    const w = Math.abs(U(b) - U(a));
    col(doc, INK);
    doc.setFillColor(POCHE[0], POCHE[1], POCHE[2]);
    doc.setLineWidth(0.5);
    doc.rect(x0, V(v0 + m.levelH), w, m.levelH * k, "S");
    doc.rect(x0, V(v0 + m.levelH), w, 0.05 * k, "FD");
    doc.rect(x0, V(v0 + 0.15), w, 0.15 * k, "FD");
    doc.rect(x0, V(v0 + m.levelH), 0.05 * k, m.levelH * k, "FD");
    doc.rect(x0 + w - 0.05 * k, V(v0 + m.levelH), 0.05 * k, m.levelH * k, "FD");
    doc.setDrawColor(PDF.goldInk[0], PDF.goldInk[1], PDF.goldInk[2]);
    doc.setLineWidth(0.8);
    doc.rect(x0 + 0.1 * k, V(v0 + m.levelH - 0.1), w - 0.2 * k, (m.levelH - 0.3) * k, "S");
    if (r.level === 0)
      for (const u of [a + 0.2, b - 0.2]) {
        doc.setFillColor(214, 214, 206);
        col(doc, INK);
        doc.setLineWidth(0.5);
        doc.rect(U(u) - 0.45 * k, gy + 0.3 * k, 0.9 * k, 0.3 * k, "FD");
        hatch(doc, U(u) - 0.45 * k, gy + 0.3 * k, 0.9 * k, 0.3 * k, 2.4);
        doc.rect(U(u) - 0.25 * k, V(0), 0.5 * k, gy + 0.3 * k - V(0), "FD");
        hatch(doc, U(u) - 0.25 * k, V(0), 0.5 * k, gy + 0.3 * k - V(0), 3);
      }
  }
  const r0 = cuts[0];
  if (r0) {
    const a = U(across ? r0.z0 : r0.x0);
    callout(doc, 1, a + (across ? -0.2 : 0.2) * k, gy + 0.45 * k, a - 30, gy + 0.6 * k);
    callout(doc, 2, a + (across ? -0.2 : 0.2) * k, gy + 0.1 * k, a - 30, gy + 0.1 * k);
    callout(
      doc,
      3,
      (U(across ? r0.z0 : r0.x0) + U(across ? r0.z1 : r0.x1)) / 2,
      V(m.levelH) + 1,
      (U(across ? r0.z0 : r0.x0) + U(across ? r0.z1 : r0.x1)) / 2,
      V(m.levelH) - 14,
    );
    callout(
      doc,
      4,
      a + (across ? -0.1 : 0.1) * k,
      V(m.levelH * 0.5),
      a + (across ? -0.6 : 0.6) * k,
      V(m.levelH * 0.5) + 12,
    );
  }
  for (const r of o.rooms.filter(
    (q) =>
      q.name !== "Outside stair" && (across ? at >= q.x0 && at <= q.x1 : at >= q.z0 && at <= q.z1),
  )) {
    const a = across ? r.z0 : r.x0;
    const b = across ? r.z1 : r.x1;
    col(doc, GREY);
    text(
      doc,
      r.name.toUpperCase(),
      (U(a) + U(b)) / 2,
      V(r.level * m.levelH + m.levelH * 0.45),
      5.4,
      true,
      { align: "center" },
    );
  }
  const top = o.levels * m.levelH;
  const lx = Math.max(U(lo), U(hi)) + 14;
  levelMark(doc, lx, gy, "GL", 0, true);
  levelMark(doc, lx, V(0.15), "FFL", 0.15 + m.plinth);
  levelMark(doc, lx, V(top), "top of units", top + m.plinth);
  dimChain(doc, [V(top), gy], lx + 70, false, [top + m.plinth]);
  viewTitle(
    doc,
    n,
    `Section ${which}-${which} (looking ${across ? "west" : "north"})`,
    s,
    box.x + 4,
    box.y + 10,
  );
  return key;
}

function sheetSection(c: Ctx, m: Model, which: "A" | "B") {
  const top = m.H + m.roof.riseM + m.plinth + TYPICAL.footingDepth;
  const span = (which === "A" ? m.W : m.L) + 2 * m.roof.eaveM + 2.8;
  const keyH = 120;
  const s = pickScale(span, top + 1.2, DRAW.w - 130, DRAW.h - keyH - 40);
  newSheet(c, which === "A" ? "A-04" : "A-05", `Section ${which}-${which}`, `1:${s}`);
  const key = drawSection(
    c,
    m,
    which,
    { x: DRAW.x, y: DRAW.y, w: DRAW.w, h: DRAW.h - keyH },
    s,
    which === "A" ? "6" : "7",
  );
  const ky = DRAW.y + DRAW.h - keyH + 14;
  col(c.doc, INK);
  text(c.doc, `KEY TO SECTION ${which}-${which}`, DRAW.x, ky, 6.5, true);
  const half = Math.ceil(key.length / 2);
  const colW = DRAW.w / 2 - 10;
  keyList(c.doc, key.slice(0, half), DRAW.x, ky + 11, colW, 5.6);
  // Second column keeps the original numbering.
  let yy = ky + 11;
  key.slice(half).forEach((it, i) => {
    col(c.doc, PDF.goldInk);
    text(c.doc, String(half + i + 1), DRAW.x + colW + 20, yy, 5.6, true);
    col(c.doc, INK);
    c.doc.setFont("helvetica", "normal");
    c.doc.setFontSize(5.6);
    const lines = c.doc.splitTextToSize(sanitize(it), colW - 12) as string[];
    text(c.doc, lines.join("\n"), DRAW.x + colW + 30, yy, 5.6);
    yy += lines.length * 5.6 * 1.25 + 2;
  });
}

/* -------------------------------------------------------------- roof */

function sheetRoof(c: Ctx, m: Model) {
  const { doc } = c;
  if (!m.masonry) return sheetContainerRoof(c, m);
  const e = m.roof.eaveM;
  const RL = m.L + 2 * e;
  const RW = m.W + 2 * e;
  const planW = DRAW.w * 0.5;
  const s = pickScale(RL + 2, RW + 2, planW - 20, DRAW.h - 80);
  const k = ptPerM(s);
  newSheet(c, "S-01", "Roof plan and roof structure", `Plan 1:${s}`);
  const ox = DRAW.x + (planW - RL * k) / 2;
  const oy = DRAW.y + 20 + (DRAW.h - 80 - RW * k) / 2;
  const X = (x: number) => ox + (x + RL / 2) * k;
  const Y = (z: number) => oy + (z + RW / 2) * k;
  // Wall line below, dashed.
  col(doc, GREY);
  doc.setLineDashPattern([3, 2], 0);
  doc.setLineWidth(0.4);
  doc.rect(X(-m.L / 2), Y(-m.W / 2), m.L * k, m.W * k);
  doc.setLineDashPattern([], 0);
  col(doc, INK);
  doc.setLineWidth(0.9);
  doc.rect(X(-RL / 2), Y(-RW / 2), RL * k, RW * k);
  const arrow = (x0: number, y0: number, x1: number, y1: number) => {
    doc.setLineWidth(0.5);
    doc.line(x0, y0, x1, y1);
    const a = Math.atan2(y1 - y0, x1 - x0);
    doc.setFillColor(INK[0], INK[1], INK[2]);
    doc.triangle(
      x1,
      y1,
      x1 - 5 * Math.cos(a - 0.4),
      y1 - 5 * Math.sin(a - 0.4),
      x1 - 5 * Math.cos(a + 0.4),
      y1 - 5 * Math.sin(a + 0.4),
      "F",
    );
  };
  const spacing = trussSpacingM(m.cover);
  if (m.roof.form === "gable" || m.roof.form === "hip") {
    const rx = m.roof.form === "hip" ? Math.max(0, RL / 2 - RW / 2) : RL / 2;
    doc.setLineWidth(1);
    doc.line(X(-rx), Y(0), X(rx), Y(0));
    if (m.roof.form === "hip")
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) doc.line(X(sx * rx), Y(0), X((sx * RL) / 2), Y((sz * RW) / 2));
    // Trusses dashed.
    doc.setDrawColor(150, 104, 58);
    doc.setLineDashPattern([5, 2], 0);
    doc.setLineWidth(0.35);
    const pos = trussPositions(m.L - 0.2, spacing).map((p) => p - (m.L - 0.2) / 2);
    for (const p of pos) doc.line(X(p), Y(-m.W / 2), X(p), Y(m.W / 2));
    doc.setLineDashPattern([], 0);
    col(doc, INK);
    arrow(X(0), Y(-0.6), X(0), Y(-RW / 2 + 0.5));
    arrow(X(0), Y(0.6), X(0), Y(RW / 2 - 0.5));
    text(doc, `${m.roof.pitchDeg} deg`, X(0) + 4, Y(-RW / 4), 6, true);
    text(doc, `${m.roof.pitchDeg} deg`, X(0) + 4, Y(RW / 4) + 6, 6, true);
    if (m.roof.form === "hip") {
      arrow(X(-rx - 0.4), Y(0), X(-RL / 2 + 0.4), Y(0));
      arrow(X(rx + 0.4), Y(0), X(RL / 2 - 0.4), Y(0));
    }
    text(doc, "RIDGE", X(0), Y(0) - 3, 5.6, true, { align: "center" });
    col(doc, GREY);
    text(
      doc,
      `Trusses (dashed) at ${spacing * 1000} mm centres: ${pos.length} no.`,
      X(-RL / 2),
      Y(RW / 2) + 14,
      6,
    );
  } else if (m.roof.form === "mono") {
    arrow(X(0), Y(RW / 2 - 0.5), X(0), Y(-RW / 2 + 0.5));
    text(doc, "10 deg, falls to the back", X(0) + 4, Y(0), 6, true);
    doc.setDrawColor(150, 104, 58);
    doc.setLineDashPattern([5, 2], 0);
    doc.setLineWidth(0.3);
    for (const p of trussPositions(m.L - 0.2, 0.6).map((q) => q - (m.L - 0.2) / 2))
      doc.line(X(p), Y(-m.W / 2), X(p), Y(m.W / 2));
    doc.setLineDashPattern([], 0);
  } else {
    // Flat: falls to two outlets at the back.
    col(doc, INK);
    doc.setLineWidth(0.5);
    doc.rect(X(-m.L / 2 + 0.2), Y(-m.W / 2 + 0.2), (m.L - 0.4) * k, (m.W - 0.4) * k);
    for (const sx of [-1, 1]) {
      doc.circle(X((sx * m.L) / 3), Y(-m.W / 2 + 0.35), 2.5, "S");
      arrow(X((sx * m.L) / 3), Y(m.W / 4), X((sx * m.L) / 3), Y(-m.W / 2 + 0.7));
    }
    text(doc, "Screed to falls 1:80 to outlets, 100 mm rainwater pipes", X(0), Y(0) + 3, 6, false, {
      align: "center",
    });
  }
  dimChain(doc, [X(-RL / 2), X(RL / 2)], Y(-RW / 2) - 16, true, [RL], Y(-RW / 2) - 3);
  dimChain(doc, [Y(-RW / 2), Y(RW / 2)], X(-RL / 2) - 16, false, [RW], X(-RL / 2) - 3);
  northArrow(doc, DRAW.x + planW - 12, DRAW.y + 14);
  scaleBar(doc, s, viewTitle(doc, "8", "Roof plan", s, DRAW.x, PH - FM - 34) + 24, PH - FM - 40);

  // Truss detail on the right.
  const dx = DRAW.x + planW + 14;
  const dw = DRAW.w - planW - 14;
  if (m.roof.form === "flat") {
    detailParapet(c, dx, DRAW.y + 10, dw, 240);
    return;
  }
  const span = m.W;
  const rise =
    m.roof.form === "mono"
      ? Math.tan((10 * Math.PI) / 180) * span
      : Math.tan((m.roof.pitchDeg * Math.PI) / 180) * (span / 2);
  const ts = pickScale(span + 2 * e + 0.6, rise + 1.2, dw - 30, 240);
  const tk = ptPerM(ts);
  const bx = dx + (dw - (span + 2 * e) * tk) / 2 + e * tk;
  const by = DRAW.y + 40 + rise * tk;
  const P = (x: number, yv: number) => [bx + x * tk, by - yv * tk] as [number, number];
  const tt = trussType(span);
  doc.setDrawColor(150, 104, 58);
  const member = (a: [number, number], b: [number, number], w = 1.6) => {
    doc.setLineWidth(w);
    doc.line(a[0], a[1], b[0], b[1]);
  };
  const ex = Math.tan((m.roof.pitchDeg * Math.PI) / 180) * e;
  if (m.roof.form === "mono") {
    member(P(-e, rise + ex * 0.2), P(span + e, -ex * 0.2));
    member(P(0, 0), P(span, 0), 1.2);
    for (let i = 1; i < 4; i++)
      member(P((span * i) / 4, 0), P((span * i) / 4, rise * (1 - i / 4)), 0.9);
  } else {
    const apex = P(span / 2, rise);
    member(P(-e, -ex), apex);
    member(P(span + e, -ex), apex);
    member(P(0, 0), P(span, 0), 1.4);
    if (tt === "kingpost") {
      member(P(span / 2, 0), apex, 1);
      member(P(span / 2, 0), P(span / 4, rise / 2), 1);
      member(P(span / 2, 0), P((3 * span) / 4, rise / 2), 1);
    } else {
      member(P(span / 3, 0), P(span / 4, rise / 2), 1);
      member(P(span / 3, 0), apex, 1);
      member(P((2 * span) / 3, 0), P((3 * span) / 4, rise / 2), 1);
      member(P((2 * span) / 3, 0), apex, 1);
    }
    // Purlins.
    doc.setFillColor(INK[0], INK[1], INK[2]);
    const purl = m.cover === "tiles" ? 0.32 : 0.9;
    const slope = Math.hypot(span / 2 + e, rise + ex);
    for (let d = 0.15; d < slope - 0.1; d += purl)
      for (const side of [0, 1]) {
        const f = d / slope;
        const a = side ? P(span + e, -ex) : P(-e, -ex);
        doc.rect(a[0] + (apex[0] - a[0]) * f - 1.2, a[1] + (apex[1] - a[1]) * f - 4, 2.4, 2.4, "F");
      }
  }
  // Wall plates and walls.
  doc.setFillColor(POCHE[0], POCHE[1], POCHE[2]);
  col(doc, INK);
  for (const x of [0, span]) {
    doc.setLineWidth(0.4);
    doc.rect(P(x, 0)[0] - 0.1 * tk, P(x, 0)[1] + 0.05 * tk, 0.2 * tk, 0.5 * tk, "FD");
  }
  dimChain(doc, [P(0, 0)[0], P(span, 0)[0]], P(0, 0)[1] + 0.75 * tk, true, [span]);
  if (m.roof.form !== "mono")
    dimChain(doc, [P(0, rise)[1], P(0, 0)[1]], P(-e, 0)[0] - 12, false, [rise]);
  viewTitle(
    doc,
    "9",
    m.roof.form === "mono"
      ? "Typical rafter layout"
      : `Typical ${tt === "fink" ? "Fink" : "king-post"} truss`,
    ts,
    dx,
    DRAW.y + 14,
  );
  col(doc, INK);
  const notes = [
    `Pitch ${m.roof.form === "mono" ? 10 : m.roof.pitchDeg} degrees, ${Math.round(e * 1000)} mm eaves. ${ROOF_LABEL[m.roof.form]}.`,
    m.roof.form === "mono"
      ? "Rafters 50 x 150 mm at 600 mm centres (or light steel C-channels), bearing on the ring beam at both ends."
      : `Rafters and tie beam 50 x 150 mm; struts and ${tt === "fink" ? "webs" : "king post"} 50 x 100 mm; trusses at ${spacing * 1000} mm centres, braced diagonally under the ridge and at both ends.`,
    m.cover === "tiles"
      ? "Battens 50 x 25 mm at the tile gauge (about 320 mm); underlay under the battens."
      : "Purlins 50 x 50 mm at 900 mm centres; sheets fixed with roofing screws and washers on every second corrugation.",
    "All timber pressure-treated against termites and rot; galvanised fixings; truss sizes to be checked by the engineer for the actual span and roof load.",
  ];
  keyList(doc, notes, dx, DRAW.y + 66 + (rise + 1.2) * tk, dw, 6);
}

function sheetContainerRoof(c: Ctx, m: Model) {
  const { doc, o } = c;
  const planW = DRAW.w * 0.55;
  const s = pickScale(m.L + 2, m.W + 2, planW - 20, DRAW.h - 80);
  const k = ptPerM(s);
  newSheet(c, "S-01", "Roof plan and roof structure", `Plan 1:${s}`);
  const ox = DRAW.x + (planW - m.L * k) / 2 + (m.L / 2) * k;
  const oy = DRAW.y + 30 + (DRAW.h - 90) / 2;
  const top = Math.max(...o.outlines.map((r) => r.level));
  col(doc, INK);
  for (const r of o.outlines) {
    doc.setLineWidth(r.level === top ? 0.9 : 0.3);
    if (r.level !== top) doc.setLineDashPattern([3, 2], 0);
    doc.rect(ox + r.x0 * k, oy + r.z0 * k, (r.x1 - r.x0) * k, (r.z1 - r.z0) * k);
    doc.setLineDashPattern([], 0);
    if (r.level === top) {
      doc.setDrawColor(150, 112, 78);
      doc.setLineWidth(0.2);
      for (let x = r.x0 + 0.3; x < r.x1 - 0.1; x += 0.3)
        doc.line(ox + x * k, oy + (r.z0 + 0.05) * k, ox + x * k, oy + (r.z1 - 0.05) * k);
      col(doc, INK);
    }
  }
  northArrow(doc, DRAW.x + planW - 12, DRAW.y + 14);
  scaleBar(
    doc,
    s,
    viewTitle(doc, "8", "Roof plan (tops of the units)", s, DRAW.x, PH - FM - 34) + 24,
    PH - FM - 40,
  );
  const dx = DRAW.x + planW + 14;
  col(doc, INK);
  text(doc, "ROOF NOTES", dx, DRAW.y + 14, 7.5, true);
  keyList(
    doc,
    [
      "Container roofs are corrugated steel and shed water to the edges; seal any cut or welded joints.",
      "In hot areas, a ventilated lean-to roof of iron sheet on light steel or timber rafters, about 300 mm above the containers, keeps the units much cooler.",
      "Add gutters and downpipes along the low edge, and paint the roof white or with a reflective coating.",
      "Any roof structure added on top is designed by the engineer for wind uplift.",
    ],
    dx,
    DRAW.y + 28,
    DRAW.w - planW - 14,
    6.2,
  );
}

function detailParapet(c: Ctx, x: number, y: number, w: number, h: number) {
  const { doc } = c;
  const s = 20;
  const k = ptPerM(s);
  const bx = x + 30;
  const by = y + 40;
  doc.setFillColor(POCHE[0], POCHE[1], POCHE[2]);
  col(doc, INK);
  doc.setLineWidth(0.5);
  doc.rect(bx, by, 0.2 * k, 1.2 * k, "FD");
  doc.setFillColor(214, 214, 206);
  doc.rect(bx + 0.2 * k, by + TYPICAL.parapet * k, 1.4 * k, TYPICAL.roofSlab * k, "FD");
  hatch(doc, bx + 0.2 * k, by + TYPICAL.parapet * k, 1.4 * k, TYPICAL.roofSlab * k, 2.4);
  doc.rect(bx - 0.03 * k, by - 0.05 * k, 0.26 * k, 0.05 * k, "FD");
  doc.setDrawColor(PDF.red[0], PDF.red[1], PDF.red[2]);
  doc.setLineWidth(1.1);
  doc.line(bx + 0.2 * k, by + 0.35 * k, bx + 0.2 * k, by + (TYPICAL.parapet - 0.04) * k);
  doc.line(
    bx + 0.2 * k,
    by + (TYPICAL.parapet - 0.04) * k,
    bx + 1.6 * k,
    by + (TYPICAL.parapet - 0.02) * k,
  );
  viewTitle(doc, "9", "Parapet and roof slab detail", s, x, y + 14);
  keyList(
    doc,
    [
      `RC roof slab ${Math.round(TYPICAL.roofSlab * 1000)} mm C25, reinforcement to the engineer's design.`,
      "Screed to falls 1:80; torch-on membrane (red) turned 150 mm up the parapet into a chase.",
      `Parapet ${Math.round(TYPICAL.parapet * 1000)} mm high, 200 mm walling, precast coping with drip.`,
    ],
    x,
    by + 1.4 * k + 20,
    w,
    6,
  );
}

/* ------------------------------------------------------------ foundation */

function sheetFoundation(c: Ctx, m: Model) {
  const { doc, o } = c;
  const planW = DRAW.w * 0.56;
  const s = pickScale(m.L + 2, m.W + 2, planW - 30, DRAW.h - 80);
  const k = ptPerM(s);
  newSheet(c, "S-02", "Foundation plan and details", `Plan 1:${s}, details 1:20`);
  const minX = Math.min(-m.L / 2, ...o.outlines.map((r) => r.x0));
  const maxX = Math.max(m.L / 2, ...o.outlines.map((r) => r.x1));
  const minZ = Math.min(-m.W / 2, ...o.outlines.map((r) => r.z0));
  const maxZ = Math.max(m.W / 2, ...o.outlines.map((r) => r.z1));
  const ox = DRAW.x + 30 + (planW - 30 - (maxX - minX) * k) / 2;
  const oy = DRAW.y + 24 + (DRAW.h - 90 - (maxZ - minZ) * k) / 2;
  const X = (x: number) => ox + (x - minX) * k;
  const Y = (z: number) => oy + (z - minZ) * k;
  const kind = o.foundation.kind;
  doc.setFillColor(222, 222, 214);
  col(doc, INK);
  doc.setLineWidth(0.4);
  if (kind === "container_pads" || kind === "container_piers") {
    const is40 = o.structure === "container_40ft";
    for (const r of o.outlines.filter((q) => q.level === 0)) {
      doc.setLineDashPattern([3, 2], 0);
      doc.rect(X(r.x0), Y(r.z0), (r.x1 - r.x0) * k, (r.z1 - r.z0) * k);
      doc.setLineDashPattern([], 0);
      const xs = is40 ? [r.x0 + 0.2, (r.x0 + r.x1) / 2, r.x1 - 0.2] : [r.x0 + 0.2, r.x1 - 0.2];
      for (const x of xs)
        for (const z of [r.z0 + 0.2, r.z1 - 0.2]) {
          doc.rect(X(x) - 0.45 * k, Y(z) - 0.45 * k, 0.9 * k, 0.9 * k, "FD");
          hatch(doc, X(x) - 0.45 * k, Y(z) - 0.45 * k, 0.9 * k, 0.9 * k, 2.2);
        }
    }
  } else if (kind === "columns_beams") {
    const L = m.L;
    const W = m.W;
    const nx = Math.max(2, Math.ceil(L / 3.5) + 1);
    const nz = Math.max(2, Math.ceil(W / 3.5) + 1);
    for (const z of [-W / 2 + 0.2, W / 2 - 0.2])
      doc.rect(X(-L / 2), Y(z) - 0.125 * k, L * k, 0.25 * k, "FD");
    for (const x of [-L / 2 + 0.2, L / 2 - 0.2])
      doc.rect(X(x) - 0.125 * k, Y(-W / 2), 0.25 * k, W * k, "FD");
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++) {
        const x = -L / 2 + 0.2 + ((L - 0.4) * i) / (nx - 1);
        const z = -W / 2 + 0.2 + ((W - 0.4) * j) / (nz - 1);
        doc.setFillColor(222, 222, 214);
        doc.rect(X(x) - 0.5 * k, Y(z) - 0.5 * k, k, k, "FD");
        hatch(doc, X(x) - 0.5 * k, Y(z) - 0.5 * k, k, k, 2.2);
        doc.setFillColor(POCHE[0], POCHE[1], POCHE[2]);
        doc.rect(X(x) - 0.15 * k, Y(z) - 0.15 * k, 0.3 * k, 0.3 * k, "FD");
      }
  } else {
    for (const w of m.walls) {
      const fw = w.exterior ? TYPICAL.footingW : TYPICAL.footingInnerW;
      doc.setFillColor(222, 222, 214);
      if (w.axis === "x") {
        const a = w.exterior ? w.from : w.from - (TYPICAL.footingW - 0.2) / 2;
        const b = w.exterior ? w.to : w.to + (TYPICAL.footingW - 0.2) / 2;
        doc.rect(
          X(a - (w.exterior ? (fw - w.thick) / 2 : 0)),
          Y(w.at) - (fw * k) / 2,
          (b - a + (w.exterior ? fw - w.thick : 0)) * k,
          fw * k,
          "FD",
        );
        hatch(
          doc,
          X(a - (w.exterior ? (fw - w.thick) / 2 : 0)),
          Y(w.at) - (fw * k) / 2,
          (b - a + (w.exterior ? fw - w.thick : 0)) * k,
          fw * k,
          3,
        );
      } else {
        doc.rect(X(w.at) - (fw * k) / 2, Y(w.from), fw * k, (w.to - w.from) * k, "FD");
        hatch(doc, X(w.at) - (fw * k) / 2, Y(w.from), fw * k, (w.to - w.from) * k, 3);
      }
    }
    // Walls above, as lines.
    col(doc, INK);
    doc.setLineWidth(0.3);
    for (const w of m.walls) {
      if (w.axis === "x") {
        doc.line(X(w.from), Y(w.at - w.thick / 2), X(w.to), Y(w.at - w.thick / 2));
        doc.line(X(w.from), Y(w.at + w.thick / 2), X(w.to), Y(w.at + w.thick / 2));
      } else {
        doc.line(X(w.at - w.thick / 2), Y(w.from), X(w.at - w.thick / 2), Y(w.to));
        doc.line(X(w.at + w.thick / 2), Y(w.from), X(w.at + w.thick / 2), Y(w.to));
      }
    }
    // Detail marker on the front wall footing.
    doc.setFillColor(255, 255, 255);
    col(doc, PDF.red);
    doc.circle(X(minX + 1.2), Y(maxZ) + 12, 6, "FD");
    text(doc, "11", X(minX + 1.2), Y(maxZ) + 14, 5.6, true, { align: "center" });
  }
  dimChain(doc, [X(minX), X(maxX)], Y(minZ) - 16, true, [maxX - minX], Y(minZ) - 3);
  dimChain(doc, [Y(minZ), Y(maxZ)], X(minX) - 16, false, [maxZ - minZ], X(minX) - 3);
  northArrow(doc, DRAW.x + planW - 6, DRAW.y + 14);
  const fEnd = viewTitle(doc, "10", "Foundation plan", s, DRAW.x, PH - FM - 34);
  scaleBar(doc, s, fEnd + 24, PH - FM - 40);
  col(doc, GREY);
  text(
    doc,
    `${o.foundation.name}. Footings hatched; walls above as thin lines.`,
    DRAW.x,
    PH - FM - 24,
    5.8,
  );

  // Detail on the right.
  const dx = DRAW.x + planW + 20;
  const dw = DRAW.w - planW - 20;
  if (kind === "container_pads" || kind === "container_piers")
    detailPad(c, m, dx, DRAW.y, dw, kind === "container_piers");
  else if (kind === "columns_beams") detailColumn(c, m, dx, DRAW.y, dw);
  else detailStrip(c, m, dx, DRAW.y, dw, kind === "raised_plinth");
}

function detailStrip(c: Ctx, m: Model, x: number, y: number, w: number, raised: boolean) {
  const { doc } = c;
  const s = 25;
  const k = ptPerM(s);
  const plinth = raised ? Math.max(0.45, m.plinth + 0.3) : Math.max(0.15, m.plinth + m.floor);
  const fd = TYPICAL.footingDepth;
  const gx = x + 50;
  const gy = y + 40 + (plinth + 0.5) * k;
  const wallT = 0.2;
  // Ground.
  groundLine(doc, gx - 30, gx + 1.3 * k, gy, 8);
  // Footing.
  const fw = TYPICAL.footingW;
  doc.setFillColor(214, 214, 206);
  col(doc, INK);
  doc.setLineWidth(0.5);
  doc.rect(
    gx + ((wallT - fw) / 2) * k,
    gy + (fd - TYPICAL.footingT) * k,
    fw * k,
    TYPICAL.footingT * k,
    "FD",
  );
  hatch(
    doc,
    gx + ((wallT - fw) / 2) * k,
    gy + (fd - TYPICAL.footingT) * k,
    fw * k,
    TYPICAL.footingT * k,
    2.6,
  );
  // Foundation wall and wall above.
  doc.setFillColor(POCHE_IN[0], POCHE_IN[1], POCHE_IN[2]);
  doc.rect(gx, gy - plinth * k, wallT * k, (fd - TYPICAL.footingT + plinth) * k, "FD");
  doc.setFillColor(POCHE[0], POCHE[1], POCHE[2]);
  doc.rect(gx, y + 30, wallT * k, gy - plinth * k - (y + 30), "FD");
  // DPC.
  doc.setDrawColor(PDF.red[0], PDF.red[1], PDF.red[2]);
  doc.setLineWidth(1.2);
  doc.line(gx, gy - plinth * k, gx + wallT * k, gy - plinth * k);
  // Slab layers inside.
  const sx = gx + wallT * k;
  const sw = 1.1 * k;
  const slabTop = gy - plinth * k;
  const yScreed = slabTop;
  const ySlab = slabTop + TYPICAL.screed * k;
  const yDpm = ySlab + TYPICAL.slab * k;
  const yHard = yDpm + TYPICAL.blinding * k;
  doc.setFillColor(236, 232, 222);
  col(doc, INK);
  doc.setLineWidth(0.4);
  doc.rect(sx, yScreed, sw, TYPICAL.screed * k, "FD");
  doc.setFillColor(214, 214, 206);
  doc.rect(sx, ySlab, sw, TYPICAL.slab * k, "FD");
  hatch(doc, sx, ySlab, sw, TYPICAL.slab * k, 2.6);
  doc.setDrawColor(INK[0], INK[1], INK[2]);
  doc.setLineDashPattern([2, 1], 0);
  doc.line(sx + 2, ySlab + TYPICAL.slab * k * 0.4, sx + sw - 2, ySlab + TYPICAL.slab * k * 0.4);
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(PDF.red[0], PDF.red[1], PDF.red[2]);
  doc.setLineWidth(0.9);
  doc.line(sx, yDpm, sx + sw, yDpm);
  doc.setFillColor(242, 236, 214);
  col(doc, INK);
  doc.setLineWidth(0.3);
  doc.rect(sx, yDpm, sw, TYPICAL.blinding * k, "FD");
  const hardH = Math.max(
    TYPICAL.hardcore,
    plinth - TYPICAL.screed - TYPICAL.slab - TYPICAL.blinding,
  );
  stipple(doc, sx, yHard, sw, hardH * k, 0.12);
  doc.rect(sx, yHard, sw, hardH * k, "S");
  const keys = [
    "Wall: 200 mm machine-cut stone, cement-sand mortar 1:4, hoop iron every second course.",
    "Damp-proof course (red): bituminous felt or 1000-gauge polythene, lapped 150 mm, at floor level.",
    "Floor finish on 30 mm cement-sand screed.",
    "Ground slab: 100 mm C20 (1:2:4) with A142 mesh (dashed), 25 mm cover.",
    "Damp-proof membrane (red): 1000-gauge polythene, laps taped and turned up the wall.",
    "Blinding: 50 mm murram or quarry dust, sprayed with anti-termite treatment.",
    `Hardcore: ${raised ? "compacted fill in 150 mm layers, then " : ""}230 mm broken stone, well compacted.`,
    `Foundation walling to ${raised ? "a raised plinth on the low side" : "plinth height"}, in the same stone and mortar.`,
    `Strip footing: ${Math.round(fw * 1000)} x ${Math.round(TYPICAL.footingT * 1000)} mm C15 concrete, bottom at least ${fd.toFixed(1)} m below ground on firm soil.`,
  ];
  callout(doc, 1, gx + wallT * k * 0.5, y + 46, gx - 24, y + 46);
  callout(doc, 2, gx + wallT * k, gy - plinth * k, gx - 24, gy - plinth * k - 8);
  callout(doc, 3, sx + sw * 0.7, yScreed + 1, sx + sw + 12, yScreed - 6);
  callout(doc, 4, sx + sw * 0.7, ySlab + 3, sx + sw + 12, ySlab + 4);
  callout(doc, 5, sx + sw * 0.6, yDpm, sx + sw + 12, yDpm + 10);
  callout(doc, 6, sx + sw * 0.5, yDpm + 2, sx + sw + 12, yDpm + 20);
  callout(
    doc,
    7,
    sx + sw * 0.4,
    yHard + (hardH * k) / 2,
    sx + sw + 12,
    yHard + (hardH * k) / 2 + 12,
  );
  callout(doc, 8, gx + wallT * k * 0.5, gy + 0.4 * k, gx - 24, gy + 0.4 * k);
  callout(
    doc,
    9,
    gx + ((wallT - fw) / 2) * k + 3,
    gy + (fd - 0.1) * k,
    gx - 24,
    gy + (fd - 0.05) * k,
  );
  // Dimensions.
  dimChain(
    doc,
    [gx + ((wallT - fw) / 2) * k, gx + ((wallT + fw) / 2) * k],
    gy + fd * k + 12,
    true,
    [fw],
  );
  dimChain(
    doc,
    [gy - plinth * k, gy, gy + fd * k],
    gx + 1.3 * k + 16,
    false,
    [plinth, fd],
    gx + 1.3 * k,
  );
  viewTitle(
    doc,
    "11",
    raised ? "Stepped strip footing, raised plinth" : "Typical strip footing and floor",
    s,
    x,
    y + 14,
  );
  keyList(doc, keys, x, gy + fd * k + 34, w, 5.6);
}

function detailColumn(c: Ctx, m: Model, x: number, y: number, w: number) {
  const { doc } = c;
  const s = 25;
  const k = ptPerM(s);
  const gx = x + 60;
  const gy = y + 70;
  groundLine(doc, gx - 40, gx + 1.4 * k, gy, 8);
  doc.setFillColor(214, 214, 206);
  col(doc, INK);
  doc.setLineWidth(0.5);
  const pd = 1.2;
  doc.rect(gx - 0.5 * k, gy + (pd - 0.35) * k, k, 0.35 * k, "FD");
  hatch(doc, gx - 0.5 * k, gy + (pd - 0.35) * k, k, 0.35 * k, 2.6);
  doc.rect(gx - 0.15 * k, gy - 0.15 * k, 0.3 * k, (pd - 0.2) * k, "FD");
  hatch(doc, gx - 0.15 * k, gy - 0.15 * k, 0.3 * k, (pd - 0.2) * k, 3);
  doc.rect(gx - 0.15 * k, gy - 0.15 * k, 1.3 * k, 0.4 * k, "FD");
  hatch(doc, gx - 0.15 * k, gy - 0.15 * k, 1.3 * k, 0.4 * k, 2.6);
  callout(doc, 1, gx, gy + (pd - 0.15) * k, gx - 50, gy + (pd - 0.1) * k);
  callout(doc, 2, gx, gy + 0.5 * k, gx - 50, gy + 0.5 * k);
  callout(doc, 3, gx + 0.8 * k, gy, gx + 0.8 * k, gy - 24);
  dimChain(doc, [gx - 0.5 * k, gx + 0.5 * k], gy + pd * k + 12, true, [1.0]);
  dimChain(doc, [gy, gy + pd * k], gx + 1.4 * k + 12, false, [pd]);
  viewTitle(doc, "11", "Column, pad footing and ground beam", s, x, y + 14);
  keyList(
    doc,
    [
      "Pad footing 1000 x 1000 x 350 mm C25 with Y12 bars at 150 mm both ways, on 50 mm blinding; depth set by the engineer.",
      "Column 300 x 300 mm C25, 4 Y16 bars, R8 links at 150 mm, up to the ground beam.",
      "Ground beam 250 x 400 mm C25 tying every column, carrying the walls and a suspended slab.",
      "On a steep plot the engineer may prefer terraces cut into the slope; this is one common answer, not the design.",
    ],
    x,
    gy + pd * k + 34,
    w,
    6,
  );
}

function detailPad(c: Ctx, m: Model, x: number, y: number, w: number, pier: boolean) {
  const { doc } = c;
  const s = 20;
  const k = ptPerM(s);
  const gx = x + 70;
  const gy = y + 60;
  groundLine(doc, gx - 50, gx + 1.0 * k, gy, 8);
  doc.setFillColor(214, 214, 206);
  col(doc, INK);
  doc.setLineWidth(0.5);
  doc.rect(gx - 0.45 * k, gy + 0.3 * k, 0.9 * k, 0.3 * k, "FD");
  hatch(doc, gx - 0.45 * k, gy + 0.3 * k, 0.9 * k, 0.3 * k, 2.4);
  const ph = pier ? 0.6 : 0.3;
  const s2 = pier ? 0.4 : 0.55;
  doc.rect(gx - (s2 / 2) * k, gy - ph * k, s2 * k, (0.3 + ph) * k, "FD");
  hatch(doc, gx - (s2 / 2) * k, gy - ph * k, s2 * k, (0.3 + ph) * k, 3);
  doc.setFillColor(80, 80, 80);
  doc.rect(gx - ((s2 + 0.05) / 2) * k, gy - ph * k - 0.012 * k, (s2 + 0.05) * k, 0.012 * k, "FD");
  doc.setFillColor(150, 112, 78);
  doc.rect(gx - 0.1 * k, gy - ph * k - 0.012 * k - 0.16 * k, 0.6 * k, 0.16 * k, "FD");
  callout(doc, 1, gx, gy + 0.45 * k, gx - 60, gy + 0.45 * k);
  callout(doc, 2, gx, gy - 0.1 * k, gx - 60, gy - 0.1 * k);
  callout(doc, 3, gx, gy - ph * k - 1, gx - 60, gy - ph * k - 12);
  callout(doc, 4, gx + 0.3 * k, gy - ph * k - 0.1 * k, gx + 0.7 * k, gy - ph * k - 30);
  dimChain(doc, [gx - 0.45 * k, gx + 0.45 * k], gy + 0.6 * k + 12, true, [0.9]);
  viewTitle(
    doc,
    "11",
    pier ? "Pier on pad footing (container corner)" : "Pad footing (container corner)",
    s,
    x,
    y + 14,
  );
  keyList(
    doc,
    [
      "Pad 900 x 900 x 300 mm C25 with a Y12 mesh, on firm ground below the topsoil.",
      pier
        ? "Pier 400 x 400 mm C25, heights varied to level the units on the slope."
        : "Plinth 550 x 550 mm C25, about 300 mm above ground.",
      "10 mm steel plate with four anchors cast in; the container corner casting is welded or bolted to it.",
      "Container corner casting. Pads under every corner (and mid-length on 40 ft units).",
    ],
    x,
    gy + 0.6 * k + 34,
    w,
    6,
  );
}

/* ------------------------------------------------------------- schedules */

function sheetSchedules(c: Ctx, m: Model) {
  const { doc, o } = c;
  newSheet(c, "A-06", "Schedules and specification", "No scale");
  let y = DRAW.y + 6;
  const x = DRAW.x;
  const table = (cols: Array<{ h: string; w: number }>, rows: string[][], title: string) => {
    col(doc, INK);
    text(doc, title.toUpperCase(), x, y, 7.5, true);
    y += 6;
    doc.setFillColor(235, 238, 232);
    doc.rect(
      x,
      y,
      cols.reduce((s2, q) => s2 + q.w, 0),
      11,
      "F",
    );
    let cx = x;
    for (const q of cols) {
      text(doc, q.h, cx + 3, y + 7.6, 5.8, true);
      cx += q.w;
    }
    y += 11;
    doc.setLineWidth(0.25);
    doc.setDrawColor(210, 210, 204);
    for (const r of rows) {
      cx = x;
      r.forEach((v, i) => {
        text(doc, v, cx + 3, y + 7.2, 5.8);
        cx += cols[i].w;
      });
      doc.line(x, y + 10, cx, y + 10);
      y += 10;
    }
    y += 12;
  };
  const sched = openingSchedule(m.walls);
  if (sched.length)
    table(
      [
        { h: "Mark", w: 34 },
        { h: "Type", w: 70 },
        { h: "Width", w: 46 },
        { h: "Height", w: 46 },
        { h: "Sill", w: 40 },
        { h: "No.", w: 30 },
        { h: "Where", w: 50 },
        { h: "Frame and glazing", w: 290 },
      ],
      sched.map((q) => [
        q.mark,
        q.kind === "door" ? "Door" : q.kind === "window" ? "Window" : "Open archway",
        `${Math.round(q.width * 1000)}`,
        `${Math.round(q.height * 1000)}`,
        q.kind === "window" ? `${Math.round(q.sill * 1000)}` : "-",
        String(q.count),
        q.outside ? "Outside" : "Inside",
        q.kind === "window"
          ? q.height < 0.8
            ? "Aluminium or steel casement, obscured glass, top-hung vent (wet room)."
            : "Aluminium or steel casement, 5 mm clear glass, mosquito mesh, burglar bars inside."
          : q.kind === "door"
            ? q.outside
              ? "Solid hardwood or steel security door, 3-lever lock, weather bar."
              : "Flush or panel door in a hardwood frame, mortice lock."
            : "Plastered reveals, no leaf.",
      ]),
      "Door and window schedule (sizes in mm)",
    );
  const rooms = o.rooms.filter((r) => r.name !== "Outside stair");
  const wet = (n: string) => /bath|kitchen|shower|wc/i.test(n);
  table(
    [
      { h: "Room", w: 110 },
      { h: "Area m²", w: 46 },
      { h: "Floor", w: 150 },
      { h: "Walls", w: 150 },
      { h: "Ceiling", w: 140 },
    ],
    rooms.map((r) => [
      r.name,
      ((r.x1 - r.x0) * (r.z1 - r.z0)).toFixed(1),
      wet(r.name)
        ? "Non-slip ceramic tiles"
        : /bed/i.test(r.name) && o.style.floor === "carpet"
          ? "Carpet on underlay"
          : FLOOR_LABEL[o.style.floor].replace(
              /, tiles elsewhere|Carpet in bedrooms/i,
              "Porcelain tiles",
            ),
      wet(r.name) ? "Ceramic tiles to 1.8 m, plaster and paint above" : "Plaster, 3 coats emulsion",
      m.masonry ? CEILING_LABEL[o.style.ceiling] : "Insulated lining boards",
    ]),
    "Room and finishes schedule",
  );
  const notesY = y;
  col(doc, INK);
  text(doc, "GENERAL SPECIFICATION", x, y, 7.5, true);
  y += 10;
  const spec = m.masonry
    ? [
        "Concrete: C15 for footings, C20 for slabs and ring beams, C25 for columns and roof slabs; 25 mm cover inside, 40 mm against earth.",
        "Reinforcement: high-yield (Y) and mild steel (R) bars to KS EAS 412; A142 mesh in the ground slab.",
        "Walling: machine-cut stone 200 mm outside, 100 mm blocks or stone inside, cement-sand mortar 1:4, hoop iron every second course.",
        `Roof: ${ROOF_LABEL[o.style.roof]} with ${m.cover === "tiles" ? "clay or concrete tiles" : m.cover === "sheet" ? "pre-painted iron sheet" : "an RC slab and membrane"}; timber treated against termites and rot.`,
        "Plaster: 12 mm cement-sand 1:4 inside, 15 mm render outside; paint to the chosen colours.",
        "Services: rainwater goods to a soakaway or tank; drainage and electrical layouts by the respective engineers.",
      ]
    : [
        "Containers: ISO units, cut openings framed with steel box sections, rust-treated and painted.",
        "Insulation: 50 mm insulation and lining boards inside; a ventilated roof over the units is recommended in hot areas.",
        "Fixing: corner castings welded or bolted to plates cast into the footings; stacked units twist-locked.",
        "Services: rainwater goods, drainage and electrical layouts by the respective engineers.",
      ];
  y = keyList(doc, spec, x, y, 420, 6);
  // Right column: who signs and what still has to be done.
  const rx = x + 440;
  let ry = notesY;
  col(doc, INK);
  text(doc, "BEFORE ANYTHING IS BUILT", rx, ry, 7.5, true);
  ry += 10;
  keyList(
    doc,
    [
      "A licensed surveyor confirms the beacons and the house position against the building lines.",
      "A soil test (trial pits) confirms the footing depth; black cotton soil needs a different foundation.",
      "A registered architect turns these drawings into approval drawings; a structural engineer designs and signs the structure.",
      "The county approves the plans; the NCA registers the project and the contractor.",
      `Ground reading: ${o.dropM == null ? "none at this point" : `about ${o.dropM.toFixed(2)} m fall under the footprint`} on a 30-90 m public grid; a level survey shows the real fall.`,
    ],
    rx,
    ry,
    DRAW.w - 440,
    6,
  );
}

/* ------------------------------------------------------------------ main */

/** Number of sheets the set will add (for "sheet n of N"). */
export function drawingSheetCount(): number {
  return 8;
}

/** Add the drawing set to `doc` as landscape A4 sheets. */
export function addDrawingSet(doc: jsPDF, o: DrawingSetInput): void {
  const m = model(o);
  const c: Ctx = { doc, o, sheet: 0, total: drawingSheetCount() };
  sheetPlan(c, m);
  sheetElevations(c, m, ["south", "north"], "A-02", 2);
  sheetElevations(c, m, ["east", "west"], "A-03", 4);
  sheetSection(c, m, "A");
  sheetSection(c, m, "B");
  sheetRoof(c, m);
  sheetFoundation(c, m);
  sheetSchedules(c, m);
}
