import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { applicantFinancingPatch } from "@/lib/financing-input";
export { APPLICANT_FINANCING_STATUSES } from "@/lib/financing-input";

export type FinancingRow = Database["public"]["Tables"]["financing_applications"]["Row"];
export type FinancingInsert = Database["public"]["Tables"]["financing_applications"]["Insert"];
export type FinancingPurpose = Database["public"]["Enums"]["financing_purpose"];
export type FinancingStatus = Database["public"]["Enums"]["financing_status"];

export const FINANCING_PURPOSES: { value: FinancingPurpose; label: string }[] = [
  { value: "purchase", label: "Land / property purchase" },
  { value: "construction", label: "Construction" },
  { value: "refinance", label: "Refinance" },
  { value: "bridge", label: "Bridge finance" },
  { value: "equity_release", label: "Equity release" },
  { value: "other", label: "Other" },
];

export const FINANCING_STATUSES: { value: FinancingStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "funded", label: "Funded" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];

export async function listMyFinancing(): Promise<FinancingRow[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data, error } = await supabase
    .from("financing_applications")
    .select("*")
    .eq("applicant_id", u.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getFinancing(id: string): Promise<FinancingRow | null> {
  const { data, error } = await supabase
    .from("financing_applications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createFinancing(
  input: Omit<FinancingInsert, "applicant_id">,
): Promise<FinancingRow> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sign in to start a financing application");
  const { data, error } = await supabase
    .from("financing_applications")
    .insert({ ...input, applicant_id: u.user.id, status: "draft" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateFinancing(
  id: string,
  patch: Partial<FinancingInsert>,
): Promise<FinancingRow> {
  const { data, error } = await supabase
    .from("financing_applications")
    .update(applicantFinancingPatch(patch))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFinancing(id: string): Promise<void> {
  const { error } = await supabase.from("financing_applications").delete().eq("id", id);
  if (error) throw error;
}

export function formatMoney(n: number | null | undefined, currency = "KES"): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${currency} ${new Intl.NumberFormat("en-KE").format(Number(n))}`;
}
