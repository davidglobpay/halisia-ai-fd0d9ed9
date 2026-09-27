import { describe, expect, it } from "vitest";
import { buildPassportEvidence, type PassportEvidenceInput } from "@/lib/passport-evidence";

const base: PassportEvidenceInput = {
  lat: -1.15,
  lng: 36.96,
  ref: "",
  positionLabel: "Approximate",
  positionExact: false,
  locationConfidencePct: 40,
  sourceLabel: "Test",
  countyName: "Kiambu",
  admin: null,
  facts: null,
  intel: null,
  intelState: "ok",
  geotech: null,
  geoState: "ok",
  wave4: null,
  w4State: "ok",
  retrievedAt: "2026-09-27T00:00:00Z",
};

const scoreExplain = (confidence: "low" | "medium" | "high") => ({
  score: 72,
  formula: "weighted mean",
  factors: [{ label: "roads", value: 70, weight: "50%" }],
  confidence,
  note: "",
});

describe("buildPassportEvidence", () => {
  it("marks every missing value as a gap with Not assessed confidence", () => {
    const { items } = buildPassportEvidence(base);
    for (const it of items.filter((x) => x.value == null)) {
      expect(it.cls).toBe("gap");
      expect(it.confidence).toBe("not_assessed");
    }
  });

  it("distinguishes provider failure from empty results", () => {
    const failed = buildPassportEvidence({ ...base, intelState: "error" });
    const elev = failed.items.find((x) => x.id === "elev")!;
    expect(elev.note).toMatch(/failed/);
    expect(failed.ledger.find((l) => l.id === "g-elev")!.status).toBe("failed");
    const empty = buildPassportEvidence(base);
    expect(empty.items.find((x) => x.id === "elev")!.note).toMatch(/no data/);
  });

  it("withholds low-confidence scores and shows medium ones with formula", () => {
    const wave4 = {
      admin: { county: null, constituency: null, ward: null, town: null, village: null, displayName: null },
      facilities: {},
      climate: { annualRainfallMm: 900, meanTempC: 19, tempMinC: 12, tempMaxC: 26 },
      scores: { accessibility: 72, infrastructure: 72, environment: 72, development: 72, investment: 72 },
      breakdown: {
        accessibility: scoreExplain("low"),
        infrastructure: scoreExplain("medium"),
        environment: scoreExplain("high"),
        development: scoreExplain("low"),
        investment: scoreExplain("low"),
      },
      distanceBuckets: {},
      sources: [],
      generatedAt: "2026-09-27T00:00:00Z",
    };
    const { items } = buildPassportEvidence({ ...base, wave4 });
    const inv = items.find((x) => x.id === "score-investment")!;
    expect(inv.value).toBeNull();
    expect(inv.note).toMatch(/Insufficient coverage/);
    const infra = items.find((x) => x.id === "score-infrastructure")!;
    expect(infra.value).toBe("72/100");
    expect(infra.method).toMatch(/weighted mean/);
  });

  it("never claims verification, ownership or boundary", () => {
    const { items } = buildPassportEvidence({ ...base, ref: "LR 123" });
    for (const it of items) {
      expect(it.value ?? "").not.toMatch(/\bverified\b/i);
    }
    expect(items.find((x) => x.id === "boundary")!.value).toBeNull();
    expect(items.find((x) => x.id === "title")!.value).toBeNull();
    expect(items.find((x) => x.id === "flood")!.value).toBeNull();
  });

  it("reports coverage from available facts", () => {
    const { summary } = buildPassportEvidence(base);
    expect(summary.available + summary.missing).toBe(summary.total);
    expect(summary.coveragePct).toBeLessThan(40);
  });
});
