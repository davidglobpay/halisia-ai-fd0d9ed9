import type { GeotechIntel } from "@/lib/geotech.functions";
import { brandPage, brandFooters, prepareMark } from "@/lib/pdf-chrome";
import halisiaMark from "@/assets/brand/halisia-mark.png.asset.json";

/**
 * Infographic-style PDF for the AI Geotechnical Intelligence Module.
 * Uses jsPDF vector primitives to render colored panels, gauges, stacked
 * soil bars, terrain transects, foundation grids and risk chips so the
 * downloaded report feels like the in-app dashboard.
 */
export async function downloadGeotechPdf(g: GeotechIntel, address: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  // Named brandMark, not mark: the sources list below declares its own `mark`
  // for the filled/hollow bullet, and shadowing it here would be a trap for
  // whoever next adds a chrome call inside that loop.
  const brandMark = await prepareMark(halisiaMark.url);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // ── Palette (Deep Space Blue) ──────────────────────────────────────
  const C = {
    ink: [16, 22, 40] as [number, number, number],
    bg: [8, 12, 28] as [number, number, number],
    panel: [18, 26, 52] as [number, number, number],
    line: [60, 78, 120] as [number, number, number],
    text: [232, 238, 255] as [number, number, number],
    dim: [150, 165, 200] as [number, number, number],
    accent: [96, 165, 250] as [number, number, number],
    cyan: [56, 189, 248] as [number, number, number],
    good: [74, 222, 128] as [number, number, number],
    warn: [251, 191, 36] as [number, number, number],
    bad: [248, 113, 113] as [number, number, number],
    clay: [220, 130, 90] as [number, number, number],
    silt: [200, 180, 140] as [number, number, number],
    sand: [240, 210, 130] as [number, number, number],
  };
  const rgb = (c: [number, number, number]) => c;
  const setFill = (c: [number, number, number]) =>
    doc.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: [number, number, number]) =>
    doc.setDrawColor(c[0], c[1], c[2]);
  const setText = (c: [number, number, number]) =>
    doc.setTextColor(c[0], c[1], c[2]);
  const levelColor = (l: string) =>
    l === "Low" || l === "Preferred" || l === "Easy" || l === "High"
      ? C.good
      : l === "Moderate" || l === "Possible" || l === "Medium"
        ? C.warn
        : C.bad;

  const paintBg = () => {
    setFill(C.bg);
    doc.rect(0, 0, W, H, "F");
    // After the fill, never before: this document paints a full-page dark
    // background, which would bury a watermark drawn first.
    brandPage(doc, brandMark, "dark");
  };
  const panel = (x: number, y: number, w: number, h: number, r = 10) => {
    setFill(C.panel);
    setDraw(C.line);
    doc.setLineWidth(0.6);
    doc.roundedRect(x, y, w, h, r, r, "FD");
  };
  const heading = (x: number, y: number, s: string, size = 11) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    setText(C.text);
    doc.text(s, x, y);
  };
  const body = (x: number, y: number, s: string, w?: number, size = 9) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    setText(C.dim);
    const parts = w ? doc.splitTextToSize(s, w) : [s];
    doc.text(parts, x, y);
    return parts.length * (size + 2);
  };
  const chip = (
    x: number,
    y: number,
    label: string,
    color: [number, number, number],
  ) => {
    const w = doc.getTextWidth(label) + 14;
    setFill(color);
    doc.roundedRect(x, y - 9, w, 13, 6, 6, "F");
    setText(C.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(label, x + 7, y);
    return w;
  };

  // ── PAGE 1 — COVER ─────────────────────────────────────────────────
  paintBg();

  // Top brand strip
  setFill(C.accent);
  doc.rect(0, 0, W, 4, "F");
  setText(C.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("HALISIA · WAVE 3", 40, 26);
  setText(C.dim);
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toISOString().slice(0, 10), W - 40, 26, {
    align: "right",
  });

  // Hero
  heading(40, 70, "AI Geotechnical Assessment", 22);
  setText(C.cyan);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Preliminary subsurface intelligence · public open data", 40, 90);

  setText(C.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(address, 40, 118);
  setText(C.dim);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Coordinates ${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}`, 40, 132);

  // Confidence gauge (right side, top)
  const gx = W - 170,
    gy = 70,
    gw = 130,
    gh = 90;
  panel(gx, gy, gw, gh, 10);
  heading(gx + 12, gy + 20, "AI Confidence");
  const pct = Math.max(0, Math.min(100, g.confidence));
  const barX = gx + 12,
    barY = gy + 40,
    barW = gw - 24;
  setFill([30, 42, 76]);
  doc.roundedRect(barX, barY, barW, 10, 5, 5, "F");
  setFill(pct >= 66 ? C.good : pct >= 40 ? C.warn : C.bad);
  doc.roundedRect(barX, barY, (barW * pct) / 100, 10, 5, 5, "F");
  setText(C.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(`${pct}`, gx + 12, gy + 78);
  setText(C.dim);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("/100  · public data blend", gx + 40, gy + 78);

  // Disclaimer callout
  const dy = 160,
    dh = 66;
  setFill([46, 32, 12]);
  setDraw(C.warn);
  doc.setLineWidth(0.8);
  doc.roundedRect(40, dy, W - 80, dh, 8, 8, "FD");
  setText(C.warn);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("⚠  COMPLIANCE NOTICE", 52, dy + 16);
  setText([250, 230, 200]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const disc = doc.splitTextToSize(g.disclaimer, W - 104);
  doc.text(disc, 52, dy + 30);

  // ── At-a-glance stat tiles ─────────────────────────────────────────
  const tiles: Array<[string, string, [number, number, number]]> = [
    [`${g.terrain.elevationM} m`, "Elevation", C.accent],
    [`${g.terrain.slopePct}%`, "Slope", C.cyan],
    [`${g.bedrock.minM}–${g.bedrock.maxM} m`, "Bedrock depth", C.warn],
    [`${g.groundwater.annualRainMm ?? "—"} mm`, "Annual rain", C.good],
  ];
  const ty = 244,
    tw = (W - 80 - 3 * 10) / 4,
    th = 66;
  tiles.forEach((t, i) => {
    const x = 40 + i * (tw + 10);
    panel(x, ty, tw, th, 10);
    setText(t[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(t[0], x + 12, ty + 30);
    setText(C.dim);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(t[1].toUpperCase(), x + 12, ty + 50);
  });

  // ── Terrain transect (SVG-style path drawn in vector) ─────────────
  const px = 40,
    py = 328,
    pw = W - 80,
    ph = 130;
  panel(px, py, pw, ph, 10);
  heading(px + 14, py + 20, "Terrain profile (synthetic transect)");
  setText(C.dim);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `${g.terrain.landform.toUpperCase()} · relief ${g.terrain.reliefM} m · aspect ${g.terrain.aspectLabel} · roughness ${g.terrain.roughness} m`,
    px + 14,
    py + 34,
  );

  // Draw a synthetic profile from elevation ± relief with deterministic seed
  const pts: [number, number][] = [];
  const gxl = px + 20,
    gyt = py + 48,
    gxw = pw - 40,
    gyh = ph - 62;
  const seed = (g.lat * 1000 + g.lng * 1000) | 0;
  const rand = (i: number) => {
    const s = Math.sin(seed + i * 7.31) * 43758.5453;
    return s - Math.floor(s);
  };
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const base = 0.5 + 0.3 * Math.sin(t * Math.PI * 2 + rand(1) * 3);
    const noise = 0.15 * rand(i) - 0.075;
    const y = gyt + gyh - (base + noise) * gyh;
    pts.push([gxl + t * gxw, y]);
  }
  // Fill under curve
  setFill([30, 60, 110]);
  doc.setDrawColor(0, 0, 0, 0);
  const poly: number[][] = pts.map(([x, y]) => [x, y]);
  poly.push([gxl + gxw, gyt + gyh]);
  poly.push([gxl, gyt + gyh]);
  // jsPDF lacks fillPolygon; draw as many tiny rects would be slow — use lines + area sim
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    doc.setFillColor(30, 60, 110);
    // triangle-ish area
    doc.triangle(x1, y1, x2, y2, x2, gyt + gyh, "F");
    doc.triangle(x1, y1, x2, gyt + gyh, x1, gyt + gyh, "F");
  }
  // Line on top
  setDraw(C.cyan);
  doc.setLineWidth(1.2);
  for (let i = 0; i < pts.length - 1; i++) {
    doc.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
  }
  // Axes
  setDraw(C.line);
  doc.setLineWidth(0.4);
  doc.line(gxl, gyt + gyh, gxl + gxw, gyt + gyh);

  // ── PAGE 2 — SOIL + GEOLOGY + BEDROCK ─────────────────────────────
  doc.addPage();
  paintBg();
  setFill(C.accent);
  doc.rect(0, 0, W, 4, "F");
  heading(40, 40, "Soil profile · Geology · Bedrock", 16);
  setText(C.dim);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    "Source: FAO SoilGrids v2.0 (250m) · derived interpretation",
    40,
    56,
  );

  // Soil layers stacked bars
  const sy = 80,
    slh = 34;
  g.soilLayers.forEach((L, i) => {
    const y = sy + i * (slh + 8);
    panel(40, y, W - 80, slh, 8);
    setText(C.text);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(L.depth, 52, y + 14);
    setText(C.dim);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      `${L.texture} · drainage ${L.drainage}${L.bulkDensity != null ? ` · ρ ${L.bulkDensity} g/cm³` : ""} · org ${L.organicPct}%`,
      52,
      y + 26,
    );
    // Stacked bar
    const bx = W - 40 - 220,
      bw2 = 220,
      bh = 12,
      by = y + 11;
    const total = Math.max(1, L.clayPct + L.siltPct + L.sandPct);
    let cx = bx;
    const seg = (pct: number, col: [number, number, number]) => {
      const w = (bw2 * pct) / total;
      setFill(col);
      doc.rect(cx, by, w, bh, "F");
      cx += w;
    };
    seg(L.clayPct, C.clay);
    seg(L.siltPct, C.silt);
    seg(L.sandPct, C.sand);
    setDraw(C.line);
    doc.setLineWidth(0.4);
    doc.rect(bx, by, bw2, bh, "S");
    setText(C.dim);
    doc.setFontSize(7);
    doc.text(
      `C ${L.clayPct}% · S ${L.siltPct}% · Sa ${L.sandPct}%`,
      bx,
      by + bh + 9,
    );
  });

  // Legend
  const ly = sy + g.soilLayers.length * (slh + 8) + 6;
  const lx0 = 40;
  const legendItem = (
    x: number,
    label: string,
    col: [number, number, number],
  ) => {
    setFill(col);
    doc.rect(x, ly - 8, 10, 10, "F");
    setText(C.dim);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(label, x + 14, ly);
    return doc.getTextWidth(label) + 30;
  };
  let lx = lx0;
  lx += legendItem(lx, "Clay", C.clay);
  lx += legendItem(lx, "Silt", C.silt);
  lx += legendItem(lx, "Sand", C.sand);

  // Geology + bedrock cards
  const gcy = ly + 24,
    gch = 130;
  const gcw = (W - 80 - 10) / 2;
  panel(40, gcy, gcw, gch);
  heading(52, gcy + 20, "Geological interpretation");
  setText(C.cyan);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(g.geology.dominant, 52, gcy + 40);
  chip(52, gcy + 58, g.geology.setting, C.accent);
  chip(
    52 + doc.getTextWidth(g.geology.setting) + 22,
    gcy + 58,
    `Confidence ${g.geology.confidence}`,
    levelColor(g.geology.confidence),
  );
  body(52, gcy + 82, g.geology.note, gcw - 24, 8.5);

  panel(50 + gcw, gcy, gcw, gch);
  heading(62 + gcw, gcy + 20, "Estimated bedrock");
  // Bedrock depth gauge
  const dxg = 62 + gcw,
    dyg = gcy + 40,
    dwg = gcw - 24;
  setText(C.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(`${g.bedrock.minM}–${g.bedrock.maxM} m`, dxg, dyg + 10);
  setText(C.dim);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("estimated depth to competent rock", dxg, dyg + 24);
  // Vertical scale
  const scaleTop = dyg + 34,
    scaleH = 50;
  setFill([30, 42, 76]);
  doc.roundedRect(dxg, scaleTop, dwg, scaleH, 4, 4, "F");
  const maxScale = 30;
  const p1 = Math.min(1, g.bedrock.minM / maxScale);
  const p2 = Math.min(1, g.bedrock.maxM / maxScale);
  setFill(C.warn);
  doc.rect(dxg + dwg * p1, scaleTop, Math.max(2, dwg * (p2 - p1)), scaleH, "F");
  setText(C.dim);
  doc.setFontSize(7);
  doc.text("0m", dxg, scaleTop + scaleH + 10);
  doc.text(`${maxScale}m`, dxg + dwg - 10, scaleTop + scaleH + 10);
  chip(
    dxg,
    scaleTop + scaleH + 24,
    `Excavation: ${g.bedrock.excavation}`,
    levelColor(g.bedrock.excavation),
  );

  // ── PAGE 3 — GROUNDWATER, FOUNDATIONS, RISK, SOURCES ──────────────
  doc.addPage();
  paintBg();
  setFill(C.accent);
  doc.rect(0, 0, W, 4, "F");
  heading(40, 40, "Groundwater · Foundations · Risk", 16);

  // Groundwater
  const wy = 68,
    wh = 90;
  panel(40, wy, W - 80, wh);
  heading(52, wy + 20, "Groundwater indicators");
  const gwRow = (
    x: number,
    label: string,
    val: string,
    col: [number, number, number],
  ) => {
    setText(C.dim);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), x, wy + 40);
    chip(x, wy + 58, val, col);
  };
  const cellW = (W - 80 - 24) / 3;
  gwRow(
    52,
    "Shallow groundwater",
    g.groundwater.shallowLikelihood,
    levelColor(g.groundwater.shallowLikelihood),
  );
  gwRow(
    52 + cellW,
    "Seasonal waterlogging",
    g.groundwater.seasonalWaterlogging,
    levelColor(g.groundwater.seasonalWaterlogging),
  );
  gwRow(
    52 + cellW * 2,
    "Nearest water",
    g.groundwater.nearestWaterKm != null
      ? `${g.groundwater.nearestWaterKm} km`
      : "—",
    C.accent,
  );

  // Foundations grid
  const fy = wy + wh + 16;
  heading(40, fy, "Foundation suitability", 12);
  const fCards = g.foundations;
  const fyy = fy + 10,
    fh2 = 90;
  const fcw = (W - 80 - 3 * 10) / 4;
  fCards.forEach((f, i) => {
    const x = 40 + i * (fcw + 10);
    panel(x, fyy, fcw, fh2);
    setText(C.text);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(f.type, x + 12, fyy + 20);
    chip(x + 12, fyy + 38, f.suitability, levelColor(f.suitability));
    body(x + 12, fyy + 56, f.note, fcw - 24, 8);
  });

  // Risk indicators
  const ry = fyy + fh2 + 20;
  heading(40, ry, "Construction risk indicators", 12);
  const ryy = ry + 10;
  const rcw = (W - 80 - 10) / 2;
  g.risks.forEach((r, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 40 + col * (rcw + 10);
    const y = ryy + row * 46;
    panel(x, y, rcw, 38);
    setText(C.text);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(r.label, x + 12, y + 16);
    chip(x + rcw - 70, y + 16, r.level, levelColor(r.level));
    body(x + 12, y + 30, r.note, rcw - 24, 8);
  });

  // Sources footer
  const rows = Math.ceil(g.risks.length / 2);
  const sy2 = ryy + rows * 46 + 14;
  panel(40, sy2, W - 80, 70);
  heading(52, sy2 + 18, "Data sources");
  setText(C.dim);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  let syy = sy2 + 34;
  g.sources.forEach((s) => {
    const mark = s.used ? "●" : "○";
    doc.text(`${mark}  ${s.label}  —  ${s.url}`, 52, syy);
    syy += 10;
  });

  brandFooters(doc, brandMark, {
    tone: "dark",
    note: "Preliminary planning use only. Not a geotechnical investigation.",
    issued: new Date().toLocaleDateString("en-KE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  });

  const slug =
    address
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "site";
  const ts = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const coord = `${g.lat.toFixed(3)}_${g.lng.toFixed(3)}`.replace(/[.-]/g, "");
  doc.save(`halisia-geotech-${slug}-${coord}-${ts}.pdf`);
}
