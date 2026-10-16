/**
 * The evidence classes, and the word-tracking behind the read-aloud.
 *
 * Both are pure modules so they can be tested without a DOM. The component
 * that uses them is deliberately thin for that reason: everything that can be
 * got wrong — which word a character offset belongs to, which class a fact
 * falls in — lives here where it can be checked.
 */
import { describe, expect, it } from "vitest";
import { tokenize, tokenAt, firstWord, msPerWord } from "@/lib/spoken-text";
import {
  EVIDENCE_CLASSES,
  OUTPUT_CLASSES,
  classMeta,
  classOf,
  classTally,
  isMappable,
  outputsOfClass,
  EVIDENCE_LEAD,
} from "@/lib/evidence-class";

describe("a passage survives being split for highlighting", () => {
  const SAMPLE = "Ownership is  not visible.\nAsk the registry.";

  it("loses no character, so the rendered text matches the source", () => {
    expect(
      tokenize(SAMPLE)
        .map((t) => t.text)
        .join(""),
    ).toBe(SAMPLE);
  });

  it("produces contiguous offsets", () => {
    const t = tokenize(SAMPLE);
    t.forEach((tok, i) => {
      if (i === 0) expect(tok.start).toBe(0);
      else expect(tok.start).toBe(t[i - 1].end);
    });
    expect(t.at(-1)!.end).toBe(SAMPLE.length);
  });

  it("keeps a double space and a newline as their own runs", () => {
    const t = tokenize(SAMPLE);
    // Trimming these would silently reflow the paragraph a reader is following.
    expect(t.some((x) => !x.word && x.text === "  ")).toBe(true);
    expect(t.some((x) => !x.word && x.text.includes("\n"))).toBe(true);
  });

  it.each([
    ["", 0],
    ["   ", 1],
    ["one", 1],
  ])("handles %o", (text, count) => {
    expect(tokenize(text)).toHaveLength(count);
  });
});

describe("a speech boundary lands on the right word", () => {
  const SAMPLE = "Ownership is  not visible.\nAsk the registry.";
  const T = tokenize(SAMPLE);

  it("maps an offset inside a word to that word", () => {
    expect(T[tokenAt(T, SAMPLE.indexOf("not"))].text).toBe("not");
    expect(T[tokenAt(T, 0)].text).toBe("Ownership");
    expect(T[tokenAt(T, 5)].text).toBe("Ownership");
  });

  it("resolves an offset in whitespace forward, never backward", () => {
    // Engines commonly report the gap before a word rather than its first
    // character. Highlighting a word the voice has finished is worse than
    // being one word early, so the gap belongs to what comes next.
    const i = tokenAt(T, SAMPLE.indexOf("  "));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(T[i].word).toBe(true);
    expect(T[i].start).toBeGreaterThan(SAMPLE.indexOf("  "));
  });

  it("never returns a gap token", () => {
    for (let i = 0; i < SAMPLE.length; i++) {
      const j = tokenAt(T, i);
      if (j >= 0) expect(T[j].word).toBe(true);
    }
  });

  it("returns -1 past the last word rather than wrapping", () => {
    expect(tokenAt(T, SAMPLE.length + 50)).toBe(-1);
    expect(tokenAt([], 0)).toBe(-1);
  });

  it("finds the first word for the initial highlight", () => {
    expect(T[firstWord(T)].text).toBe("Ownership");
    expect(firstWord(tokenize("   "))).toBe(-1);
  });

  it("paces the no-boundary fallback sanely", () => {
    // Only used when an engine never fires `boundary`. It must stay positive
    // and move the right way with rate, or the fallback runs away from the voice.
    expect(msPerWord(1)).toBeGreaterThan(100);
    expect(msPerWord(2)).toBeLessThan(msPerWord(1));
    expect(Number.isFinite(msPerWord(0))).toBe(true);
  });
});

describe("every output is classed by what can be said about it", () => {
  it("has four classes in reading order, checkable first", () => {
    expect(EVIDENCE_CLASSES).toHaveLength(4);
    expect([...EVIDENCE_CLASSES].sort((a, b) => a.rank - b.rank).map((c) => c.id)).toEqual([
      "visible",
      "measured",
      "inferred",
      "unprovable",
    ]);
  });

  it("only draws on the map what someone could check there", () => {
    expect(EVIDENCE_CLASSES.filter((c) => c.mappable).map((c) => c.id)).toEqual([
      "visible",
      "measured",
    ]);
    expect(isMappable("inferred")).toBe(false);
    expect(isMappable("unprovable")).toBe(false);
  });

  it.each(EVIDENCE_CLASSES.map((c) => [c.id, c] as const))(
    "%s explains itself in plain words",
    (_id, c) => {
      expect(c.label.length).toBeGreaterThan(5);
      expect(c.meaning.length).toBeGreaterThan(30);
      expect(classMeta(c.id)).toBe(c);
    },
  );

  it("gives every output exactly one known class, with no duplicate ids", () => {
    const ids = OUTPUT_CLASSES.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const o of OUTPUT_CLASSES) {
      expect(EVIDENCE_CLASSES.some((c) => c.id === o.cls)).toBe(true);
      expect(classOf(o.id)).toBe(o.cls);
    }
  });

  it("never names a source for something nothing can establish", () => {
    // The point of the unprovable class is that no dataset settles it. A
    // source beside one would be the old defect in a new place.
    for (const o of OUTPUT_CLASSES.filter((x) => x.cls === "unprovable")) {
      expect(o.source, `${o.id} must name no source`).toBeNull();
    }
    for (const o of OUTPUT_CLASSES.filter((x) => x.cls !== "unprovable")) {
      expect(typeof o.source, `${o.id} must name a source`).toBe("string");
    }
  });

  it.each(["title", "owner", "boundary-legal", "zoning", "encumbrance", "comps"])(
    "classes %s as something nobody can tell you from a screen",
    (id) => {
      expect(classOf(id)).toBe("unprovable");
    },
  );

  it.each(["schools", "health"])(
    "classes %s as a dataset record, not imagery verification",
    (id) => {
      expect(classOf(id)).toBe("measured");
    },
  );

  it("tallies every output across the four classes", () => {
    const t = classTally();
    expect(t.map((x) => x.meta.id)).toEqual(["visible", "measured", "inferred", "unprovable"]);
    expect(t.reduce((s, x) => s + x.count, 0)).toBe(OUTPUT_CLASSES.length);
    expect(outputsOfClass("visible")).toHaveLength(0);
  });
  it("does not describe the empty imagery class as observed physical proof", () => {
    expect(classMeta("visible").meaning).toMatch(/no imagery-confirmed observations/);
    expect(classMeta("visible").meaning).not.toMatch(/it is there in the/i);
  });
  it("does not retain an elevation-derived flood output in the catalogue", () => {
    expect(classOf("flood-proxy")).toBe("unprovable");
    expect(OUTPUT_CLASSES.find((x) => x.id === "flood-proxy")?.source).toBeNull();
  });

  it("opens by denying a score and pointing at the registry", () => {
    expect(EVIDENCE_LEAD).toMatch(/publishes no score/i);
    expect(EVIDENCE_LEAD).toMatch(/ownership/i);
    expect(EVIDENCE_LEAD).toMatch(/registry/i);
    expect(EVIDENCE_LEAD).toMatch(/surveyor/i);
  });
});

it.each(["boundary-drawn", "buildable", "soil", "coords", "slope"])(
  "does not present %s as observed ground",
  (id) => {
    expect(classOf(id)).toBe("inferred");
  },
);
