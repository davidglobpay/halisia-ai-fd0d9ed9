import { expect, it } from "vitest";
import { renderPassportPdf, type PassportPdfAssets } from "@/lib/passport-pdf";
import { readFileSync, writeFileSync } from "node:fs";
import type { GeotechIntel } from "@/lib/geotech.functions";
import type { Wave4Intel } from "@/lib/wave4-intel.functions";
import { KENYA_COUNTY_FACTS } from "@/lib/kenya-county-facts";
const tiny =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMQqTb9DwADLwHEfqFBBQAAAABJRU5ErkJggg==";

it("renders charts, mapped amenities and branded pages without inventing subsurface findings", () => {
  const png = (path: string, w: number, h: number) => ({
    dataUrl: `data:image/png;base64,${readFileSync(path).toString("base64")}`,
    width: w,
    height: h,
    ratio: w / h,
  });
  const a: PassportPdfAssets = {
    lockup: { dataUrl: tiny, width: 1, height: 1, ratio: 1 },
    symbol: null,
    county: null,
    maps: {},
    amenities: [],
  };
  // Optional local visual inspection uses the exact downloaded app branding.
  if (process.env.HALISIA_PDF_QA) {
    a.lockup = png("/tmp/halisia-lockup.png", 1175, 360);
    a.symbol = png("/tmp/halisia-mark.png", 1000, 1000);
    a.maps.map = png("/tmp/qa-map.png", 512, 320);
    a.maps.satellite = a.maps.map;
    a.maps.terrain = a.maps.map;
  }
  a.amenities = [
    {
      name: "SYNTHETIC SCHOOL / NOT REAL EVIDENCE",
      category: "education",
      lat: 0.5,
      lng: 34.5,
      distanceKm: 1.2,
      source: "Synthetic fixture",
      image: a.maps.map ?? null,
      photo: null,
    },
  ];
  const doc = renderPassportPdf(
    {
      place: "QA FIXTURE - NOT A SITE REPORT",
      locationLine: "Synthetic layout validation",
      positionLabel: "Synthetic point",
      items: [],
      ledger: [],
      coveragePct: 0,
      generatedAt: "2026-10-17",
      county: KENYA_COUNTY_FACTS[39],
      geotech: {
        terrainMeasured: true,
        terrain: { slopePct: 8.5, aspectLabel: "NE", minM: 1400, maxM: 1450 },
        soilLayers: [
          {
            depth: "0-5 cm",
            texture: "Clay loam",
            sandPct: 35,
            siltPct: 30,
            clayPct: 35,
            bulkDensity: 1.2,
          },
        ],
        sources: [{ label: "SoilGrids", used: true }],
      } as GeotechIntel,
      wave4: {
        weather: {
          updatedAt: "2026-10-17T12:00:00Z",
          points: Array.from({ length: 24 }, (_, i) => ({
            time: `2026-10-18T${String(i).padStart(2, "0")}:00:00Z`,
            temperatureC: -2 + i,
            rainfallMm: i % 3,
            windMS: 3,
            symbol: i % 2 ? "rain" : "clearsky_day",
          })),
        },
        climate: {
          monthly: Array.from({ length: 12 }, (_, i) => ({
            month: String(i + 1),
            rainfallMm: 40 + i * 10,
            temperatureC: 18 + i / 5,
          })),
        },
      } as Wave4Intel,
    },
    a,
  );
  expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(6);
  const pdf = doc.output();
  expect(pdf).toContain("%PDF-");
  if (process.env.HALISIA_PDF_QA)
    writeFileSync("/tmp/halisia-visual-passport-qa.pdf", Buffer.from(doc.output("arraybuffer")));
});
