import type { GeotechIntel } from "@/lib/geotech.functions";

/**
 * Compact PDF export for the AI Geotechnical Intelligence Module.
 * Uses jsPDF (already installed for the dossier) and renders the summary
 * plus a text-based cross-section so users can share the preliminary read.
 */
export async function downloadGeotechPdf(g: GeotechIntel, address: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 48;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("HALISIA · AI Geotechnical Assessment", 40, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${address}`, 40, y);
  y += 12;
  doc.text(`${g.lat.toFixed(4)}, ${g.lng.toFixed(4)} · Confidence ${g.confidence}/100`, 40, y);
  y += 18;

  // Disclaimer box
  doc.setFillColor(255, 244, 214);
  doc.setDrawColor(220, 180, 80);
  doc.roundedRect(40, y, W - 80, 60, 6, 6, "FD");
  doc.setTextColor(120, 80, 0);
  doc.setFontSize(9);
  const wrap = doc.splitTextToSize(g.disclaimer, W - 100);
  doc.text(wrap, 48, y + 14);
  doc.setTextColor(20, 20, 20);
  y += 78;

  const section = (title: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, 40, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  };
  const line = (text: string) => {
    const parts = doc.splitTextToSize(text, W - 80);
    doc.text(parts, 40, y);
    y += parts.length * 12;
    if (y > 780) {
      doc.addPage();
      y = 48;
    }
  };

  section("Terrain analysis");
  const t = g.terrain;
  line(
    `Elevation ${t.elevationM} m · Slope ${t.slopePct}% · Aspect ${t.aspectLabel} (${t.aspectDeg}°) · Relief ${t.reliefM} m · Roughness ${t.roughness} m · Landform ${t.landform}`,
  );
  line(`Erosion risk: ${t.erosionRisk}. Natural drainage index: ${t.drainageIndex}/100.`);

  section("Soil profile (SoilGrids)");
  for (const L of g.soilLayers) {
    line(
      `${L.depth} · ${L.texture} · clay ${L.clayPct}% / silt ${L.siltPct}% / sand ${L.sandPct}% · org ${L.organicPct}%${L.bulkDensity != null ? ` · ρ ${L.bulkDensity} g/cm³` : ""} · drainage ${L.drainage}`,
    );
  }

  section("Geological interpretation");
  line(`${g.geology.dominant} · setting ${g.geology.setting} · confidence ${g.geology.confidence}`);
  line(g.geology.note);

  section("Estimated bedrock");
  line(
    `Depth ${g.bedrock.minM}–${g.bedrock.maxM} m · excavation ${g.bedrock.excavation} · confidence ${g.bedrock.confidence}.`,
  );

  section("Groundwater indicators");
  line(
    `Shallow groundwater ${g.groundwater.shallowLikelihood} · seasonal waterlogging ${g.groundwater.seasonalWaterlogging} · rainfall ${g.groundwater.annualRainMm ?? "—"} mm/yr.`,
  );

  section("Foundation suitability");
  for (const f of g.foundations) line(`${f.type}: ${f.suitability} — ${f.note}`);

  section("Risk indicators");
  for (const r of g.risks) line(`${r.label}: ${r.level} — ${r.note}`);

  section("Data sources");
  for (const s of g.sources) line(`${s.used ? "•" : "◦"} ${s.label} — ${s.url}`);

  const slug = address
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "site";
  const ts = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  doc.save(`halisia-geotech-${slug}-${ts}.pdf`);
}
