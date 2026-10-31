/**
 * CSV + PDF export of seller analytics (lead quality, inquiry trends, views,
 * saves, contact requests and the suggested actions shown in the UI).
 */
import jsPDF from "jspdf";
import type { ListingInsight } from "@/lib/seller-tools";
import { PDF, brandPage, brandFooters, getMarkSync } from "@/lib/pdf-chrome";
import { deliverBlob, deliverPdf } from "@/lib/pdf-delivery";

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEADERS = [
  "Listing",
  "County",
  "Type",
  "Status",
  "Completeness %",
  "Views",
  "Saves",
  "Enquiries",
  "Contact requests",
  "Lead quality",
  "Lead quality reason",
  "Enquiries last 7d",
  "Enquiries prior 7d",
  "7-day trend %",
  "Save rate %",
  "Enquiry rate %",
  "Suggested follow-ups",
  "Suggested improvements",
];

export function insightsToCsv(rows: ListingInsight[]): string {
  const lines = [HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.property.title,
        r.property.county ?? "",
        r.property.kind,
        r.property.status,
        r.property.completeness_pct,
        r.views,
        r.saves,
        r.leads.length,
        r.contactRequests,
        r.quality,
        r.qualityReason,
        r.leadsLast7,
        r.leadsPrev7,
        r.trendPct,
        r.saveRate,
        r.enquiryRate,
        r.followUps.join(" | "),
        r.improvements.join(" | "),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n");
}

function download(blob: Blob, filename: string) {
  deliverBlob(blob, filename);
}

export function downloadSellerCsv(rows: ListingInsight[]): string {
  const filename = `halisia-seller-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  download(new Blob([insightsToCsv(rows)], { type: "text/csv;charset=utf-8" }), filename);
  return filename;
}

export function downloadSellerPdf(rows: ListingInsight[]): string {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  // Synchronous by contract — every caller treats the return as a filename,
  // not a promise — so the mark is read from the cache the app primed at
  // start-up rather than awaited here. Null simply means no logo this once.
  const mark = getMarkSync();
  brandPage(doc, mark);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  let y = M;

  const ensure = (need: number) => {
    if (y + need > H - M) {
      doc.addPage();
      brandPage(doc, mark);
      y = M;
    }
  };

  doc.setFillColor(PDF.forest[0], PDF.forest[1], PDF.forest[2]);
  doc.rect(0, 0, W, 86, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Seller analytics report", M, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(PDF.greenLight[0], PDF.greenLight[1], PDF.greenLight[2]);
  doc.text(
    `HALISIA AI · generated ${new Date().toLocaleString("en-KE")} · ${rows.length} listing(s)`,
    M,
    64,
  );
  y = 110;

  const totals = rows.reduce(
    (a, r) => ({
      views: a.views + r.views,
      saves: a.saves + r.saves,
      leads: a.leads + r.leads.length,
      contacts: a.contacts + r.contactRequests,
    }),
    { views: 0, saves: 0, leads: 0, contacts: 0 },
  );

  doc.setTextColor(22, 30, 46);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Portfolio totals", M, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Views ${totals.views}   ·   Saves ${totals.saves}   ·   Enquiries ${totals.leads}   ·   Contact requests ${totals.contacts}`,
    M,
    y,
  );
  y += 24;

  for (const r of rows) {
    ensure(150);
    doc.setDrawColor(220, 226, 236);
    doc.line(M, y, W - M, y);
    y += 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(doc.splitTextToSize(r.property.title, W - M * 2)[0] ?? "Listing", M, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110, 120, 140);
    doc.text(
      `${r.property.county ?? "Kenya"} · ${r.property.kind} · ${r.property.status} · ${r.property.completeness_pct}% complete`,
      M,
      y,
    );
    y += 16;
    doc.setTextColor(22, 30, 46);
    doc.text(
      `Views ${r.views}  |  Saves ${r.saves}  |  Enquiries ${r.leads.length}  |  Contact requests ${r.contactRequests}`,
      M,
      y,
    );
    y += 13;
    doc.text(`Lead quality: ${r.quality.toUpperCase()} — ${r.qualityReason}`, M, y);
    y += 13;
    doc.text(
      `7-day trend ${r.trendPct > 0 ? "+" : ""}${r.trendPct}% (${r.leadsLast7} vs ${r.leadsPrev7}) · save rate ${r.saveRate}% · enquiry rate ${r.enquiryRate}%`,
      M,
      y,
    );
    y += 16;

    const block = (title: string, items: string[]) => {
      ensure(30 + items.length * 12);
      doc.setFont("helvetica", "bold");
      doc.text(title, M, y);
      y += 12;
      doc.setFont("helvetica", "normal");
      for (const it of items) {
        const lines = doc.splitTextToSize(`• ${it}`, W - M * 2 - 8) as string[];
        ensure(lines.length * 11 + 4);
        doc.text(lines, M + 8, y);
        y += lines.length * 11;
      }
      y += 6;
    };
    block("Suggested follow-ups", r.followUps);
    block("Suggested improvements", r.improvements);
  }

  brandFooters(doc, mark, {
    note: "Indicative analytics. Not a valuation or a guarantee of sale.",
    issued: new Date().toLocaleDateString("en-KE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  });

  const filename = `halisia-seller-analytics-${new Date().toISOString().slice(0, 10)}.pdf`;
  deliverPdf(doc, filename);
  return filename;
}
