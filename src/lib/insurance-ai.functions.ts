import { createServerFn } from "@tanstack/react-start";
import { parseServerInput, InsuranceBriefSchema } from "@/lib/server-input";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { InsuranceAiOutput, InsuranceRisk } from "@/lib/insurance";

export type InsuranceBriefInput = {
  title: string;
  kind: string;
  county?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  size_value?: number | null;
  size_unit?: string | null;
  amenities?: string[];
  utilities?: string[];
  access_type?: string | null;
};

function fallback(input: InsuranceBriefInput): InsuranceAiOutput {
  const county = (input.county ?? "").toLowerCase();
  const flood = /kisumu|budalangi|tana|kilifi|mombasa|garissa|homabay|siaya/.test(county);
  const drought = /turkana|marsabit|garissa|wajir|mandera|isiolo|kitui|makueni/.test(county);
  const seismic = /nakuru|baringo|elgeyo|nairobi|kajiado|narok/.test(county);
  const risks: InsuranceRisk[] = [
    flood && {
      name: "Flood exposure",
      severity: "high" as const,
      description: "County sits in a documented flood-prone belt during long rains.",
      confidencePct: 70,
    },
    drought && {
      name: "Drought & water stress",
      severity: "moderate" as const,
      description: "ASAL context increases water-supply and vegetation-fire risk.",
      confidencePct: 65,
    },
    seismic && {
      name: "Seismic activity",
      severity: "moderate" as const,
      description: "Rift Valley proximity elevates minor seismic risk.",
      confidencePct: 55,
    },
    {
      name: "Boundary & title disputes",
      severity: "moderate" as const,
      description: "Kenyan land parcels commonly benefit from title-insurance protection.",
      confidencePct: 60,
    },
    input.kind === "land"
      ? {
          name: "Encroachment & vandalism",
          severity: "moderate" as const,
          description:
            "Vacant land is exposed to encroachment, illegal grazing and materials theft.",
          confidencePct: 60,
        }
      : {
          name: "Fire & structural damage",
          severity: "moderate" as const,
          description:
            "Standard peril for built assets; verify wiring, materials and neighbouring risks.",
          confidencePct: 60,
        },
  ].filter(Boolean) as InsuranceRisk[];
  return {
    keyRisks: risks,
    recommendedCoverage: [
      "Title insurance / conveyancing indemnity",
      "Property all-risks (fire, flood, malicious damage)",
      "Public liability",
      input.kind === "land" ? "Vacant land liability endorsement" : "Contents & tenant liability",
      "Contractors all-risk (if building)",
    ],
    questionsForInsurer: [
      "Is flood a named peril or an extension I need to purchase?",
      "What is the excess for storm / flood claims in this county?",
      "Do you require a valuation report before binding cover?",
      "Is title insurance available and what does it exclude?",
      "How do premiums change if the plot is fenced / secured / occupied?",
    ],
    overallConfidencePct: 62,
    disclaimers: [
      "AI-generated risk brief is a starting checklist, not underwriting advice.",
      "Confirm every peril, exclusion and premium with a licensed Kenyan insurer.",
    ],
    generatedAt: new Date().toISOString(),
  };
}

export const generateInsuranceBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    parseServerInput<InsuranceBriefInput>(InsuranceBriefSchema, input, "insurance brief"),
  )
  .handler(async ({ data }): Promise<InsuranceAiOutput> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return fallback(data);
    const prompt = `You are HALISIA AI producing an insurance & risk brief for a Kenyan real-estate listing.
Return STRICT JSON matching:
{
  "keyRisks": [{"name": string, "severity": "low"|"moderate"|"high", "description": string, "confidencePct": number}],
  "recommendedCoverage": string[],
  "questionsForInsurer": string[],
  "overallConfidencePct": number,
  "disclaimers": string[]
}
LISTING:
${JSON.stringify(data, null, 2)}
Rules: Kenyan context (KCB Insurance, Jubilee, CIC, Britam, APA, ICEA), 4-7 risks max, avoid inventing hazards, always include title/boundary risk consideration, always include a disclaimer that this is not underwriting advice.`;
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
      if (!res.ok) return fallback(data);
      const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const raw = j.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(raw) as Partial<InsuranceAiOutput>;
      const fb = fallback(data);
      const strArr = (v: unknown, n = 10): string[] =>
        Array.isArray(v) ? v.slice(0, n).map((x) => String(x).slice(0, 220)) : [];
      const risks: InsuranceRisk[] = Array.isArray(parsed.keyRisks)
        ? parsed.keyRisks.slice(0, 8).map((r) => {
            const sev = String((r as InsuranceRisk)?.severity ?? "moderate");
            const severity: InsuranceRisk["severity"] =
              sev === "low" || sev === "high" ? (sev as InsuranceRisk["severity"]) : "moderate";
            return {
              name: String((r as InsuranceRisk)?.name ?? "Risk").slice(0, 80),
              severity,
              description: String((r as InsuranceRisk)?.description ?? "").slice(0, 320),
              confidencePct: Math.max(
                0,
                Math.min(100, Math.round(Number((r as InsuranceRisk)?.confidencePct) || 50)),
              ),
            };
          })
        : fb.keyRisks;
      return {
        keyRisks: risks.length ? risks : fb.keyRisks,
        recommendedCoverage: strArr(parsed.recommendedCoverage).length
          ? strArr(parsed.recommendedCoverage)
          : fb.recommendedCoverage,
        questionsForInsurer: strArr(parsed.questionsForInsurer).length
          ? strArr(parsed.questionsForInsurer)
          : fb.questionsForInsurer,
        overallConfidencePct: Math.max(
          0,
          Math.min(100, Math.round(Number(parsed.overallConfidencePct) || fb.overallConfidencePct)),
        ),
        disclaimers: strArr(parsed.disclaimers).length
          ? strArr(parsed.disclaimers)
          : fb.disclaimers,
        generatedAt: new Date().toISOString(),
      };
    } catch (e) {
      console.error("insurance brief failed", e);
      return fallback(data);
    }
  });
