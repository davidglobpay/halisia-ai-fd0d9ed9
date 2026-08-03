import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Contribution = Database["public"]["Tables"]["contributions"]["Row"];

export const CONTRIBUTION_KINDS = [
  {
    value: "correction",
    label: "Data correction",
    blurb: "Fix an inaccurate amenity, boundary or price signal.",
  },
  {
    value: "local_knowledge",
    label: "Local knowledge",
    blurb: "On-the-ground context a dataset cannot capture.",
  },
  {
    value: "photo_evidence",
    label: "Photo evidence",
    blurb: "Site or neighbourhood imagery with a location.",
  },
  {
    value: "amenity",
    label: "New amenity",
    blurb: "A school, clinic, market or facility that is missing.",
  },
  {
    value: "risk_report",
    label: "Risk report",
    blurb: "Flooding, access, insecurity or land dispute signals.",
  },
] as const;

export async function listMyContributions(): Promise<Contribution[]> {
  const { data, error } = await supabase
    .from("contributions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createContribution(input: {
  kind: string;
  title: string;
  body?: string | null;
  county?: string | null;
  ref?: string | null;
}): Promise<Contribution> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) throw new Error("Sign in to contribute");
  const { data, error } = await supabase
    .from("contributions")
    .insert({ ...input, user_id: userRes.user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type ReputationSummary = {
  points: number;
  accepted: number;
  pending: number;
  rejected: number;
  acceptanceRate: number | null;
  qualityAvg: number | null;
  tier: "Newcomer" | "Trusted" | "Expert" | "Custodian";
  impact: string;
};

export function summariseReputation(rows: Contribution[]): ReputationSummary {
  const accepted = rows.filter((r) => r.status === "accepted").length;
  const pending = rows.filter((r) => r.status === "pending").length;
  const rejected = rows.filter((r) => r.status === "rejected").length;
  const reviewed = accepted + rejected;
  const points = rows.reduce((s, r) => s + (r.reward_points ?? 0), 0);
  const scored = rows.filter((r) => typeof r.quality_score === "number");
  const qualityAvg = scored.length
    ? Math.round((scored.reduce((s, r) => s + (r.quality_score ?? 0), 0) / scored.length) * 10) / 10
    : null;
  const tier =
    points >= 500 ? "Custodian" : points >= 200 ? "Expert" : points >= 50 ? "Trusted" : "Newcomer";
  return {
    points,
    accepted,
    pending,
    rejected,
    acceptanceRate: reviewed ? Math.round((accepted / reviewed) * 100) : null,
    qualityAvg,
    tier,
    impact:
      accepted === 0
        ? "Your first accepted contribution will start improving scores for everyone searching that area."
        : `${accepted} accepted ${accepted === 1 ? "contribution is" : "contributions are"} now feeding location intelligence for other users.`,
  };
}
