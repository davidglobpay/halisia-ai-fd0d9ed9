import { expect, it } from "vitest";
import { landUseContext } from "@/lib/passport-land-use";
import type { EvidenceItem } from "@/lib/passport-evidence";
it("does not attach suitability guidance to absent findings", () =>
  expect(landUseContext({ value: null } as EvidenceItem)).toBeNull());
it("does not infer population growth or jobs from one census total", () =>
  expect(landUseContext({ id: "pop", value: "100" } as EvidenceItem)).toContain(
    "cannot show growth",
  ));
it("does not choose foundations from a regional soil model", () =>
  expect(landUseContext({ id: "soil", value: "Loam" } as EvidenceItem)).toContain(
    "cannot specify a foundation",
  ));
