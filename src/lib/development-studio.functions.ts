import { createServerFn } from "@tanstack/react-start";
import {
  CONCEPT_DISCLAIMER,
  conceptFallback,
  conceptPrompt,
  type ConceptInput,
  type ConceptOption,
  type ConceptOutput,
} from "@/lib/development-studio";

export const generateDevelopmentConcept = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as ConceptInput)
  .handler(async ({ data }): Promise<ConceptOutput> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return conceptFallback(data);
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
        body: JSON.stringify({
          model: "google/gemini-3.6-flash",
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: conceptPrompt(data) }],
        }),
      });
      if (!res.ok) {
        console.error("development concept gateway error", res.status, await res.text());
        return conceptFallback(data);
      }
      const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}") as Partial<ConceptOutput>;
      const fb = conceptFallback(data);
      const options: ConceptOption[] =
        Array.isArray(parsed.options) && parsed.options.length
          ? parsed.options.slice(0, 3).map((o, i) => ({
              name: String(o?.name ?? fb.options[i]?.name ?? `Option ${i + 1}`).slice(0, 90),
              useType: String(o?.useType ?? "Mixed").slice(0, 90),
              rationale: String(o?.rationale ?? "").slice(0, 600),
              massing: String(o?.massing ?? "").slice(0, 300),
              unitMix: String(o?.unitMix ?? "").slice(0, 200),
              estimatedUnits: Math.max(0, Math.round(Number(o?.estimatedUnits) || 0)),
              phasing: Array.isArray(o?.phasing)
                ? o.phasing.slice(0, 6).map((s) => String(s).slice(0, 200))
                : [],
              capexBandKes: String(o?.capexBandKes ?? "—").slice(0, 120),
              revenueBandKes: String(o?.revenueBandKes ?? "—").slice(0, 120),
              paybackYears: String(o?.paybackYears ?? "—").slice(0, 40),
              risks: Array.isArray(o?.risks)
                ? o.risks.slice(0, 6).map((s) => String(s).slice(0, 220))
                : [],
              confidencePct: Math.max(0, Math.min(100, Math.round(Number(o?.confidencePct) || 50))),
            }))
          : fb.options;
      const assumptions = Array.isArray(parsed.assumptions)
        ? parsed.assumptions.slice(0, 8).map((s) => String(s).slice(0, 300))
        : fb.assumptions;
      if (!assumptions.some((a) => a.includes("Concept-stage")))
        assumptions.push(CONCEPT_DISCLAIMER);
      return {
        summary: String(parsed.summary ?? fb.summary).slice(0, 1200),
        siteRead: Array.isArray(parsed.siteRead)
          ? parsed.siteRead.slice(0, 8).map((s) => String(s).slice(0, 240))
          : fb.siteRead,
        options,
        nextSteps: Array.isArray(parsed.nextSteps)
          ? parsed.nextSteps.slice(0, 8).map((s) => String(s).slice(0, 240))
          : fb.nextSteps,
        assumptions,
        generatedAt: new Date().toISOString(),
        source: "ai",
      };
    } catch (e) {
      console.error("development concept failed", e);
      return conceptFallback(data);
    }
  });
