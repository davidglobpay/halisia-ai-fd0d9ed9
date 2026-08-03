import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

export type InsuranceBriefRow = Database["public"]["Tables"]["insurance_briefs"]["Row"];

export type InsuranceRisk = {
  name: string;
  severity: "low" | "moderate" | "high";
  description: string;
  confidencePct: number;
};

export type InsuranceAiOutput = {
  keyRisks: InsuranceRisk[];
  recommendedCoverage: string[];
  questionsForInsurer: string[];
  overallConfidencePct: number;
  disclaimers: string[];
  generatedAt: string;
};

export async function getInsuranceBrief(propertyId: string): Promise<InsuranceBriefRow | null> {
  const { data, error } = await supabase
    .from("insurance_briefs")
    .select("*")
    .eq("property_id", propertyId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertInsuranceBrief(
  propertyId: string,
  ai: InsuranceAiOutput,
): Promise<InsuranceBriefRow> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sign in to generate a brief");
  const { data, error } = await supabase
    .from("insurance_briefs")
    .upsert(
      {
        property_id: propertyId,
        generated_by: u.user.id,
        ai_output: ai as unknown as Json,
      },
      { onConflict: "property_id" },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
