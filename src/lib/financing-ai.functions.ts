import { createServerFn } from "@tanstack/react-start";
import { parseServerInput, LenderSummarySchema } from "@/lib/server-input";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LenderSummaryInput = {
  borrower_name: string;
  borrower_email?: string | null;
  borrower_phone?: string | null;
  monthly_income?: number | null;
  employment_status?: string | null;
  requested_amount: number;
  currency: string;
  purpose: string;
  tenure_months?: number | null;
  property_value?: number | null;
  property_address?: string | null;
  notes?: string | null;
};

export type LenderSummaryOutput = {
  headline: string;
  loanSnapshot: string;
  borrowerProfile: string;
  propertyOverview: string;
  riskFlags: string[];
  strengths: string[];
  dtiEstimatePct: number | null;
  ltvEstimatePct: number | null;
  recommendedDocuments: string[];
  suggestedLenders: string[];
  disclaimers: string[];
  confidencePct: number;
  generatedAt: string;
};

function heuristic(input: LenderSummaryInput): LenderSummaryOutput {
  const dti =
    input.monthly_income && input.monthly_income > 0 && input.tenure_months
      ? Math.round(
          (input.requested_amount / input.tenure_months / Number(input.monthly_income)) * 100,
        )
      : null;
  const ltv =
    input.property_value && input.property_value > 0
      ? Math.round((input.requested_amount / Number(input.property_value)) * 100)
      : null;
  return {
    headline: `${input.currency} ${new Intl.NumberFormat("en-KE").format(input.requested_amount)} ${input.purpose.replace("_", " ")} facility for ${input.borrower_name}`,
    loanSnapshot: `Requesting ${input.currency} ${input.requested_amount} for ${input.purpose}${input.tenure_months ? ` over ${input.tenure_months} months` : ""}.`,
    borrowerProfile: `${input.borrower_name}${input.employment_status ? `, ${input.employment_status}` : ""}${input.monthly_income ? `, monthly income ${input.currency} ${input.monthly_income}` : ""}.`,
    propertyOverview: input.property_address
      ? `Subject property: ${input.property_address}${input.property_value ? ` (est. value ${input.currency} ${input.property_value})` : ""}.`
      : "No subject property attached.",
    riskFlags: [
      dti != null && dti > 40 ? "Estimated DTI above 40% — affordability tight" : null,
      ltv != null && ltv > 80 ? "LTV above 80% — expect higher rate or PMI" : null,
      !input.monthly_income ? "Income not stated — lenders will request payslips" : null,
    ].filter(Boolean) as string[],
    strengths: [
      input.property_value ? "Collateral value stated" : null,
      input.employment_status ? "Employment stated" : null,
    ].filter(Boolean) as string[],
    dtiEstimatePct: dti,
    ltvEstimatePct: ltv,
    recommendedDocuments: [
      "National ID / KRA PIN",
      "3–6 months bank statements",
      "Latest 3 payslips or audited accounts (self-employed)",
      "Title deed or sale agreement",
      "Valuation report",
    ],
    suggestedLenders: [
      "KCB Mortgage",
      "Stanbic Home Loans",
      "HF Group",
      "NCBA",
      "Kenya Mortgage Refinance Company (via partner)",
    ],
    disclaimers: [
      "AI-generated summary is indicative only, not a credit decision.",
      "Ratios are estimates — lenders will apply their own affordability models.",
    ],
    confidencePct: 60,
    generatedAt: new Date().toISOString(),
  };
}

export const generateLenderSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    parseServerInput<LenderSummaryInput>(LenderSummarySchema, input, "financing"),
  )
  .handler(async ({ data }): Promise<LenderSummaryOutput> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return heuristic(data);
    const prompt = `You are HALISIA AI, preparing a lender-ready credit brief for a Kenyan mortgage / construction financing application.
Return STRICT JSON only, matching:
{
  "headline": string,
  "loanSnapshot": string,
  "borrowerProfile": string,
  "propertyOverview": string,
  "riskFlags": string[],
  "strengths": string[],
  "dtiEstimatePct": number|null,
  "ltvEstimatePct": number|null,
  "recommendedDocuments": string[],
  "suggestedLenders": string[],
  "disclaimers": string[],
  "confidencePct": number
}
APPLICATION:
${JSON.stringify(data, null, 2)}
Rules: neutral banker tone, no invented facts, Kenyan lender context (KCB, Stanbic, HF, NCBA, Absa, Co-op, KMRC), include disclaimers that this is not a credit decision. "suggestedLenders" lists lenders worth comparing for this loan purpose only; do not claim the applicant qualifies with any of them.`;
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
        body: JSON.stringify({
          model: "google/gemini-3.6-flash",
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) return heuristic(data);
      const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const raw = j.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(raw) as Partial<LenderSummaryOutput>;
      const fb = heuristic(data);
      const arr = (v: unknown, n = 8): string[] =>
        Array.isArray(v) ? v.slice(0, n).map((x) => String(x).slice(0, 240)) : [];
      return {
        headline: String(parsed.headline ?? fb.headline).slice(0, 200),
        loanSnapshot: String(parsed.loanSnapshot ?? fb.loanSnapshot).slice(0, 400),
        borrowerProfile: String(parsed.borrowerProfile ?? fb.borrowerProfile).slice(0, 400),
        propertyOverview: String(parsed.propertyOverview ?? fb.propertyOverview).slice(0, 400),
        riskFlags: arr(parsed.riskFlags),
        strengths: arr(parsed.strengths),
        dtiEstimatePct:
          parsed.dtiEstimatePct == null ? fb.dtiEstimatePct : Number(parsed.dtiEstimatePct),
        ltvEstimatePct:
          parsed.ltvEstimatePct == null ? fb.ltvEstimatePct : Number(parsed.ltvEstimatePct),
        recommendedDocuments: arr(parsed.recommendedDocuments).length
          ? arr(parsed.recommendedDocuments)
          : fb.recommendedDocuments,
        suggestedLenders: arr(parsed.suggestedLenders).length
          ? arr(parsed.suggestedLenders)
          : fb.suggestedLenders,
        disclaimers: arr(parsed.disclaimers).length ? arr(parsed.disclaimers) : fb.disclaimers,
        confidencePct: Math.max(
          0,
          Math.min(100, Math.round(Number(parsed.confidencePct) || fb.confidencePct)),
        ),
        generatedAt: new Date().toISOString(),
      };
    } catch (e) {
      console.error("lender summary failed", e);
      return heuristic(data);
    }
  });
