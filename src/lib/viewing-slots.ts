/**
 * Booking-style viewing workflow.
 *
 * Landlords publish concrete time slots; renters request a slot and the
 * landlord confirms or declines. Requests reuse the existing `viewings` table
 * so leads, notifications and the dashboard keep working.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ViewingSlot = Database["public"]["Tables"]["viewing_slots"]["Row"];
export type ViewingRequest = Database["public"]["Tables"]["viewings"]["Row"];

export const REQUEST_STATUSES = ["requested", "confirmed", "declined", "cancelled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export function slotLabel(s: Pick<ViewingSlot, "start_at" | "end_at">): string {
  const start = new Date(s.start_at);
  const end = new Date(s.end_at);
  const d = start.toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" });
  const t = (x: Date) => x.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
  return `${d} · ${t(start)}–${t(end)}`;
}

export function isPast(s: Pick<ViewingSlot, "start_at">): boolean {
  return new Date(s.start_at).getTime() < Date.now();
}

export async function listSlots(propertyId: string): Promise<ViewingSlot[]> {
  const { data, error } = await supabase
    .from("viewing_slots")
    .select("*")
    .eq("property_id", propertyId)
    .order("start_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createSlot(input: {
  propertyId: string;
  startAt: string;
  endAt: string;
  capacity?: number;
  note?: string | null;
}): Promise<ViewingSlot> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sign in to propose viewing slots");
  if (new Date(input.endAt) <= new Date(input.startAt))
    throw new Error("The slot must end after it starts");
  const { data, error } = await supabase
    .from("viewing_slots")
    .insert({
      property_id: input.propertyId,
      owner_id: u.user.id,
      start_at: input.startAt,
      end_at: input.endAt,
      capacity: Math.max(1, input.capacity ?? 1),
      note: input.note ?? null,
      status: "open",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSlot(id: string, patch: Partial<ViewingSlot>): Promise<ViewingSlot> {
  const { data, error } = await supabase
    .from("viewing_slots")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSlot(id: string): Promise<void> {
  const { error } = await supabase.from("viewing_slots").delete().eq("id", id);
  if (error) throw error;
}

/** All requests against a property's slots (landlord view). */
export async function listRequestsForProperty(propertyId: string): Promise<ViewingRequest[]> {
  const { data, error } = await supabase
    .from("viewings")
    .select("*")
    .eq("property_id", propertyId)
    .order("scheduled_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** The signed-in renter's own requests. */
export async function listMyRequests(): Promise<ViewingRequest[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data, error } = await supabase
    .from("viewings")
    .select("*")
    .eq("buyer_id", u.user.id)
    .order("scheduled_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function requestSlot(input: {
  slot: ViewingSlot;
  notes?: string | null;
}): Promise<ViewingRequest> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sign in to request a viewing");
  const { data, error } = await supabase
    .from("viewings")
    .insert({
      property_id: input.slot.property_id,
      seller_id: input.slot.owner_id,
      buyer_id: u.user.id,
      slot_id: input.slot.id,
      scheduled_at: input.slot.start_at,
      status: "requested",
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setRequestStatus(
  id: string,
  status: RequestStatus,
): Promise<ViewingRequest> {
  const { data, error } = await supabase
    .from("viewings")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function slotSeatsLeft(slot: ViewingSlot, requests: ViewingRequest[]): number {
  const taken = requests.filter(
    (r) => r.slot_id === slot.id && (r.status === "requested" || r.status === "confirmed"),
  ).length;
  return Math.max(0, slot.capacity - taken);
}
