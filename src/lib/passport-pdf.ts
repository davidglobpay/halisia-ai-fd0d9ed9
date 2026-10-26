import { passportLocationNews } from "./pulse.functions";
import { landUseContext } from "./passport-land-use";
import jsPDF from "jspdf";
import { displayPlaceName, isQueryCentroid } from "./passport-quality";
import { CHAPTERS, CLASS_LABEL, type EvidenceItem, type LedgerEntry } from "./passport-evidence";
import type { PassportAiExport } from "./passport-ai-evidence";
import type { LocationIntel } from "./location-intel.functions";
import type { GeotechIntel } from "./geotech.functions";
import type { Wave4Intel } from "./wave4-intel.functions";
import type { CountyFacts } from "./kenya-county-facts";
import { loadBrandImage, type BrandImage } from "./brand-asset";
import { PDF, brandPage, sanitize } from "./pdf-chrome";
import { passportMapImage } from "./passport-visual-assets";
import { PREVIEW_LAYERS, type EvidenceMapLayer } from "./map-evidence-preview";
import { COUNTY_LOGOS } from "./county-logos";
import lockupUrl from "@/assets/brand/halisia-lockup.png?url";
import symbolUrl from "@/assets/brand/halisia-mark.png?url";

export type PassportPdfOptions = {
  place: string;
  locationLine: string;
  positionLabel: string;
  items: EvidenceItem[];
  ledger: LedgerEntry[];
  coveragePct: number;
  generatedAt: string;
  aiSummary?: PassportAiExport | null;
  coords?: { lat: number; lng: number };
  county?: CountyFacts | null;
  intel?: LocationIntel | null;
  geotech?: GeotechIntel | null;
  wave4?: Wave4Intel | null;
};
export type PassportPdfAssets = {
  lockup: BrandImage | null;
  symbol: BrandImage | null;
  county: BrandImage | null;
  maps: Partial<Record<EvidenceMapLayer, BrandImage | null>>;
  amenities: Array<{
    name: string;
    category: string;
    lat: number;
    lng: number;
    distanceKm?: number;
    driveKm?: number | null;
    driveMin?: number | null;
    source: string;
    image: BrandImage | null;
    photo: BrandImage | null;
  }>;
  news: Array<{
    title: string;
    source_name: string | null;
    published_at: string | null;
    url: string | null;
    category: string | null;
  }>;
};

async function collectAssets(o: PassportPdfOptions): Promise<PassportPdfAssets> {
  const [lockup, symbol, county] = await Promise.all([
    loadBrandImage(lockupUrl),
    loadBrandImage(symbolUrl),
    o.county ? loadBrandImage(COUNTY_LOGOS[o.county.code] ?? "") : null,
  ]);
  // Artwork is bundled with this build. A transient decode failure must not
  // block the user's evidence export; render the named text fallback below.
  const maps: PassportPdfAssets["maps"] = {};
  if (o.coords)
    await Promise.all(
      (["satellite", "map", "terrain"] as const).map(async (layer) => {
        maps[layer] = await passportMapImage(o.coords!.lat, o.coords!.lng, layer);
      }),
    );
  const imageDeadline = Date.now() + 45_000;
  const places: Omit<PassportPdfAssets["amenities"][number], "image" | "photo">[] = [];
  for (const [category, list] of Object.entries(o.intel?.categories ?? {}))
    for (const p of list) {
      if (
        p.location &&
        Number.isFinite(p.location.lat) &&
        Number.isFinite(p.location.lng) &&
        !isQueryCentroid(p.location, o.coords)
      )
        places.push({
          name: displayPlaceName(p.name),
          category,
          lat: p.location.lat,
          lng: p.location.lng,
          distanceKm: p.distanceKm,
          driveKm: p.driveKm,
          driveMin: p.driveMin,
          source: "Google Places / Routes",
        });
    }
  if (o.wave4?.sources.some((s) => s.used && s.label.includes("Overpass")))
    for (const [category, list] of Object.entries(o.wave4.facilities))
      for (const p of list) {
        if (!isQueryCentroid(p, o.coords))
          places.push({ ...p, name: displayPlaceName(p.name), category, source: "OpenStreetMap" });
      }
  // Google Places and Overpass frequently return the same facility twice at
  // slightly different coordinates. Dedupe similar names within 50 m so the
  // directory never prints the same amenity as two cards.
  const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const similarName = (x: string, y: string) => {
    const a = normName(x),
      b = normName(y);
    if (!a || !b) return false;
    return (
      a === b || a.includes(b) || b.includes(a) || (a.length >= 6 && b.startsWith(a.slice(0, 6)))
    );
  };
  const distM = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const dLat = ((b.lat - a.lat) * Math.PI) / 180,
      dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((a.lat * Math.PI) / 180) *
        Math.cos((b.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.sqrt(h));
  };
  const uniquePlaces = places.filter(
    (p, i) => !places.slice(0, i).some((q) => distM(p, q) <= 50 && similarName(p.name, q.name)),
  );
  // Existing adapter results are bounded; preserve every located named result in the directory.
  const amenities: PassportPdfAssets["amenities"] = [];
  for (let i = 0; i < uniquePlaces.length; i += 4) {
    const batch = await Promise.all(
      uniquePlaces.slice(i, i + 4).map(async (p) => ({
        ...p,
        // Satellite, not street. Esri's street basemap has almost no vector
        // data for rural Machakos - the Katani export produced 26 near-blank
        // pale cards from it - while its imagery of the same coordinates is
        // detailed. Zoom 18 frames a plot and its frontage rather than two
        // kilometres of nothing.
        image:
          Date.now() < imageDeadline ? await passportMapImage(p.lat, p.lng, "satellite", 18) : null,
        photo: null,
      })),
    );
    amenities.push(...batch);
  }
  // County news is a nice-to-have: a failure here must never cost the export.
  let news: PassportPdfAssets["news"] = [];
  if (o.county?.name) {
    try {
      // o.place is the coordinate string for a dropped pin, so placeTerms
      // returned nothing and PLACE_WEIGHT — the strongest local signal in the
      // ranking — never fired. locationLine carries the town and ward.
      const res = await passportLocationNews({
        data: { county: o.county.name, place: `${o.locationLine} ${o.place}` },
      });
      news = res.articles ?? [];
    } catch {
      news = [];
    }
  }
  return { lockup, symbol, county, maps, amenities, news };
}

/** Rendering separated from download for PDF layout tests with explicitly synthetic fixtures. */
export function renderPassportPdf(o: PassportPdfOptions, a: PassportPdfAssets): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const W = doc.internal.pageSize.getWidth(),
    H = doc.internal.pageSize.getHeight(),
    M = 40,
    C = W - 2 * M;
  let y = 92;
  const image = (im: BrandImage, x: number, yy: number, w: number, h: number) => {
    const scale = Math.min(w / im.width, h / im.height);
    doc.addImage(
      im.dataUrl,
      "PNG",
      x + (w - im.width * scale) / 2,
      yy + (h - im.height * scale) / 2,
      im.width * scale,
      im.height * scale,
      undefined,
      "FAST",
    );
  };
  const page = (title: string) => {
    doc.setFillColor(...PDF.ivory);
    doc.rect(0, 0, W, H, "F");
    brandPage(doc, a.symbol);
    doc.setFillColor(...PDF.green);
    doc.rect(0, 0, W, 5, "F");
    // Centred on every page. The text fallback is centred too, so a failed
    // artwork load changes the mark but never the layout.
    if (a.lockup) image(a.lockup, (W - 150) / 2, 16, 150, 49);
    else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(...PDF.forest);
      doc.text("HALISIA.AI", W / 2, 43, { align: "center" });
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PDF.goldInk);
    doc.text("LAND PASSPORT", W - M, 30, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(sanitize(title), W - M, 45, { align: "right" });
    doc.setDrawColor(...PDF.gold);
    doc.line(M, 73, W - M, 73);
    y = 92;
  };
  const next = (title: string) => {
    doc.addPage();
    page(title);
  };
  // Section starts are recorded for the table of contents; continuation pages
  // created by need() are not sections and must not appear in it.
  const toc: Array<{ label: string; page: number }> = [];
  const section = (t: string) => {
    next(t);
    toc.push({ label: t, page: doc.getNumberOfPages() });
  };
  const CATEGORY_TONES: [number, number, number][] = [PDF.green, PDF.gold, PDF.forest, PDF.goldInk];
  const toneFor = (cat: string) => {
    let h = 0;
    for (const ch of cat) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return CATEGORY_TONES[h % CATEGORY_TONES.length];
  };
  /**
   * Small calm vector glyph per amenity category, drawn with jsPDF
   * primitives inside a tinted disc. Unknown categories get a plain disc.
   */
  const drawCategoryIcon = (cat: string, cx: number, cy: number) => {
    const tone = toneFor(cat);
    doc.setFillColor(tone[0], tone[1], tone[2]);
    doc.circle(cx, cy, 6, "F");
    doc.setFillColor(247, 243, 234);
    doc.setDrawColor(247, 243, 234);
    doc.setLineWidth(1);
    const k = cat.toLowerCase();
    if (
      k.includes("health") ||
      k.includes("hospital") ||
      k.includes("clinic") ||
      k.includes("pharm")
    ) {
      doc.rect(cx - 1.2, cy - 3.4, 2.4, 6.8, "F");
      doc.rect(cx - 3.4, cy - 1.2, 6.8, 2.4, "F");
    } else if (k.includes("educ") || k.includes("school") || k.includes("learn")) {
      doc.rect(cx - 3.2, cy - 2.4, 6.4, 4.8, "F");
      doc.setFillColor(tone[0], tone[1], tone[2]);
      doc.rect(cx - 0.5, cy - 2.4, 1, 4.8, "F");
    } else if (
      k.includes("shop") ||
      k.includes("market") ||
      k.includes("retail") ||
      k.includes("super")
    ) {
      doc.rect(cx - 2.8, cy - 1, 5.6, 4, "F");
      doc.setLineWidth(1.2);
      doc.circle(cx, cy - 1.6, 1.8, "S");
    } else if (
      k.includes("transport") ||
      k.includes("bus") ||
      k.includes("matatu") ||
      k.includes("station")
    ) {
      doc.roundedRect(cx - 3, cy - 3, 6, 5, 1, 1, "F");
      doc.circle(cx - 1.8, cy + 2.8, 0.9, "F");
      doc.circle(cx + 1.8, cy + 2.8, 0.9, "F");
    } else if (
      k.includes("worship") ||
      k.includes("church") ||
      k.includes("mosque") ||
      k.includes("relig")
    ) {
      doc.triangle(cx, cy - 3.6, cx - 3, cy + 0.4, cx + 3, cy + 0.4, "F");
      doc.rect(cx - 3, cy + 0.4, 6, 3, "F");
    } else if (
      k.includes("food") ||
      k.includes("restaurant") ||
      k.includes("cafe") ||
      k.includes("eat")
    ) {
      doc.circle(cx - 1.4, cy - 0.6, 2, "F");
      doc.rect(cx + 1.2, cy - 3, 1.2, 6.4, "F");
    } else if (k.includes("fuel") || k.includes("petrol") || k.includes("gas")) {
      doc.rect(cx - 2.6, cy - 3, 4.4, 6, "F");
      doc.rect(cx + 1.8, cy - 1.4, 1.4, 2.6, "F");
    } else if (
      k.includes("bank") ||
      k.includes("financ") ||
      k.includes("atm") ||
      k.includes("sacco")
    ) {
      doc.triangle(cx, cy - 3.4, cx - 3.4, cy - 0.8, cx + 3.4, cy - 0.8, "F");
      doc.rect(cx - 2.6, cy - 0.4, 1.2, 3.2, "F");
      doc.rect(cx - 0.6, cy - 0.4, 1.2, 3.2, "F");
      doc.rect(cx + 1.4, cy - 0.4, 1.2, 3.2, "F");
    } else {
      doc.circle(cx, cy, 2, "F");
    }
  };
  const need = (h: number, title = "Evidence directory") => {
    if (y + h > H - 65) next(title);
  };
  const text = (
    s: string,
    size = 10,
    bold = false,
    color: [number, number, number] = PDF.forest,
    x = M,
    width = C,
  ) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(sanitize(s), width) as string[];
    need(lines.length * size * 1.35);
    doc.text(lines, x, y + size);
    y += lines.length * size * 1.35;
  };
  const title = (s: string) => {
    text(s, 21, true);
    y += 9;
  };
  const meta = (s: string) => {
    text(s, 8, false, PDF.stone2);
    y += 5;
  };
  const block = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    const rows = doc.splitTextToSize(sanitize(value), C - 24) as string[];
    const height = Math.max(50, 30 + rows.length * 15.6);
    need(height + 10);
    const top = y;
    doc.setFillColor(...PDF.paper);
    doc.roundedRect(M, top, C, height, 8, 8, "F");
    y = top + 7;
    text(label.toUpperCase(), 7, true, PDF.goldInk, M + 12, C - 24);
    text(value, 12, true, PDF.forest, M + 12, C - 24);
    y = top + height + 10;
  };
  /**
   * A short reading of the evidence already printed above it.
   *
   * Strictly derived: every sentence restates, aggregates or compares numbers
   * that appear on the same page. It carries no rating, no suitability verdict
   * and no claim about anything unmeasured. A fabricated scoring layer was
   * removed from this product on purpose; this is a summary, not its return.
   */
  const conclusion = (lines: Array<string | false | null | undefined>) => {
    const body = lines.filter((l): l is string => !!l && l.trim().length > 0).join(" ");
    if (!body) return;
    const rows = doc.splitTextToSize(sanitize(body), C - 24) as string[];
    const height = 26 + rows.length * 12.6;
    need(height + 12);
    const top = y;
    doc.setFillColor(...PDF.paper);
    doc.roundedRect(M, top, C, height, 8, 8, "F");
    doc.setDrawColor(...PDF.gold);
    doc.setLineWidth(2);
    doc.line(M, top + 4, M, top + height - 4);
    doc.setLineWidth(0.6);
    y = top + 7;
    text("READING THIS EVIDENCE (INTERPRETATION)", 7, true, PDF.goldInk, M + 12, C - 24);
    text(body, 9, false, PDF.forest, M + 12, C - 24);
    y = top + height + 12;
  };
  const map = (layer: EvidenceMapLayer, h = 235) => {
    const im = a.maps[layer];
    // Missing imagery is omitted, never replaced by a placeholder card.
    if (!im) {
      return;
    }
    need(h + 75);
    image(im, M, y, C, h);
    y += h + 6;
    meta(`${PREVIEW_LAYERS[layer].label} context - ${PREVIEW_LAYERS[layer].attribution}`);
    meta(
      "Red marker: selected location. Capture date and positional accuracy not supplied. No surveyed boundary is drawn.",
    );
  };
  const bars = (rows: Array<{ label: string; value: number | null }>, unit: string) => {
    const valid = rows.filter(
      (r): r is { label: string; value: number } => r.value != null && Number.isFinite(r.value),
    );
    if (!valid.length) return;
    // An all-zero series drew a full-height chart of invisible bars above a
    // large void, captioned "never zero" - which reads as broken rather than
    // informative. The Katani rainfall forecast was 24 zeros. State it.
    if (valid.every((r) => r.value === 0)) {
      meta(`All returned values are zero for this period. Scale: ${unit}.`);
      return;
    }
    need(200);
    const lo = Math.min(0, ...valid.map((r) => r.value)),
      hi = Math.max(0, ...valid.map((r) => r.value)),
      range = hi - lo || 1,
      base = y + 140,
      bw = C / Math.max(rows.length, 1);
    doc.setDrawColor(...PDF.stone2);
    const zero = base - ((0 - lo) / range) * 110;
    doc.line(M, zero, M + C, zero);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.value == null || !Number.isFinite(r.value)) continue;
      const end = base - ((r.value - lo) / range) * 110;
      const h = Math.abs(end - zero);
      doc.setFillColor(...PDF.green);
      if (h > 0) doc.rect(M + i * bw + 5, Math.min(end, zero), bw - 10, h, "F");
      doc.setTextColor(...PDF.forest);
      doc.setFontSize(7);
      doc.text(
        String(Math.round(r.value * 10) / 10),
        M + i * bw + bw / 2,
        Math.min(end, zero) - 5,
        {
          align: "center",
        },
      );
      if (i % Math.max(1, Math.ceil(rows.length / 8)) === 0 || i === rows.length - 1)
        doc.text(sanitize(r.label), M + i * bw + bw / 2, base + 13, { align: "center" });
    }
    y = base + 29;
    meta(`Scale: ${unit}. Gaps represent missing samples, never zero.`);
  };
  // Page 1: cover. Subject, scope and provenance posture up front, before any
  // evidence, so the report can be identified and bounded from its first page.
  doc.setFillColor(...PDF.ivory);
  doc.rect(0, 0, W, H, "F");
  brandPage(doc, a.symbol);
  doc.setFillColor(...PDF.green);
  doc.rect(0, 0, W, 5, "F");
  if (a.lockup) image(a.lockup, (W - 220) / 2, 110, 220, 72);
  else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.setTextColor(...PDF.forest);
    doc.text("HALISIA.AI", W / 2, 160, { align: "center" });
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...PDF.goldInk);
  doc.text("L A N D   P A S S P O R T", W / 2, 224, { align: "center" });
  doc.setDrawColor(...PDF.gold);
  doc.line(W / 2 - 60, 238, W / 2 + 60, 238);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...PDF.forest);
  const placeLines = doc.splitTextToSize(sanitize(o.place), C - 60) as string[];
  doc.text(placeLines, W / 2, 290, { align: "center" });
  let coverY = 290 + placeLines.length * 26;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...PDF.stone2);
  const locLines = doc.splitTextToSize(sanitize(o.locationLine), C - 100) as string[];
  doc.text(locLines, W / 2, coverY, { align: "center" });
  coverY += locLines.length * 15 + 8;
  doc.setFontSize(9);
  doc.text(`${o.positionLabel} | Generated ${o.generatedAt}`, W / 2, coverY, {
    align: "center",
  });
  if (o.coords) {
    coverY += 16;
    doc.text(
      `Selected coordinates ${o.coords.lat.toFixed(6)}, ${o.coords.lng.toFixed(6)}`,
      W / 2,
      coverY,
      { align: "center" },
    );
  }
  doc.setFontSize(8);
  doc.setTextColor(...PDF.stone2);
  const scopeLines = doc.splitTextToSize(
    sanitize(
      `Source-backed context with modelled estimates labelled by class. Coverage of the evidence checklist: ${o.coveragePct}%. This report does not establish title, ownership, a surveyed boundary, planning approval or investment return; registry and legal verification are outside its scope.`,
    ),
    C - 120,
  ) as string[];
  doc.text(scopeLines, W / 2, H - 150, { align: "center" });
  // Page 2: table-of-contents placeholder, filled after every section has
  // rendered so its page numbers are the true final ones.
  next("Contents");
  section("Location & satellite evidence");
  title(o.place);
  meta(o.locationLine);
  meta(`${o.positionLabel} | Generated ${o.generatedAt}`);
  map("satellite", 255);
  if (o.coords)
    block("Selected coordinates", `${o.coords.lat.toFixed(6)}, ${o.coords.lng.toFixed(6)}`);
  const directory = o.items.filter((it) => it.value);
  const sourced = directory.filter((it) => it.cls === "measured" || it.cls === "official").length,
    estimates = directory.filter((it) => it.cls === "modelled" || it.cls === "ai").length;
  // The Katani cover read "16 entries / 8 sourced / 7 modelled" - 15, not 16.
  // The arithmetic was right and the label was wrong: interpretation items are
  // counted in the total but belong to neither named bucket. Name the
  // remainder rather than let the line appear not to add up.
  const interpreted = directory.length - sourced - estimates;
  block(
    "Report contents",
    `Evidence directory: ${directory.length} entries / ${sourced} sourced or reference / ${estimates} modelled or AI${
      interpreted > 0 ? ` / ${interpreted} interpretation` : ""
    }. Maps, amenities and charts are additional context.`,
  );
  meta(
    "Imagery is location context. Estimates and conceptual diagrams are distinct from site observations. Registry, ownership and surveyed boundary verification are outside this report.",
  );
  if (o.county) {
    section("County context");
    title(`${o.county.name} County`);
    if (a.county) {
      image(a.county, W - M - 80, y - 34, 70, 70);
      y += 38;
    }
    block("Population - KNBS 2019 reference", o.county.population2019.toLocaleString("en-KE"));
    block("County area", `${o.county.areaKm2.toLocaleString("en-KE")} km2`);
    block(
      "Administrative context",
      `${o.county.constituencies} constituencies / ${o.county.wards} wards`,
    );
    block("Headquarters", o.county.headquarters);
    text("Economy, farming & local livelihoods", 15, true);
    y += 8;
    for (const v of o.county.economy) text(`+ ${v}`, 12);
    // Real imagery of the surrounding area rather than stock photographs of
    // crops or industry. Field patterns, plot sizes and built-up extent are
    // visible in the image itself; the crop list above stays a county-level
    // reference and is deliberately NOT presented as identified from imagery.
    if (a.maps.satellite) {
      y += 4;
      need(140);
      image(a.maps.satellite, M, y, C, 120);
      y += 126;
      meta(
        "Land cover around the point - Tiles (c) Esri, Maxar. Field patterns and built-up areas are visible in the imagery; crop types above are county reference data and are not identified from this image.",
      );
    }
    y += 12;
    text("Landmarks & wider social context", 15, true);
    for (const v of o.county.landmarks) text(`+ ${v}`, 11);
    y += 12;
    // Keep the closing disclaimer on the county page; spilling it alone onto
    // a fresh page left a near-blank sheet under a wrong continuation header.
    need(40, "County context");
    meta(
      "County reference profile, not a parcel finding or current political assessment. Emblem identifies the county; no endorsement or government integration is implied.",
    );
  }
  const weather = o.wave4?.weather;
  if (weather?.points.length) {
    section("Weather forecast / MET Norway");
    title("Weather ahead");
    meta(
      `MET Norway / CC BY 4.0 | forecast issued ${weather.updatedAt ?? "not supplied"}. Times shown in EAT (UTC+3).`,
    );
    const eat = (iso: string) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso.slice(11, 16);
      return new Date(d.getTime() + 3 * 3600_000).toISOString().slice(11, 16);
    };
    const points = weather.points.slice(0, 24);
    text("Temperature forecast (next 24 h)", 14, true);
    bars(
      points.map((p) => ({ label: eat(p.time), value: p.temperatureC })),
      "degrees C",
    );
    text("Rainfall forecast at shown hours", 14, true);
    bars(
      points.map((p) => ({ label: eat(p.time), value: p.rainfallMm })),
      "mm during the following one hour, not daily totals",
    );
    // Plain-text condition labels replace the drawn circle/hatch glyphs, which
    // rendered as broken symbols in exported PDFs.
    const cond = (s: string | null | undefined) => {
      if (!s) return "condition not supplied";
      const base = s.replace(/_(day|night|polartwilight)$/, "");
      if (base.includes("thunder")) return "Thunder";
      if (base.includes("snow") || base.includes("sleet")) return "Sleet/snow";
      if (base.includes("rain")) return base.includes("heavy") ? "Heavy rain" : "Rain";
      if (base === "fog") return "Fog";
      if (base === "cloudy") return "Cloudy";
      if (base.includes("partlycloudy") || base === "fair") return "Partly cloudy";
      if (base === "clearsky") return "Clear";
      return base.replaceAll("_", " ");
    };
    const strip = points
      .filter((_, i) => i % 3 === 0)
      .map((p) => `${eat(p.time)} ${cond(p.symbol)}`)
      .join("  |  ");
    if (strip) text(strip, 8, false, PDF.forest);
    meta("Forecast model output; local conditions can differ. Labels map MET condition codes.");
  }
  const climate = o.wave4?.climate;
  if (climate?.monthly?.some((m) => m.temperatureC != null || m.rainfallMm != null)) {
    section("Climate model / historical period");
    title("Climate through the year");
    meta(
      `${climate.source ?? "Regional climate model"} | ${climate.period ?? "Reference period not supplied"}. Monthly climate context, not today's weather.`,
    );
    text("Rainfall - monthly mean total", 14, true);
    bars(
      climate.monthly.map((m) => ({ label: m.month, value: m.rainfallMm })),
      "mm per month",
    );
    text("Temperature - monthly mean", 14, true);
    bars(
      climate.monthly.map((m) => ({ label: m.month, value: m.temperatureC })),
      "degrees C",
    );
    const wetMonths = climate.monthly.filter(
      (m): m is typeof m & { rainfallMm: number } =>
        m.rainfallMm != null && Number.isFinite(m.rainfallMm),
    );
    if (wetMonths.length >= 3) {
      const wet = wetMonths.reduce((a, b) => (b.rainfallMm > a.rainfallMm ? b : a));
      const dry = wetMonths.reduce((a, b) => (b.rainfallMm < a.rainfallMm ? b : a));
      const annual = wetMonths.reduce((n, m) => n + m.rainfallMm, 0);
      const ratio = wet.rainfallMm / Math.max(dry.rainfallMm, 0.1);
      conclusion([
        `Across the reference period the wettest month is ${wet.month} at ${wet.rainfallMm.toFixed(0)} mm and the driest is ${dry.month} at ${dry.rainfallMm.toFixed(0)} mm. Annual rainfall (sum of monthly means): about ${annual.toFixed(0)} mm.`,
        ratio >= 3
          ? "Rainfall is concentrated rather than spread evenly, so water storage and planting calendars matter more here than the annual total alone suggests."
          : "Rainfall is relatively evenly distributed through the year in this model.",
        "These are modelled monthly means for a wide grid cell over a multi-year period, not measurements at this plot and not a forecast.",
      ]);
    }
  } else if (climate && (climate.annualRainfallMm != null || climate.meanTempC != null)) {
    section("Climate snapshot");
    title("Climate snapshot");
    if (climate.annualRainfallMm != null)
      block("Mean annual rainfall", `${climate.annualRainfallMm.toFixed(0)} mm/year`);
    if (climate.meanTempC != null)
      block("Mean temperature", `${climate.meanTempC.toFixed(1)} degrees C`);
    meta(
      "Regional model estimate. No monthly series was returned; a seasonal graph is not invented.",
    );
  }
  const g = o.geotech;
  if (g?.terrainMeasured && g.terrain) {
    section("Terrain & regional slope model");
    title("Terrain & topography");
    if (g.elevationGrid?.values.length) {
      const values = g.elevationGrid.values;
      const n = values.length;
      const valid = n >= 2 && values.every((row) => row.length === n && row.every(Number.isFinite));
      if (valid) {
        need(230);
        const lo = Math.min(...values.flat()),
          hi = Math.max(...values.flat());
        const cellW = C / n,
          cellH = 32,
          top = y;
        values.forEach((row, r) =>
          row.forEach((elevation, c) => {
            const t = (elevation - lo) / Math.max(1, hi - lo);
            doc.setFillColor(220 - t * 130, 235 - t * 110, 195 - t * 110);
            doc.rect(M + c * cellW, top + (n - 1 - r) * cellH, cellW, cellH, "F");
            doc.setFontSize(9);
            doc.setTextColor(...PDF.forest);
            doc.text(
              `${Math.round(elevation)} m`,
              M + (c + 0.5) * cellW,
              top + (n - 1 - r + 0.6) * cellH,
              { align: "center" },
            );
          }),
        );
        y += n * cellH + 8;
        meta(
          `North up / regional elevation samples / ${g.elevationGrid.source}. Grid spacing ${g.elevationGrid.stepDeg} degrees; raster resolution is not survey accuracy.`,
        );
      } else map("terrain", 180);
    } else map("terrain", 180);
    block(
      "Regional slope / aspect",
      `${g.terrain.slopePct.toFixed(1)}% / ${((Math.atan(g.terrain.slopePct / 100) * 180) / Math.PI).toFixed(1)} degrees / modelled aspect ${g.terrain.aspectLabel} (${g.terrain.aspectDeg} degrees)`,
    );
    block(
      "Grid elevation range",
      g.terrain.reliefUsable
        ? `${g.terrain.minM.toFixed(0)} - ${g.terrain.maxM.toFixed(0)} m`
        : "Not reported - this elevation grid is dominated by raster error",
    );
    meta(g.terrain.reliefNote);
    need(160);
    const x = M + 30,
      base = y + 90,
      run = C - 60,
      // A 1.0% slope drew a 3 pt rise across a 515 pt run: a flat line under a
      // caption promising vertical exaggeration. Floor the rise so the
      // gradient reads, and state the factor below - an exaggerated section is
      // honest only when the reader knows by how much.
      rise = Math.min(75, Math.max(18, g.terrain.slopePct * 3)),
      trueRise = (run * g.terrain.slopePct) / 100,
      exaggeration = trueRise > 0 ? rise / trueRise : 0;
    doc.setDrawColor(...PDF.green);
    doc.setLineWidth(3);
    doc.line(x, base, x + run, base - rise);
    doc.setLineWidth(0.6);
    doc.line(x, base, x + run, base);
    doc.line(x + run, base, x + run, base - rise);
    y = base + 12;
    meta(
      `Gradient explanation: ${g.terrain.slopePct.toFixed(1)} m rise over 100 m horizontal run. Schematic, vertical exaggeration approximately ${exaggeration.toFixed(0)}x, not a surveyed cross-section.`,
    );
    meta(
      "ASTER 30 m regional elevation-grid model. Slope direction and exact ground profile require a survey.",
    );
    conclusion([
      g.terrain.reliefUsable
        ? `Modelled slope is ${g.terrain.slopePct.toFixed(1)}% (${((Math.atan(g.terrain.slopePct / 100) * 180) / Math.PI).toFixed(1)} degrees) facing ${g.terrain.aspectLabel}, across an elevation range of ${g.terrain.reliefM.toFixed(0)} m in the sampled grid.`
        : `Modelled slope is ${g.terrain.slopePct.toFixed(1)}% (${((Math.atan(g.terrain.slopePct / 100) * 180) / Math.PI).toFixed(1)} degrees) facing ${g.terrain.aspectLabel}. No elevation range is reported from this grid: too many of its samples disagree with every neighbouring sample to tell ground from raster error.`,
      "Aspect indicates which way surface water runs off; it does not establish where water collects, which depends on ground detail this raster cannot see.",
      "Earthworks quantities, drainage design and buildability need a survey. A 30 m regional grid cannot supply them.",
    ]);
  }
  if (g?.soilLayers.length && g.sources.some((s) => s.used && s.label.includes("SoilGrids"))) {
    section("Regional soil model");
    title("Soils by depth");
    meta(
      "ISRIC SoilGrids 250 m model. Coloured bands describe composition; they are not a borehole log.",
    );
    const colors: [number, number, number][] = [
      [192, 138, 46],
      [204, 176, 126],
      [90, 119, 84],
    ];
    for (const layer of g.soilLayers) {
      need(100);
      text(`${layer.depth} / ${layer.texture}`, 13, true);
      y += 8;
      const vals = [layer.sandPct, layer.siltPct, layer.clayPct];
      let x = M;
      if (vals.every((v) => Number.isFinite(v) && v >= 0) && vals.reduce((a, b) => a + b, 0) > 0) {
        const sum = vals.reduce((a, b) => a + b, 0);
        vals.forEach((v, i) => {
          doc.setFillColor(...colors[i]);
          doc.rect(x, y, (C * v) / sum, 30, "F");
          x += (C * v) / sum;
        });
        y += 38;
        meta(
          `Sand ${layer.sandPct.toFixed(1)}% / silt ${layer.siltPct.toFixed(1)}% / clay ${layer.clayPct.toFixed(1)}%`,
        );
      }
      if (layer.bulkDensity != null) meta(`Bulk density ${layer.bulkDensity.toFixed(2)} g/cm3`);
    }
    y += 15;
    text("Below the mapped soil layers", 14, true);
    y += 8;
    meta(
      "Bedrock depth and water-table level have not been measured. A soil model cannot locate them. Geological drilling / borehole records and a licensed investigation are needed for an actual subsurface section.",
    );
    need(85);
    doc.setFillColor(221, 205, 174);
    doc.rect(M, y, C, 25, "F");
    doc.setDrawColor(...PDF.stone2);
    doc.setLineDashPattern([4, 4], 0);
    doc.line(M, y + 45, M + C, y + 45);
    doc.setLineDashPattern([], 0);
    y += 57;
    meta(
      "Concept diagram: surface soil / unknown deeper geology. Dashed line has no assigned depth.",
    );
    const clayVals = g.soilLayers.map((l) => l.clayPct).filter((v) => Number.isFinite(v));
    if (clayVals.length) {
      const lo = Math.min(...clayVals),
        hi = Math.max(...clayVals);
      const deepest = g.soilLayers[g.soilLayers.length - 1];
      conclusion([
        `Mapped clay content runs ${lo.toFixed(0)}-${hi.toFixed(0)}% across ${g.soilLayers.length} depth bands, with the deepest mapped band (${deepest.depth}) at ${deepest.clayPct.toFixed(0)}% clay.`,
        hi >= 35
          ? "Clay-rich soils in this range are generally associated with shrink-swell movement and slower drainage. That is a general property of such soils, not a measurement of how this ground behaves."
          : "",
        "Bedrock depth, water table and bearing capacity are not measured and cannot be derived from a composition model. A site investigation by a licensed professional is required before any foundation or earthworks decision.",
      ]);
    }
  }
  if (g && !g.soilLayers.length) {
    section("Soil data availability");
    title("Soil model unavailable");
    block(
      "ISRIC SoilGrids",
      g.soilStatus === "failed"
        ? "The provider request failed or timed out for this export."
        : "No complete soil-composition band was returned for this export.",
    );
    text(
      "This is a data gap, not evidence that soil is absent. Bedrock, groundwater and foundation suitability have not been assessed. A site investigation is needed before structural design.",
    );
  }
  const access = o.items.filter((it) => it.chapter === "access" && it.value);
  // Skip the section entirely when neither the street map nor any access
  // finding came back — a title over an empty page reads as broken, and the
  // contents page already explains that missing sections are data gaps.
  if (a.maps.map || access.length) {
    section("Roads & access context");
    title("Roads & access");
    // Imagery first: it carries road geometry even where the street basemap has
    // no vector data for the area. The street layer follows, for its labels.
    map("map", 230);
    meta(
      "Road labels come from the rendered map. A visible road does not establish a legal right of access, road condition or a connected driveway.",
    );
    for (const it of access) {
      // Without an explicit title this falls back to need()'s default,
      // "Evidence directory", which is why page 8 of the Katani export carried
      // that header above amenity counts.
      need(
        110 + doc.splitTextToSize(sanitize(it.value!), C - 24).length * 16,
        "Roads & access context",
      );
      block(it.label, it.value!);
      meta(it.source);
    }
  }
  if (a.amenities.length) {
    section("Located amenities");
    title("Amenities around the point");
    meta(
      "Numbered location cards use provider-reported points; distances are labelled by measurement type.",
    );
    a.amenities.forEach((p, i) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const nameLines = doc.splitTextToSize(sanitize(p.name), C - 214) as string[];
      const cardHeight = Math.max(180, 155 + nameLines.length * 14.3);
      need(cardHeight + 12, "Amenities continued");
      const top = y;
      doc.setFillColor(...PDF.paper);
      doc.roundedRect(M, top, C, cardHeight, 8, 8, "F");
      if (p.image) image(p.image, M + 8, top + 8, 180, 112);
      else {
        doc.setTextColor(...PDF.stone2);
        doc.setFontSize(8);
        doc.text("Map image unavailable", M + 15, top + 40);
      }
      y = top + 10;
      text(`${i + 1}. ${p.name}`, 11, true, PDF.forest, M + 200, C - 214);
      // Calm category marker: a small vector glyph so the card type reads at
      // a glance without pictogram clipart.
      const catTop = y;
      text(p.category, 8, false, PDF.goldInk, M + 214, C - 228);
      drawCategoryIcon(p.category, M + 204, catTop + 6);
      if (p.distanceKm != null)
        text(`${p.distanceKm.toFixed(2)} km straight-line`, 9, false, PDF.forest, M + 200, C - 214);
      if (p.driveKm != null)
        text(`${p.driveKm.toFixed(2)} km driving route`, 9, false, PDF.forest, M + 200, C - 214);
      if (p.driveMin != null)
        text(
          `~${Math.round(p.driveMin)} min driving estimate`,
          9,
          false,
          PDF.forest,
          M + 200,
          C - 214,
        );
      text(`${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`, 8, false, PDF.stone2, M + 200, C - 214);
      y = Math.max(y, top + cardHeight - 30);
      text(
        `${p.source} | map: Esri and contributors | image date unknown`,
        7,
        false,
        PDF.stone2,
        M + 10,
        C - 20,
      );
      doc.textWithLink("Open Street View near this amenity", M + 10, top + cardHeight - 8, {
        url: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${p.lat},${p.lng}`,
      });
      y = top + cardHeight + 12;
    });
    const byCategory = new Map<string, number>();
    for (const p of a.amenities) {
      const d = p.distanceKm;
      if (d == null || !Number.isFinite(d)) continue;
      const prev = byCategory.get(p.category);
      if (prev == null || d < prev) byCategory.set(p.category, d);
    }
    const nearest = [...byCategory.entries()]
      .sort((x, z) => x[1] - z[1])
      .map(([c, d]) => `${c} ${d.toFixed(2)} km`)
      .join(", ");
    conclusion([
      `${a.amenities.length} located facilities were returned around the point.`,
      nearest ? `Nearest by category, straight-line: ${nearest}.` : "",
      "Straight-line distance is not travel distance, and a facility appearing here is not a check of whether it is open, operating or accepting new users. Absence from this list is not evidence that nothing exists.",
    ]);
  }
  if (a.news.length) {
    section("Recent county news / HALISIA Pulse");
    title("Recent news in this county");
    meta(
      `${a.news.length} land-relevant stories tagged to ${o.county?.name ?? "this county"} in the HALISIA Pulse feed, newest first. County-level reporting, not parcel-specific, and not verified by HALISIA.`,
    );
    const byDate = [...a.news].sort((x, y2) =>
      (y2.published_at ?? "").localeCompare(x.published_at ?? ""),
    );
    for (const n of byDate) {
      need(74);
      const when = n.published_at ? n.published_at.slice(0, 10) : "date not supplied";
      text(n.title, 11, true);
      meta(
        `${n.source_name ?? "source not supplied"} | ${when}${n.category ? ` | ${n.category}` : ""}`,
      );
      if (n.url) {
        doc.setFontSize(8);
        doc.setTextColor(...PDF.goldInk);
        doc.textWithLink("Open the original report", M, y + 8, { url: n.url });
        y += 18;
      }
      y += 6;
    }
    conclusion([
      `${a.news.length} recent stories were tagged to this county.`,
      "Headlines indicate what is being reported in the county, not what is true of this plot. Confirm anything material with the county planning office or the original publisher before relying on it.",
    ]);
  }
  section("Sources & supporting findings");
  title("Evidence directory");
  meta(
    "Measured / reference / modelled / interpretation labels describe the source, not legal verification.",
  );
  for (const c of CHAPTERS) {
    const list = o.items.filter((it) => it.chapter === c.id && it.value);
    if (!list.length) continue;
    need(65);
    text(c.title, 15, true);
    y += 7;
    // Land-use considerations are printed once per section, not once per entry.
    const sectionUses: string[] = [];
    for (const it of list) {
      doc.setFontSize(10);
      const findingHeight =
        doc.splitTextToSize(sanitize(`${it.label}: ${it.value}`), C).length * 13.5;
      doc.setFontSize(8);
      const sourceHeight =
        doc.splitTextToSize(
          sanitize(
            `${CLASS_LABEL[it.cls]} | ${it.source} | retrieved ${it.retrieved ?? "reference dataset"}`,
          ),
          C,
        ).length * 10.8;
      const methodHeight = doc.splitTextToSize(sanitize(it.method), C).length * 10.8;
      need(findingHeight + sourceHeight + methodHeight + 18);
      text(`${it.label}: ${it.value}`, 10, true);
      meta(
        `${CLASS_LABEL[it.cls]} | ${it.source} | retrieved ${it.retrieved ?? "reference dataset"}`,
      );
      text(it.method, 8, false, PDF.stone2);
      const use = landUseContext(it);
      if (use && !sectionUses.includes(use)) sectionUses.push(use);
      y += 7;
    }
    for (const use of sectionUses) {
      need(75);
      meta(`Land-use considerations (interpretation): ${use}`);
    }
  }
  need(100);
  text("Provider status at export", 13, true);
  for (const e of o.ledger.filter((e) => e.status !== "not_connected")) {
    text(
      `${e.provider}: ${e.status === "ok" ? "returned data" : e.status === "loading" ? "still loading" : e.status === "failed" ? "request failed" : "no sample returned"}`,
      8,
      false,
      PDF.stone2,
    );
  }
  meta(
    "Missing sources never establish absence, safety, ownership, approval, mineral reserves or investment returns. Political, mining and parcel-specific economic findings are omitted without supporting records.",
  );
  // Fill the table of contents on page 2 with the sections that actually
  // rendered, in order, with their final page numbers. Sections appear only
  // when their source returned data, so the contents list is also an honest
  // map of what this export does and does not cover.
  doc.setPage(2);
  page("Contents");
  title("What this report contains");
  meta(
    "Sections appear only when their underlying source returned data for this export. A missing section is a data gap, not a finding.",
  );
  y += 8;
  for (const entry of toc) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...PDF.forest);
    doc.text(sanitize(entry.label), M, y + 11);
    doc.setTextColor(...PDF.goldInk);
    doc.text(String(entry.page), W - M, y + 11, { align: "right" });
    doc.setDrawColor(...PDF.stone2);
    doc.setLineWidth(0.4);
    doc.line(M, y + 17, W - M, y + 17);
    y += 26;
  }
  y += 10;
  meta(
    "Every figure is labelled by source class: measured, reference, modelled or interpretation. Imagery is location context; estimates and concept diagrams are distinct from site observations.",
  );
  const total = doc.getNumberOfPages();
  for (let n = 1; n <= total; n++) {
    doc.setPage(n);
    doc.setDrawColor(...PDF.gold);
    doc.line(M, H - 45, W - M, H - 45);
    doc.setFontSize(7);
    doc.setTextColor(...PDF.stone2);
    doc.text("Source-backed context / model estimates labelled", W / 2, H - 25, {
      align: "center",
    });
    doc.text(`${n}/${total}`, W - M, H - 25, { align: "right" });
  }
  return doc;
}

export async function downloadPassportPdf(o: PassportPdfOptions): Promise<string> {
  const assets = await collectAssets(o);
  const doc = renderPassportPdf(o, assets);
  const filename = `halisia-land-passport-${
    o.place
      .replace(/[^a-z0-9]+/gi, "-")
      .slice(0, 40)
      .toLowerCase() || "location"
  }.pdf`;
  doc.save(filename);
  return filename;
}
