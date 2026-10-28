/**
 * Runtime validation for server functions that previously trusted a type cast.
 *
 * Each of these inputs is placed into an AI prompt or an outside API call, so
 * an unchecked payload could be arbitrarily large (cost) or the wrong shape
 * (crashes, nonsense prompts). The schemas check types and cap sizes but stay
 * permissive about extra keys, so existing callers keep working unchanged.
 */
import { z } from "zod";

const LIST_MAX = 60;

/** Accepts finite numbers, numeric strings ("1200"), null and undefined. */
const optNum = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : v),
  z.number().finite().nullish(),
);
const num = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : v),
  z.number().finite(),
);
const str = (max: number) => z.string().max(max);
const optStr = (max: number) => z.string().max(max).nullish();
// Listing rows can hold null for empty arrays, so null is accepted.
const strList = z.array(z.string().max(200)).max(LIST_MAX).nullish();

export const LenderSummarySchema = z
  .object({
    borrower_name: str(200),
    borrower_email: optStr(320),
    borrower_phone: optStr(40),
    monthly_income: optNum,
    employment_status: optStr(120),
    requested_amount: num,
    currency: str(8),
    purpose: str(60),
    tenure_months: optNum,
    property_value: optNum,
    property_address: optStr(500),
    notes: optStr(4000),
  })
  .passthrough();

export const ConceptSchema = z
  .object({
    title: str(300),
    county: optStr(80),
    address: optStr(500),
    kind: str(60),
    size_value: optNum,
    size_unit: optStr(30),
    price: optNum,
    currency: optStr(8),
    utilities: strList,
    amenities: strList,
    access_type: optStr(120),
    slopeHint: optStr(300),
    goal: optStr(300),
    budget: optNum,
    clarifications: strList,
  })
  .passthrough();

export const InsuranceBriefSchema = z
  .object({
    title: str(300),
    kind: str(60),
    county: optStr(80),
    address: optStr(500),
    latitude: optNum,
    longitude: optNum,
    size_value: optNum,
    size_unit: optStr(30),
    amenities: strList,
    utilities: strList,
    access_type: optStr(120),
  })
  .passthrough();

export const ListingAiSchema = z
  .object({
    title: str(300),
    description: optStr(8000),
    kind: str(60),
    intent: str(30),
    price: optNum,
    currency: optStr(8),
    size_value: optNum,
    size_unit: optStr(30),
    county: optStr(80),
    address: optStr(500),
    latitude: optNum,
    longitude: optNum,
    amenities: strList,
    utilities: strList,
    access_type: optStr(120),
  })
  .passthrough();

export const GeotechSchema = z
  .object({
    lat: num.pipe(z.number().min(-90).max(90)),
    lng: num.pipe(z.number().min(-180).max(180)),
  })
  .passthrough();

export const CoachSchema = z
  .object({
    title: str(300),
    description: optStr(8000),
    kind: str(60),
    intent: str(30),
    county: optStr(80),
    address: optStr(500),
    price: optNum,
    monthly_rent: optNum,
    currency: optStr(8),
    size_value: optNum,
    size_unit: optStr(30),
    bedrooms: optNum,
    bathrooms: optNum,
    amenities: strList,
    utilities: strList,
    access_type: optStr(120),
    photos: optNum,
    hasPin: z.boolean().optional(),
    missingKeys: strList,
    clarifications: strList,
  })
  .passthrough();

export const BriefSchema = z
  .object({
    goal: str(500),
    intendedUse: str(300),
    siteAreaSqm: optNum,
    buildableAreaSqm: optNum,
    maxFootprintSqm: optNum,
    maxFloors: optNum,
    budgetKes: optNum,
    options: z
      .array(
        z
          .object({
            id: str(80),
            name: str(200),
            floors: num,
            footprintSqm: num,
            unitCount: num,
          })
          .passthrough(),
      )
      .max(20),
  })
  .passthrough();

const count = num.pipe(z.number().int().min(0).max(100_000));

export const NarrativeSchema = z
  .object({
    address: str(500),
    lat: num.pipe(z.number().min(-90).max(90)),
    lng: num.pipe(z.number().min(-180).max(180)),
    elevationM: optNum,
    airQuality: z
      .object({
        aqi: optNum,
        category: optStr(80),
        dominant: optStr(80),
      })
      .passthrough()
      .nullish(),
    counts: z
      .object({
        schools: count,
        hospitals: count,
        groceries: count,
        transit: count,
        restaurants: count,
        banks: count,
      })
      .passthrough(),
  })
  .passthrough();

/** Parse or throw a short, safe message (never echoes the payload). */
export function parseServerInput<T>(schema: z.ZodTypeAny, input: unknown, name: string): T {
  const r = schema.safeParse(input);
  if (!r.success) {
    const where = r.error.issues
      .slice(0, 3)
      .map((i) => i.path.join(".") || "(root)")
      .join(", ");
    throw new Error(`Invalid ${name} input: ${where}`);
  }
  return r.data as T;
}
