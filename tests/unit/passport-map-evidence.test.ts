import { describe, expect, it } from "vitest";
import { passportMapEvidence } from "@/lib/passport-map-evidence";
import { buildPassportEvidence, type EvidenceItem } from "@/lib/passport-evidence";

const item: EvidenceItem = {
  id: "soil", chapter: "physical", label: "Synthetic test soil",
  value: "Modelled clay", source: "Synthetic test source", method: "Test grid model",
  usedFor: ["Foundation screening"], cls: "modelled", confidence: "medium",
  retrieved: "2026-10-13T00:00:00Z", note: "Not a laboratory test",
};
const point = { lat: -1.15, lng: 36.96, intel: null };
describe("Passport map evidence adapter", () => {
  it("retains metadata without promoting retrieval or grid precision", () => {
    const [mapped] = passportMapEvidence([item], point);
    expect(mapped).toMatchObject({ source: item.source, method: item.method, supports: "Foundation screening", capturedAt: null, retrievedAt: item.retrieved, evidenceClass: "model_inference", position: { lat: point.lat, lng: point.lng, accuracyM: null } });
    expect(mapped.limitations).toContain(item.note);
    expect(mapped.limitations).toContain("not a located site observation");
  });
  it("does not make official statistics registry records or locate county aggregates", () => {
    const [mapped] = passportMapEvidence([{ ...item, id: "pop", chapter: "admin", cls: "official" }], point);
    expect(mapped.evidenceClass).toBe("open_data");
    expect(mapped.position).toBeNull();
  });
  it("never treats measured input as a professional attestation", () => {
    expect(passportMapEvidence([{ ...item, id: "elev", cls: "measured" }], point)[0].evidenceClass).toBe("open_data");
  });
  it("separates supplied coordinates from model inference without parsing strings", () => {
    const [mapped] = passportMapEvidence([{ ...item, id: "coords", cls: "measured", value: "99, 999" }], point);
    expect(mapped.evidenceClass).toBe("user_submission");
    expect(mapped.position?.lat).toBe(point.lat);
  });
  it("omits gaps and blank findings, and rejects invalid sampling points", () => {
    expect(passportMapEvidence([{ ...item, cls: "gap" }, { ...item, value: null }, { ...item, value: " " }], point)).toEqual([]);
    expect(passportMapEvidence([item], { ...point, lat: NaN })[0].position).toBeNull();
  });
  it("keeps unsupported new context unlocated", () => {
    expect(passportMapEvidence([{ ...item, id: "future-context" }], point)[0].position).toBeNull();
  });
  it("uses the real builder without inventing provider findings on failure", () => {
    const { items, ledger } = buildPassportEvidence({ ...point, ref: "Synthetic fixture", positionLabel: "User supplied", positionExact: false, locationConfidencePct: 40, sourceLabel: "Synthetic test submission", countyName: null, admin: null, facts: null, geotech: null, wave4: null, intelState: "error", geoState: "error", w4State: "error", retrievedAt: "Test visit" });
    const mapped = passportMapEvidence(items, point);
    expect(mapped.some((x) => x.id === "elev" || x.id === "title" || x.id === "boundary")).toBe(false);
    expect(ledger.find((x) => x.id === "g-elev")?.status).toBe("failed");
    expect(mapped.every((x) => x.capturedAt === null)).toBe(true);
  });
});