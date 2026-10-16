/**
 * Flood risk is not assessed, and no surface may imply otherwise.
 *
 * The location dashboard printed a "Flood proxy" tile whose value was read
 * straight off absolute elevation — under 20 m "Elevated risk", under 100 m
 * "Moderate", otherwise "Low" — while three other surfaces in the same release
 * said the opposite:
 *
 *   intelligence-engine.ts   "Elevation alone cannot establish flood risk"
 *   passport-evidence.ts     "HALISIA does not run a flood model."
 *   pdf-dossier.ts           "does not establish ... flood risk"
 *
 * So the app contradicted itself, and the single surface that handed a buyer a
 * verdict was the one with nothing behind it. Height above sea level says
 * nothing about where water goes on a given parcel: that depends on the local
 * catchment, drainage, soil and upstream development, none of which is read.
 *
 * These tests read the shipped source rather than calling a function, because
 * the defect was a literal in a component — somewhere a unit test on the
 * engine could never see.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Surfaces that have, or could plausibly acquire, a flood claim. */
const SURFACES = [
  "src/components/halisia/intelligence-dashboard.tsx",
  "src/lib/intelligence-engine.ts",
  "src/lib/passport-evidence.ts",
  "src/lib/pdf-dossier.ts",
];

/**
 * Strip comments. The history of this defect is written above the tile it was
 * removed from and quotes the old bands verbatim; read as code, that history
 * would fail the very test it explains.
 */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("no surface grades flood risk", () => {
  /**
   * The mechanism, not the vocabulary.
   *
   * An earlier draft of this test forbade the band words themselves and caught
   * two innocent lines: `low: "Low"` in a confidence-label map, and
   * `x.level !== "Low"` filtering the geotechnical model's own risk levels.
   * Neither derives anything from elevation. Banning the words would have
   * meant rewriting correct code to satisfy a test, so what is banned is the
   * shape of the defect: a height threshold that resolves to a verdict.
   */
  it.each(SURFACES)("%s derives no verdict from an elevation threshold", (path) => {
    const c = code(path);
    expect(c, `${path} must not key a verdict to a height`).not.toMatch(
      /elevation[?.\w]*\.meters\s*<\s*\d+\s*\n?\s*\?/,
    );
  });

  it.each(SURFACES)("%s does not use the phrase that had nothing behind it", (path) => {
    // "Elevated risk" has no legitimate use in this codebase — it existed only
    // as the sub-20-metre branch of the removed tile.
    expect(code(path)).not.toMatch(/"Elevated risk"/);
  });

  it("says plainly on the dashboard that flood risk is not assessed", () => {
    // Removing the verdict is only half the job: a buyer who came looking for
    // flood risk must be told it is absent, not left with a missing tile.
    const raw = readFileSync("src/components/halisia/intelligence-dashboard.tsx", "utf8");
    expect(raw).toMatch(/Not assessed/);
    expect(raw).toMatch(/no flood model is run/i);
  });

  it("keeps the other surfaces' denials intact", () => {
    // These are the statements the dashboard was contradicting. If a future
    // change softens them, the contradiction can return from the other side.
    expect(code("src/lib/intelligence-engine.ts")).toMatch(
      /Elevation alone cannot establish flood risk/,
    );
    expect(code("src/lib/passport-evidence.ts")).toMatch(/does not run a flood model/i);
  });

  it("does not select foundation advice from absolute altitude", () => {
    const engine = code("src/lib/intelligence-engine.ts");
    expect(engine).not.toContain("foundation strategy for low-lying or high-altitude ground");
    expect(engine).not.toMatch(/elevM\s*[<>]\s*\d+/);
  });

  it("still reports the elevation itself, which is measured", () => {
    // The reading is real and comes from a named API. What was removed is the
    // verdict built on top of it, not the figure.
    const c = code("src/components/halisia/intelligence-dashboard.tsx");
    expect(c).toMatch(/Google Elevation API/);
  });
});
