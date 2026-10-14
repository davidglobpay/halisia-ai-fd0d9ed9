/**
 * The scoring layer is gone, and this is what keeps it gone.
 *
 * The app published a Land Intelligence Score out of 100, a grade from AAA to
 * C and a per-module mark, none of which was a measurement. "Construction" was
 * a four-step band off elevation: 42 below 20 m, 62 below 100 m, 55 above
 * 2,400 m, 78 otherwise. "Amenity access" was 30 + the count of nearby places
 * × 3.5. "Environment" averaged the air quality index, read as though an AQI
 * were a grade out of 100, with a second elevation band. The composite was
 * their persona-weighted mean.
 *
 * Two things have to hold from here, and the second matters as much as the
 * first. No score, grade or verdict may come back — and everything that was
 * genuinely read must still be published, because answering "we removed the
 * number" with an emptier page would be its own kind of dishonesty. The
 * elevation in metres, the air quality index, the counts within 3 km and the
 * provider confidence are all still here and all still checkable at source.
 *
 * The last block reads the shipped source of the surfaces themselves. A unit
 * test on the engine cannot see a `/100` hard-coded into a component, and that
 * is exactly where this defect lived for longest.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  runIntelligenceEngine,
  PERSONAS,
  type Persona,
  type DecisionOutput,
} from "@/lib/intelligence-engine";

/* ---------- a location where every provider answered ---------- */

const INTEL = {
  elevation: { meters: 1795 },
  airQuality: { universalAqi: 61, category: "Good air quality" },
  categories: {
    schools: [{ name: "A" }, { name: "B" }, { name: "C" }],
    hospitals: [{ name: "D" }, { name: "E" }],
    groceries: [{ name: "F" }, { name: "G" }, { name: "H" }, { name: "I" }],
    transit: [{ name: "J" }],
  },
  providers: {
    elevation: { status: "ok" },
    airQuality: { status: "ok" },
    places: { status: "ok" },
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const run = (persona: Persona = "investor"): DecisionOutput =>
  runIntelligenceEngine(INTEL, undefined, persona, undefined);

describe("no score comes back, for any persona", () => {
  it.each(PERSONAS.map((p) => p.id))(
    "%s gets no composite and no grade",
    (persona) => {
      const d = run(persona);
      expect(d.reading).toBeNull();
      expect(d.grade).toBeNull();
    },
  );

  it("gives no module a mark or a letter", () => {
    for (const m of run().modules) {
      expect(m.score, `${m.id} must carry no score`).toBeNull();
      expect(m.grade, `${m.id} must carry no grade`).toBeNull();
    }
  });

  it("publishes no verdict, band or rating anywhere in the decision", () => {
    const d = run();
    const text = [
      d.headline,
      d.readingLabel,
      d.scopeNote,
      ...d.reasons,
      ...d.professionalRecs,
      ...d.modules.flatMap((m) => [
        m.label,
        ...m.reasons,
        ...m.limitations,
        m.nextStep,
      ]),
    ].join("  ");

    // Google's own air-quality category is a measured value passed through
    // verbatim — "Good air quality" is theirs, read from the Air Quality API and
    // named as such. It is removed before the band check so the check tests what
    // HALISIA says about the place, not what a named source said about the air.
    const judged = text.split(INTEL.airQuality.category).join(" ");

    // A mark out of a hundred, however it is spaced.
    expect(text).not.toMatch(/\d+\s*\/\s*100/);
    // The old bands, as whole words — "Fair" must not match "Fairview".
    expect(judged).not.toMatch(/\b(Excellent|Good|Fair|Weak)\b/);
    // The credit ladder.
    expect(text).not.toMatch(/\b(AAA|AA|BBB|BB)\b/);
    // The verdict that went before them.
    expect(text).not.toMatch(/\b(Highly Recommended|Not Recommended)\b/i);
  });

  it("says plainly in the headline that it is not scoring", () => {
    expect(run().headline).toMatch(/no score, no grade, no ranking/i);
  });
});

describe("everything that was actually read is still published", () => {
  const d = run();
  const module = (id: string) => d.modules.find((m) => m.id === id)!;

  it("keeps the elevation in metres, not a band derived from it", () => {
    expect(module("construction").reasons.join(" ")).toContain("1795");
    expect(module("construction").status).toBe("measured");
    expect(module("construction").sources).toContain(
      "Google Maps Elevation API",
    );
  });

  it("keeps the air quality index and its category", () => {
    const r = module("environment").reasons.join(" ");
    expect(r).toContain("61");
    expect(r).toContain("Good air quality");
  });

  it("keeps the counts within 3 km", () => {
    const r = module("infrastructure").reasons.join(" ");
    expect(r).toContain("3 schools");
    expect(r).toContain("2 health facilities");
    expect(r).toContain("4 shops");
    expect(r).toContain("1 transit stops");
  });

  it("still reports confidence, which is a fact about the run", () => {
    expect(d.confidencePct).toBe(100);
    expect(module("construction").confidencePct).toBe(100);
  });

  it("still counts the three modules as measured rather than emptying the page", () => {
    // Removing the scores must not make the engine claim nothing was read.
    expect(d.measuredCount).toBeGreaterThanOrEqual(3);
    expect(d.scopeNote).not.toMatch(/every provider returned empty/);
    expect(d.reasons.length).toBeGreaterThanOrEqual(3);
  });

  it("still names what it cannot assess, and who to ask", () => {
    expect(d.dueDiligence.length).toBeGreaterThan(0);
    for (const item of d.dueDiligence) {
      expect(item.who.length).toBeGreaterThan(10);
    }
  });
});

describe("a location where nothing answered says so", () => {
  const d = runIntelligenceEngine(undefined, undefined, "investor", undefined);

  it("reports no reading and no confidence rather than a default", () => {
    expect(d.reading).toBeNull();
    expect(d.confidencePct).toBeNull();
    expect(d.measuredCount).toBe(0);
  });

  it("does not claim to have read anything", () => {
    expect(d.headline).toMatch(/nothing could be read/i);
  });
});

describe("the surfaces themselves carry no score", () => {
  // The engine could be clean while a component prints "/100" from its own
  // state. These are the files that did exactly that.
  const SURFACES = [
    "src/lib/intelligence-engine.ts",
    "src/components/halisia/hero-summary.tsx",
    "src/components/halisia/land-intelligence-score.tsx",
    "src/lib/pdf-intelligence.ts",
  ];

  /**
   * Strip comments, so the history written above a function is not read as
   * code, and strip type aliases. The `Grade` alias still exists so the dead
   * `grade` field has a type; what matters is that nothing ever produces a
   * value of it, which the assignment check below proves directly.
   */
  function code(path: string): string {
    return readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/.*$/gm, "$1")
      .replace(/^export type \w+ =[^;]*;/gm, " ");
  }

  it.each(SURFACES)("%s renders no mark out of 100", (path) => {
    expect(code(path)).not.toMatch(/\/\s*100/);
  });

  it.each(SURFACES)("%s contains no grade ladder", (path) => {
    expect(code(path)).not.toMatch(/"AAA"|"BBB"|Grade \$\{/);
  });

  it.each(SURFACES)("%s has no Excellent/Good/Fair/Weak band", (path) => {
    expect(code(path)).not.toMatch(/"(Excellent|Fair|Weak)"/);
  });

  it("assigns null to every grade field and never calls a grader", () => {
    const engine = code("src/lib/intelligence-engine.ts");
    const assignments = engine.match(/\bgrade:\s*[^,\n]+/g) ?? [];
    expect(assignments.length).toBeGreaterThan(0);
    for (const a of assignments) {
      // `grade: Grade | null` on the interface, or `grade: null` in a producer.
      expect(a.trim()).toMatch(/^grade:\s*(null|Grade \| null);?$/);
    }
  });

  it("no longer defines a grader or a score-to-band map", () => {
    const engine = code("src/lib/intelligence-engine.ts");
    expect(engine).not.toMatch(/function grade\s*\(/);
    expect(engine).not.toMatch(/function trendFrom\s*\(/);
    expect(engine).not.toMatch(/function tone\s*\(/);
  });
});
