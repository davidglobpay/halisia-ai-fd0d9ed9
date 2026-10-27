import { describe, it, expect } from "vitest";
import {
  amenityCategory,
  filteredAmenities,
  amenityAccessItems,
  driveTime,
  agreedPdfAdmin,
  pdfLocationLine,
  distinctPdfNews,
  annualMonthlyRainfall,
  landPriceSection,
  type LocatedAmenity,
} from "@/lib/passport-pdf-quality";
const origin = { lat: -1.478682, lng: 36.957676 };
const facility = (name: string, offset: number, category = "schools"): LocatedAmenity => ({
  name,
  category,
  lat: origin.lat + offset,
  lng: origin.lng,
  source: "Synthetic fixture",
});
describe("Passport PDF quality rules", () => {
  it("classifies pharmacy by provider type, not hospital bucket", () => {
    expect(amenityCategory("pharmacy", ["hospital"])).toBe("pharmacy");
  });
  it("classifies a typed restaurant", () => {
    expect(amenityCategory("indian_restaurant")).toBe("restaurants");
  });
  it.each(["swimming_pool", "lodging", "residential_estate"])("rejects non-facility %s", (type) => {
    expect(amenityCategory(type, ["restaurant", "school"])).toBeNull();
  });
  it.each(["Public utility land", "Proposed school", "Reserved area", "Plot 12"])(
    "rejects %s",
    (name) => {
      expect(filteredAmenities([facility(name, 0.01)], origin)).toEqual([]);
    },
  );
  it("excludes query centroid points", () => {
    expect(filteredAmenities([facility("School", 0)], origin)).toEqual([]);
  });
  it("retains nearest four sorted by straight-line distance", () => {
    const list = filteredAmenities(
      [5, 3, 1, 4, 2].map((n) => facility(`School ${n}`, n * 0.01)),
      origin,
    );
    expect(list.map((p) => p.name)).toEqual(["School 1", "School 2", "School 3", "School 4"]);
  });
  it("deduplicates EPZ variants within 300 metres", () => {
    expect(filteredAmenities([facility("Epz", 0.01), facility("EPZ", 0.012)], origin)).toHaveLength(
      1,
    );
    expect(filteredAmenities([facility("Epz", 0.01), facility("EPZ", 0.014)], origin)).toHaveLength(
      2,
    );
  });
  it("access summary uses exactly the displayed nearest list", () => {
    const list = filteredAmenities(
      [
        facility("School farther", 0.02),
        facility("School nearest", 0.01),
        facility("Proposed school", 0.005),
      ],
      origin,
    );
    const [summary] = amenityAccessItems(list, "2026-10-28");
    expect(summary.value).toContain("nearest 2 shown");
    expect(summary.value).toContain(list[0].name);
    expect(summary.value).not.toContain("Proposed");
  });
  it("shows less than one minute below 0.5", () => {
    expect(driveTime(0)).toBe("<1 min");
    expect(driveTime(0.49)).toBe("<1 min");
    expect(driveTime(0.5)).toBe("~1 min");
  });
  it("omits conflicting sub-county and preserves Google locality spelling", () => {
    const admin = agreedPdfAdmin(
      { locality: "Kitengela", ward: null, subCounty: "Kajiado Central" },
      "Kajiado East",
    );
    expect(pdfLocationLine(admin, "Kajiado")).toBe("Kitengela, Kajiado County, Kenya");
  });
  it("shows sub-county only when both providers agree", () => {
    const a = { locality: "Kamulu", ward: null, subCounty: "Njiru" };
    expect(agreedPdfAdmin(a, null).subCounty).toBeNull();
    expect(agreedPdfAdmin(a, "Njiru").subCounty).toBe("Njiru");
  });
  const article = (
    title: string,
    source: string,
    date = "2026-10-27",
  ): Parameters<typeof distinctPdfNews>[0][number] => ({
    title,
    source_name: source,
    published_at: date,
    url: "https://example.org/news",
    category: null,
  });
  it("collapses token overlap at least 0.5 within three days", () => {
    const result = distinctPdfNews([
      article("Kitengela road construction project starts", "A"),
      article("Kitengela road construction project launched", "B", "2026-10-25"),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].alsoReportedBy).toEqual(["B"]);
  });
  it("keeps same headline more than three days apart", () => {
    expect(
      distinctPdfNews([
        article("Road project starts", "A"),
        article("Road project starts", "B", "2026-10-23"),
      ]),
    ).toHaveLength(2);
  });
  it.each(["facebook.com", "x.com", "tiktok.com", "instagram.com"])(
    "excludes social host %s",
    (host) => {
      expect(
        distinctPdfNews([{ ...article("Road project", "A"), url: `https://${host}/post` }]),
      ).toEqual([]);
    },
  );
  it("caps distinct stories at six", () => {
    expect(
      distinctPdfNews(Array.from({ length: 9 }, (_, i) => article(`Unique${i} topic${i}`, "A"))),
    ).toHaveLength(6);
  });
  it("uses twelve monthly means and omits incomplete annual rainfall", () => {
    expect(annualMonthlyRainfall(Array.from({ length: 12 }, () => ({ rainfallMm: 10 })))).toBe(120);
    expect(annualMonthlyRainfall([{ rainfallMm: 10 }])).toBeNull();
  });
  it("omits null land-price summary", () => {
    expect(landPriceSection(null)).toBeNull();
    expect(landPriceSection(undefined)).toBeNull();
  });
});
