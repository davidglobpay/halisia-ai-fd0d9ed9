/**
 * One-click "Download Concept Study" PDF for the Land Development Concept AI.
 * Includes the mandatory conceptual-study disclaimer on the cover and in the
 * footer of every page, plus the evidence & citations appendix.
 */
import jsPDF from "jspdf";
import type { PropertyRow } from "@/lib/properties";
import { CONCEPT_DISCLAIMER, type ConceptOutput } from "@/lib/development-studio";
import type { EvidenceBundle } from "@/lib/evidence";
import type { ReadinessResult } from "@/lib/investment-readiness";

export const CONCEPT_STUDY_DISCLAIMER =
  "Conceptual AI Study — Not an Approved Architectural, Planning, Engineering or Investment Document. " +
  CONCEPT_DISCLAIMER;

const M = 14;
const INK = [8, 14, 30] as const;
const ACCENT = [0, 194, 232] as const;
const MUTED = [110, 122, 140] as const;

export function conceptStudyFilename(p: PropertyRow): string {
  const slug = (p.title || "site")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `halisia-concept-study-${slug || "site"}-${stamp}.pdf`;
}

export function buildConceptStudyPdf(input: {
  property: PropertyRow;
  concept: ConceptOutput;
  evidence: EvidenceBundle;
  readiness?: ReadinessResult | null;
}): jsPDF {
  const { property: p, concept, evidence, readiness } = input;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = 0;

  const footer = () => {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor(220);
      doc.line(M, H - 16, W - M, H - 16);
      doc.setFontSize(6.5);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(doc.splitTextToSize(CONCEPT_STUDY_DISCLAIMER, W - M * 2), M, H - 12);
      doc.text(`Page ${i} of ${pages}`, W - M, H - 5, { align: "right" });
    }
  };

  const page = () => {
    doc.addPage();
    y = M + 6;
  };
  const need = (h: number) => {
    if (y + h > H - 22) page();
  };
  const h2 = (t: string) => {
    need(14);
    doc.setFontSize(12);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.setFont("helvetica", "bold");
    doc.text(t, M, y);
    y += 2;
    doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.line(M, y, M + 24, y);
    y += 6;
    doc.setFont("helvetica", "normal");
  };
  const body = (t: string, size = 9) => {
    doc.setFontSize(size);
    doc.setTextColor(45, 52, 68);
    const lines = doc.splitTextToSize(t, W - M * 2) as string[];
    for (const line of lines) {
      need(6);
      doc.text(line, M, y);
      y += size * 0.5;
    }
    y += 2;
  };
  const bullets = (items: string[]) => {
    doc.setFontSize(9);
    doc.setTextColor(45, 52, 68);
    for (const it of items) {
      const lines = doc.splitTextToSize(it, W - M * 2 - 4) as string[];
      lines.forEach((line, i) => {
        need(6);
        doc.text(i === 0 ? `•  ${line}` : `   ${line}`, M, y);
        y += 4.6;
      });
    }
    y += 2;
  };

  // ---------- Cover ----------
  doc.setFillColor(7, 30, 61);
  doc.rect(0, 0, W, 78, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text("HALISIA AI · LAND DEVELOPMENT & PROJECT CONCEPT", M, 22);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(doc.splitTextToSize(p.title || "Concept study", W - M * 2) as string[], M, 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(0, 194, 232);
  doc.text(
    [
      p.address,
      p.county ? `${p.county} County` : null,
      p.size_value ? `${p.size_value} ${p.size_unit ?? ""}`.trim() : null,
    ]
      .filter(Boolean)
      .join("  ·  ") || "Location not stated",
    M,
    56,
  );
  doc.setTextColor(220, 228, 240);
  doc.setFontSize(8);
  doc.text(`Generated ${new Date(concept.generatedAt).toLocaleString("en-KE")}`, M, 66);
  y = 92;

  doc.setDrawColor(212, 160, 23);
  doc.setFillColor(255, 250, 235);
  const dis = doc.splitTextToSize(CONCEPT_STUDY_DISCLAIMER, W - M * 2 - 8) as string[];
  const boxH = dis.length * 4.4 + 10;
  doc.roundedRect(M, y, W - M * 2, boxH, 2, 2, "FD");
  doc.setFontSize(8.5);
  doc.setTextColor(120, 84, 6);
  doc.text(dis, M + 4, y + 7);
  y += boxH + 10;

  h2("Executive summary");
  body(concept.summary);

  h2("Site read");
  bullets(concept.siteRead);

  // ---------- Options ----------
  concept.options.forEach((o, idx) => {
    page();
    doc.setFontSize(8);
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.text(`OPTION ${idx + 1} · ${o.useType.toUpperCase()}`, M, y);
    y += 7;
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(doc.splitTextToSize(o.name, W - M * 2) as string[], M, y);
    doc.setFont("helvetica", "normal");
    y += 9;
    body(o.rationale);

    const rows: [string, string][] = [
      ["Massing", o.massing],
      ["Unit mix", o.unitMix],
      ["Estimated units", String(o.estimatedUnits)],
      ["Capex band", o.capexBandKes],
      ["Revenue band", o.revenueBandKes],
      ["Payback", `${o.paybackYears} years`],
      ["Confidence", `${o.confidencePct}%`],
    ];
    rows.forEach(([k, v], i) => {
      need(8);
      if (i % 2 === 0) {
        doc.setFillColor(246, 249, 252);
        doc.rect(M, y - 4, W - M * 2, 7, "F");
      }
      doc.setFontSize(8.5);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(k, M + 2, y);
      doc.setTextColor(30, 38, 54);
      doc.text(doc.splitTextToSize(v, W - M * 2 - 46) as string[], M + 44, y);
      y += 7;
    });
    y += 4;

    if (o.phasing.length) {
      h2("Phasing");
      bullets(o.phasing.map((s, i) => `Phase ${i + 1}: ${s.replace(/^Phase \d+:\s*/i, "")}`));
    }
    if (o.risks.length) {
      h2("Risks to confirm");
      bullets(o.risks);
    }
  });

  // ---------- Readiness ----------
  page();
  if (readiness) {
    h2("Investment & construction finance readiness");
    body(`Overall indicative score: ${readiness.total}% — ${readiness.band}.`);
    readiness.factors.forEach((f) => {
      need(16);
      doc.setFontSize(9);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(`${f.label}`, M, y);
      doc.text(`${f.score}%`, W - M, y, { align: "right" });
      y += 2.5;
      doc.setFillColor(232, 238, 245);
      doc.rect(M, y, W - M * 2, 2, "F");
      doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.rect(M, y, ((W - M * 2) * f.score) / 100, 2, "F");
      y += 6;
      doc.setFontSize(7.5);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      const l = doc.splitTextToSize(`${f.evidence} Improve: ${f.improve}`, W - M * 2) as string[];
      l.forEach((line) => {
        need(5);
        doc.text(line, M, y);
        y += 3.6;
      });
      y += 3;
    });
  }

  // ---------- Evidence ----------
  h2("Evidence & citations");
  body(
    `Overall evidence confidence: ${evidence.overall.toUpperCase()} (${evidence.overallPct}%). ${evidence.wording}`,
  );
  evidence.signals.forEach((s) => {
    need(14);
    doc.setFontSize(8.5);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(`${s.label} — ${s.confidence.toUpperCase()}`, M, y);
    y += 4;
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    (doc.splitTextToSize(`Value: ${s.value}. Used for: ${s.used}`, W - M * 2) as string[]).forEach(
      (line) => {
        need(5);
        doc.text(line, M, y);
        y += 3.6;
      },
    );
    y += 2.5;
  });

  h2("Sources");
  evidence.citations.forEach((c) => {
    need(10);
    doc.setFontSize(8.5);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(c.label, M, y);
    y += 4;
    doc.setFontSize(7.5);
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.textWithLink(c.url, M, y, { url: c.url });
    y += 4;
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    (doc.splitTextToSize(c.detail, W - M * 2) as string[]).forEach((line) => {
      need(5);
      doc.text(line, M, y);
      y += 3.6;
    });
    y += 2.5;
  });

  h2("Assumptions & next steps");
  bullets(concept.nextSteps);
  bullets(concept.assumptions);

  footer();
  return doc;
}

export function downloadConceptStudy(input: {
  property: PropertyRow;
  concept: ConceptOutput;
  evidence: EvidenceBundle;
  readiness?: ReadinessResult | null;
}): void {
  const doc = buildConceptStudyPdf(input);
  doc.save(conceptStudyFilename(input.property));
}
