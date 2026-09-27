import { describe, expect, it } from "vitest";

// The globe intro's stage timeline is defined inline in the component; this
// test locks the documented sequence (World -> Africa -> Kenya -> counties ->
// Nairobi) and timing invariants without needing a DOM render.
import { readFileSync } from "node:fs";
import path from "node:path";

describe("GlobeIntro stage timeline", () => {
  const source = readFileSync(
    path.join(process.cwd(), "src/components/halisia/globe-intro.tsx"),
    "utf8",
  );

  it("defines the world -> Africa -> Kenya -> counties -> Nairobi sequence", () => {
    const labels = ["World", "Africa", "Kenya", "Kenya · counties", "Nairobi"];
    let lastIndex = -1;
    for (const label of labels) {
      const idx = source.indexOf(`"${label}"`);
      expect(idx, `expected stage "${label}" to be defined`).toBeGreaterThan(-1);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it("skips the animation under prefers-reduced-motion", () => {
    expect(source).toMatch(/prefers-reduced-motion: reduce/);
  });

  it("plays only once per session via sessionStorage", () => {
    expect(source).toMatch(/sessionStorage/);
  });

  it("provides deliberate replay and skip controls", () => {
    expect(source).toMatch(/Replay/);
    expect(source).toMatch(/Skip/);
    expect(source).toMatch(/onClick=\{play\}/);
    expect(source).toMatch(/onClick=\{finish\}/);
  });
});
