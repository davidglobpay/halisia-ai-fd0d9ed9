import jsPDF from "jspdf";

type Confidence = "Low" | "Medium" | "High";
type Water = "Reliable" | "Intermittent" | "Scarce";
type MetricId = "livability" | "population" | "growth" | "water";

export type CompareCounty = {
  name: string;
  region: string;
  lat: number;
  lng: number;
  livability: number;
  population: string;
  populationN: number;
  growth: string;
  growthN: number;
  water: Water;
  confidence: Record<MetricId, Confidence>;
  vibe: string;
  highlights: string[];
};

const METRICS: Array<{ id: MetricId; label: string }> = [
  { id: "livability", label: "Livability" },
  { id: "population", label: "Population" },
  { id: "growth", label: "Growth (YoY)" },
  { id: "water", label: "Water reliability" },
];

function display(c: CompareCounty, m: MetricId): string {
  switch (m) {
    case "livability":
      return `${c.livability}/100`;
    case "population":
      return c.population;
    case "growth":
      return c.growth;
    case "water":
      return c.water;
  }
}

function numeric(c: CompareCounty, m: MetricId): number {
  switch (m) {
    case "livability":
      return c.livability;
    case "population":
      return c.populationN;
    case "growth":
      return c.growthN;
    case "water":
      return c.water === "Reliable" ? 90 : c.water === "Intermittent" ? 60 : 30;
  }
}

export function generateCountyComparisonPdf(counties: CompareCounty[]) {
  if (counties.length === 0) return;
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;

  const ink: [number, number, number] = [15, 23, 42];
  const muted: [number, number, number] = [100, 116, 139];
  const accent: [number, number, number] = [45, 140, 255];
  const bg: [number, number, number] = [247, 249, 252];

  doc.setFillColor(...bg);
  doc.rect(0, 0, W, H, "F");
  doc.setFillColor(...accent);
  doc.rect(0, 0, W, 6, "F");

  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("HALISIA.AI · COUNTY COMPARISON", M, 34);

  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(`Comparing ${counties.length} counties`, M, 66);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  doc.text(
    `${counties.map((c) => c.name).join(" · ")}  ·  Generated ${new Date().toLocaleString()}`,
    M,
    84,
  );

  // Header row
  const labelColW = 150;
  const colGap = 12;
  const availW = W - M * 2 - labelColW - colGap;
  const colW = (availW - colGap * (counties.length - 1)) / counties.length;
  let y = 110;

  const drawCell = (
    x: number,
    yy: number,
    w: number,
    h: number,
    fill: [number, number, number] | null,
  ) => {
    if (fill) {
      doc.setFillColor(...fill);
      doc.roundedRect(x, yy, w, h, 8, 8, "F");
    }
  };

  // County header cards
  drawCell(M, y, labelColW, 60, null);
  counties.forEach((c, i) => {
    const x = M + labelColW + colGap + i * (colW + colGap);
    drawCell(x, y, colW, 60, [255, 255, 255]);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(c.region.toUpperCase(), x + 12, y + 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...ink);
    doc.text(c.name, x + 12, y + 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(`${c.lat.toFixed(2)}, ${c.lng.toFixed(2)}`, x + 12, y + 54);
  });
  y += 74;

  // Metric rows — highlight best value per row
  METRICS.forEach((m) => {
    const values = counties.map((c) => numeric(c, m.id));
    const best = Math.max(...values);
    const rowH = 52;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...ink);
    doc.text(m.label, M, y + 20);
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text("higher is better", M, y + 34);

    counties.forEach((c, i) => {
      const x = M + labelColW + colGap + i * (colW + colGap);
      const isBest = numeric(c, m.id) === best && counties.length > 1;
      drawCell(x, y, colW, rowH, isBest ? [225, 238, 255] : [255, 255, 255]);
      if (isBest) {
        doc.setDrawColor(...accent);
        doc.setLineWidth(1);
        doc.roundedRect(x, y, colW, rowH, 8, 8, "S");
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(...ink);
      doc.text(display(c, m.id), x + 12, y + 26);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      doc.text(`Confidence · ${c.confidence[m.id]}`, x + 12, y + 42);
    });
    y += rowH + 8;
  });

  // Highlights row (may overflow — new page if needed)
  const highlightsRowH = 84;
  if (y + highlightsRowH + 40 > H) {
    doc.addPage();
    doc.setFillColor(...bg);
    doc.rect(0, 0, W, H, "F");
    y = 60;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  doc.text("Highlights", M, y + 20);
  counties.forEach((c, i) => {
    const x = M + labelColW + colGap + i * (colW + colGap);
    drawCell(x, y, colW, highlightsRowH, [255, 255, 255]);
    doc.setFontSize(9);
    doc.setTextColor(...ink);
    c.highlights.slice(0, 4).forEach((h, k) => {
      doc.setFillColor(...accent);
      doc.circle(x + 14, y + 20 + k * 16, 1.6, "F");
      doc.text(h, x + 22, y + 22 + k * 16, {
        maxWidth: colW - 30,
      });
    });
  });
  y += highlightsRowH + 8;

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text(
    "Informational only — verify title, survey and zoning with a licensed professional.",
    M,
    H - 24,
  );
  doc.text("halisia.ai", W - M - 40, H - 24);

  const slug = counties
    .map((c) => c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"))
    .join("-vs-")
    .slice(0, 80);
  doc.save(`halisia-compare-${slug}.pdf`);
}
