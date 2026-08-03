import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type RentalDetails = Database["public"]["Tables"]["rental_details"]["Row"];
export type RentalDetailsInsert = Database["public"]["Tables"]["rental_details"]["Insert"];

export const FURNISHING_OPTIONS = ["Unfurnished", "Semi-furnished", "Fully furnished"];

export const RENTAL_UTILITIES = [
  "Water included",
  "Electricity included",
  "Internet included",
  "Garbage collection",
  "Borehole backup",
  "Solar water heating",
];

export const SECURITY_FEATURES = [
  "24/7 manned gate",
  "CCTV",
  "Electric fence",
  "Perimeter wall",
  "Intercom",
  "Alarm system",
  "Backup generator",
];

export const ACCESSIBILITY_FEATURES = [
  "Step-free entrance",
  "Lift / elevator",
  "Wide doorways",
  "Ground-floor unit",
  "Accessible bathroom",
  "Reserved accessible parking",
];

export async function getRentalDetails(propertyId: string): Promise<RentalDetails | null> {
  const { data, error } = await supabase
    .from("rental_details")
    .select("*")
    .eq("property_id", propertyId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertRentalDetails(input: RentalDetailsInsert): Promise<RentalDetails> {
  const { data, error } = await supabase
    .from("rental_details")
    .upsert(input, { onConflict: "property_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type RentalListing = {
  property: Database["public"]["Tables"]["properties"]["Row"];
  rental: RentalDetails | null;
};

/** Published rental/lease listings joined with their vacancy details. */
export async function listRentalVacancies(): Promise<RentalListing[]> {
  const { data: props, error } = await supabase
    .from("properties")
    .select("*")
    .eq("status", "published")
    .in("intent", ["rent", "lease"])
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) throw error;
  const rows = props ?? [];
  if (rows.length === 0) return [];
  const { data: details } = await supabase
    .from("rental_details")
    .select("*")
    .in(
      "property_id",
      rows.map((r) => r.id),
    );
  const map = new Map((details ?? []).map((d) => [d.property_id, d]));
  return rows.map((property) => ({ property, rental: map.get(property.id) ?? null }));
}

export function formatRent(r: RentalDetails | null, fallbackCurrency = "KES"): string {
  if (!r?.monthly_rent) return "Rent on request";
  const n = new Intl.NumberFormat("en-KE").format(Number(r.monthly_rent));
  return `${r.currency || fallbackCurrency} ${n} / mo`;
}
