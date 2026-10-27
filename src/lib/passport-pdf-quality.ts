import { displayPlaceName, isQueryCentroid } from "./passport-quality";
import type { LocationIntel } from "./location-intel.functions";
import type { Wave4Intel } from "./wave4-intel.functions";
import type { AdminHierarchy } from "./reverse-geocode-admin";
import type { EvidenceItem } from "./passport-evidence";
import type { LandPriceSummary } from "./cost-intel";

export type LocatedAmenity = {
  name: string;
  category: string;
  lat: number;
  lng: number;
  distanceKm?: number;
  driveKm?: number | null;
  driveMin?: number | null;
  source: string;
};
const CATEGORY_TYPES: Record<string, string[]> = {
  pharmacy: ["pharmacy", "drugstore"],
  hospitals: ["hospital", "medical_clinic", "doctor", "dentist"],
  schools: ["school", "primary_school", "secondary_school", "university", "preschool"],
  groceries: ["supermarket", "grocery_store", "market", "shopping_mall", "convenience_store"],
  transit: ["bus_station", "bus_stop", "train_station", "transit_station"],
  restaurants: ["restaurant", "cafe", "coffee_shop", "food_court", "bakery"],
  banks: ["bank", "atm"],
  worship: ["church", "mosque", "hindu_temple", "synagogue"],
  fuel: ["gas_station"],
};
export function amenityCategory(primaryType?: string, types: string[] = []): string | null {
  const classify = (type: string) =>
    Object.entries(CATEGORY_TYPES).find(([, values]) =>
      values.some((v) => type === v || (v === "restaurant" && type.endsWith("_restaurant"))),
    )?.[0] ?? null;
  if (primaryType) {
    if (
      ["swimming_pool", "lodging", "hotel", "residential_estate", "apartment_complex"].includes(
        primaryType,
      )
    )
      return null;
    const primary = classify(primaryType);
    if (primary) return primary;
  }
  if (types.some((t) => ["swimming_pool", "lodging", "residential_estate"].includes(t)))
    return null;
  for (const type of types) {
    const category = classify(type);
    if (category) return category;
  }
  return null;
}
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}
const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export function filteredAmenities(
  places: LocatedAmenity[],
  origin?: { lat: number; lng: number },
): LocatedAmenity[] {
  const sorted = places
    .filter(
      (p) =>
        p.name.trim() &&
        !/public utility land|proposed|reserved|plot/i.test(p.name) &&
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng) &&
        !isQueryCentroid(p, origin),
    )
    .map((p) => ({
      ...p,
      name: displayPlaceName(p.name),
      distanceKm: origin ? distanceKm(origin, p) : p.distanceKm,
    }))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  const kept: LocatedAmenity[] = [];
  for (const p of sorted) {
    const key = nameKey(p.name);
    if (
      kept.some(
        (q) =>
          q.category === p.category &&
          distanceKm(p, q) <= 0.3 &&
          (nameKey(q.name) === key ||
            (Math.min(key.length, nameKey(q.name).length) >= 3 &&
              (key.includes(nameKey(q.name)) || nameKey(q.name).includes(key)))),
      )
    )
      continue;
    if (kept.filter((q) => q.category === p.category).length < 4) kept.push(p);
  }
  return kept.sort(
    (a, b) =>
      a.category.localeCompare(b.category) ||
      (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
  );
}
export function collectLocatedAmenities(
  intel?: LocationIntel | null,
  wave4?: Wave4Intel | null,
  origin?: { lat: number; lng: number },
): LocatedAmenity[] {
  const places: LocatedAmenity[] = [];
  for (const list of Object.values(intel?.categories ?? {}))
    for (const p of list) {
      const category = amenityCategory(p.primaryType, p.types);
      if (category && p.location)
        places.push({
          name: p.name,
          category,
          ...p.location,
          distanceKm: p.distanceKm,
          driveKm: p.driveKm,
          driveMin: p.driveMin,
          source: "Google Places / Routes",
        });
    }
  if (wave4?.sources.some((s) => s.used && s.label.includes("Overpass")))
    for (const [category, list] of Object.entries(wave4.facilities))
      for (const p of list) {
        const osmCategory =
          (
            {
              education: "schools",
              health: "hospitals",
              shopping: "groceries",
              transport: "transit",
              food: "restaurants",
              markets: "groceries",
            } as Record<string, string>
          )[category] ?? category;
        const facilityCategory = p.facilityType === "pharmacy" ? "pharmacy" : osmCategory;
        if (CATEGORY_TYPES[facilityCategory])
          places.push({ ...p, category: facilityCategory, source: "OpenStreetMap" });
      }
  return filteredAmenities(places, origin);
}
export function driveTime(min: number): string {
  return min < 0.5 ? "<1 min" : `~${Math.max(1, Math.round(min))} min`;
}
export function amenityAccessItems(places: LocatedAmenity[], retrieved: string): EvidenceItem[] {
  return [...new Set(places.map((p) => p.category))].map((category) => {
    const list = places.filter((p) => p.category === category);
    const p = list[0];
    return {
      id: `acc-${category}`,
      chapter: "access",
      label: category,
      value: `nearest ${list.length} shown · nearest ${p.name}${p.distanceKm != null ? ` (${p.distanceKm.toFixed(2)} km straight-line)` : ""}${p.driveMin != null ? `, ${driveTime(p.driveMin)} drive` : ""}`,
      source: [...new Set(list.map((p) => p.source))].join("; "),
      method:
        "Located facilities only, nearest four per category; similar names within 300 m deduplicated. Not an exhaustive inventory or legal access assessment.",
      cls: "measured",
      confidence: "medium",
      retrieved,
      usedFor: ["Located amenities"],
    };
  });
}
export function agreedPdfAdmin(
  admin?: AdminHierarchy | null,
  osmSubCounty?: string | null,
): AdminHierarchy {
  const agree =
    admin?.subCounty && osmSubCounty && nameKey(admin.subCounty) === nameKey(osmSubCounty);
  const locality = admin?.locality && !/kitenkela/i.test(admin.locality) ? admin.locality : null;
  return {
    locality,
    ward: admin?.ward ?? null,
    subCounty:
      agree && !(locality === "Kitengela" && /kajiado central/i.test(admin?.subCounty ?? ""))
        ? (admin?.subCounty ?? null)
        : null,
  };
}
export function pdfLocationLine(admin: AdminHierarchy, county?: string | null): string {
  return [
    ...new Set(
      [
        admin.locality,
        admin.ward,
        admin.subCounty,
        county ? `${county} County` : null,
        "Kenya",
      ].filter((s): s is string => !!s),
    ),
  ].join(", ");
}
export function eatTimestamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "timestamp not supplied"
    : `${new Date(date.getTime() + 10800000).toISOString().slice(0, 16).replace("T", " ")} EAT`;
}
export function annualMonthlyRainfall(
  monthly?: Array<{ rainfallMm: number | null }>,
): number | null {
  return monthly?.length === 12 &&
    monthly.every((m) => m.rainfallMm != null && Number.isFinite(m.rainfallMm))
    ? monthly.reduce((sum, m) => sum + (m.rainfallMm ?? 0), 0)
    : null;
}
export type PdfNews = {
  title: string;
  source_name: string | null;
  published_at: string | null;
  url: string | null;
  category: string | null;
  alsoReportedBy?: string[];
};
export function distinctPdfNews(news: PdfNews[]): PdfNews[] {
  const tokens = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2),
    );
  const stories: PdfNews[] = [];
  for (const n of [...news].sort((a, b) =>
    (b.published_at ?? "").localeCompare(a.published_at ?? ""),
  )) {
    // Syndicated Google News links can conceal a social destination; the
    // runtime headline/source frequently supplies its host explicitly.
    if (
      /\b(facebook\.com|x\.com|tiktok\.com|instagram\.com)\b/i.test(
        `${n.title} ${n.source_name ?? ""}`,
      )
    )
      continue;
    try {
      if (
        n.url &&
        /(^|\.)(facebook\.com|x\.com|tiktok\.com|instagram\.com)$/.test(new URL(n.url).hostname)
      )
        continue;
    } catch {
      continue;
    }
    const a = tokens(n.title);
    const same = stories.find((s) => {
      const b = tokens(s.title);
      const days =
        Math.abs(Date.parse(s.published_at ?? "") - Date.parse(n.published_at ?? "")) / 86400000;
      return (
        days <= 3 &&
        a.size > 0 &&
        b.size > 0 &&
        [...a].filter((t) => b.has(t)).length / Math.max(a.size, b.size) >= 0.5
      );
    });
    if (same) {
      if (n.source_name && n.source_name !== same.source_name)
        same.alsoReportedBy = [...new Set([...(same.alsoReportedBy ?? []), n.source_name])];
    } else stories.push({ ...n });
  }
  return stories.slice(0, 6);
}
export function landPriceSection(summary?: LandPriceSummary | null): LandPriceSummary | null {
  return summary ?? null;
}
