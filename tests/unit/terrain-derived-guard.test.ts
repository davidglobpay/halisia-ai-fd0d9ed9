import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { robustRelief } from "@/lib/terrain-relief";
import { buildPassportEvidence } from "@/lib/passport-evidence";
import { renderPassportPdf } from "@/lib/passport-pdf";
import type { GeotechIntel } from "@/lib/geotech.functions";
// Execute the real production calculation, isolated from server/provider setup.
const source = readFileSync("src/lib/geotech.functions.ts", "utf8");
const calculation = source.slice(
  source.indexOf("function terrainAnalysis("),
  source.indexOf("async function fetchClimate("),
);
const js = ts.transpileModule(calculation, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const analyze = new Function("robustRelief", "aspectLabel", js + ";return terrainAnalysis;")(
  robustRelief,
  () => "N",
);
it("withholds a rejected center instead of calling it a ridge", () => {
  const grid = Array.from({ length: 5 }, () => Array(5).fill(1133));
  grid[2][2] = 1198;
  expect(analyze(grid, 5, 0.01, 0)).toBeNull();
});
it("keeps coherent model terrain available", () => {
  const grid = Array.from({ length: 5 }, () => Array.from({ length: 5 }, (_, c) => 1000 + c * 4));
  expect(analyze(grid, 5, 0.01, 0)).toMatchObject({ reliefM: 16, reliefUsable: true });
});

it("withholds rejected terrain in tiles and PDF while retaining raw samples", () => {
  const grid = Array.from({ length: 5 }, () => Array(5).fill(1133));
  grid[2][2] = 1198;
  const terrain = analyze(grid, 5, 0.01, 0);
  const geotech = {
    terrain,
    terrainMeasured: terrain != null,
    soilLayers: [],
    groundwater: {},
    sources: [{ label: "Open-Topo-Data ASTER30m", used: true }],
    elevationGrid: { values: grid, stepDeg: 0.01, source: "Synthetic QA" },
  } as unknown as GeotechIntel;
  const evidence = buildPassportEvidence({
    lat: 0,
    lng: 0,
    ref: "",
    positionLabel: "Synthetic",
    positionExact: false,
    locationConfidencePct: 0,
    sourceLabel: "Fixture",
    countyName: null,
    admin: null,
    facts: null,
    intel: null,
    intelState: "error",
    geotech,
    geoState: "ok",
    wave4: null,
    w4State: "error",
    retrievedAt: "2026-10-30",
  });
  expect(evidence.items.find((x) => x.id === "slope")?.value).toBeNull();
  expect(evidence.items.find((x) => x.id === "landform")?.value).toBeNull();
  const doc = renderPassportPdf(
    {
      place: "Synthetic QA",
      locationLine: "Fixture",
      positionLabel: "Synthetic",
      items: [],
      ledger: [],
      coveragePct: 0,
      generatedAt: "2026-10-30",
      geotech,
    },
    { lockup: null, symbol: null, county: null, maps: {}, amenities: [], news: [] },
  );
  expect(doc.output()).not.toContain("Regional slope / aspect");
  expect(geotech.elevationGrid?.values[2][2]).toBe(1198);
});
