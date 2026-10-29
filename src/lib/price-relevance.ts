/**
 * How current and how local is a price?
 *
 * Construction prices move and differ by county. A price is still shown when
 * it is old or from elsewhere, but it is never presented as if it were a
 * current local quote. Thresholds are deliberately simple and stated.
 */
export const PRICE_AGEING_MONTHS = 6;
export const PRICE_STALE_MONTHS = 12;

export type PriceAge = "current" | "ageing" | "stale" | "undated";
export type PricePlace = "local" | "elsewhere" | "unspecified" | "no_county_chosen";

export type PriceRelevance = {
  ageMonths: number | null;
  age: PriceAge;
  place: PricePlace;
  notes: string[];
};

/** Whole months between two dates (calendar months, floor). */
export function monthsBetween(fromIso: string, now: Date): number | null {
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return null;
  let m =
    (now.getUTCFullYear() - from.getUTCFullYear()) * 12 + (now.getUTCMonth() - from.getUTCMonth());
  if (now.getUTCDate() < from.getUTCDate()) m -= 1;
  return Math.max(0, m);
}

/** The same calendar day `months` months earlier (UTC midnight). */
function monthsBefore(now: Date, months: number): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/county/g, "")
    .trim();
}

/** A price row's county field can be "Nairobi", "Kiambu/Nairobi" or "Nairobi metro". */
export function countyCovers(priceCounty: string, requestedCounty: string): boolean {
  const want = norm(requestedCounty);
  if (!want) return false;
  return priceCounty
    .split(/[/,;]| incl\.? /i)
    .map((part) =>
      norm(part)
        .replace(/\bmetro\b/, "")
        .trim(),
    )
    .some((part) => part === want);
}

export function priceRelevance(args: {
  observedDate: string | null | undefined;
  priceCounty: string | null | undefined;
  requestedCounty: string | null | undefined;
  now?: Date;
}): PriceRelevance {
  const now = args.now ?? new Date();
  const notes: string[] = [];

  const ageMonths = args.observedDate ? monthsBetween(args.observedDate, now) : null;
  const observed = args.observedDate ? new Date(args.observedDate) : null;
  let age: PriceAge;
  if (ageMonths == null || !observed) {
    age = "undated";
    notes.push("Price date not recorded");
  } else if (observed < monthsBefore(now, PRICE_STALE_MONTHS)) {
    age = "stale";
    notes.push(`${ageMonths} months old: likely out of date`);
  } else if (observed < monthsBefore(now, PRICE_AGEING_MONTHS)) {
    age = "ageing";
    notes.push(`${ageMonths} months old`);
  } else {
    age = "current";
  }

  let place: PricePlace;
  const requested = args.requestedCounty?.trim();
  if (!requested) {
    place = "no_county_chosen";
  } else if (!args.priceCounty?.trim()) {
    place = "unspecified";
    notes.push("Location of this price not recorded");
  } else if (countyCovers(args.priceCounty, requested)) {
    place = "local";
  } else {
    place = "elsewhere";
    notes.push(`${args.priceCounty.trim()} price used for ${requested}`);
  }

  return { ageMonths, age, place, notes };
}

/** Counts for the banner above a priced table. */
export function relevanceSummary(items: PriceRelevance[]) {
  return {
    priced: items.length,
    stale: items.filter((i) => i.age === "stale").length,
    ageing: items.filter((i) => i.age === "ageing").length,
    undated: items.filter((i) => i.age === "undated").length,
    elsewhere: items.filter((i) => i.place === "elsewhere").length,
    unspecified: items.filter((i) => i.place === "unspecified").length,
  };
}
