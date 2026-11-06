import { describe, expect, it } from "vitest";

import {
  CONTAINER_PAD_MAX_DROP_M,
  MASONRY_PLINTH_MAX_DROP_M,
  MASONRY_STRIP_MAX_DROP_M,
  groundDrop,
  planFoundation,
} from "@/components/halisia/model-lab/site/foundation";

describe("foundation suggestion", () => {
  it("level ground under masonry: strip footing and slab", () => {
    const p = planFoundation({ structure: "masonry_stone", dropM: 0.1 });
    expect(p.kind).toBe("strip_slab");
    expect(p.clearanceM).toBeGreaterThan(0);
  });
  it("moderate fall under masonry: stepped footing with raised plinth", () => {
    expect(
      planFoundation({ structure: "masonry_stone", dropM: MASONRY_STRIP_MAX_DROP_M + 0.1 }).kind,
    ).toBe("raised_plinth");
  });
  it("steep fall under masonry: columns and ground beams", () => {
    expect(
      planFoundation({ structure: "masonry_stone", dropM: MASONRY_PLINTH_MAX_DROP_M + 0.1 }).kind,
    ).toBe("columns_beams");
  });
  it("containers: pads on gentle ground, piers on a fall", () => {
    expect(planFoundation({ structure: "container_40ft", dropM: 0.2 }).kind).toBe("container_pads");
    expect(
      planFoundation({ structure: "container_20ft", dropM: CONTAINER_PAD_MAX_DROP_M + 0.2 }).kind,
    ).toBe("container_piers");
  });
  it("stacked containers add the two-high check", () => {
    const p = planFoundation({ structure: "container_40ft", dropM: 0.2, stacked: true });
    expect(p.checks.some((c) => /two-high/i.test(c))).toBe(true);
  });
  it("never claims a design and always asks for a soil test and an engineer", () => {
    for (const s of ["masonry_stone", "container_20ft", "container_40ft"] as const) {
      for (const d of [null, 0, 0.5, 2]) {
        const p = planFoundation({ structure: s, dropM: d });
        expect(p.checks.join(" ")).toMatch(/soil/i);
        expect(p.checks.join(" ")).toMatch(/engineer/i);
        expect(p.checks.join(" ")).toMatch(/not a design/i);
      }
    }
  });
  it("says level ground is assumed when there is no terrain reading", () => {
    expect(planFoundation({ structure: "masonry_stone", dropM: null }).why).toMatch(
      /level ground is assumed/,
    );
  });
  it("ground drop is max minus min, ignoring bad samples", () => {
    expect(groundDrop([1, 2.5, Number.NaN, 0.5])).toBeCloseTo(2, 9);
    expect(groundDrop([])).toBeNull();
  });
});
