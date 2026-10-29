import { describe, expect, it } from "vitest";
import {
  countyCovers,
  monthsBetween,
  priceRelevance,
  relevanceSummary,
} from "@/lib/price-relevance";

const NOW = new Date("2026-10-29T12:00:00Z");

describe("a price shows how old it is", () => {
  it("counts whole calendar months", () => {
    expect(monthsBetween("2026-10-02", NOW)).toBe(0);
    expect(monthsBetween("2026-04-29", NOW)).toBe(6);
    expect(monthsBetween("2026-04-30", NOW)).toBe(5);
    expect(monthsBetween("2025-03-22", NOW)).toBe(19);
    expect(monthsBetween("not a date", NOW)).toBeNull();
  });

  it.each([
    ["2026-10-02", "current"],
    ["2026-04-29", "current"],
    ["2026-04-28", "ageing"],
    ["2026-03-27", "ageing"],
    ["2025-10-29", "ageing"],
    ["2025-10-28", "stale"],
    ["2025-03-22", "stale"],
  ])("a price observed %s is %s", (date, age) => {
    expect(
      priceRelevance({
        observedDate: date,
        priceCounty: "Nairobi",
        requestedCounty: "Nairobi",
        now: NOW,
      }).age,
    ).toBe(age);
  });

  it("says so when the date is missing, instead of treating it as current", () => {
    const r = priceRelevance({
      observedDate: null,
      priceCounty: "Nairobi",
      requestedCounty: "Nairobi",
      now: NOW,
    });
    expect(r.age).toBe("undated");
    expect(r.notes).toContain("Price date not recorded");
  });

  it("explains a stale price", () => {
    const r = priceRelevance({
      observedDate: "2025-03-22",
      priceCounty: "Nairobi",
      requestedCounty: "",
      now: NOW,
    });
    expect(r.notes).toEqual(["19 months old: likely out of date"]);
  });
});

describe("a price shows whether it is local", () => {
  it("matches the county forms in the price table", () => {
    expect(countyCovers("Nairobi", "Nairobi")).toBe(true);
    expect(countyCovers("Kiambu/Nairobi", "Kiambu")).toBe(true);
    expect(countyCovers("Nairobi metro", "Nairobi")).toBe(true);
    expect(countyCovers("Nairobi metro incl. Kitengela", "Nairobi")).toBe(true);
    expect(countyCovers("Nairobi", "Kisumu")).toBe(false);
    expect(countyCovers("Nairobi County", "nairobi")).toBe(true);
  });

  it("flags a Nairobi price used for Kisumu", () => {
    const r = priceRelevance({
      observedDate: "2026-10-02",
      priceCounty: "Nairobi",
      requestedCounty: "Kisumu",
      now: NOW,
    });
    expect(r.place).toBe("elsewhere");
    expect(r.notes).toEqual(["Nairobi price used for Kisumu"]);
  });

  it("flags a price with no recorded location", () => {
    const r = priceRelevance({
      observedDate: "2026-10-02",
      priceCounty: null,
      requestedCounty: "Kisumu",
      now: NOW,
    });
    expect(r.place).toBe("unspecified");
  });

  it("adds no location note when no county was chosen", () => {
    const r = priceRelevance({
      observedDate: "2026-10-02",
      priceCounty: "Nairobi",
      requestedCounty: "",
      now: NOW,
    });
    expect(r.place).toBe("no_county_chosen");
    expect(r.notes).toEqual([]);
  });
});

describe("the table banner counts problems", () => {
  it("summarises age and place", () => {
    const items = [
      priceRelevance({
        observedDate: "2025-01-01",
        priceCounty: "Nairobi",
        requestedCounty: "Kisumu",
        now: NOW,
      }),
      priceRelevance({
        observedDate: "2026-10-01",
        priceCounty: "Kisumu",
        requestedCounty: "Kisumu",
        now: NOW,
      }),
      priceRelevance({
        observedDate: null,
        priceCounty: null,
        requestedCounty: "Kisumu",
        now: NOW,
      }),
    ];
    expect(relevanceSummary(items)).toEqual({
      priced: 3,
      stale: 1,
      ageing: 0,
      undated: 1,
      elsewhere: 1,
      unspecified: 1,
    });
  });
});
