import { supabase } from "@/integrations/supabase/client";
import type { SavedReport } from "@/lib/saved-items";

export type ReportCollection = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
};

export type CollectionItem = { collection_id: string; saved_item_id: string };

export type ReportShare = {
  id: string;
  saved_item_id: string;
  token: string;
  recipient_email: string;
  label: string;
  latitude: number | null;
  longitude: number | null;
  deed_ref: string | null;
  note: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  last_accessed_at: string | null;
  created_at: string;
};

export type ReportVersion = {
  id: string;
  saved_item_id: string;
  version: number;
  summary: string;
  changes: Array<{ field: string; from: string | null; to: string | null }>;
  created_at: string;
};

async function requireUser() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Sign in to continue");
  return data.user;
}

/* -------------------------------- collections ------------------------------- */

export async function listCollections(): Promise<ReportCollection[]> {
  const { data, error } = await supabase
    .from("report_collections")
    .select("id,name,description,color,created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ReportCollection[];
}

export async function createCollection(input: {
  name: string;
  description?: string | null;
  color?: string | null;
}): Promise<ReportCollection> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("report_collections")
    .insert({
      user_id: user.id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      color: input.color ?? null,
    })
    .select("id,name,description,color,created_at")
    .single();
  if (error) throw error;
  return data as ReportCollection;
}

export async function renameCollection(id: string, name: string) {
  const { error } = await supabase
    .from("report_collections")
    .update({ name: name.trim() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCollection(id: string) {
  const { error } = await supabase.from("report_collections").delete().eq("id", id);
  if (error) throw error;
}

export async function listCollectionItems(): Promise<CollectionItem[]> {
  const { data, error } = await supabase
    .from("report_collection_items")
    .select("collection_id,saved_item_id");
  if (error) throw error;
  return (data ?? []) as CollectionItem[];
}

export async function addToCollection(collectionId: string, savedItemId: string) {
  const user = await requireUser();
  const { error } = await supabase
    .from("report_collection_items")
    .insert({ collection_id: collectionId, saved_item_id: savedItemId, user_id: user.id });
  if (error && error.code !== "23505") throw error;
}

export async function removeFromCollection(collectionId: string, savedItemId: string) {
  const { error } = await supabase
    .from("report_collection_items")
    .delete()
    .eq("collection_id", collectionId)
    .eq("saved_item_id", savedItemId);
  if (error) throw error;
}

/* ---------------------------------- shares ---------------------------------- */

function makeToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function listShares(savedItemId?: string): Promise<ReportShare[]> {
  let query = supabase
    .from("report_shares")
    .select("*")
    .order("created_at", { ascending: false });
  if (savedItemId) query = query.eq("saved_item_id", savedItemId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ReportShare[];
}

export async function createShare(input: {
  report: SavedReport;
  recipientEmail: string;
  expiresInDays?: number | null;
}): Promise<ReportShare> {
  const user = await requireUser();
  const email = input.recipientEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address");
  const expires =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
      : null;
  const { data, error } = await supabase
    .from("report_shares")
    .insert({
      saved_item_id: input.report.id,
      owner_id: user.id,
      token: makeToken(),
      recipient_email: email,
      label: input.report.label,
      latitude: input.report.lat,
      longitude: input.report.lng,
      deed_ref: input.report.ref || null,
      note: input.report.note,
      expires_at: expires,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ReportShare;
}

export async function revokeShare(id: string) {
  const { error } = await supabase
    .from("report_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export function shareUrl(token: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/shared-report/${token}`;
}

export async function getSharedReport(token: string): Promise<ReportShare | null> {
  const { data, error } = await supabase
    .from("report_shares")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  void supabase
    .from("report_shares")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", data.id);
  return data as ReportShare;
}

/* --------------------------------- versions --------------------------------- */

export async function listVersions(savedItemId: string): Promise<ReportVersion[]> {
  const { data, error } = await supabase
    .from("report_versions")
    .select("id,saved_item_id,version,summary,changes,created_at")
    .eq("saved_item_id", savedItemId)
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ReportVersion[];
}

export async function recordVersion(input: {
  savedItemId: string;
  summary: string;
  changes?: Array<{ field: string; from: string | null; to: string | null }>;
  snapshot?: Record<string, unknown>;
}) {
  const user = await requireUser();
  const { data: last } = await supabase
    .from("report_versions")
    .select("version")
    .eq("saved_item_id", input.savedItemId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const next = (last?.version ?? 0) + 1;
  const { error } = await supabase.from("report_versions").insert({
    saved_item_id: input.savedItemId,
    owner_id: user.id,
    version: next,
    summary: input.summary,
    changes: input.changes ?? [],
    snapshot: (input.snapshot ?? {}) as never,
  });
  if (error) throw error;
}