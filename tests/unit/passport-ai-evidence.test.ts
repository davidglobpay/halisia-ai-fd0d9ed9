import { describe, expect, it } from "vitest";
import { resolveAiEvidence } from "@/lib/passport-ai-evidence";
import type { EvidenceItem } from "@/lib/passport-evidence";

const row = (
  id: string,
  confidence: EvidenceItem["confidence"],
  value = "Known",
): EvidenceItem => ({
  id,
  chapter: "physical",
  label: id,
  value,
  source: `Source ${id}`,
  method: "Measured",
  usedFor: ["Context"],
  cls: "measured",
  confidence,
  retrieved: "2026-09-27T16:00:00Z",
});

describe("resolveAiEvidence", () => {
  it("resolves unique citations and derives from the weakest cited row", () => {
    const result = resolveAiEvidence("Point [elev]. Soil [soil]. Again [elev].", [
      row("elev", "high"),
      row("soil", "medium"),
    ]);
    expect(result.cited.map((x) => x.id)).toEqual(["elev", "soil"]);
    expect(result.confidence).toBe("medium");
  });

  it("does not assess confidence when a citation is unmatched", () => {
    const result = resolveAiEvidence("Point [elev] and [missing].", [row("elev", "high")]);
    expect(result.unknownIds).toEqual(["missing"]);
    expect(result.confidence).toBe("not_assessed");
  });
});
