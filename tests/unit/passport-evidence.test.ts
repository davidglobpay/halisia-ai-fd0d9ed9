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

/**
 * A Wave 4 group as it is published now: no score, a method in words, and
 * factors whose `unit` says what the figure counts rather than how it was
 * weighted. The fixture used to carry `score: 72` and `formula: "weighted
 * mean"`, which is what the passport printed as "72/100".
 */
const groupCoverage = (confidence: "low" | "medium" | "high") => ({
  score: null,
  method: "Counted from features mapped in OpenStreetMap within 3 km of this point.",
  factors: [{ label: "Schools", value: 7, unit: "mapped within 3 km" }],
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

  it("withholds thinly mapped groups and shows well-mapped ones as counts", () => {
    const wave4 = {
      admin: {
        county: null,
        constituency: null,
        ward: null,
        town: null,
        village: null,
        displayName: null,
      },
      facilities: {},
      climate: { annualRainfallMm: 900, meanTempC: 19, tempMinC: 12, tempMaxC: 26 },
      scores: {
        accessibility: null,
        infrastructure: null,
        environment: null,
        development: null,
        investment: null,
      },
      breakdown: {
        accessibility: groupCoverage("low"),
        infrastructure: groupCoverage("medium"),
        environment: groupCoverage("high"),
        development: groupCoverage("low"),
        investment: groupCoverage("low"),
      },
      distanceBuckets: {},
      sources: [],
      generatedAt: "2026-09-27T00:00:00Z",
    };
    const { items } = buildPassportEvidence({ ...base, wave4 });
    const inv = items.find((x) => x.id === "score-investment")!;
    expect(inv.value).toBeNull();
    expect(inv.note).toMatch(/little is mapped here/i);

    // This row printed "72/100" with the arithmetic as its method. It now
    // carries the count and names where the count came from.
    const infra = items.find((x) => x.id === "score-infrastructure")!;
    expect(infra.value).toBe("Schools 7 mapped within 3 km");
    expect(infra.method).toMatch(/OpenStreetMap/);

    // No passport row may carry a mark out of a hundred.
    for (const row of items) {
      expect(row.value ?? "", `${row.id} must publish no score`).not.toMatch(/\d+\s*\/\s*100/);
      expect(row.method, `${row.id} must not print arithmetic`).not.toMatch(/weighted mean/i);
    }
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
