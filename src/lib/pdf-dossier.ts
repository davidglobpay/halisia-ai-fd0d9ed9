import jsPDF from "jspdf";
import { fetchStaticMapCached } from "@/lib/static-map-cache";
import { getWave4Intel, type Wave4Intel, type ScoreExplain } from "@/lib/wave4-intel.functions";
import {
  drawIsometricTerrain,
  fetchElevationGrid,
  gridStats,
  type ElevationGrid,
} from "@/lib/terrain-grid";
import { startTerrainTimer, recordTerrainEvent } from "@/lib/terrain-telemetry";

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
  progress(35, "Aggregating Wave 4 open data…");
  let wave4: Wave4Intel | null = null;
  try {
    wave4 = await getWave4Intel({ data: { lat, lng } });
  } catch {
    wave4 = null;
  }
  const sat = pick(3);

  // Wave 2 · Isometric terrain grid (rendered off-screen to a PNG the PDF embeds).
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

  // Palette
  const ink: [number, number, number] = [15, 23, 42];
  const muted: [number, number, number] = [100, 116, 139];
  const accent: [number, number, number] = [45, 140, 255];
  const bg: [number, number, number] = [247, 249, 252];


  // ---------- Page 1: cover ----------
  doc.setFillColor(...bg);
  doc.rect(0, 0, W, H, "F");
  doc.setFillColor(...accent);
  doc.rect(0, 0, W, 6, "F");

  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("HALISIA.AI · LOCATION INTELLIGENCE DOSSIER", M, 40);

  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  const title = doc.splitTextToSize(address, W - M * 2);
  doc.text(title, M, 78);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...muted);
  doc.text(
    `${lat.toFixed(5)}, ${lng.toFixed(5)}  ·  Generated ${new Date().toLocaleString()}`,
    M,
    100,
  );

  if (shareUrl) {
    doc.setFontSize(9);
    doc.setTextColor(...accent);
    doc.textWithLink("Open shareable view →", M, 114, { url: shareUrl });
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
      "Open-data coverage at this location is too thin to support an indicator.",
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
  doc.text("Derived from OpenStreetMap facility counts and", W - M - 175, 183);
  doc.text("Open-Meteo climate normals. Not a survey or valuation.", W - M - 175, 195);

  // Hero map (light view) — degrade gracefully if the static-map API is not authorized.
  if (base.dataUrl) {
    doc.addImage(base.dataUrl, "PNG", M, 230, W - M * 2, 320);
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text("Fig 1 · Light basemap · parcel centroid marked", M, 565);
  } else {
    doc.setFillColor(235, 240, 248);
    doc.roundedRect(M, 230, W - M * 2, 320, 10, 10, "F");
    doc.setFontSize(10);
    doc.setTextColor(...muted);
    doc.text(
      "Basemap unavailable — enable the Static Maps API for this key to embed live evidence.",
      M + 20,
      390,
    );
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text(
    "Informational only — verify title, survey and zoning with a licensed professional.",
    M,
    H - 30,
  );
  doc.text("halisia.ai", W - M - 40, H - 30);

  // ---------- Page 2: Open-data indicators ----------
  // Omitted entirely when Wave 4 returned nothing — an empty page is honest,
  // a populated one would not be.
  if (wave4) {
    doc.addPage();
    doc.setFillColor(...bg);
    doc.rect(0, 0, W, H, "F");
    drawHeader(doc, W, M, "Open-data indicators · indicative", ink, muted);

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
    const cardH = 132;
    cards.forEach((c, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = M + col * (colW + 20);
      const yy = 116 + row * (cardH + 12);
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
            colW - 28,
          ),
          x + 14,
          yy + 60,
        );
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(...ink);
        doc.text(`${c.ex.score}`, x + 14, yy + 46);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...muted);
        doc.text("/100", x + 48, yy + 46);
        doc.setFillColor(230, 235, 242);
        doc.roundedRect(x + 14, yy + 54, colW - 28, 5, 2.5, 2.5, "F");
        doc.setFillColor(...accent);
        doc.roundedRect(x + 14, yy + 54, ((colW - 28) * c.ex.score) / 100, 5, 2.5, 2.5, "F");

        doc.setFontSize(7.5);
        doc.setTextColor(...muted);
        doc.text(`Formula: ${c.ex.formula}`, x + 14, yy + 72);
        const factorLines = c.ex.factors.map(
          (f) => `${f.label}: ${typeof f.value === "number" ? Math.round(f.value * 10) / 10 : f.value} (${f.weight})`,
        );
        doc.text(doc.splitTextToSize(factorLines.join("  ·  "), colW - 28), x + 14, yy + 84);
        doc.text(`Confidence: ${c.ex.confidence}`, x + 14, yy + 120);
      }
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

  // ---------- Page 3: Evidence layers ----------
  doc.addPage();
  doc.setFillColor(...bg);
  doc.rect(0, 0, W, H, "F");
  drawHeader(doc, W, M, "Evidence · terrain, drainage & flood exposure", ink, muted);

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
      desc: "Hybrid view: road network over satellite imagery at the parcel centroid.",
    },
    {
      img: sat.dataUrl,
      title: "High-resolution satellite",
      desc: "High-resolution satellite imagery. Visual reference only; no classification applied.",
    },
    {
      img: base.dataUrl,
      title: "Drainage & flood context",
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
    const d = doc.splitTextToSize(e.desc, imgW - 24);
    doc.text(d, x + 12, yy + imgH + 22);
  });

  drawFooter(doc, W, H, M, muted);

  // ---------- Page 4: AI narrative ----------
  doc.addPage();
  doc.setFillColor(...bg);
  doc.rect(0, 0, W, H, "F");
  drawHeader(doc, W, M, "AI narrative & recommendations", ink, muted);

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(M, 110, W - M * 2, 220, 10, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...ink);
  doc.text("What this dossier does and does not establish", M + 20, 135);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  const scopeNote =
    "This dossier assembles public open data and basemap imagery for the coordinate given. It does not establish ownership, boundaries, plot size, zoning, servicing, flood risk or market value. No site visit, survey, title search or valuation informed any figure in it. Every indicator shown is formula-based and indicative, with its inputs printed alongside it.";
  doc.text(doc.splitTextToSize(scopeNote, W - M * 2 - 40), M + 20, 155);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...ink);
  doc.text("Standard verification checklist", M + 20, 250);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  const recs = [
    "1. Commission a boundary survey to confirm parcel size before purchase.",
    "2. Inspect drainage channels and surrounding low-ground during a rainy day.",
    "3. Confirm Kenya Power connection point and estimated last-mile cost.",
    "4. Verify title deed and any encumbrances at the local Lands registry.",
  ];
  doc.text(recs.join("\n"), M + 20, 270, { lineHeightFactor: 1.5 });

  drawFooter(doc, W, H, M, muted);

  // ---------- Wave 1 & 2 · Climate + isometric terrain ----------
  if (wave4 || terrainGrid) {
    doc.addPage();
    doc.setFillColor(...bg);
    doc.rect(0, 0, W, H, "F");
    drawHeader(doc, W, M, "Waves 1 & 2 · Climate normals + 3D terrain", ink, muted);

    // Climate tiles (from Wave 4 Open-Meteo aggregation).
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

    // Terrain infographic
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
      const stats = `Elevation ${s.minM}–${s.maxM} m · relief Δ ${s.reliefM} m · sampled span ~${s.spanKm} km · overall grade ~${s.slopePct}%`;
      doc.text(stats, M + 16, 534);
      doc.text(
        "Colour ramp: green (low) → amber → white (high). Cyan pin marks the search point.",
        M + 16,
        548,
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

  // ---------- Page 5: Wave 4 · Public open-data intelligence ----------
  if (wave4) {
    doc.addPage();
    doc.setFillColor(...bg);
    doc.rect(0, 0, W, H, "F");
    drawHeader(doc, W, M, "Wave 4 · Public open-data intelligence", ink, muted);

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(M, 110, W - M * 2, 90, 10, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...ink);
    doc.text("Administrative profile", M + 16, 132);
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
    // Facility mix — top 6 categories
    const facEntries = Object.entries(wave4.facilities)
      .map(([k, list]) => [k, list.length] as [string, number])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(M, 410, W - M * 2, 170, 10, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...ink);
    doc.text("Nearby public facilities (3 km)", M + 16, 432);
    const maxCount = Math.max(1, ...facEntries.map(([, n]) => n));
    facEntries.forEach(([k, n], i) => {
      const y = 450 + i * 20;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...ink);
      doc.text(k, M + 16, y);
      doc.setTextColor(...muted);
      doc.text(String(n), W - M - 30, y, { align: "right" });
      doc.setFillColor(235, 240, 248);
      doc.roundedRect(M + 130, y - 8, W - M * 2 - 180, 8, 4, 4, "F");
      doc.setFillColor(...accent);
      doc.roundedRect(M + 130, y - 8, ((W - M * 2 - 180) * n) / maxCount, 8, 4, 4, "F");
    });

    doc.setFontSize(8);
    doc.setTextColor(...muted);
    const usedSources = wave4.sources.filter((s) => s.used).map((s) => s.label);
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(
      doc.splitTextToSize(
        `Sources contacted: ${usedSources.length ? usedSources.join(" · ") : "none returned data"} · generated ${new Date(wave4.generatedAt).toLocaleString()}`,
        W - M * 2,
      ),
      M,
      H - 55,
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

function drawHeader(
  doc: jsPDF,
  W: number,
  M: number,
  title: string,
  ink: [number, number, number],
  muted: [number, number, number],
) {
  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("HALISIA.AI · DOSSIER", M, 40);
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, M, 75);
}

function drawFooter(doc: jsPDF, W: number, H: number, M: number, muted: [number, number, number]) {
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text(
    "Informational only — verify title, survey and zoning with a licensed professional.",
    M,
    H - 30,
  );
  doc.text("halisia.ai", W - M - 40, H - 30);
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
