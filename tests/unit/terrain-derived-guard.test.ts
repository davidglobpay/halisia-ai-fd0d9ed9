import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { robustRelief } from "@/lib/terrain-relief";
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
