import jsPDF from "jspdf";
import { fetchStaticMapCached } from "@/lib/static-map-cache";
import {
  getWave4Intel,
  OVERPASS_CATEGORY_LABELS,
  type Wave4Intel,
  type ScoreExplain,
} from "@/lib/wave4-intel.functions";
import {
  drawIsometricTerrain,
  fetchElevationGrid,
  gridStats,
  type ElevationGrid,
} from "@/lib/terrain-grid";
import { startTerrainTimer, recordTerrainEvent } from "@/lib/terrain-telemetry";
import halisiaMark from "@/assets/brand/halisia-mark.png.asset.json";
import { PDF, prepareMark, drawWatermark } from "@/lib/pdf-chrome";
import type { BrandImage } from "@/lib/brand-asset";

/**
 * The brand mark for this run. Resolved once in generateLocationDossier and
 * read by drawHeader, whose signature is shared by eleven call sites and so
 * cannot take another argument without touching all of them.
 */
let runMark: BrandImage | null = null;

// jsPDF's built-in Helvetica only covers WinAnsi. Characters outside it
// (arrows, Greek letters) render as garbage, so none are used in this file.
function nairobiStamp(d: Date): string {
  try {
    return `${d.toLocaleString("en-GB", { timeZone: "Africa/Nairobi" })} EAT`;
  } catch {
    return "Timestamp unavailable";
  }
}

export async function generateLocationDossier(opts: {
  lat: number;
  lng: number;
  address: string;
  shareUrl?: string;
  onProgress?: (pct: number, stage: string) => void;
}): Promise<{
  ok: true;
  mapsRequested: number;
  mapsSucceeded: number;
  mapsFailed: number;
  lastError: { error: string; status?: number } | null;
  filename: string;
}> {
  const { lat, lng, address, shareUrl, onProgress } = opts;
  const progress = (pct: number, stage: string) => {
    try {
      onProgress?.(Math.max(0, Math.min(100, Math.round(pct))), stage);
    } catch {
      /* ignore progress callback errors */
    }
  };
  progress(2, "Fetching evidence maps…");

  // Fetch evidence maps in parallel — never let a static-map failure block the PDF.
  const settled = await Promise.allSettled([
    fetchStaticMapCached({ lat, lng, layer: "roadmap-light", zoom: 15 }),
    fetchStaticMapCached({ lat, lng, layer: "terrain", zoom: 13 }),
    fetchStaticMapCached({ lat, lng, layer: "hybrid", zoom: 16 }),
    fetchStaticMapCached({ lat, lng, layer: "satellite", zoom: 17 }),
  ]);
  let mapsFailed = 0;
  let lastError: { error: string; status?: number } | null = null;
  const pick = (i: number): { dataUrl: string | null } => {
    const s = settled[i];
    if (s.status !== "fulfilled") {
      mapsFailed++;
      lastError = { error: "promise_rejected" };
      return { dataUrl: null };
    }
    const v = s.value as { ok?: boolean; dataUrl?: string; error?: string; status?: number };
    if (v.ok && v.dataUrl) return { dataUrl: v.dataUrl };
    mapsFailed++;
    if (v.error) lastError = { error: v.error, status: v.status };
    return { dataUrl: null };
  };
  const base = pick(0);
  const terrain = pick(1);
  const hybrid = pick(2);
  progress(35, "Aggregating public open data…");
  let wave4: Wave4Intel | null = null;
  try {
    wave4 = await getWave4Intel({ data: { lat, lng } });
  } catch {
    wave4 = null;
  }
  const sat = pick(3);

  // Isometric terrain grid (rendered off-screen to a PNG the PDF embeds).
  progress(55, "Sampling ASTER elevation grid…");
  let terrainGrid: ElevationGrid | null = null;
  try {
    terrainGrid = await fetchElevationGrid(lat, lng, 9, 0.02, undefined, "pdf-terrain");
  } catch {
    terrainGrid = null;
  }
  progress(70, "Rendering isometric terrain projection…");
  const terrainImg = terrainGrid ? renderTerrainToPngDataUrl(terrainGrid, 900, 520) : null;
  progress(78, "Composing dossier pages…");

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;

  // Palette - the app's own tokens. This file painted itself in the retired
  // Deep Space Blue scheme, so a downloaded dossier looked like it came from a
  // different product than the page that produced it.
  const ink: [number, number, number] = PDF.forest;
  const muted: [number, number, number] = PDF.stone2;
  const accent: [number, number, number] = PDF.goldInk;
  const bg: [number, number, number] = PDF.ivory;

  // Decode the mark before any page is drawn. Never throws; a logo that will
  // not load must not cost the user their download.
  runMark = await prepareMark(halisiaMark.url);

  // ---------- Page 1: cover ----------
  doc.setFillColor(...bg);
  doc.rect(0, 0, W, H, "F");
  drawWatermark(doc, runMark);
  doc.setFillColor(...PDF.green);
  doc.rect(0, 0, W, 6, "F");

  if (runMark) {
    const mh = 34;
    doc.addImage(runMark.dataUrl, "PNG", M, 18, mh * runMark.ratio, mh, undefined, "FAST");
  }

  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    "HALISIA.AI · LOCATION INTELLIGENCE DOSSIER",
    runMark ? M + 34 * runMark.ratio + 10 : M,
    40,
  );

  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  const title = doc.splitTextToSize(address, W - M * 2);
  doc.text(title, M, 78);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...muted);
  const coverMeta = `${lat.toFixed(5)}, ${lng.toFixed(5)}  ·  Generated ${nairobiStamp(new Date())}`;
  doc.text(coverMeta, M, 100);

  if (shareUrl) {
    doc.setFontSize(9);
    doc.setTextColor(...accent);
    doc.textWithLink("Open shareable view", M, 114, { url: shareUrl });
  }

  // Composite indicator — withheld when open-data coverage cannot support it.
  const composite = wave4?.breakdown.investment ?? null;
  const compositeScore = composite && composite.confidence !== "low" ? composite.score : null;

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(M, 120, W - M * 2, 90, 10, 10, "F");
  doc.setTextColor(...muted);
  doc.setFontSize(9);
  doc.text("COMPOSITE OPEN-DATA INDICATOR · INDICATIVE", M + 20, 145);
  if (compositeScore != null) {
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(42);
    doc.text(`${compositeScore}`, M + 20, 190);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...muted);
    doc.text("/ 100", M + 100, 190);
  } else {
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Not assessed", M + 20, 172);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text(
      doc.splitTextToSize(
        "Open-data coverage at this location is too thin to support an indicator.",
        W - M * 2 - 240,
      ),
      M + 20,
      190,
    );
  }

  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text("OPEN-DATA CONFIDENCE", W - M - 175, 145);
  doc.setFontSize(14);
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.text(composite ? composite.confidence.toUpperCase() : "NO DATA", W - M - 175, 165);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text("Follows the weakest OpenStreetMap-derived", W - M - 175, 183);
  doc.text("component. Not a survey or valuation.", W - M - 175, 195);

  // Hero map (light view) — degrade gracefully if the static-map API is not authorized.
  if (base.dataUrl) {
    doc.addImage(base.dataUrl, "PNG", M, 230, W - M * 2, 320);
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text("Fig 1 · Light basemap · search point marked", M, 565);
  } else {
    doc.setFillColor(235, 240, 248);
    doc.roundedRect(M, 230, W - M * 2, 320, 10, 10, "F");
    doc.setFontSize(10);
    doc.setTextColor(...muted);
    doc.text(
      doc.splitTextToSize(
        "Basemap unavailable — enable the Static Maps API for this key to embed live evidence.",
        W - M * 2 - 40,
      ),
      M + 20,
      390,
    );
  }

  drawFooter(doc, W, H, M, muted);

  // ---------- Page 2: Open-data indicators ----------
  // Omitted entirely when Wave 4 returned nothing — an empty page is honest,
  // a populated one would not be.
  if (wave4) {
    doc.addPage();
    doc.setFillColor(...bg);
    doc.rect(0, 0, W, H, "F");
    drawHeader(doc, M, "Open-data indicators · indicative", ink, muted);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text(
      "Formula-based indicators computed from public open data. Not measurements, not a valuation.",
      M,
      96,
    );

    const cards: Array<{ label: string; ex: ScoreExplain }> = [
      { label: "Accessibility", ex: wave4.breakdown.accessibility },
      { label: "Infrastructure", ex: wave4.breakdown.infrastructure },
      { label: "Environment", ex: wave4.breakdown.environment },
      { label: "Development", ex: wave4.breakdown.development },
      { label: "Investment (composite)", ex: wave4.breakdown.investment },
    ];

    const colW = (W - M * 2 - 20) / 2;
    const cardH = 158;
    const lineH = 9;
    cards.forEach((c, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = M + col * (colW + 20);
      const yy = 112 + row * (cardH + 10);
      const innerW = colW - 28;
      const withheld = c.ex.confidence === "low";

      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, yy, colW, cardH, 8, 8, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...muted);
      doc.text(c.label.toUpperCase(), x + 14, yy + 20);

      if (withheld) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...ink);
        doc.text("Insufficient coverage", x + 14, yy + 44);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...muted);
        doc.text(
          doc.splitTextToSize(
            "Too few mapped features here to compute this. Absence in OpenStreetMap is not evidence that facilities are absent.",
            innerW,
          ),
          x + 14,
          yy + 60,
        );
        return;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(...ink);
      doc.text(`${c.ex.score}`, x + 14, yy + 46);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...muted);
      doc.text("/100", x + 48, yy + 46);
      doc.setFillColor(230, 235, 242);
      doc.roundedRect(x + 14, yy + 54, innerW, 5, 2.5, 2.5, "F");
      doc.setFillColor(...accent);
      doc.roundedRect(x + 14, yy + 54, (innerW * c.ex.score) / 100, 5, 2.5, 2.5, "F");

      // Wrap formula and factors so long infrastructure lines never spill into
      // the neighbouring card, and cap them so they never reach the confidence line.
      doc.setFontSize(7.5);
      doc.setTextColor(...muted);
      const formulaLines = (
        doc.splitTextToSize(`Formula: ${c.ex.formula}`, innerW) as string[]
      ).slice(0, 2);
      doc.text(formulaLines, x + 14, yy + 72);
      const factorText = c.ex.factors
        .map((f) => `${f.label}: ${Math.round(f.value * 10) / 10} (${f.weight})`)
        .join("  ·  ");
      const factorsY = yy + 72 + formulaLines.length * lineH + 4;
      const maxFactorLines = Math.max(1, Math.floor((yy + cardH - 26 - factorsY) / lineH) + 1);
      const factorLines = (doc.splitTextToSize(factorText, innerW) as string[]).slice(
        0,
        maxFactorLines,
      );
      doc.text(factorLines, x + 14, factorsY);
      doc.text(`Confidence: ${c.ex.confidence}`, x + 14, yy + cardH - 12);
    });

    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(
      doc.splitTextToSize(
        "Facility counts are a capped sample — the Overpass query returns at most 60 elements within 3 km, so dense areas are understated. These indicators use fixed heuristic weights and are not calibrated against transaction or survey data.",
        W - M * 2,
      ),
      M,
      H - 70,
    );
    drawFooter(doc, W, H, M, muted);
  }

  // ---------- Page 3: Evidence imagery ----------
  doc.addPage();
  doc.setFillColor(...bg);
  doc.rect(0, 0, W, H, "F");
  drawHeader(doc, M, "Evidence imagery · terrain, built form & water", ink, muted);

  const imgW = (W - M * 2 - 20) / 2;
  const imgH = 180;

  const evidence = [
    {
      img: terrain.dataUrl,
      title: "Terrain & slope",
      desc: "Terrain basemap with contour shading. Gradient must be confirmed by survey.",
    },
    {
      img: hybrid.dataUrl,
      title: "Built environment",
      desc: "Hybrid view: road network over satellite imagery at the search point.",
    },
    {
      img: sat.dataUrl,
      title: "High-resolution satellite",
      desc: "High-resolution satellite imagery. Visual reference only; no classification applied.",
    },
    {
      img: base.dataUrl,
      title: "Mapped water features",
      desc: "Light basemap with water features as mapped by the basemap provider. No flood modelling has been performed.",
    },
  ];

  evidence.forEach((e, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (imgW + 20);
    const yy = 110 + row * (imgH + 70);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, yy, imgW, imgH + 60, 8, 8, "F");
    if (e.img) {
      doc.addImage(e.img, "PNG", x + 8, yy + 8, imgW - 16, imgH - 16);
    } else {
      doc.setFillColor(235, 240, 248);
      doc.roundedRect(x + 8, yy + 8, imgW - 16, imgH - 16, 6, 6, "F");
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      doc.text("Imagery unavailable", x + 16, yy + imgH / 2);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...ink);
    doc.text(e.title, x + 12, yy + imgH + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(doc.splitTextToSize(e.desc, imgW - 24), x + 12, yy + imgH + 22);
  });

  drawFooter(doc, W, H, M, muted);

  // ---------- Page 4: Scope & verification ----------
  // No AI-generated narrative is included, so the page is not labelled as one.
  doc.addPage();
  doc.setFillColor(...bg);
  doc.rect(0, 0, W, H, "F");
  drawHeader(doc, M, "Scope & verification checklist", ink, muted);

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(M, 110, W - M * 2, 230, 10, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...ink);
  doc.text("What this dossier does and does not establish", M + 20, 135);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  const scopeNote =
    "This dossier assembles public open data and basemap imagery for the coordinate given. It does not establish ownership, boundaries, plot size, zoning, servicing, flood risk or market value. No site visit, survey, title search or valuation informed any figure in it. Every indicator shown is formula-based and indicative, with its inputs printed alongside it.";
  const scopeLines = doc.splitTextToSize(scopeNote, W - M * 2 - 40) as string[];
  doc.text(scopeLines, M + 20, 155);

  const checklistY = 155 + scopeLines.length * 12 + 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...ink);
  doc.text("Standard verification checklist", M + 20, checklistY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  const recs = [
    "1. Commission a boundary survey to confirm parcel size before purchase.",
    "2. Inspect drainage channels and surrounding low-ground during a rainy day.",
    "3. Confirm Kenya Power connection point and estimated last-mile cost.",
    "4. Verify title deed and any encumbrances at the local Lands registry.",
  ];
  doc.text(recs.join("\n"), M + 20, checklistY + 20, { lineHeightFactor: 1.5 });

  drawFooter(doc, W, H, M, muted);

  // ---------- Page 5: Climate normals & terrain ----------
  if (wave4 || terrainGrid) {
    doc.addPage();
    doc.setFillColor(...bg);
    doc.rect(0, 0, W, H, "F");
    drawHeader(doc, M, "Climate normals & terrain", ink, muted);

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(M, 110, W - M * 2, 90, 10, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...ink);
    doc.text("Climate normals (Open-Meteo, 2010–2020)", M + 16, 132);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    const climateRows: Array<[string, string]> = wave4
      ? [
          [
            "Mean temperature",
            wave4.climate.meanTempC != null ? `${wave4.climate.meanTempC.toFixed(1)} °C` : "—",
          ],
          [
            "Daily-mean range",
            wave4.climate.tempMinC != null && wave4.climate.tempMaxC != null
              ? `${wave4.climate.tempMinC.toFixed(0)} – ${wave4.climate.tempMaxC.toFixed(0)} °C`
              : "—",
          ],
          [
            "Annual rainfall",
            wave4.climate.annualRainfallMm != null
              ? `${Math.round(wave4.climate.annualRainfallMm)} mm/yr`
              : "—",
          ],
          ["Sample coverage", "~11 years of daily archive · EC-Earth3P-HR"],
        ]
      : [["Climate data", "Unavailable — Open-Meteo did not return a series."]];
    climateRows.forEach(([k, v], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      doc.text(`${k}: ${v}`, M + 16 + col * (W / 2 - M), 152 + row * 18);
    });

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(M, 220, W - M * 2, H - 260 - 40, 10, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...ink);
    doc.text("Isometric topographic projection (ASTER 30 m)", M + 16, 242);
    if (terrainImg && terrainGrid) {
      const s = gridStats(terrainGrid);
      doc.addImage(terrainImg, "PNG", M + 16, 254, W - M * 2 - 32, 260);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...muted);
      const stats = `Elevation ${s.minM}–${s.maxM} m · relief ${s.reliefM} m · sampled span ~${s.spanKm} km · overall grade ~${s.slopePct}%`;
      doc.text(doc.splitTextToSize(stats, W - M * 2 - 32), M + 16, 534);
      doc.text(
        "Colour ramp: green (low), amber, then white (high). Cyan pin marks the search point.",
        M + 16,
        560,
      );
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...muted);
      doc.text(
        "Terrain grid unavailable — Open-Topo-Data returned no series for this coordinate.",
        M + 20,
        280,
      );
    }

    drawFooter(doc, W, H, M, muted);
  }

  // ---------- Page 6: Administrative profile & nearby facilities ----------
  if (wave4) {
    doc.addPage();
    doc.setFillColor(...bg);
    doc.rect(0, 0, W, H, "F");
    drawHeader(doc, M, "Administrative profile & nearby facilities", ink, muted);

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(M, 110, W - M * 2, 90, 10, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...ink);
    doc.text("Administrative profile (OpenStreetMap reverse lookup)", M + 16, 132);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    const rows: Array<[string, string]> = [
      ["County", wave4.admin.county ?? "—"],
      ["Constituency", wave4.admin.constituency ?? "—"],
      ["Ward", wave4.admin.ward ?? "—"],
      ["Town", wave4.admin.town ?? "—"],
    ];
    rows.forEach(([k, v], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      doc.text(`${k}: ${v}`, M + 16 + col * (W / 2 - M), 152 + row * 18);
    });

    // Formula inputs and confidence are presented once on the open-data indicators page.
    const facEntries = Object.entries(wave4.facilities)
      .map(([k, list]) => [k, list.length] as [string, number])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const facTop = 220;
    const facH = 60 + facEntries.length * 20 + 24;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(M, facTop, W - M * 2, facH, 10, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...ink);
    doc.text("Mapped public facilities within 3 km", M + 16, facTop + 22);
    const maxCount = Math.max(1, ...facEntries.map(([, n]) => n));
    facEntries.forEach(([k, n], i) => {
      const y = facTop + 48 + i * 20;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...ink);
      doc.text(OVERPASS_CATEGORY_LABELS[k] ?? k, M + 16, y);
      doc.setTextColor(...muted);
      doc.text(String(n), W - M - 16, y, { align: "right" });
      doc.setFillColor(235, 240, 248);
      doc.roundedRect(M + 130, y - 8, W - M * 2 - 180, 8, 4, 4, "F");
      if (n > 0) {
        doc.setFillColor(...accent);
        doc.roundedRect(M + 130, y - 8, ((W - M * 2 - 180) * n) / maxCount, 8, 4, 4, "F");
      }
    });
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(
      doc.splitTextToSize(
        "Counts reflect what is mapped in OpenStreetMap, capped at 12 per category. A zero means nothing is mapped, not that nothing exists.",
        W - M * 2 - 32,
      ),
      M + 16,
      facTop + facH - 16,
    );

    const usedSources = wave4.sources.filter((s) => s.used).map((s) => s.label);
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(
      doc.splitTextToSize(
        `Sources that returned data: ${usedSources.length ? usedSources.join(" · ") : "none"} · generated ${nairobiStamp(new Date(wave4.generatedAt))}`,
        W - M * 2,
      ),
      M,
      H - 60,
    );
    drawFooter(doc, W, H, M, muted);
  }

  const safe =
    address
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase()
      .slice(0, 50) || "location";
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const coord = `${lat.toFixed(4)}_${lng.toFixed(4)}`.replace(/-/g, "s");
  const filename = `halisia-dossier-${safe}-${coord}-${stamp}.pdf`;
  progress(96, "Saving PDF…");
  doc.save(filename);
  progress(100, "Done");
  return {
    ok: true,
    mapsRequested: settled.length,
    mapsSucceeded: settled.length - mapsFailed,
    mapsFailed,
    lastError,
    filename,
  };
}

/**
 * Page header. Called immediately after every addPage and before any content,
 * which makes it the right place for the watermark too - it has to be painted
 * first to sit behind everything else.
 */
function drawHeader(
  doc: jsPDF,
  M: number,
  title: string,
  ink: [number, number, number],
  muted: [number, number, number],
) {
  const W = doc.internal.pageSize.getWidth();
  drawWatermark(doc, runMark);

  doc.setFillColor(...PDF.green);
  doc.rect(0, 0, W, 4, "F");

  let x = M;
  if (runMark) {
    const mh = 18;
    doc.addImage(runMark.dataUrl, "PNG", M, 24, mh * runMark.ratio, mh, undefined, "FAST");
    x = M + mh * runMark.ratio + 8;
  }

  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("HALISIA.AI · DOSSIER", x, 40);

  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, M, 75);
}

function drawFooter(doc: jsPDF, W: number, H: number, M: number, muted: [number, number, number]) {
  doc.setDrawColor(...PDF.stone2);
  doc.setLineWidth(0.5);
  doc.line(M, H - 44, W - M, H - 44);

  let x = M;
  if (runMark) {
    const mh = 11;
    doc.addImage(runMark.dataUrl, "PNG", M, H - 38, mh * runMark.ratio, mh, undefined, "FAST");
    x = M + mh * runMark.ratio + 6;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text(
    "Informational only — verify title, survey and zoning with a licensed professional.",
    x,
    H - 30,
  );
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF.goldInk);
  doc.text("halisia.ai", W - M, H - 30, { align: "right" });
}

function renderTerrainToPngDataUrl(grid: ElevationGrid, w: number, h: number): string | null {
  if (typeof document === "undefined") return null;
  const timer = startTerrainTimer("pdf-terrain", { w, h });
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    timer.error("no 2d context");
    recordTerrainEvent({ layer: "render", kind: "error", error: "pdf: no 2d context" });
    return null;
  }
  try {
    drawIsometricTerrain(ctx, grid, w, h, { background: "#ffffff" });
    const url = canvas.toDataURL("image/png");
    timer.success({ bytes: url.length });
    return url;
  } catch (e) {
    timer.error(e);
    return null;
  }
}
