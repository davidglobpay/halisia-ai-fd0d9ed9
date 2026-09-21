import { describe, expect, it } from "vitest";
import {
  applyFilters,
  completeness,
  listingTrust,
  railFilter,
  recommend,
} from "@/lib/marketplace";
import type { PropertyRow } from "@/lib/properties";

const completeListing = {
  id: "listing-1",
  title: "Complete test listing",
  description:
    "A deliberately complete listing row used to prove that completeness is not evidence.",
  price: 12_000_000,
  size_value: 2,
  county: "Nairobi",
  address: "Westlands",
  latitude: -1.267,
  longitude: 36.81,
  amenities: ["Road access"],
  utilities: ["Water"],
  cover_image: "https://example.test/listing.jpg",
  ai_summary: "AI-generated summary",
  ai_score: { overall: 95 },
  intent: "sale",
  kind: "land",
  bedrooms: null,
  bathrooms: null,
  featured: true,
  view_count: 500,
  created_at: new Date().toISOString(),
} as unknown as PropertyRow;

describe("marketplace trust boundaries", () => {
  it("keeps a complete, geocoded, AI-scored listing unverified", () => {
    expect(completeness(completeListing)).toBe(100);
    expect(listingTrust(completeListing)).toEqual({
      provenance: "SOURCE_LISTED",
      dataState: "DATA_COMPLETENESS",
      dataCompleteness: 100,
      documentsReviewed: false,
      evidenceVerified: false,
      regulatorVerified: false,
    });
  });

  it("does not treat media, sponsorship or popularity as evidence", () => {
    const trust = listingTrust(completeListing);
    expect(trust.evidenceVerified).toBe(false);
    expect(trust.regulatorVerified).toBe(false);
  });

  it("returns no native rows for the evidence-verified filter or rail", () => {
    expect(applyFilters([completeListing], { evidenceVerified: true })).toEqual([]);
    expect(railFilter([completeListing], "evidence_verified")).toEqual([]);
  });

  it("never awards a recommendation bonus for fabricated verification", () => {
    const [result] = recommend([completeListing], {});
    expect(result.reasons).not.toContain("Verified listing with complete data");
    expect(result.reasons).toContain("100% data completeness");
  });
});
