import jsPDF from "jspdf";
import { brandFooters, brandPage, getMarkSync, sanitize } from "@/lib/pdf-chrome";
import { COST_ASSUMPTIONS, kes, type SystemEstimate } from "@/lib/construction-cost";

export function buildCostPdf(o: {
  title: string;
  context?: string;
  grossM2: number;
  storeys: number;
  rows: SystemEstimate[];
}): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const mark = getMarkSync();
  brandPage(doc, mark);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  let y = M;
  const t = (s: string, size = 9, bold = false, color: [number, number, number] = [16, 45, 26]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(sanitize(s), W - 2 * M) as string[];
    if (y + lines.length * size * 1.3 > H - 60) {
      doc.addPage();
      brandPage(doc, mark);
      y = M;
    }
    doc.text(lines, M, y + size);
    y += lines.length * size * 1.3;
  };
  t("HALISIA INDICATIVE CONSTRUCTION BUDGET", 9, true, [20, 123, 53]);
  t(o.title, 18, true);
  if (o.context) t(o.context, 9, false, [95, 105, 98]);
  t(
    `Gross floor area: ${Math.round(o.grossM2)} m2  |  Storeys: ${o.storeys}  |  Generated: ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
    9,
  );
  t(
    "Type: Estimate (planning range). Confidence: low-moderate. Not a quote, BoQ or engineering design.",
    8.5,
    true,
    [179, 38, 30],
  );
  y += 8;
  for (const r of o.rows) {
    t(r.label, 12, true);
    t(`Rate: ${kes(r.rateLow)} - ${kes(r.rateHigh)} per m2`, 9);
    t(
      `Total: ${kes(r.totalLow)} - ${kes(r.totalHigh)}  (+10% contingency ${kes(r.contingencyLow)} - ${kes(r.contingencyHigh)})`,
      9,
      true,
    );
    r.pros.forEach((p) => t(`+ ${p}`, 8.5));
    r.cons.forEach((c) => t(`- ${c}`, 8.5, false, [95, 105, 98]));
    y += 6;
  }
  t("Assumptions and limitations", 12, true);
  COST_ASSUMPTIONS.forEach((a) => t(`- ${a}`, 8.5));
  brandFooters(doc, mark, {
    note: "Indicative estimate. Confirm with a quantity surveyor and engineer.",
  });
  return doc;
}

export async function downloadCostPdf(o: Parameters<typeof buildCostPdf>[0]): Promise<string> {
  const doc = buildCostPdf(o);
  const name = `halisia-cost-estimate-${o.title
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()
    .slice(0, 40)}.pdf`;
  doc.save(name);
  return name;
}
