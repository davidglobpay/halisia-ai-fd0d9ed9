import { describe, expect, it } from "vitest";
import {
  PASSPORT_DISCLAIMER,
  passportFacts,
  passportRef,
  reconcileArea,
  toVerificationState,
  verificationDisplay,
  type SpatialParcel,
} from "@/lib/spatial";

function parcel(overrides: Partial<SpatialParcel> = {}): SpatialParcel {
  return {
    id: "p1",
    titleDeedNo: "NAIROBI/BLOCK 118/2451",
    parcelCode: "KMB-RUIRU-2451",
    county: "Kiambu",
    centroid: { lat: -1.1489, lng: 36.9601 },
    ring: [
      { lat: -1.1487, lng: 36.9599 },
      { lat: -1.1487, lng: 36.9603 },
      { lat: -1.1491, lng: 36.9603 },
      { lat: -1.1491, lng: 36.9599 },
    ],
    areaSqm: 2020,
    elevationMasl: 1560,
    zoningType: "Residential",
    maxHeightM: 15,
    roadSetbackM: 6,
    riparianSetbackM: 30,
    valuationKes: 12_000_000,
    status: "verified",
    surveyVerifiedOn: null,
    deedHash: null,
    verificationState: "unverified",
    verificationConfidence: 0,
    verificationMethod: null,
    verificationEvidenceRef: null,
    verificationUpdatedAt: null,
    legacyParcelCode: "KJD-RUIRU-2451",
    legacyTitleDeedNo: null,
    beacons: [],
    ...overrides,
  };
}

describe("toVerificationState", () => {
  it("falls back to unverified for unknown values", () => {
    expect(toVerificationState("evidence_backed")).toBe("evidence_backed");
    expect(toVerificationState("verified")).toBe("unverified");
    expect(toVerificationState(null)).toBe("unverified");
  });
});

describe("verificationDisplay", () => {
  it("never presents a legacy 'verified' status as verified", () => {
    const d = verificationDisplay(parcel());
    expect(d.label).toBe("Unverified");
    expect(d.tone).toBe("pending");
  });

  it("shows reviewer confidence only for evidence-backed records", () => {
    const d = verificationDisplay(
      parcel({
        verificationState: "evidence_backed",
        verificationConfidence: 92,
        verificationMethod: "Registry search + licensed survey",
      }),
    );
    expect(d.label).toBe("Evidence-backed");
    expect(d.tone).toBe("verified");
    expect(d.detail).toContain("92%");
  });
});

describe("passportFacts", () => {
  it("emits factual entries with no synthetic score", () => {
    const facts = passportFacts(parcel());
    expect(facts.some((f) => f.key === "verification")).toBe(true);
    for (const f of facts) expect(typeof f.value).toBe("string");
    expect(JSON.stringify(facts)).not.toMatch(/score/i);
  });

  it("includes superseded identifiers", () => {
    const ids = passportFacts(parcel()).find((f) => f.key === "identifiers");
    expect(ids?.value).toContain("KJD-RUIRU-2451");
  });

  it("flags boundary/area mismatch as indicative", () => {
    const facts = passportFacts(parcel({ areaSqm: 100 }));
    expect(facts.find((f) => f.key === "area")?.value).toMatch(/indicative, non-cadastral/);
  });
});

describe("PASSPORT_DISCLAIMER", () => {
  it("keeps the required wording", () => {
    expect(PASSPORT_DISCLAIMER).toBe(
      "Not assessed here: title validity · ownership · legal boundary position.",
    );
  });
});

describe("reconcileArea / passportRef", () => {
  it("returns null without a usable polygon", () => {
    expect(reconcileArea(parcel({ ring: [] }))).toBeNull();
  });

  it("passportRef is deterministic and independent of deedHash", () => {
    expect(passportRef(parcel())).toBe(passportRef(parcel({ deedHash: "abc" })));
  });
});
