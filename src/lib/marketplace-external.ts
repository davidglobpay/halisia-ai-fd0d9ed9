import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ExternalListingRow =
  Database["public"]["Tables"]["marketplace_external_listings"]["Row"];
export type SourceRow = Database["public"]["Tables"]["marketplace_sources"]["Row"];
export type ListingCategory = Database["public"]["Enums"]["mkt_listing_category"];
export type ListingIntentExternal = Database["public"]["Enums"]["mkt_listing_intent"];

/** The subset of source fields the UI is allowed to act on. */
export type PartnerSource = Pick<
  SourceRow,
  | "id"
  | "name"
  | "slug"
  | "website_url"
  | "logo_url"
  | "source_type"
  | "integration_mode"
  | "commercial_status"
  | "can_display_images"
  | "can_display_description"
  | "rights_basis"
>;

export type PartnerListing = ExternalListingRow & { source: PartnerSource | null };

const SOURCE_FIELDS =
  "id, name, slug, website_url, logo_url, source_type, integration_mode, commercial_status, can_display_images, can_display_description, rights_basis";

export type PartnerFilters = {
  county?: string;
  category?: ListingCategory | "all";
  intent?: ListingIntentExternal | "all";
  sourceId?: string;
  maxPrice?: number;
};

/**
 * Active partner listings. Row-level security already restricts this to
 * listings whose source is active, so no source filter is applied here.
 */
export async function listPartnerListings(filters: PartnerFilters = {}): Promise<PartnerListing[]> {
  let query = supabase
    .from("marketplace_external_listings")
    .select(`*, source:marketplace_sources(${SOURCE_FIELDS})`)
    .eq("active", true)
    .order("source_checked_at", { ascending: false, nullsFirst: false })
    .limit(200);

  if (filters.county) query = query.eq("county", filters.county);
  if (filters.category && filters.category !== "all")
    query = query.eq("listing_category", filters.category);
  if (filters.intent && filters.intent !== "all") query = query.eq("intent", filters.intent);
  if (filters.sourceId) query = query.eq("source_id", filters.sourceId);
  if (filters.maxPrice != null) query = query.lte("price", filters.maxPrice);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as PartnerListing[];
}

export async function getPartnerListing(id: string): Promise<PartnerListing | null> {
  const { data, error } = await supabase
    .from("marketplace_external_listings")
    .select(`*, source:marketplace_sources(${SOURCE_FIELDS})`)
    .eq("id", id)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as PartnerListing) ?? null;
}

/** The link out to the source, when one has been recorded. */
export function partnerUrl(
  row: Pick<ExternalListingRow, "original_listing_url" | "canonical_url">,
) {
  const raw = row.original_listing_url ?? row.canonical_url;
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : null;
}

/** Adds the referral code without clobbering a query string the source already uses. */
export function withReferral(url: string, code: string | null): string {
  if (!code) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("ref", code);
    return u.toString();
  } catch {
    return url;
  }
}

export function formatPartnerPrice(
  row: Pick<ExternalListingRow, "price" | "currency" | "price_qualifier" | "intent">,
): string {
  if (row.price == null) return "Price on request";
  const n = new Intl.NumberFormat("en-KE").format(Number(row.price));
  const per = row.intent === "rent" ? " / mo" : "";
  const qualifier = row.price_qualifier ? ` ${row.price_qualifier}` : "";
  return `${row.currency ?? "KES"} ${n}${per}${qualifier}`;
}

export function formatSize(
  row: Pick<ExternalListingRow, "size_value" | "size_unit">,
): string | null {
  if (row.size_value == null) return null;
  return `${new Intl.NumberFormat("en-KE").format(Number(row.size_value))} ${row.size_unit ?? ""}`.trim();
}

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

/** True when the source has not been re-checked recently, or says so itself. */
export function mayBeOutOfDate(
  row: Pick<ExternalListingRow, "freshness" | "source_checked_at">,
): boolean {
  if (row.freshness === "stale" || row.freshness === "expired") return true;
  if (!row.source_checked_at) return true;
  return Date.now() - new Date(row.source_checked_at).getTime() > THIRTY_DAYS;
}

export function formatCheckedDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  });
}

export const CATEGORY_LABELS: Record<string, string> = {
  land: "Land",
  house: "House",
  apartment: "Apartment",
  commercial: "Commercial",
  industrial: "Industrial",
  agricultural: "Agricultural",
  offplan: "Off-plan",
  affordable_housing: "Affordable housing",
  rental: "Rental",
  development: "Development",
  other: "Other",
};

export const INTENT_LABELS: Record<string, string> = {
  sale: "For sale",
  rent: "To rent",
  lease: "For lease",
  apply: "Apply",
};

export const AVAILABILITY_LABELS: Record<string, string> = {
  available: "Available",
  reserved: "Reserved",
  sold: "Sold",
  let: "Let",
  withdrawn: "Withdrawn",
  unknown: "Availability unknown",
};

export type ReferralHandle = { id: string; referral_code: string; expires_at: string };

/** Records the click-out. Callers must never block the visitor when this fails. */
export async function createReferral(
  sourceId: string,
  externalListingId: string,
): Promise<ReferralHandle | null> {
  const { data, error } = await supabase.rpc("mkt_create_referral", {
    p_source_id: sourceId,
    p_external_listing_id: externalListingId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  return (row as ReferralHandle) ?? null;
}

export type PartnerLeadInput = {
  fullName: string;
  consentPartnerContact: boolean;
  email?: string;
  phone?: string;
  message?: string;
  enquiryType?: string;
  externalListingId?: string;
  referralId?: string;
  consentMarketing?: boolean;
};

/**
 * The database rejects this outright unless partner-contact consent is true,
 * so the form must keep its submit disabled until the box is ticked.
 */
export async function createPartnerLead(input: PartnerLeadInput): Promise<string> {
  const { data, error } = await supabase.rpc("mkt_create_lead", {
    p_full_name: input.fullName,
    p_consent_partner_contact: input.consentPartnerContact,
    p_email: input.email,
    p_phone: input.phone,
    p_message: input.message,
    p_enquiry_type: input.enquiryType,
    p_external_listing_id: input.externalListingId,
    p_referral_id: input.referralId,
    p_consent_marketing: input.consentMarketing ?? false,
  });
  if (error) throw error;
  return data as string;
}
