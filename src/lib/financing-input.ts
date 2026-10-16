import type { Database } from "@/integrations/supabase/types";

type FinancingInsert = Database["public"]["Tables"]["financing_applications"]["Insert"];

export const APPLICANT_FINANCING_STATUSES = ["draft", "submitted", "withdrawn"] as const;
const applicantFields = new Set([
  "borrower_name",
  "borrower_email",
  "borrower_phone",
  "monthly_income",
  "employment_status",
  "requested_amount",
  "currency",
  "purpose",
  "tenure_months",
  "property_value",
  "property_address",
  "property_id",
  "notes",
  "documents",
  "consultation_requested_at",
  "status",
]);

/** Defence in depth only: database enforcement must independently protect decisions. */
export function applicantFinancingPatch(patch: Partial<FinancingInsert>): Partial<FinancingInsert> {
  for (const key of Object.keys(patch)) {
    if (!applicantFields.has(key))
      throw new Error(`Applicants cannot update financing field: ${key}`);
  }
  if (patch.status !== undefined && !APPLICANT_FINANCING_STATUSES.some((s) => s === patch.status)) {
    throw new Error("Financing decisions can only be set by an authorized backend process");
  }
  return { ...patch };
}
