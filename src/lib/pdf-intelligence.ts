/**
 * PDF report for the Land Intelligence Engine.
 *
 * Renders the unified LIOS decision (overall score, persona-weighted
 * recommendation, all 10 modules with confidence, sources, limitations
 * and next steps) into a self-contained multi-page PDF. Deliberately
 * dependency-light — jsPDF only — so it works even when static-map
 * providers are unreachable.
 */
import jsPDF from "jspdf";
import type { DecisionOutput, ModuleOutput } from "@/lib/intelligence-engine";
import { labelForPersona } from "@/lib/intelligence-engine";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function verificationOf(m: ModuleOutput): { label: string; color: [number, number, number] } {
  if (m.confidencePct >= 75 && m.sources.length >= 2)
    return { label: "Verified", color: [34, 197, 94] };
  if (m.confidencePct >= 45) return { label: "AI-Estimated", color: [98, 233, 255] };
  return { label: "Unverified", color: [212, 160, 23] };
}

export interface IntelligencePdfOptions {
  decision: DecisionOutput;
  address: string;
  lat: number;
  lng: number;
  shareUrl?: string;
  onProgress?: (pct: number, stage: string) => void;
}

export async function generateIntelligencePdf(
  opts: IntelligencePdfOptions,
): Promise<{ filename: string }> {
  const { decision, address, lat, lng, shareUrl, onProgress } = opts;
  const tick = (pct: number, stage: string) => {
    try {
      onProgress?.(Math.max(0, Math.min(100, Math.round(pct))), stage);
    } catch {
      /* ignore */
    }
  };
  tick(4, "Preparing document…");

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const ACCENT: [number, number, number] = [0, 194, 232];
  const MUTED: [number, number, number] = [140, 150, 168];
  const INK: [number, number, number] = [22, 30, 46];

  const setColor = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);

  // ---------- Cover page ----------
  doc.setFillColor(7, 30, 61);
  doc.rect(0, 0, W, H, "F");
  setColor([255, 255, 255]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("HALISIA.AI · LAND INTELLIGENCE REPORT", M, 64);

  doc.setFontSize(28);
  doc.text(`LIOS ${decision.overall} / 100`, M, 130);
  doc.setFontSize(14);
  setColor([0, 194, 232]);
  doc.text(decision.recommendation, M, 154);

  setColor([200, 210, 224]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const wrap = (t: string, w: number) => doc.splitTextToSize(t, w) as string[];
  const addrLines = wrap(address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`, W - M * 2);
  doc.text(addrLines, M, 180);
  doc.text(
    `Coordinates ${lat.toFixed(5)}, ${lng.toFixed(5)}  ·  Grade ${decision.grade}  ·  Confidence ${decision.confidencePct}%`,
    M,
    198 + (addrLines.length - 1) * 14,
  );
  doc.text(
    `Optimised for ${labelForPersona(decision.persona)}  ·  Generated ${new Date(decision.freshness).toLocaleString()}`,
    M,
    216 + (addrLines.length - 1) * 14,
  );
  if (shareUrl) {
    doc.setFontSize(9);
    setColor([160, 175, 200]);
    doc.text(`Shareable report · ${shareUrl}`, M, H - 60);
  }

  // ---------- Body pages ----------
  const startBody = () => {
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, W, H, "F");
    setColor(INK);
  };

  startBody();
  let y = M;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Executive summary", M, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const reasons = decision.reasons.length
    ? decision.reasons
    : ["No dominant drivers detected — refer to the module breakdown."];
  reasons.forEach((r) => {
    const lines = wrap(`• ${r}`, W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 14 + 4;
  });

  y += 8;
  setColor(MUTED);
  doc.setFontSize(10);
  doc.text(
    `Confidence ${decision.confidencePct}%  ·  ${decision.modules.length} intelligence modules  ·  Freshness ${new Date(decision.freshness).toLocaleString()}`,
    M,
    y,
  );
  y += 20;
  setColor(INK);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Recommended professionals", M, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  decision.professionalRecs.forEach((r) => {
    doc.text(`• ${r}`, M, y);
    y += 14;
  });

  // ---------- Module pages ----------
  const drawModule = (m: ModuleOutput) => {
    const need = 260;
    if (y + need > H - M) {
      doc.addPage();
      y = M;
    }
    const v = verificationOf(m);
    doc.setDrawColor(230, 234, 240);
    doc.setLineWidth(0.6);
    doc.line(M, y - 4, W - M, y - 4);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    setColor(INK);
    doc.text(`${m.label}`, M, y + 10);

    // Score chip
    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.roundedRect(W - M - 80, y - 2, 80, 22, 6, 6, "F");
    setColor([7, 30, 61]);
    doc.setFontSize(11);
    doc.text(`${m.score}/100 · ${m.grade}`, W - M - 74, y + 12);

    // Meta row: verification · confidence · sources · trend
    y += 26;
    setColor(v.color);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(v.label.toUpperCase(), M, y);
    setColor(MUTED);
    doc.setFont("helvetica", "normal");
    doc.text(
      `  ·  Confidence ${m.confidencePct}%  ·  ${m.sources.length} sources  ·  Trend ${m.trend}`,
      M + doc.getTextWidth(v.label.toUpperCase()),
      y,
    );
    y += 12;

    // Why
    setColor(INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Why this score", M, y + 12);
    y += 18;
    doc.setFont("helvetica", "normal");
    m.reasons.forEach((r) => {
      const lines = wrap(`• ${r}`, W - M * 2);
      doc.text(lines, M, y);
      y += lines.length * 12 + 2;
    });

    // Sources
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.text("Sources", M, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    setColor(MUTED);
    const src = wrap(m.sources.join("  ·  "), W - M * 2);
    doc.text(src, M, y);
    y += src.length * 12 + 6;

    // Possible limitations (explicit heading — mirrors the UI drilldown)
    setColor(INK);
    doc.setFont("helvetica", "bold");
    doc.text("Possible limitations · what to verify next", M, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    setColor([120, 90, 20]);
    m.limitations.forEach((l) => {
      const lines = wrap(`⚠ ${l}`, W - M * 2);
      doc.text(lines, M, y);
      y += lines.length * 12 + 2;
    });

    // Next step
    y += 4;
    setColor(INK);
    doc.setFont("helvetica", "bold");
    doc.text("Recommended next step", M, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    setColor([0, 100, 160]);
    const ns = wrap(m.nextStep, W - M * 2);
    doc.text(ns, M, y);
    y += ns.length * 12 + 16;
    setColor(INK);
  };

  doc.addPage();
  y = M;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Module scores", M, y);
  y += 24;

  const modules = decision.modules;
  modules.forEach((m, i) => {
    tick(20 + Math.round((i / modules.length) * 70), `Rendering ${m.label}…`);
    drawModule(m);
  });

  // ---------- Footer & disclaimer ----------
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    setColor(MUTED);
    doc.text(
      `HALISIA.AI  ·  Land Intelligence Report  ·  Page ${i} of ${pages}`,
      M,
      H - 20,
    );
  }
  doc.setPage(pages);
  setColor(MUTED);
  doc.setFontSize(8);
  doc.text(
    "Predictions are estimates, not certainties. Verify title, zoning and site conditions with licensed professionals before any transaction.",
    M,
    H - 32,
    { maxWidth: W - M * 2 },
  );

  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 13);
  const filename = `halisia-intelligence-${slugify(address) || "location"}-${lat.toFixed(4)}-${lng.toFixed(4)}-${stamp}.pdf`;
  tick(96, "Saving…");
  doc.save(filename);
  tick(100, "Done");
  return { filename };
}