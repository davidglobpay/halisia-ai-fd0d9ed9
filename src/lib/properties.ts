import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PropertyRow = Database["public"]["Tables"]["properties"]["Row"];
export type PropertyInsert = Database["public"]["Tables"]["properties"]["Insert"];
export type PropertyKind = Database["public"]["Enums"]["property_kind"];
export type PropertyStatus = Database["public"]["Enums"]["property_status"];
export type ListingIntent = Database["public"]["Enums"]["listing_intent"];
export type LeadRow = Database["public"]["Tables"]["leads"]["Row"];

export type PropertyFilters = {
  kind?: PropertyKind | "all";
  intent?: ListingIntent | "all";
  county?: string;
  minPrice?: number;
  maxPrice?: number;
  minSize?: number;
  q?: string;
};

export async function listProperties(filters: PropertyFilters = {}): Promise<PropertyRow[]> {
  let query = supabase
    .from("properties")
    .select("*")
    .eq("status", "published")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60);

  if (filters.kind && filters.kind !== "all") query = query.eq("kind", filters.kind);
  if (filters.intent && filters.intent !== "all") query = query.eq("intent", filters.intent);
  if (filters.county) query = query.eq("county", filters.county);
  if (filters.minPrice != null) query = query.gte("price", filters.minPrice);
  if (filters.maxPrice != null) query = query.lte("price", filters.maxPrice);
  if (filters.minSize != null) query = query.gte("size_value", filters.minSize);
  if (filters.q) query = query.ilike("title", `%${filters.q}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getProperty(id: string): Promise<PropertyRow | null> {
  const { data, error } = await supabase.from("properties").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listMyProperties(): Promise<PropertyRow[]> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return [];
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("owner_id", userRes.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createProperty(
  input: Omit<PropertyInsert, "owner_id">,
): Promise<PropertyRow> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) throw new Error("Sign in to create a listing");
  const { data, error } = await supabase
    .from("properties")
    .insert({ ...input, owner_id: userRes.user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProperty(
  id: string,
  patch: Partial<PropertyInsert>,
): Promise<PropertyRow> {
  const { data, error } = await supabase
    .from("properties")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createLead(input: {
  property_id: string;
  seller_id: string;
  message: string;
  contact_email?: string;
  contact_phone?: string;
}): Promise<LeadRow> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) throw new Error("Sign in to contact the seller");
  const { data, error } = await supabase
    .from("leads")
    .insert({
      property_id: input.property_id,
      seller_id: input.seller_id,
      buyer_id: userRes.user.id,
      message: input.message,
      contact_email: input.contact_email ?? null,
      contact_phone: input.contact_phone ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listMyLeadsAsSeller(): Promise<LeadRow[]> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return [];
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("seller_id", userRes.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export const PROPERTY_KINDS: { value: PropertyKind; label: string }[] = [
  { value: "land", label: "Land" },
  { value: "house", label: "House" },
  { value: "apartment", label: "Apartment" },
  { value: "rental", label: "Rental" },
  { value: "commercial", label: "Commercial" },
  { value: "industrial", label: "Industrial" },
  { value: "agricultural", label: "Agricultural" },
  { value: "mixed_use", label: "Mixed use" },
  { value: "other", label: "Other" },
];

export const INTENTS: { value: ListingIntent; label: string }[] = [
  { value: "sale", label: "For sale" },
  { value: "rent", label: "For rent" },
  { value: "lease", label: "For lease" },
];

export function formatPrice(row: Pick<PropertyRow, "price" | "currency" | "intent">): string {
  if (row.price == null) return "Price on request";
  const n = new Intl.NumberFormat("en-KE").format(Number(row.price));
  const suffix = row.intent === "rent" ? " / mo" : "";
  return `${row.currency} ${n}${suffix}`;
}
