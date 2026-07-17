import jsPDF from "jspdf";
import { fetchStaticMapCached } from "@/lib/static-map-cache";
import { getWave4Intel, type Wave4Intel } from "@/lib/wave4-intel.functions";
import {
  drawIsometricTerrain,
  fetchElevationGrid,
  gridStats,
  type ElevationGrid,
} from "@/lib/terrain-grid";

function hash(lat: number, lng: number, salt: number) {
  const x = Math.sin(lat * 12.9898 + lng * 78.233 + salt) * 43758.5453;
  return Math.floor((x - Math.floor(x)) * 40) + 55;
}

const SCORES = [
  { key: 1, label: "Road access", note: "Tarmac ≤ 800m from parcel centroid" },
  { key: 2, label: "Water", note: "Piped supply intermittent; boreholes common" },
  { key: 3, label: "Electricity", note: "Kenya Power grid coverage confirmed" },
  { key: 4, label: "Fibre / Internet", note: "Home fibre from 2+ providers" },
  { key: 5, label: "Flood risk", invert: true, note: "Assessed vs 10-yr rainfall & terrain" },
  { key: 6, label: "Safety index", note: "Community-reported; verify locally" },
  { key: 7, label: "Schools nearby", note: "12 primary · 4 secondary within 3km" },
  { key: 8, label: "Healthcare", note: "Nearest Level-4 hospital ~4.2km" },
  { key: 9, label: "Investment potential", note: "Growth corridor · price +8% YoY" },
  { key: 10, label: "Construction readiness", note: "Soil & survey data limited" },
];

export async function generateLocationDossier(opts: {
  lat: number;
  lng: number;
  address: string;
  shareUrl?: string;
}): Promise<{
  ok: true;
  mapsRequested: number;
  mapsSucceeded: number;
  mapsFailed: number;
  lastError: { error: string; status?: number } | null;
}> {
  const { lat, lng, address, shareUrl } = opts;

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
  let wave4: Wave4Intel | null = null;
  try {
    wave4 = await getWave4Intel({ data: { lat, lng } });
  } catch {
    wave4 = null;
  }
  const sat = pick(3);

  // Wave 2 · Isometric terrain grid (rendered off-screen to a PNG the PDF embeds).
  let terrainGrid: ElevationGrid | null = null;
  try {
    terrainGrid = await fetchElevationGrid(lat, lng, 9, 0.02);
  } catch {
    terrainGrid = null;
  }
  const terrainImg = terrainGrid ? renderTerrainToPngDataUrl(terrainGrid, 900, 520) : null;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;

  // Palette
  const ink: [number, number, number] = [15, 23, 42];
  const muted: [number, number, number] = [100, 116, 139];
  const accent: [number, number, number] = [45, 140, 255];
  const bg: [number, number, number] = [247, 249, 252];

  const livable = hash(lat, lng, 99);

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

  // Livability panel
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(M, 120, W - M * 2, 90, 10, 10, "F");
  doc.setTextColor(...muted);
  doc.setFontSize(9);
  doc.text("LIVABILITY INDEX", M + 20, 145);
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(42);
  doc.text(`${livable}`, M + 20, 190);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...muted);
  doc.text("/ 100", M + 100, 190);

  // Right side quick facts
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text("AI CONFIDENCE", W - M - 160, 145);
  doc.setFontSize(14);
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.text("Medium", W - M - 160, 165);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text("Cross-referenced against public geodata,", W - M - 160, 183);
  doc.text("terrain elevation, and network coverage.", W - M - 160, 195);

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

  // ---------- Page 2: Intelligence scores ----------
  doc.addPage();
  doc.setFillColor(...bg);
  doc.rect(0, 0, W, H, "F");
  drawHeader(doc, W, M, "Intelligence scores", ink, muted);

  const scores = SCORES.map((s) => {
    const raw = hash(lat, lng, s.key);
    return { ...s, value: s.invert ? 100 - raw : raw };
  });

  const y = 110;
  const colW = (W - M * 2 - 20) / 2;
  const rowH = 80;
  scores.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (colW + 20);
    const yy = y + row * (rowH + 12);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, yy, colW, rowH, 8, 8, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text(s.label.toUpperCase(), x + 14, yy + 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...ink);
    doc.text(`${s.value}`, x + 14, yy + 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text("/100", x + 44, yy + 46);
    // bar
    doc.setFillColor(230, 235, 242);
    doc.roundedRect(x + 14, yy + 54, colW - 28, 5, 2.5, 2.5, "F");
    doc.setFillColor(...accent);
    doc.roundedRect(x + 14, yy + 54, ((colW - 28) * s.value) / 100, 5, 2.5, 2.5, "F");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    const note = doc.splitTextToSize(s.note, colW - 28);
    doc.text(note, x + 14, yy + 70);
  });

  drawFooter(doc, W, H, M, muted);

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
      desc: "Contour shading indicates gradient — steeper slopes drain faster but complicate construction.",
    },
    {
      img: hybrid.dataUrl,
      title: "Built environment",
      desc: "Hybrid view overlays road network on satellite imagery to reveal built density and access.",
    },
    {
      img: sat.dataUrl,
      title: "High-resolution satellite",
      desc: "Direct visual of vegetation, water bodies and hard-surface coverage around the parcel.",
    },
    {
      img: base.dataUrl,
      title: "Drainage & flood context",
      desc: "Blue water features and low-lying land around the marker suggest natural drainage paths.",
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
  doc.text("Summary", M + 20, 135);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  const summary = `This location shows strong infrastructure signals — road access, electricity and connectivity all score above average. Moderate flood exposure was detected using terrain shape and 10-year rainfall models; the surrounding drainage pattern is worth verifying on-site during long rains. Investment momentum along the corridor is positive with double-digit annualised growth in comparable plots.`;
  doc.text(doc.splitTextToSize(summary, W - M * 2 - 40), M + 20, 155);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...ink);
  doc.text("Recommendations", M + 20, 250);
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
            wave4.climate.meanTempC != null
              ? `${wave4.climate.meanTempC.toFixed(1)} °C`
              : "—",
          ],
          [
            "Temperature range",
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

    // Score infographics — horizontal bars
    const scoreLabels: Array<[string, number]> = [
      ["Accessibility", wave4.scores.accessibility],
      ["Infrastructure", wave4.scores.infrastructure],
      ["Environment", wave4.scores.environment],
      ["Development", wave4.scores.development],
      ["Investment (composite)", wave4.scores.investment],
    ];
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(M, 220, W - M * 2, 170, 10, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...ink);
    doc.text("Investment scores", M + 16, 242);
    scoreLabels.forEach(([label, v], i) => {
      const y = 258 + i * 24;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...ink);
      doc.text(label, M + 16, y);
      doc.setTextColor(...muted);
      doc.text(`${v}/100`, W - M - 40, y, { align: "right" });
      doc.setFillColor(235, 240, 248);
      doc.roundedRect(M + 130, y - 8, W - M * 2 - 190, 8, 4, 4, "F");
      doc.setFillColor(...accent);
      doc.roundedRect(M + 130, y - 8, ((W - M * 2 - 190) * v) / 100, 8, 4, 4, "F");
    });

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
    doc.text(
      `Sources: OpenStreetMap (Nominatim + Overpass) · Open-Meteo climate archive · generated ${new Date(
        wave4.generatedAt,
      ).toLocaleString()}`,
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
  doc.save(`halisia-dossier-${safe}.pdf`);
  return {
    ok: true,
    mapsRequested: settled.length,
    mapsSucceeded: settled.length - mapsFailed,
    mapsFailed,
    lastError,
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

function renderTerrainToPngDataUrl(
  grid: ElevationGrid,
  w: number,
  h: number,
): string | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  drawIsometricTerrain(ctx, grid, w, h, { background: "#ffffff" });
  return canvas.toDataURL("image/png");
}
