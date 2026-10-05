/**
 * County comparison PDF.
 *
 * This export used to print four metrics per county — livability, density,
 * growth and water reliability — each under a row of confidence dots, with a
 * footer defining three dots as "multiple-source support". Only density was
 * ever measured; the other three were generated. A reader could take that PDF
 * into a meeting believing four figures had been checked.
 *
 * It now prints the one county-level figure HALISIA can cite, with its source
 * on the page. No dots: a national census release does not need a confidence
 * band, it needs a citation.
 */
import jsPDF from "jspdf";
import {
  METRIC_LABELS,
  METRIC_UNITS,
  DENSITY_PROVENANCE,
  countyMetrics,
  formatMetric,
  type CountyMetric,
} from "@/lib/county-metrics";
import { fetchStaticMapCached } from "@/lib/static-map-cache";
import { PDF, brandPage, brandFooters, prepareMark } from "@/lib/pdf-chrome";
import halisiaMark from "@/assets/brand/halisia-mark.png.asset.json";

type County = { code: number; name: string; lat: number; lng: number };

export async function generateCountyComparePdf(counties: County[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const mark = await prepareMark(halisiaMark.url);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 36;

  // Brand tokens, not the retired Deep Space Blue this file shipped with.
  // Brand tokens, not the retired Deep Space Blue this file shipped with.
  // Assigned directly, never spread: [...PDF.forest] widens a readonly tuple
  // to number[] and stops satisfying the three-argument colour setters.
  const ink = PDF.forest;
  const muted = PDF.stone2;
  const accent = PDF.green;
  const bg = PDF.ivory;

  doc.setFillColor(...bg);
  doc.rect(0, 0, W, H, "F");
  brandPage(doc, mark);
  doc.setFillColor(...accent);
  doc.rect(0, 0, W, 6, "F");

  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("HALISIA.AI · COUNTY COMPARISON", M, 36);

  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(`${counties.length}-county side-by-side`, M, 66);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  doc.text(
    `${counties.map((c) => c.name).join(" · ")}  ·  Generated ${new Date().toLocaleString()}`,
    M,
    84,
  );

  const metrics = Object.keys(METRIC_LABELS) as CountyMetric[];
  const colGap = 12;
  const colW = (W - M * 2 - colGap * (counties.length - 1)) / counties.length;
  const top = 110;
  const cardH = 90 + metrics.length * 40;

  counties.forEach((c, i) => {
    const x = M + i * (colW + colGap);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, top, colW, cardH, 12, 12, "F");

    doc.setTextColor(...ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(c.name, x + 16, top + 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text(`${c.lat.toFixed(3)}°, ${c.lng.toFixed(3)}°`, x + 16, top + 44);

    const m = countyMetrics(c.code);
    metrics.forEach((mk, j) => {
      const yy = top + 74 + j * 40;
      doc.setDrawColor(230, 235, 242);
      doc.line(x + 16, yy, x + colW - 16, yy);
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      doc.text(METRIC_LABELS[mk].toUpperCase(), x + 16, yy + 14);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(...ink);
      doc.text(formatMetric(mk, m[mk]), x + 16, yy + 30);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      doc.text(METRIC_UNITS[mk], x + 16 + doc.getTextWidth(formatMetric(mk, m[mk])) + 4, yy + 30);
      doc.setFontSize(7);
      doc.setTextColor(...muted);
      doc.text("KNBS 2019", x + colW - 60, yy + 14);
    });
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text(
    `Informational only — verify with a licensed professional. ${DENSITY_PROVENANCE} HALISIA holds no other county-level metric and prints none.`,
    M,
    H - 32,
  );
  doc.text("halisia.ai", W - M - 40, H - 20);

  // ---- Page 2: Map data evidence ----
  const maps = await Promise.all(
    counties.map((c) =>
      fetchStaticMapCached({ lat: c.lat, lng: c.lng, layer: "roadmap-light", zoom: 9 }).catch(
        () => null,
      ),
    ),
  );
  if (maps.some(Boolean)) {
    doc.addPage("a4", "landscape");
    doc.setFillColor(...bg);
    doc.rect(0, 0, W, H, "F");
    brandPage(doc, mark);
    doc.setFillColor(...accent);
    doc.rect(0, 0, W, 6, "F");
    doc.setTextColor(...muted);
    doc.setFontSize(10);
    doc.text("HALISIA.AI · MAP DATA EVIDENCE", M, 36);
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("County map evidence", M, 66);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text(
      "Static-map basemaps captured from Google Maps Platform for each selected county centroid.",
      M,
      84,
    );
    const mTop = 110;
    const imgH = 200;
    counties.forEach((c, i) => {
      const x = M + i * (colW + colGap);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, mTop, colW, imgH + 60, 12, 12, "F");
      const m = maps[i];
      const dataUrl = m && "ok" in m && m.ok ? m.dataUrl : null;
      if (dataUrl) {
        try {
          doc.addImage(dataUrl, "PNG", x + 8, mTop + 8, colW - 16, imgH, undefined, "FAST");
        } catch {
          /* ignore image errors */
        }
      }
      doc.setTextColor(...ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(c.name, x + 12, mTop + imgH + 30);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      doc.text(
        `Centroid ${c.lat.toFixed(3)}°, ${c.lng.toFixed(3)}° · Source: Google Maps Platform`,
        x + 12,
        mTop + imgH + 46,
      );
    });
  }

  brandFooters(doc, mark, {
    note: "County comparison. Published figures, each traced to its source.",
    issued: new Date().toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" }),
  });

  const safe =
    counties
      .map((c) => c.name)
      .join("-")
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase()
      .slice(0, 60) || "compare";
  doc.save(`halisia-compare-${safe}.pdf`);
}
