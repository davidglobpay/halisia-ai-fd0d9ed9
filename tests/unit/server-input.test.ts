import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BriefSchema,
  CoachSchema,
  ConceptSchema,
  GeotechSchema,
  InsuranceBriefSchema,
  LenderSummarySchema,
  ListingAiSchema,
  NarrativeSchema,
  parseServerInput,
} from "@/lib/server-input";

const listing = {
  title: "Ruiru plot",
  kind: "land",
  intent: "sale",
  price: 4950000,
  county: "Kiambu",
  amenities: ["water"],
  utilities: [],
  description: null,
};

describe("server inputs are checked, not cast", () => {
  it("accepts what the app sends today, extra keys included", () => {
    expect(() =>
      parseServerInput(ListingAiSchema, { ...listing, id: "x", owner_id: "y" }, "listing"),
    ).not.toThrow();
    expect(() =>
      parseServerInput(CoachSchema, { ...listing, photos: 0, hasPin: false }, "coach"),
    ).not.toThrow();
    expect(() =>
      parseServerInput(ConceptSchema, { ...listing, goal: "rental income" }, "concept"),
    ).not.toThrow();
    expect(() =>
      parseServerInput(
        InsuranceBriefSchema,
        { ...listing, latitude: -1.1, longitude: 36.9 },
        "insurance",
      ),
    ).not.toThrow();
  });

  it("accepts numeric strings from form fields and returns numbers", () => {
    const out = parseServerInput<{ requested_amount: number; monthly_income: number }>(
      LenderSummarySchema,
      {
        borrower_name: "A",
        requested_amount: "2500000",
        monthly_income: "180000",
        currency: "KES",
        purpose: "mortgage",
      },
      "financing",
    );
    expect(out.requested_amount).toBe(2500000);
    expect(out.monthly_income).toBe(180000);
  });

  it("rejects a missing required field without echoing the payload", () => {
    expect(() =>
      parseServerInput(
        LenderSummarySchema,
        { borrower_name: "SECRET NAME", currency: "KES", purpose: "x" },
        "financing",
      ),
    ).toThrow(/Invalid financing input: requested_amount/);
    try {
      parseServerInput(LenderSummarySchema, { borrower_name: "SECRET NAME" }, "financing");
    } catch (e) {
      expect(String((e as Error).message)).not.toMatch(/SECRET/);
    }
  });

  it("caps sizes so a prompt cannot be stuffed", () => {
    expect(() =>
      parseServerInput(ListingAiSchema, { ...listing, description: "x".repeat(8001) }, "listing"),
    ).toThrow();
    expect(() =>
      parseServerInput(ListingAiSchema, { ...listing, amenities: Array(61).fill("a") }, "listing"),
    ).toThrow();
  });

  it("rejects impossible coordinates", () => {
    expect(() => parseServerInput(GeotechSchema, { lat: 95, lng: 36 }, "geotech")).toThrow();
    expect(() => parseServerInput(GeotechSchema, { lat: "abc", lng: 36 }, "geotech")).toThrow();
    expect(() =>
      parseServerInput(GeotechSchema, { lat: -1.29, lng: 36.82 }, "geotech"),
    ).not.toThrow();
  });

  it("checks the public narrative counts", () => {
    const ok = {
      address: "Nairobi",
      lat: -1.29,
      lng: 36.82,
      counts: { schools: 3, hospitals: 1, groceries: 2, transit: 4, restaurants: 9, banks: 2 },
    };
    expect(() => parseServerInput(NarrativeSchema, ok, "narrative")).not.toThrow();
    expect(() =>
      parseServerInput(
        NarrativeSchema,
        { ...ok, counts: { ...ok.counts, schools: -1 } },
        "narrative",
      ),
    ).toThrow();
  });

  it("checks design brief options", () => {
    const ok = {
      goal: "rent",
      intendedUse: "residential",
      siteAreaSqm: 500,
      buildableAreaSqm: null,
      maxFootprintSqm: null,
      maxFloors: 3,
      budgetKes: null,
      options: [{ id: "a", name: "A", floors: 2, footprintSqm: 120, unitCount: 4 }],
    };
    expect(() => parseServerInput(BriefSchema, ok, "brief")).not.toThrow();
    expect(() =>
      parseServerInput(BriefSchema, { ...ok, options: [{ id: "a" }] }, "brief"),
    ).toThrow();
  });

  it("no longer casts input in the eight functions", () => {
    for (const f of [
      "financing-ai",
      "development-studio",
      "insurance-ai",
      "ai-listing",
      "geotech",
      "listing-coach",
      "design-studio/brief",
      "ai-narrative",
    ]) {
      const src = readFileSync(`src/lib/${f}.functions.ts`, "utf8");
      expect(src).not.toMatch(/inputValidator\(\((?:i|input): unknown\) => (?:i|input) as /);
      expect(src).toMatch(/parseServerInput<\w+>\(/);
    }
  });
});
