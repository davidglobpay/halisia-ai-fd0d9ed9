import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type BidRequestRow = Database["public"]["Tables"]["bid_requests"]["Row"];
export type BidRequestInsert = Database["public"]["Tables"]["bid_requests"]["Insert"];
export type BidProposalRow = Database["public"]["Tables"]["bid_proposals"]["Row"];
export type BidProposalInsert = Database["public"]["Tables"]["bid_proposals"]["Insert"];
export type BidCategory = Database["public"]["Enums"]["bid_category"];
export type BidRequestStatus = Database["public"]["Enums"]["bid_request_status"];
export type BidProposalStatus = Database["public"]["Enums"]["bid_proposal_status"];

export const BID_CATEGORIES: { value: BidCategory; label: string }[] = [
  { value: "construction", label: "Construction" },
  { value: "architecture", label: "Architecture" },
  { value: "surveying", label: "Surveying" },
  { value: "engineering", label: "Engineering" },
  { value: "landscaping", label: "Landscaping" },
  { value: "legal", label: "Legal" },
  { value: "other", label: "Other" },
];

export async function listMyBidRequests(): Promise<BidRequestRow[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data, error } = await supabase
    .from("bid_requests")
    .select("*")
    .eq("owner_id", u.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listOpenBidRequests(): Promise<BidRequestRow[]> {
  const { data, error } = await supabase
    .from("bid_requests")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  return data ?? [];
}

export async function listBidRequestsForProperty(propertyId: string): Promise<BidRequestRow[]> {
  const { data, error } = await supabase
    .from("bid_requests")
    .select("*")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createBidRequest(
  input: Omit<BidRequestInsert, "owner_id">,
): Promise<BidRequestRow> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sign in to request bids");
  const { data, error } = await supabase
    .from("bid_requests")
    .insert({ ...input, owner_id: u.user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBidRequestStatus(
  id: string,
  status: BidRequestStatus,
): Promise<BidRequestRow> {
  const { data, error } = await supabase
    .from("bid_requests")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listProposals(bidRequestId: string): Promise<BidProposalRow[]> {
  const { data, error } = await supabase
    .from("bid_proposals")
    .select("*")
    .eq("bid_request_id", bidRequestId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listMyProposals(): Promise<BidProposalRow[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data, error } = await supabase
    .from("bid_proposals")
    .select("*")
    .eq("provider_id", u.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function submitProposal(
  input: Omit<BidProposalInsert, "provider_id">,
): Promise<BidProposalRow> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sign in to submit a proposal");
  const { data, error } = await supabase
    .from("bid_proposals")
    .insert({ ...input, provider_id: u.user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProposalStatus(
  id: string,
  status: BidProposalStatus,
): Promise<BidProposalRow> {
  const { data, error } = await supabase
    .from("bid_proposals")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}