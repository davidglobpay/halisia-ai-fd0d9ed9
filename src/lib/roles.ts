import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

/** Every account type a person can hold. A user may hold several at once. */
export const ROLE_CATALOG: Array<{
  value: AppRole;
  label: string;
  blurb: string;
  group: "General" | "Owning & selling" | "Professional" | "Institutional";
}> = [
  {
    value: "explorer",
    label: "Explorer",
    blurb: "Browse land and county intelligence.",
    group: "General",
  },
  {
    value: "buyer",
    label: "Buyer",
    blurb: "Shortlist, compare and enquire on properties.",
    group: "General",
  },
  {
    value: "tenant",
    label: "Tenant",
    blurb: "Find rentals and request viewings.",
    group: "General",
  },
  {
    value: "contributor",
    label: "Contributor",
    blurb: "Submit local knowledge and corrections.",
    group: "General",
  },
  {
    value: "landowner",
    label: "Landowner",
    blurb: "Hold and manage parcels.",
    group: "Owning & selling",
  },
  {
    value: "seller",
    label: "Seller",
    blurb: "List land and property for sale.",
    group: "Owning & selling",
  },
  {
    value: "landlord",
    label: "Landlord",
    blurb: "Manage rental vacancies and viewings.",
    group: "Owning & selling",
  },
  {
    value: "land_agent",
    label: "Land agent",
    blurb: "Represent buyers and sellers.",
    group: "Owning & selling",
  },
  {
    value: "property_company",
    label: "Property company",
    blurb: "Operate a portfolio at company scale.",
    group: "Owning & selling",
  },
  {
    value: "developer",
    label: "Developer",
    blurb: "Plan and deliver projects.",
    group: "Owning & selling",
  },
  {
    value: "investor",
    label: "Investor",
    blurb: "Assess returns and finance deals.",
    group: "Owning & selling",
  },
  {
    value: "architect",
    label: "Architect",
    blurb: "Design and concept work.",
    group: "Professional",
  },
  {
    value: "engineer",
    label: "Engineer",
    blurb: "Structural, civil and services engineering.",
    group: "Professional",
  },
  {
    value: "surveyor",
    label: "Surveyor",
    blurb: "Land and quantity surveying.",
    group: "Professional",
  },
  { value: "valuer", label: "Valuer", blurb: "Formal valuation work.", group: "Professional" },
  {
    value: "contractor",
    label: "Contractor",
    blurb: "Build and construction delivery.",
    group: "Professional",
  },
  { value: "lawyer", label: "Lawyer", blurb: "Conveyancing and land law.", group: "Professional" },
  {
    value: "financial_institution",
    label: "Financial institution",
    blurb: "Lending and finance products.",
    group: "Institutional",
  },
  {
    value: "government_partner",
    label: "Government or institutional partner",
    blurb: "Public datasets and oversight.",
    group: "Institutional",
  },
  {
    value: "administrator",
    label: "Administrator",
    blurb: "Platform moderation. Assigned by Halisia only.",
    group: "Institutional",
  },
];

export const ROLE_LABELS: Record<AppRole, string> = ROLE_CATALOG.reduce(
  (acc, r) => ({ ...acc, [r.value]: r.label }),
  {} as Record<AppRole, string>,
);

/** Roles a user may add or remove themselves. Administrator is granted by Halisia. */
export const SELF_ASSIGNABLE: AppRole[] = ROLE_CATALOG.filter(
  (r) => r.value !== "administrator",
).map((r) => r.value);

export const PROFESSIONAL_ROLES: AppRole[] = [
  "architect",
  "engineer",
  "surveyor",
  "valuer",
  "contractor",
  "lawyer",
  "land_agent",
  "financial_institution",
];

export async function listMyRoles(): Promise<AppRole[]> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return [];
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userRes.user.id);
  if (error) throw error;
  return (data ?? []).map((r) => r.role as AppRole);
}

export async function addRole(role: AppRole): Promise<void> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) throw new Error("Sign in to update your account types");
  const { error } = await supabase.from("user_roles").insert({ user_id: userRes.user.id, role });
  if (error && error.code !== "23505") throw error;
}

export async function removeRole(role: AppRole): Promise<void> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) throw new Error("Sign in to update your account types");
  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userRes.user.id)
    .eq("role", role);
  if (error) throw error;
}

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export async function getMyProfile(): Promise<ProfileRow | null> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userRes.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertMyProfile(patch: Partial<ProfileRow>): Promise<ProfileRow> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) throw new Error("Sign in to update your profile");
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ ...patch, id: userRes.user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}
