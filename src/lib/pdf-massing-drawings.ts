/**
 * Drawings for the parcel report: the brief's massing block on the plot,
 * with dimensions, two elevations, a section and a room-area diagram.
 *
 * Everything here is drawn from numbers the household entered (rooms,
 * storeys, setbacks) and the boundary they sketched. It is a massing study:
 * a box of the right size in the right place, not a design. Every drawing
 * says so on its face, because a dimensioned drawing looks authoritative.
 */
import type jsPDF from "jspdf";
import { PDF, sanitize, type RGB } from "@/lib/pdf-chrome";
import type { LocalXY } from "@/lib/parcel-geometry";
import type { MassingStudy } from "@/lib/house-brief";

type Box = { x: number; y: number; w: number; h: number };

const ink = (doc: jsPDF, c: RGB) => {
  doc.setDrawColor(c[0], c[1], c[2]);
  doc.setTextColor(c[0], c[1], c[2]);
};

/** A dimension line with ticks and a centred label, in page points. */
export function dimLine(
  doc: jsPDF,
  a: { x: number; y: number },
  b: { x: number; y: number },
  text: string,
  offset = 0,
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const ax = a.x + nx * offset;
  const ay = a.y + ny * offset;
  const bx = b.x + nx * offset;
  const by = b.y + ny * offset;
  ink(doc, PDF.forest);
  doc.setLineWidth(0.5);
  doc.line(ax, ay, bx, by);
  const t = 3;
  doc.line(
    ax - nx * t + (dx / len) * t,
    ay - ny * t + (dy / len) * t,
    ax + nx * t - (dx / len) * t,
    ay + ny * t - (dy / len) * t,
  );
  doc.line(
    bx - nx * t + (dx / len) * t,
    by - ny * t + (dy / len) * t,
    bx + nx * t - (dx / len) * t,
    by + ny * t - (dy / len) * t,
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  const angle = (-Math.atan2(dy, dx) * 180) / Math.PI;
  const upright = angle > 90 || angle < -90 ? angle + 180 : angle;
  doc.text(sanitize(text), (ax + bx) / 2 + nx * 7, (ay + by) / 2 + ny * 7, {
    align: "center",
    angle: upright,
  });
}

/** Distance from a point along a direction to the first crossing of a ring, or null. */
export function rayToRing(
  ring: LocalXY[],
  from: LocalXY,
  dir: LocalXY,
): { d: number; hit: LocalXY } | null {
  let best: number | null = null;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    const ex = q.x - p.x;
    const ey = q.y - p.y;
    const den = dir.x * ey - dir.y * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((p.x - from.x) * ey - (p.y - from.y) * ex) / den;
    const u = ((p.x - from.x) * dir.y - (p.y - from.y) * dir.x) / den;
    if (t > 1e-6 && u >= 0 && u <= 1 && (best === null || t < best)) best = t;
  }
  return best === null
    ? null
    : { d: best, hit: { x: from.x + dir.x * best, y: from.y + dir.y * best } };
}

/**
 * Gaps from each side of the block to the boundary, measured square off the
 * middle of each side: what a builder would tape on site.
 */
export function blockClearances(block: LocalXY[], boundary: LocalXY[]) {
  const out: Array<{ from: LocalXY; to: LocalXY; m: number }> = [];
  if (block.length !== 4 || boundary.length < 3) return out;
  const c = {
    x: block.reduce((a, p) => a + p.x, 0) / 4,
    y: block.reduce((a, p) => a + p.y, 0) / 4,
  };
  for (let i = 0; i < 4; i++) {
    const p = block[i];
    const q = block[(i + 1) % 4];
    const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    const len = Math.hypot(mid.x - c.x, mid.y - c.y) || 1;
    const dir = { x: (mid.x - c.x) / len, y: (mid.y - c.y) / len };
    const hit = rayToRing(boundary, mid, dir);
    if (hit) out.push({ from: mid, to: hit.hit, m: hit.d });
  }
  return out;
}

/** Fit metres into a box at one scale; returns the scale and a mapper. */
function frame(box: Box, wM: number, hM: number, pad = 18) {
  const s = Math.min(
    (box.w - pad * 2) / Math.max(wM, 1e-6),
    (box.h - pad * 2) / Math.max(hM, 1e-6),
  );
  return { s, ox: box.x + (box.w - wM * s) / 2, oy: box.y + (box.h - hM * s) / 2 };
}

function caption(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  ink(doc, PDF.goldInk);
  doc.text(sanitize(text.toUpperCase()), x, y);
}

/**
 * Front and side elevation of the massing block: outline, storey lines,
 * ground line, overall height, width and depth. No roof is drawn, because
 * the study fixes no roof; the height is to the top floor level.
 */
export function drawElevation(
  doc: jsPDF,
  box: Box,
  title: string,
  lengthM: number,
  study: MassingStudy,
) {
  caption(doc, title, box.x, box.y - 6);
  const storeys = Math.max(1, study.storeysRequested);
  const heightM = Math.max(2.4, study.heightM);
  // Room above for an indicative 25-degree roof over the narrower span.
  const roofRise = Math.min(lengthM, 14) * 0.5 * Math.tan((25 * Math.PI) / 180);
  const f = frame(box, lengthM + 4, heightM + roofRise + 2.5);
  const gx0 = f.ox;
  const gx1 = f.ox + (lengthM + 4) * f.s;
  const gy = f.oy + (heightM + roofRise + 1.5) * f.s;
  const x0 = f.ox + 2 * f.s;
  const x1 = x0 + lengthM * f.s;
  const top = gy - heightM * f.s;
  // Ground.
  ink(doc, PDF.stone2);
  doc.setLineWidth(1.2);
  doc.line(gx0, gy, gx1, gy);
  doc.setLineWidth(0.3);
  for (let x = gx0; x < gx1; x += 6) doc.line(x, gy + 4, x + 4, gy);
  // Block and storey lines.
  doc.setFillColor(250, 243, 226);
  ink(doc, PDF.goldInk);
  doc.setLineWidth(1);
  doc.rect(x0, top, x1 - x0, gy - top, "FD");
  doc.setLineWidth(0.4);
  for (let k = 1; k < storeys; k++) {
    const y = gy - (heightM / storeys) * k * f.s;
    doc.line(x0, y, x1, y);
  }
  // Indicative roof, dashed: the study fixes no roof form.
  ink(doc, PDF.stone2);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([3, 2], 0);
  const ridge = top - roofRise * f.s;
  doc.line(x0 - 0.4 * f.s, top, (x0 + x1) / 2, ridge);
  doc.line((x0 + x1) / 2, ridge, x1 + 0.4 * f.s, top);
  doc.setLineDashPattern([], 0);
  // A 1.7 m person beside the block, for scale.
  const px = x1 + 1.2 * f.s;
  const ph = 1.7 * f.s;
  doc.setLineWidth(0.8);
  doc.circle(px, gy - ph + 0.12 * f.s, 0.12 * f.s, "S");
  doc.line(px, gy - ph + 0.25 * f.s, px, gy - 0.8 * f.s);
  doc.line(px, gy - 0.8 * f.s, px - 0.2 * f.s, gy);
  doc.line(px, gy - 0.8 * f.s, px + 0.2 * f.s, gy);
  doc.line(px - 0.3 * f.s, gy - 1.3 * f.s, px + 0.3 * f.s, gy - 1.3 * f.s);
  dimLine(doc, { x: x0, y: gy }, { x: x1, y: gy }, `${lengthM.toFixed(1)} m`, 14);
  dimLine(doc, { x: x1, y: gy }, { x: x1, y: top }, `${heightM.toFixed(1)} m`, -12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  ink(doc, PDF.stone2);
  doc.text(
    `${storeys} ${storeys === 1 ? "storey" : "storeys"} to top floor level · dashed roof indicative only · person 1.7 m`,
    x0,
    gy + 30,
  );
}

/**
 * A section through the block: floor slabs, storey heights and the ground,
 * with the foundation zone shown dashed below ground for the engineer.
 */
export function drawSection(doc: jsPDF, box: Box, depthM: number, study: MassingStudy) {
  caption(doc, "Section A-A (through the block)", box.x, box.y - 6);
  const storeys = Math.max(1, study.storeysRequested);
  const heightM = Math.max(2.4, study.heightM);
  const per = heightM / storeys;
  const f = frame(box, depthM + 4, heightM + 3);
  const gy = f.oy + (heightM + 1.5) * f.s;
  const x0 = f.ox + 2 * f.s;
  const x1 = x0 + depthM * f.s;
  ink(doc, PDF.stone2);
  doc.setLineWidth(1.2);
  doc.line(f.ox, gy, f.ox + (depthM + 4) * f.s, gy);
  // Foundation zone, dashed.
  doc.setLineDashPattern([2, 2], 0);
  doc.setLineWidth(0.5);
  doc.rect(x0 - 0.3 * f.s, gy, (depthM + 0.6) * f.s, 0.8 * f.s, "S");
  doc.setLineDashPattern([], 0);
  // Slabs and walls.
  ink(doc, PDF.forest);
  doc.setLineWidth(1.6);
  for (let k = 0; k <= storeys; k++) {
    const y = gy - per * k * f.s;
    doc.line(x0, y, x1, y);
  }
  doc.setLineWidth(1.2);
  doc.line(x0, gy, x0, gy - heightM * f.s);
  doc.line(x1, gy, x1, gy - heightM * f.s);
  for (let k = 0; k < storeys; k++) {
    const yb = gy - per * k * f.s;
    dimLine(doc, { x: x1, y: yb }, { x: x1, y: yb - per * f.s }, `${per.toFixed(1)} m`, -12);
  }
  dimLine(doc, { x: x0, y: gy }, { x: x1, y: gy }, `${depthM.toFixed(1)} m`, 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  ink(doc, PDF.stone2);
  doc.text(
    "Foundation zone (dashed): type and depth for an engineer after a soil test",
    x0,
    gy + 0.8 * f.s + 34,
  );
}

/**
 * Room areas from the brief, drawn to scale inside the block outline as
 * simple strips. Sizes are right; positions are not a layout.
 */
export function drawAreaDiagram(doc: jsPDF, box: Box, study: MassingStudy) {
  caption(doc, "Room areas to scale (not a layout)", box.x, box.y - 6);
  if (!study.rect) return;
  const W = study.rect.widthM;
  const D = study.rect.depthM;
  const f = frame(box, W, D, 8);
  const rooms: Array<{ label: string; m2: number }> = [];
  for (const l of study.schedule) {
    if (l.eachM2 != null && l.count > 0)
      for (let k = 0; k < l.count; k++) rooms.push({ label: l.label, m2: l.eachM2 });
    else if (l.totalM2 > 0) rooms.push({ label: l.label, m2: l.totalM2 });
  }
  const perFloor = Math.max(1, study.storeysRequested);
  const total = rooms.reduce((a, r) => a + r.m2, 0);
  // Only what fits on one floor's footprint is drawn; the rest is listed.
  const capacity = W * D;
  const scale = total > capacity * perFloor ? (capacity * perFloor) / total : 1;
  // Strips across the depth, rooms laid along them (simple slice layout).
  const strips = Math.max(1, Math.round(D / 4));
  const stripD = D / strips;
  let s = 0;
  let x = 0;
  const palette: RGB[] = [
    [233, 222, 196],
    [214, 228, 214],
    [226, 214, 230],
    [210, 224, 236],
    [240, 216, 204],
  ];
  doc.setLineWidth(0.4);
  let floor = 0;
  let drawn = 0;
  for (const [i, r] of rooms.entries()) {
    const wM = (r.m2 * scale) / stripD;
    if (x + wM > W + 0.01) {
      s++;
      x = 0;
      if (s >= strips) {
        floor++;
        s = 0;
        if (floor >= 1) break;
      }
    }
    const px = f.ox + x * f.s;
    const py = f.oy + s * stripD * f.s;
    const c = palette[i % palette.length];
    doc.setFillColor(c[0], c[1], c[2]);
    ink(doc, PDF.stone2);
    doc.rect(px, py, Math.min(wM, W - x) * f.s, stripD * f.s, "FD");
    if (wM * f.s > 34) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      ink(doc, PDF.forest);
      const name = r.label.replace(/ or .*/, "").replace(/ with .*/, "");
      doc.text(sanitize(name.slice(0, 18)), px + 2, py + 8);
      doc.text(`${Math.round(r.m2)} m2`, px + 2, py + 15);
    }
    x += wM;
    drawn++;
  }
  ink(doc, PDF.goldInk);
  doc.setLineWidth(1);
  doc.rect(f.ox, f.oy, W * f.s, D * f.s, "S");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  ink(doc, PDF.stone2);
  const rest = rooms.length - drawn;
  doc.text(
    `${W.toFixed(1)} x ${D.toFixed(1)} m ground floor${rest > 0 ? ` · ${rest} more on upper floors` : ""}`,
    f.ox,
    f.oy + D * f.s + 10,
  );
}
