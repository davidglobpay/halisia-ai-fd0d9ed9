/**
 * Secure document vault for investment / construction-finance readiness.
 *
 * Files live in the private `finance-vault` storage bucket under the owner's
 * user id, so only that owner can read them. Sharing is explicit and audited:
 * every share names a party, a purpose and an expiry, and the download link
 * handed to that party is a short-lived signed URL, never a public URL.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type VaultDocument = Database["public"]["Tables"]["vault_documents"]["Row"];
export type VaultShare = Database["public"]["Tables"]["vault_document_shares"]["Row"];

export const VAULT_BUCKET = "finance-vault";

export const DOCUMENT_CATEGORIES: { value: string; label: string }[] = [
  { value: "title", label: "Title deed / ownership" },
  { value: "search", label: "Official land search" },
  { value: "survey", label: "Survey / mutation" },
  { value: "valuation", label: "Valuation report" },
  { value: "approvals", label: "County approvals" },
  { value: "identity", label: "Identity & KRA PIN" },
  { value: "financials", label: "Financial statements" },
  { value: "bill_of_quantities", label: "Bill of quantities" },
  { value: "other", label: "Other" },
];

/** Standard checklist a Kenyan lender will usually ask for. */
export const REQUIRED_DOCUMENTS: { label: string; category: string }[] = [
  { label: "Copy of title deed", category: "title" },
  { label: "Official land search (within 3 months)", category: "search" },
  { label: "Survey map / mutation form", category: "survey" },
  { label: "Valuation report", category: "valuation" },
  { label: "National ID & KRA PIN", category: "identity" },
  { label: "6 months bank statements", category: "financials" },
];

export const DOCUMENT_STATUSES: { value: string; label: string }[] = [
  { value: "required", label: "Required" },
  { value: "uploaded", label: "Uploaded" },
  { value: "shared", label: "Shared" },
  { value: "verified", label: "Verified" },
];

export function categoryLabel(v: string): string {
  return DOCUMENT_CATEGORIES.find((c) => c.value === v)?.label ?? v;
}

export async function listVaultDocuments(filter?: {
  propertyId?: string | null;
  financingId?: string | null;
}): Promise<VaultDocument[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  let q = supabase
    .from("vault_documents")
    .select("*")
    .eq("owner_id", u.user.id)
    .order("created_at", { ascending: false });
  if (filter?.propertyId) q = q.eq("property_id", filter.propertyId);
  if (filter?.financingId) q = q.eq("financing_application_id", filter.financingId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createVaultDocument(input: {
  label: string;
  category: string;
  propertyId?: string | null;
  financingId?: string | null;
  notes?: string | null;
}): Promise<VaultDocument> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sign in to manage your document vault");
  const { data, error } = await supabase
    .from("vault_documents")
    .insert({
      owner_id: u.user.id,
      label: input.label,
      category: input.category,
      property_id: input.propertyId ?? null,
      financing_application_id: input.financingId ?? null,
      notes: input.notes ?? null,
      status: "required",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Uploads a file into the caller's private folder and links it to a document row. */
export async function uploadVaultFile(documentId: string, file: File): Promise<VaultDocument> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sign in to upload documents");
  if (file.size > 25 * 1024 * 1024) throw new Error("File is larger than 25MB");
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const path = `${u.user.id}/${documentId}/${Date.now()}-${safe}`;
  const { error: upErr } = await supabase.storage
    .from(VAULT_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
  if (upErr) throw upErr;
  const { data, error } = await supabase
    .from("vault_documents")
    .update({
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      status: "uploaded",
    })
    .eq("id", documentId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateVaultDocument(
  id: string,
  patch: Partial<Pick<VaultDocument, "label" | "category" | "status" | "notes">>,
): Promise<VaultDocument> {
  const { data, error } = await supabase
    .from("vault_documents")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteVaultDocument(doc: VaultDocument): Promise<void> {
  if (doc.storage_path)
    await supabase.storage.from(VAULT_BUCKET).remove([doc.storage_path]).catch(() => undefined);
  const { error } = await supabase.from("vault_documents").delete().eq("id", doc.id);
  if (error) throw error;
}

/** Short-lived signed URL — never a public link. */
export async function signedVaultUrl(doc: VaultDocument, expiresInSec = 900): Promise<string> {
  if (!doc.storage_path) throw new Error("No file uploaded for this document yet");
  const { data, error } = await supabase.storage
    .from(VAULT_BUCKET)
    .createSignedUrl(doc.storage_path, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}

export async function listShares(documentId: string): Promise<VaultShare[]> {
  const { data, error } = await supabase
    .from("vault_document_shares")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function shareDocument(input: {
  documentId: string;
  partyName: string;
  partyEmail: string;
  organisation?: string | null;
  purpose?: string | null;
  expiresInDays: number;
}): Promise<{ share: VaultShare; link: string }> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sign in to share documents");
  const expires = new Date(Date.now() + input.expiresInDays * 86400_000).toISOString();
  const { data, error } = await supabase
    .from("vault_document_shares")
    .insert({
      document_id: input.documentId,
      owner_id: u.user.id,
      party_name: input.partyName,
      party_email: input.partyEmail,
      organisation: input.organisation ?? null,
      purpose: input.purpose ?? null,
      expires_at: expires,
    })
    .select()
    .single();
  if (error) throw error;

  const { data: doc } = await supabase
    .from("vault_documents")
    .select("*")
    .eq("id", input.documentId)
    .maybeSingle();
  let link = "";
  if (doc?.storage_path) {
    const seconds = Math.min(input.expiresInDays * 86400, 7 * 86400);
    link = await signedVaultUrl(doc, seconds).catch(() => "");
  }
  if (doc) await updateVaultDocument(doc.id, { status: "shared" }).catch(() => undefined);
  return { share: data, link };
}

export async function revokeShare(id: string): Promise<void> {
  const { error } = await supabase
    .from("vault_document_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export function shareState(s: VaultShare): "revoked" | "expired" | "active" {
  if (s.revoked_at) return "revoked";
  if (s.expires_at && new Date(s.expires_at).getTime() < Date.now()) return "expired";
  return "active";
}

export function formatBytes(n: number | null): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
