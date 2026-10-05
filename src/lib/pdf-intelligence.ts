/**
 * PDF report for the location dossier.
 *
 * The cover used to open with "LIOS 72 / 100" in 28-point type and a verdict
 * beneath it — Highly Recommended through Not Recommended — over ten modules,
 * seven of which had no data behind them. A PDF is the artefact a buyer
 * forwards to a spouse, a lender or a lawyer, so it is the worst place in the
 * product for a number that was not measured.
 *
 * It now leads with the reading and what the reading is OF, prints the
 * measured modules with the services actually read for each, and gives the
 * unassessed modules a section of their own: what HALISIA does not hold and
 * who to ask instead. Still jsPDF only, so it works when map providers are
 * unreachable.
 */
import jsPDF from "jspdf";
import type { DecisionOutput, ModuleOutput } from "@/lib/intelligence-engine";
import { labelForPersona, DOSSIER_SCOPE } from "@/lib/intelligence-engine";
import { PDF, brandPage, brandFooters, prepareMark } from "@/lib/pdf-chrome";
import halisiaMark from "@/assets/brand/halisia-mark.png.asset.json";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * How the figure was obtained — not how good it is. The old version called a
 * direct elevation reading "AI-Estimated" and a pair of invented inputs
 * "Verified", because it judged by confidence and source count alone.
 */
function provenanceOf(m: ModuleOutput): {
  label: string;
  color: [number, number, number];
} {
  if (m.status === "projected") return { label: "Indicative projection", color: [138, 94, 18] };
  if (m.status === "not-assessed") return { label: "Not assessed", color: [140, 150, 168] };
  if ((m.confidencePct ?? 0) >= 100) return { label: "Measured", color: [34, 197, 94] };
  return { label: "Partly measured", color: [212, 160, 23] };
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
  // Async generator, so the mark can be awaited rather than read from cache.
  const mark = await prepareMark(halisiaMark.url);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const ACCENT: [number, number, number] = [0, 194, 232];
  const MUTED: [number, number, number] = [140, 150, 168];
  const INK: [number, number, number] = [22, 30, 46];

  const setColor = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const wrap = (t: string, w: number) => doc.splitTextToSize(t, w) as string[];

  // ---------- Cover page ----------
  doc.setFillColor(PDF.forest[0], PDF.forest[1], PDF.forest[2]);
  doc.rect(0, 0, W, H, "F");
  // After the full-page fill, never before it — a watermark painted first
  // would be buried under the cover colour.
  brandPage(doc, mark, "dark");
  setColor([255, 255, 255]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("HALISIA.AI · LOCATION READINGS", M, 64);

  doc.setFontSize(28);
  doc.text(decision.reading != null ? `${decision.reading} / 100` : "No reading", M, 130);
  doc.setFontSize(13);
  setColor(ACCENT);
  doc.text(decision.readingLabel, M, 152);

  setColor([200, 210, 224]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const addrLines = wrap(address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`, W - M * 2);
  doc.text(addrLines, M, 180);
  let coverY = 198 + (addrLines.length - 1) * 14;
  doc.text(
    `Coordinates ${lat.toFixed(5)}, ${lng.toFixed(5)}` +
      (decision.grade ? `  ·  Grade ${decision.grade}` : "") +
      (decision.confidencePct != null ? `  ·  Confidence ${decision.confidencePct}%` : ""),
    M,
    coverY,
  );
  coverY += 18;
  doc.text(
    `Weighted for ${labelForPersona(decision.persona)}  ·  Generated ${new Date(decision.freshness).toLocaleString()}`,
    M,
    coverY,
  );

  // Scope, on the cover, where it cannot be missed.
  coverY += 30;
  doc.setFontSize(10);
  setColor([170, 185, 208]);
  const scope = wrap(decision.scopeNote, W - M * 2);
  doc.text(scope, M, coverY);
  coverY += scope.length * 13 + 10;
  const scopeLine = wrap(DOSSIER_SCOPE, W - M * 2);
  doc.text(scopeLine, M, coverY);

  if (shareUrl) {
    doc.setFontSize(9);
    setColor([160, 175, 200]);
    doc.text(`Shareable report · ${shareUrl}`, M, H - 60);
  }

  // ---------- Summary page ----------
  doc.addPage();
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, "F");
  brandPage(doc, mark);
  setColor(INK);

  let y = M;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("What was measured", M, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const reasons = decision.reasons.length
    ? decision.reasons
    : ["Nothing could be read for this point — every provider returned empty."];
  reasons.forEach((r) => {
    const lines = wrap(`• ${r}`, W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 14 + 4;
  });

  y += 8;
  setColor(MUTED);
  doc.setFontSize(10);
  doc.text(
    `${decision.measuredCount} of ${decision.modules.length} modules measured  ·  ` +
      `${decision.projectedCount} projected  ·  ${decision.notAssessedCount} not assessed  ·  ` +
      `Read ${new Date(decision.freshness).toLocaleString()}`,
    M,
    y,
  );
  y += 24;
  setColor(INK);

  // ---------- Due diligence ----------
  if (decision.dueDiligence.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("What HALISIA cannot assess", M, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setColor(MUTED);
    const intro = wrap(
      "Each of these was previously shown as a score. HALISIA holds no data that answers them, so they are listed as checks to run before committing.",
      W - M * 2,
    );
    doc.text(intro, M, y + 12);
    y += 12 + intro.length * 12 + 10;

    decision.dueDiligence.forEach((d) => {
      if (y > H - M - 70) {
        doc.addPage();
        brandPage(doc, mark);
        y = M;
      }
      setColor(INK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(d.label, M, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      setColor(MUTED);
      const why = wrap(d.why, W - M * 2);
      doc.text(why, M, y);
      y += why.length * 12 + 2;
      setColor([0, 100, 160]);
      const who = wrap(`→ ${d.who}`, W - M * 2);
      doc.text(who, M, y);
      y += who.length * 12 + 12;
    });
    setColor(INK);
  }

  // ---------- Professionals ----------
  if (y > H - M - 120) {
    doc.addPage();
    brandPage(doc, mark);
    y = M;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setColor(INK);
  doc.text("Who to bring in next", M, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  decision.professionalRecs.forEach((r) => {
    doc.text(`• ${r}`, M, y);
    y += 14;
  });

  // ---------- Module pages ----------
  const drawModule = (m: ModuleOutput) => {
    const need = 240;
    if (y + need > H - M) {
      doc.addPage();
      brandPage(doc, mark);
      y = M;
    }
    const v = provenanceOf(m);
    doc.setDrawColor(230, 234, 240);
    doc.setLineWidth(0.6);
    doc.line(M, y - 4, W - M, y - 4);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    setColor(INK);
    doc.text(m.label, M, y + 10);

    // Score chip — only when there is a score.
    if (m.score != null) {
      doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.roundedRect(W - M - 80, y - 2, 80, 22, 6, 6, "F");
      setColor([7, 30, 61]);
      doc.setFontSize(11);
      doc.text(`${m.score}/100${m.grade ? ` · ${m.grade}` : ""}`, W - M - 74, y + 12);
    } else {
      doc.setDrawColor(200, 208, 220);
      doc.roundedRect(W - M - 80, y - 2, 80, 22, 6, 6, "S");
      setColor(MUTED);
      doc.setFontSize(10);
      doc.text("Not assessed", W - M - 72, y + 12);
    }

    y += 26;
    setColor(v.color);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(v.label.toUpperCase(), M, y);
    setColor(MUTED);
    doc.setFont("helvetica", "normal");
    const meta =
      m.status !== "not-assessed"
        ? `  ·  ${m.status === "projected" ? "Projection confidence" : "Confidence"} ${m.confidencePct}%  ·  ${m.sources.length === 1 ? "1 source" : `${m.sources.length} sources`}`
        : "  ·  no data held for this location";
    doc.text(meta, M + doc.getTextWidth(v.label.toUpperCase()), y);
    y += 12;

    setColor(INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(
      m.status === "measured"
        ? "Why this reading"
        : m.status === "projected"
          ? "Projection and evidence"
          : "Why there is no reading",
      M,
      y + 12,
    );
    y += 18;
    doc.setFont("helvetica", "normal");
    m.reasons.forEach((r) => {
      const lines = wrap(`• ${r}`, W - M * 2);
      doc.text(lines, M, y);
      y += lines.length * 12 + 2;
    });

    if (m.sources.length) {
      y += 4;
      setColor(INK);
      doc.setFont("helvetica", "bold");
      doc.text("Read for this", M, y);
      y += 12;
      doc.setFont("helvetica", "normal");
      setColor(MUTED);
      const src = wrap(m.sources.join("  ·  "), W - M * 2);
      doc.text(src, M, y);
      y += src.length * 12 + 6;
    }

    if (m.missing.length) {
      setColor(INK);
      doc.setFont("helvetica", "bold");
      doc.text("Not held by HALISIA", M, y);
      y += 12;
      doc.setFont("helvetica", "normal");
      setColor(MUTED);
      m.missing.forEach((s) => {
        const lines = wrap(`• ${s}`, W - M * 2);
        doc.text(lines, M, y);
        y += lines.length * 12 + 2;
      });
      y += 4;
    }

    if (m.limitations.length) {
      setColor(INK);
      doc.setFont("helvetica", "bold");
      doc.text("What this does not prove", M, y);
      y += 12;
      doc.setFont("helvetica", "normal");
      setColor([120, 90, 20]);
      m.limitations.forEach((l) => {
        const lines = wrap(`⚠ ${l}`, W - M * 2);
        doc.text(lines, M, y);
        y += lines.length * 12 + 2;
      });
      y += 4;
    }

    setColor(INK);
    doc.setFont("helvetica", "bold");
    doc.text("Check this next", M, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    setColor([0, 100, 160]);
    const ns = wrap(m.nextStep, W - M * 2);
    doc.text(ns, M, y);
    y += ns.length * 12 + 16;
    setColor(INK);
  };

  doc.addPage();
  brandPage(doc, mark);
  y = M;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Module detail", M, y);
  y += 24;

  const modules = decision.modules;
  modules.forEach((m, i) => {
    tick(20 + Math.round((i / modules.length) * 70), `Rendering ${m.label}…`);
    drawModule(m);
  });

  // ---------- Scope, then the branded footer on every page ----------
  doc.setPage(doc.getNumberOfPages());
  setColor(MUTED);
  doc.setFontSize(8);
  doc.text(DOSSIER_SCOPE, M, H - 62, { maxWidth: W - M * 2 });

  brandFooters(doc, mark, {
    note: "Location readings. Not a title search, survey or valuation.",
    issued: new Date().toLocaleDateString("en-KE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  });

  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 13);
  const filename = `halisia-readings-${slugify(address) || "location"}-${lat.toFixed(4)}-${lng.toFixed(4)}-${stamp}.pdf`;
  tick(96, "Saving…");
  doc.save(filename);
  tick(100, "Done");
  return { filename };
}
