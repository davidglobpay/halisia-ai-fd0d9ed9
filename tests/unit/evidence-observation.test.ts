import { describe, expect, it } from "vitest";
import {
  buildSliceObservation,
  provenanceText,
  sha256Hex,
  subjectFor,
  summarisePayload,
  summariseTrail,
  TIER_LABEL,
} from "@/lib/evidence-observation";

const base = {
  locationKey: "geo:-1.2921,36.8219",
  lat: -1.29213,
  lng: 36.82191,
  slice: "elevation" as const,
  status: "ok" as const,
  payload: { meters: 1661.2, resolutionM: 30 },
  retrievedAt: "2026-10-29T10:00:00.000Z",
  expiresAt: "2027-10-29T10:00:00.000Z",
  sourceId: "09751e21-5ae9-471f-a8d2-4e882e01228a",
  sourceSystem: "google_elevation",
  method: "gateway_elevation_lookup",
  version: "v1",
};

describe("every cached reading becomes an append-only observation", () => {
  it("records a public place as an area observation", async () => {
    const row = await buildSliceObservation(base);
    expect(row).toMatchObject({
      subject_type: "area",
      subject_ref: "geo:-1.2921,36.8219",
      parcel_id: null,
      domain: "LAND",
      indicator: "elevation",
      value_json: { meters: 1661.2, resolutionM: 30 },
      retrieved_at: base.retrievedAt,
      valid_to: base.expiresAt,
      source_record_id: base.locationKey,
      methodology: "gateway_elevation_lookup",
      epistemic_tier: "OBSERVED_THIRD_PARTY",
      verification_state: "unverified",
    });
  });

  it("keeps parcel readings private to the parcel", () => {
    expect(subjectFor("parcel:abc", "abc")).toEqual({
      subject_type: "parcel",
      subject_ref: "parcel:abc",
      parcel_id: "abc",
    });
  });

  it("never invents a confidence figure", async () => {
    expect((await buildSliceObservation(base)).confidence_pct).toBeNull();
  });

  it("maps each dataset to an allowed evidence domain", async () => {
    expect((await buildSliceObservation({ ...base, slice: "air_quality" })).domain).toBe("CLIMATE");
    expect((await buildSliceObservation({ ...base, slice: "places" })).domain).toBe(
      "INFRASTRUCTURE",
    );
  });

  it("hashes the content so a changed reading gets a different fingerprint", async () => {
    const a = await buildSliceObservation(base);
    const b = await buildSliceObservation({ ...base, payload: { meters: 1662 } });
    const c = await buildSliceObservation(base);
    expect(a.provenance_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.provenance_hash).not.toBe(b.provenance_hash);
    expect(a.provenance_hash).toBe(c.provenance_hash);
  });

  it("computes a standard SHA-256", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("includes source, place, dataset, time and value in the fingerprint", () => {
    const text = provenanceText({
      sourceSystem: "s",
      locationKey: "k",
      indicator: "i",
      retrievedAt: "t",
      value: { v: 1 },
    });
    expect(text).toBe('s|k|i|t|{"v":1}');
  });

  it("keeps small payloads whole and summarises large ones", () => {
    expect(summarisePayload({ a: 1 })).toEqual({ a: 1 });
    const big = { results: Array.from({ length: 2000 }, (_, i) => ({ name: `Place ${i}` })), n: 5 };
    expect(summarisePayload(big)).toMatchObject({
      truncated: true,
      fields: { results: 2000, n: 5 },
    });
    expect(summarisePayload(null)).toBeNull();
  });

  it("records degraded readings as degraded", async () => {
    const row = await buildSliceObservation({ ...base, status: "degraded", reason: "partial" });
    expect(row.metadata).toMatchObject({ status: "degraded", reason: "partial" });
  });
});

describe("the why panel summarises history per dataset", () => {
  const src = {
    authority: "Google Maps Platform",
    source_url: "https://developers.google.com/maps",
    licence: null,
  };
  const rows = [
    {
      indicator: "elevation",
      retrieved_at: "2026-09-01T00:00:00Z",
      methodology: "m1",
      epistemic_tier: "OBSERVED_THIRD_PARTY",
      verification_state: "unverified",
      metadata: { status: "ok" },
      resource_sources: src,
    },
    {
      indicator: "elevation",
      retrieved_at: "2026-10-29T00:00:00Z",
      methodology: "m2",
      epistemic_tier: "OBSERVED_THIRD_PARTY",
      verification_state: "unverified",
      metadata: { status: "degraded" },
      resource_sources: src,
    },
    {
      indicator: "air_quality",
      retrieved_at: "2026-10-20T00:00:00Z",
      methodology: "m3",
      epistemic_tier: "OBSERVED_THIRD_PARTY",
      verification_state: "unverified",
      metadata: null,
      resource_sources: null,
    },
  ];

  it("counts readings and keeps the first and latest dates", () => {
    const out = summariseTrail(rows);
    const elev = out.find((r) => r.indicator === "elevation")!;
    expect(elev).toMatchObject({
      readings: 2,
      firstAt: "2026-09-01T00:00:00Z",
      latestAt: "2026-10-29T00:00:00Z",
      method: "m2",
      degraded: true,
      label: "Elevation",
    });
    expect(elev.source?.authority).toBe("Google Maps Platform");
  });

  it("does not invent a source when none is linked", () => {
    expect(summariseTrail(rows).find((r) => r.indicator === "air_quality")!.source).toBeNull();
  });

  it("labels every evidence tier the database allows", () => {
    for (const t of [
      "UNKNOWN",
      "INFERRED",
      "OBSERVED_THIRD_PARTY",
      "AUTHORITATIVE_SOURCE",
      "FIELD_OBSERVED",
      "PROFESSIONALLY_REVIEWED",
      "REGULATOR_VERIFIED",
    ])
      expect(TIER_LABEL[t]).toBeTruthy();
  });
});
