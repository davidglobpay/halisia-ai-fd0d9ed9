import jsPDF from "jspdf";
import type { CountyProfile } from "@/lib/county-profile";
import { COUNTY_DATA_SOURCES } from "@/lib/county-profile";
import { fetchStaticMapCached } from "@/lib/static-map-cache";

type Progress = (pct: number, stage: string) => void;

const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const ACCENT: [number, number, number] = [0, 194, 232];
const GOLD: [number, number, number] = [212, 160, 23];
const BG: [number, number, number] = [247, 249, 252];
const CARD: [number, number, number] = [255, 255, 255];

export async function generateCountyProfilePdf(
  profile: CountyProfile,
  onProgress: Progress = () => {},
) {
  onProgress(2, "Initialising document");
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const { facts, latLng, scores, metrics, density } = profile;

  // ---------- Fetch map tiles up front ----------
  onProgress(8, "Fetching cover map");
  const coverMap = await fetchStaticMapCached({
    lat: latLng.lat,
    lng: latLng.lng,
    layer: "hybrid",
    zoom: 9,
  }).catch(() => null);
  onProgress(22, "Fetching evidence tiles");
  const evidence = await Promise.all(
    [
      { label: "Street", layer: "roadmap-light" as const, zoom: 10 },
      { label: "Terrain", layer: "terrain" as const, zoom: 9 },
      { label: "Satellite", layer: "satellite" as const, zoom: 11 },
      { label: "Hybrid", layer: "hybrid" as const, zoom: 12 },
    ].map((t) =>
      fetchStaticMapCached({
        lat: latLng.lat,
        lng: latLng.lng,
        layer: t.layer,
        zoom: t.zoom,
      })
        .then((r) => ({ label: t.label, dataUrl: r && "ok" in r && r.ok ? r.dataUrl : null }))
        .catch(() => ({ label: t.label, dataUrl: null })),
    ),
  );

  // ---------- Cover ----------
  onProgress(40, "Rendering cover");
  doc.setFillColor(...BG);
  doc.rect(0, 0, W, H, "F");
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, W, 8, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 8, W, 2, "F");

  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("HALISIA AI · COUNTY INTELLIGENCE DOSSIER", M, 32);
  doc.text(new Date().toLocaleString(), W - M, 32, { align: "right" });

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.text(facts.name.toUpperCase(), M, 78);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(
    `County ${String(facts.code).padStart(3, "0")} · ${facts.region} region · HQ ${facts.headquarters}`,
    M,
    98,
  );

  // Cover map
  const mapY = 118;
  const mapH = 260;
  doc.setFillColor(230, 235, 242);
  doc.roundedRect(M, mapY, W - M * 2, mapH, 10, 10, "F");
  if (coverMap && "ok" in coverMap && coverMap.ok) {
    try {
      doc.addImage(coverMap.dataUrl, "PNG", M, mapY, W - M * 2, mapH, undefined, "FAST");
    } catch {
      /* ignore */
    }
  } else {
    doc.setTextColor(...MUTED);
    doc.setFontSize(10);
    doc.text("Basemap unavailable — see evidence page for stitched OSM/Esri tiles.", M + 12, mapY + mapH / 2);
  }
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(1);
  doc.roundedRect(M, mapY, W - M * 2, mapH, 10, 10, "S");

  // Overall score badge
  const badgeY = mapY + mapH + 22;
  doc.setFillColor(...CARD);
  doc.roundedRect(M, badgeY, W - M * 2, 90, 10, 10, "F");
  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  doc.text("OVERALL HALISIA SCORE", M + 20, badgeY + 24);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(48);
  doc.text(`${scores.overall}`, M + 20, badgeY + 68);
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text("/100", M + 20 + doc.getTextWidth(`${scores.overall}`) + 6, badgeY + 68);

  // Confidence bar on the right of badge
  const confX = M + 220;
  doc.setFontSize(9);
  doc.text("DATA CONFIDENCE", confX, badgeY + 24);
  doc.setDrawColor(220, 226, 236);
  doc.setFillColor(240, 244, 250);
  doc.roundedRect(confX, badgeY + 34, 260, 10, 5, 5, "F");
  doc.setFillColor(...ACCENT);
  doc.roundedRect(confX, badgeY + 34, (260 * profile.confidencePct) / 100, 10, 5, 5, "F");
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${profile.confidencePct}%`, confX + 270, badgeY + 44);

  // Cover facts grid
  const fY = badgeY + 110;
  const facts6: Array<[string, string]> = [
    ["Population (2019)", facts.population2019.toLocaleString()],
    ["Density", `${density.toLocaleString()} /km²`],
    ["Area", `${facts.areaKm2.toLocaleString()} km²`],
    ["Constituencies", String(facts.constituencies)],
    ["Wards", String(facts.wards)],
    ["Coordinates", `${latLng.lat.toFixed(3)}°, ${latLng.lng.toFixed(3)}°`],
  ];
  const cellW = (W - M * 2) / 3;
  const cellH = 54;
  facts6.forEach((f, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = M + col * cellW;
    const y = fY + row * cellH;
    doc.setFillColor(...CARD);
    doc.rect(x, y, cellW, cellH, "F");
    doc.setDrawColor(230, 235, 242);
    doc.rect(x, y, cellW, cellH, "S");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(f[0].toUpperCase(), x + 12, y + 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(f[1], x + 12, y + 40);
    doc.setFont("helvetica", "normal");
  });

  footer(doc, W, H, M);

  // ---------- Page 2: AI summary + scorecards ----------
  onProgress(55, "Rendering AI summary");
  doc.addPage("a4", "portrait");
  pageChrome(doc, W, M, `${facts.name} · Executive Summary`);

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("AI Executive Summary", M, 78);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 70, 90);
  const summary = doc.splitTextToSize(profile.aiSummary, W - M * 2);
  doc.text(summary, M, 98);

  let y = 98 + summary.length * 12 + 12;
  y = listBlock(doc, "Strengths", profile.strengths, M, y, W, ACCENT);
  y = listBlock(doc, "Weaknesses", profile.weaknesses, M, y, W, GOLD);
  y = listBlock(doc, "Opportunities", profile.opportunities, M, y, W, ACCENT);
  y = listBlock(doc, "Key risks", profile.risks, M, y, W, GOLD);
  footer(doc, W, H, M);

  // ---------- Page 3: Dashboard scores ----------
  onProgress(68, "Rendering dashboard scores");
  doc.addPage("a4", "portrait");
  pageChrome(doc, W, M, `${facts.name} · Dashboard Scores`);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Dashboard Scores", M, 78);

  const scoreRows: Array<[string, number]> = [
    ["Economic", scores.economic],
    ["Infrastructure", scores.infrastructure],
    ["Governance", scores.governance],
    ["Healthcare", scores.healthcare],
    ["Education", scores.education],
    ["Environment", scores.environment],
    ["Security", scores.security],
    ["Habitability", scores.habitability],
    ["Investment", scores.investment],
    ["Tourism", scores.tourism],
    ["Development readiness", scores.developmentReadiness],
    ["Overall", scores.overall],
  ];
  const sw = (W - M * 2 - 12) / 2;
  const sh = 44;
  scoreRows.forEach((r, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (sw + 12);
    const yy = 98 + row * (sh + 8);
    doc.setFillColor(...CARD);
    doc.roundedRect(x, yy, sw, sh, 8, 8, "F");
    doc.setDrawColor(230, 235, 242);
    doc.roundedRect(x, yy, sw, sh, 8, 8, "S");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(r[0].toUpperCase(), x + 12, yy + 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...INK);
    doc.text(`${r[1]}`, x + 12, yy + 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("/100", x + 12 + doc.getTextWidth(`${r[1]}`) + 4, yy + 36);
    // bar
    const barX = x + 90;
    const barW = sw - 110;
    doc.setFillColor(240, 244, 250);
    doc.roundedRect(barX, yy + 28, barW, 8, 4, 4, "F");
    const tone = r[1] >= 75 ? ACCENT : r[1] >= 55 ? GOLD : ([230, 90, 90] as [number, number, number]);
    doc.setFillColor(...tone);
    doc.roundedRect(barX, yy + 28, (barW * Math.max(0, Math.min(100, r[1]))) / 100, 8, 4, 4, "F");
  });
  footer(doc, W, H, M);

  // ---------- Page 4: Governance + economy ----------
  onProgress(78, "Rendering governance & economy");
  doc.addPage("a4", "portrait");
  pageChrome(doc, W, M, `${facts.name} · Governance & Economy`);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Political & Governance", M, 78);
  const govRows: Array<[string, string]> = [
    ["Governor", facts.governor],
    ["Senator", facts.senator],
    ["Constituencies", String(facts.constituencies)],
    ["County wards", String(facts.wards)],
    ["Headquarters", facts.headquarters],
    ["Region", facts.region],
  ];
  let gy = 96;
  govRows.forEach(([k, v]) => {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(k.toUpperCase(), M, gy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(v, M + 160, gy);
    doc.setFont("helvetica", "normal");
    gy += 20;
  });

  gy += 12;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text("Economic Base", M, gy);
  gy += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 70, 90);
  const econ = doc.splitTextToSize(
    `Main activities: ${facts.economy.join(", ")}. Priority sectors identified by HALISIA AI: ${profile.prioritySectors.join(", ")}.`,
    W - M * 2,
  );
  doc.text(econ, M, gy);
  gy += econ.length * 12 + 12;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text("Landmarks", M, gy);
  gy += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 70, 90);
  const lm = doc.splitTextToSize(facts.landmarks.join(" · "), W - M * 2);
  doc.text(lm, M, gy);

  gy += lm.length * 12 + 16;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text("Key Metrics", M, gy);
  gy += 6;
  const metricRows: Array<[string, string]> = [
    ["Livability index", `${metrics.livability}/100`],
    ["Population (2019)", facts.population2019.toLocaleString()],
    ["Growth (est.)", `${metrics.growth.toFixed(1)}%`],
    ["Water reliability", `${metrics.water}/100`],
  ];
  metricRows.forEach(([k, v], i) => {
    const yy = gy + 16 + i * 20;
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(k.toUpperCase(), M, yy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(v, M + 220, yy);
    doc.setFont("helvetica", "normal");
  });

  footer(doc, W, H, M);

  // ---------- Page 5: Recommendations + outlook ----------
  onProgress(85, "Rendering recommendations");
  doc.addPage("a4", "portrait");
  pageChrome(doc, W, M, `${facts.name} · Recommendations`);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Strategic Recommendations", M, 78);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let ry = 98;
  profile.recommendations.forEach((r, i) => {
    doc.setTextColor(...ACCENT);
    doc.setFont("helvetica", "bold");
    doc.text(`${i + 1}.`, M, ry);
    doc.setTextColor(60, 70, 90);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(r, W - M * 2 - 20);
    doc.text(lines, M + 18, ry);
    ry += lines.length * 12 + 6;
  });

  ry += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text("Development outlook", M, ry);
  ry += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 70, 90);
  const outlook = doc.splitTextToSize(profile.outlook, W - M * 2);
  doc.text(outlook, M, ry);
  footer(doc, W, H, M);

  // ---------- Page 6: Map evidence ----------
  onProgress(92, "Rendering map evidence");
  doc.addPage("a4", "portrait");
  pageChrome(doc, W, M, `${facts.name} · Map Evidence`);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Map Evidence", M, 78);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    "Google Static Maps with automatic OpenStreetMap / Esri tile-stitch fallback so imagery never renders blank.",
    M,
    92,
  );

  const gap = 12;
  const tileW = (W - M * 2 - gap) / 2;
  const tileH = 210;
  evidence.forEach((t, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (tileW + gap);
    const yy = 108 + row * (tileH + 42);
    doc.setFillColor(...CARD);
    doc.roundedRect(x, yy, tileW, tileH, 8, 8, "F");
    if (t.dataUrl) {
      try {
        doc.addImage(t.dataUrl, "PNG", x, yy, tileW, tileH, undefined, "FAST");
      } catch {
        /* ignore */
      }
    } else {
      doc.setTextColor(...MUTED);
      doc.setFontSize(10);
      doc.text("Tile source unavailable", x + 12, yy + tileH / 2);
    }
    doc.setDrawColor(230, 235, 242);
    doc.roundedRect(x, yy, tileW, tileH, 8, 8, "S");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(t.label.toUpperCase(), x, yy + tileH + 16);
  });

  // ---------- Page 7: Sources ----------
  doc.addPage("a4", "portrait");
  pageChrome(doc, W, M, `${facts.name} · Sources`);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Data sources & provenance", M, 78);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let sy = 100;
  COUNTY_DATA_SOURCES.forEach((s) => {
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.text(s.label, M, sy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(s.url, M, sy + 12);
    doc.text(`Verified: ${s.verified}`, M, sy + 24);
    doc.setFontSize(10);
    sy += 42;
  });
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const disc = doc.splitTextToSize(
    "AI-generated intelligence derived from public open data. Confidence bands are directional. Verify with a licensed professional before commercial decisions.",
    W - M * 2,
  );
  doc.text(disc, M, sy + 8);
  footer(doc, W, H, M);

  // ---------- Save ----------
  onProgress(98, "Writing PDF");
  const slug = facts.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const d = new Date();
  const stamp =
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}` +
    `-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  doc.save(`halisia-county-${slug}-${stamp}.pdf`);
  onProgress(100, "Done");
}

// ---------- helpers ----------
function pageChrome(doc: jsPDF, W: number, M: number, title: string) {
  doc.setFillColor(...BG);
  doc.rect(0, 0, W, doc.internal.pageSize.getHeight(), "F");
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, W, 4, "F");
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("HALISIA AI · " + title, M, 24);
}

function footer(doc: jsPDF, W: number, H: number, M: number) {
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("halisia.ai · county intelligence dossier", M, H - 20);
  doc.text(new Date().toLocaleDateString(), W - M, H - 20, { align: "right" });
}

function listBlock(
  doc: jsPDF,
  title: string,
  items: string[],
  M: number,
  y: number,
  W: number,
  tone: [number, number, number],
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...tone);
  doc.text(title.toUpperCase(), M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 70, 90);
  let yy = y + 14;
  items.forEach((it) => {
    const lines = doc.splitTextToSize(`• ${it}`, W - M * 2);
    doc.text(lines, M, yy);
    yy += lines.length * 12 + 2;
  });
  return yy + 10;
}