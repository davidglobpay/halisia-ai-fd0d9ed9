import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";

import {
  addDrawingSet,
  drawingSheetCount,
  openingSchedule,
  pickScale,
  ptPerM,
  trussPositions,
  trussSpacingM,
  trussType,
  type DrawingSetInput,
} from "@/lib/pdf-architectural-drawings";
import { roofCoverKind } from "@/components/halisia/model-lab/site/design-style";
// Recorded from buildSiteHouse in a browser: 3-bedroom gable, 2-bedroom flat,
// 1-bedroom mono-pitch, and two-high 40 ft containers.
import houses from "../fixtures/site-houses.json";

const input = (k: keyof typeof houses): DrawingSetInput =>
  ({
    ...(houses[k] as unknown as Omit<DrawingSetInput, "title" | "place" | "issued">),
    title: "Test house",
    place: "0.563000, 34.561000",
    issued: "8 Nov 2026",
  }) as DrawingSetInput;

describe("drawing scales", () => {
  it("prints 1 m as 10 mm at 1:100", () => {
    expect(ptPerM(100)).toBeCloseTo(28.35, 2);
  });
  it("picks the largest standard scale that fits", () => {
    // 19 m across 600 pt fits at 1:100 (539 pt) but not at 1:75 (718 pt).
    expect(pickScale(19, 10, 600, 400)).toBe(100);
    expect(pickScale(1.4, 1.4, 300, 300)).toBe(20);
  });
});

describe("roof structure rules", () => {
  it("spaces trusses closer under tiles than under iron sheet", () => {
    expect(trussSpacingM("tiles")).toBe(0.9);
    expect(trussSpacingM("sheet")).toBe(1.2);
  });
  it("uses a Fink truss only above a 6.5 m span", () => {
    expect(trussType(9.3)).toBe("fink");
    expect(trussType(5.8)).toBe("kingpost");
  });
  it("puts a truss on each end wall and spaces the rest evenly", () => {
    const p = trussPositions(12, 1.2);
    expect(p[0]).toBe(0);
    expect(p[p.length - 1]).toBe(12);
    expect(p).toHaveLength(11);
  });
  it("reads red-brown roofs as tiles, mono-pitch always as sheet", () => {
    expect(roofCoverKind({ roof: "gable", roofColor: "#6f2f25" })).toBe("tiles");
    expect(roofCoverKind({ roof: "mono", roofColor: "#6f2f25" })).toBe("sheet");
    expect(roofCoverKind({ roof: "hip", roofColor: "#3a4a5a" })).toBe("sheet");
    expect(roofCoverKind({ roof: "flat", roofColor: "#6f2f25" })).toBe("flat");
  });
});

describe("door and window schedule", () => {
  it("counts every opening the 3D house was built with", () => {
    const h = input("m3gable");
    const walls = h.drawing!.walls;
    const total = walls.reduce((n, w) => n + w.openings.length, 0);
    const sched = openingSchedule(walls);
    expect(sched.reduce((n, q) => n + q.count, 0)).toBe(total);
    // The front door is an outside door; marks are unique.
    expect(sched.some((q) => q.kind === "door" && q.outside)).toBe(true);
    expect(new Set(sched.map((q) => q.mark)).size).toBe(sched.length);
  });
});

describe("drawing set", () => {
  for (const k of ["m3gable", "m2flat", "m1mono", "c40"] as const) {
    it(`adds ${drawingSheetCount()} landscape sheets for ${k}`, () => {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      addDrawingSet(doc, input(k));
      expect(doc.getNumberOfPages()).toBe(1 + drawingSheetCount());
      for (let p = 2; p <= doc.getNumberOfPages(); p++) {
        doc.setPage(p);
        expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(doc.internal.pageSize.getHeight());
      }
      const raw = doc.output();
      // Every sheet carries the limit on its face.
      expect(raw.split("INDICATIVE - NOT FOR CONSTRUCTION").length - 1).toBe(drawingSheetCount());
      expect(raw).toContain("FLOOR PLAN");
      expect(raw).toContain("SECTION A-A");
    });
  }
});
