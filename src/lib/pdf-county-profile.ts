/**
 * County record PDF.
 *
 * This export used to run to seven pages. Page 2 was an "AI Executive
 * Summary" plus strengths, weaknesses, opportunities and risks. Page 3 was
 * twelve dashboard scores out of 100. Page 5 was strategic recommendations
 * and a five-to-ten-year development outlook. The cover carried an "OVERALL
 * HALISIA SCORE" in 48-point type and a data-confidence bar.
 *
 * None of those numbers were measured. They came from a sine hash of the
 * county code, which means two counties could swap scores if their codes were
 * swapped, and the written claims beside them changed accordingly. A PDF is
 * the artefact people forward and cite, so it was the most dangerous place in
 * the product for an invented figure to live.
 *
 * The export now prints the record and stops: census population, gazetted
 * area and the density derived from them, the IEBC constituency and ward
 * counts, the elected leadership, the county's economic activities and
 * landmarks, map evidence, and the sources for each. Any number that is not
 * in a published release is not in this file.
 */
import jsPDF from "jspdf";
import type { CountyProfile } from "@/lib/county-profile";
import { COUNTY_DATA_SOURCES } from "@/lib/county-profile";
import { DENSITY_PROVENANCE } from "@/lib/county-metrics";
import { TERM_CAVEAT } from "@/lib/county-politics";
import { fetchStaticMapCached } from "@/lib/static-map-cache";
import { brandPage, brandFooters, prepareMark } from "@/lib/pdf-chrome";
import halisiaMark from "@/assets/brand/halisia-mark.png.asset.json";
import { deliverPdf } from "@/lib/pdf-delivery";

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
  const mark = await prepareMark(halisiaMark.url);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const { facts, latLng, density } = profile;

  // ---------- Fetch map tiles up front ----------
  onProgress(8, "Fetching cover map");
  const coverMap = await fetchStaticMapCached({
    lat: latLng.lat,
    lng: latLng.lng,
    layer: "hybrid",
    zoom: 9,
  }).catch(() => null);
  onProgress(24, "Fetching evidence tiles");
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
        .then((r) => ({
          label: t.label,
          dataUrl: r && "ok" in r && r.ok ? r.dataUrl : null,
        }))
        .catch(() => ({ label: t.label, dataUrl: null })),
    ),
  );

  // ---------- Page 1: Cover ----------
  onProgress(45, "Rendering cover");
  doc.setFillColor(...BG);
  doc.rect(0, 0, W, H, "F");
  brandPage(doc, mark);
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, W, 8, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 8, W, 2, "F");

  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("HALISIA AI · COUNTY RECORD", M, 32);
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
    doc.text(
      "Basemap unavailable — see evidence page for stitched OSM/Esri tiles.",
      M + 12,
      mapY + mapH / 2,
    );
  }
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(1);
  doc.roundedRect(M, mapY, W - M * 2, mapH, 10, 10, "S");

  // Cover facts grid — the published figures, in place of the old score badge
  const fY = mapY + mapH + 24;
  const facts6: Array<[string, string]> = [
    ["Population (2019)", facts.population2019.toLocaleString()],
    ["Density", density != null ? `${density.toLocaleString()} /km²` : "Not recorded"],
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

  // Scope note, in place of the old confidence bar
  const noteY = fY + cellH * 2 + 20;
  doc.setFillColor(...CARD);
  doc.roundedRect(M, noteY, W - M * 2, 62, 10, 10, "F");
  doc.setDrawColor(230, 235, 242);
  doc.roundedRect(M, noteY, W - M * 2, 62, 10, 10, "S");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const scope = doc.splitTextToSize(
    "Published sources only. HALISIA holds no livability, growth, water, healthcare, education, security or investment score for any Kenyan county, and none appears in this document. HALISIA does not assert title, boundary or ownership.",
    W - M * 2 - 24,
  );
  doc.text(scope, M + 12, noteY + 20);

  // ---------- Page 2: The record ----------
  onProgress(60, "Rendering the record");
  doc.addPage("a4", "portrait");
  pageChrome(doc, W, M, `${facts.name} · The record`);
  brandPage(doc, mark);

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("The record", M, 78);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 70, 90);
  const summary = doc.splitTextToSize(profile.summary, W - M * 2);
  doc.text(summary, M, 98);

  let y = 98 + summary.length * 12 + 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text("Administration", M, y);
  y += 18;
  const govRows: Array<[string, string]> = [
    ["Governor elected 2022", facts.governor],
    ["Senator elected 2022", facts.senator],
    ["Constituencies", String(facts.constituencies)],
    ["County wards", String(facts.wards)],
    ["Headquarters", facts.headquarters],
    ["Region", facts.region],
  ];
  govRows.forEach(([k, v]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(k.toUpperCase(), M, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(v, M + 160, y);
    y += 20;
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const termNote = doc.splitTextToSize(TERM_CAVEAT, W - M * 2);
  doc.text(termNote, M, y);
  y += termNote.length * 10 + 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text("Economic activities", M, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 70, 90);
  const econ = doc.splitTextToSize(
    `${facts.economy.join(", ")}. HALISIA holds no county GDP, employment or sector-growth figure, so no sector is ranked here.`,
    W - M * 2,
  );
  doc.text(econ, M, y);
  y += econ.length * 12 + 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text("Landmarks", M, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 70, 90);
  const lm = doc.splitTextToSize(facts.landmarks.join(" · "), W - M * 2);
  doc.text(lm, M, y);
  y += lm.length * 12 + 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text("Population density", M, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(density != null ? `${density.toLocaleString()} people / km²` : "Not recorded", M, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const prov = doc.splitTextToSize(DENSITY_PROVENANCE, W - M * 2);
  doc.text(prov, M, y);

  // ---------- Page 3: Map evidence ----------
  onProgress(80, "Rendering map evidence");
  doc.addPage("a4", "portrait");
  pageChrome(doc, W, M, `${facts.name} · Map evidence`);
  brandPage(doc, mark);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Map evidence", M, 78);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    "Basemaps centred on the county centroid, with an OpenStreetMap / Esri tile-stitch fallback. Not a parcel, an address or a boundary survey.",
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

  // ---------- Page 4: Sources ----------
  onProgress(92, "Rendering sources");
  doc.addPage("a4", "portrait");
  pageChrome(doc, W, M, `${facts.name} · Sources`);
  brandPage(doc, mark);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Sources", M, 78);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Every figure in this document comes from one of these three.", M, 94);

  let sy = 118;
  COUNTY_DATA_SOURCES.forEach((s) => {
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(s.label, M, sy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(s.url, M, sy + 13);
    const used = doc.splitTextToSize(s.used, W - M * 2);
    doc.text(used, M, sy + 26);
    sy += 30 + used.length * 11 + 14;
  });

  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const disc = doc.splitTextToSize(
    "Public open data, reproduced without interpretation. This document contains no score, index, rating, forecast or recommendation. Verify with a licensed professional before any commercial decision.",
    W - M * 2,
  );
  doc.text(disc, M, sy + 8);

  // ---------- Save ----------
  onProgress(98, "Writing PDF");
  const slug = facts.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const d = new Date();
  const stamp =
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}` +
    `-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  brandFooters(doc, mark, {
    note: "County record. Published sources only.",
    issued: new Date().toLocaleDateString("en-KE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  });
  deliverPdf(doc, `halisia-county-${slug}-${stamp}.pdf`);
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
