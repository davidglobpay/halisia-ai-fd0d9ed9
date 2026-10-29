import { createServerFn } from "@tanstack/react-start";
import { parseServerInput, BriefSchema } from "@/lib/server-input";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AiOptionPatch } from "@/lib/design-studio/core";

/**
 * OPTIONAL AI enhancement for the Design Studio.
 *
 * The deterministic generator is always the source of truth. This server
 * function only returns narrative text plus *patch* numbers that the client
 * clamps against the calculated envelope (see applyAiPatches). It never
 * returns coordinates, boundaries or legal/planning facts.
 *
 * Reuses the already-configured Lovable AI gateway (LOVABLE_API_KEY). When no
 * provider is configured it reports available: false and the UI stays fully
 * functional on the deterministic path.
 */

export type BriefInput = {
  goal: string;
  intendedUse: string;
  siteAreaSqm: number | null;
  buildableAreaSqm: number | null;
  maxFootprintSqm: number | null;
  maxFloors: number | null;
  budgetKes: number | null;
  options: Array<{
    id: string;
    name: string;
    floors: number;
    footprintSqm: number;
    unitCount: number;
  }>;
};

export type BriefOutput = {
  available: boolean;
  reason?: string;
  summary: string;
  patches: AiOptionPatch[];
  warnings: string[];
  generatedAt: string;
};

function unavailable(reason: string): BriefOutput {
  return {
    available: false,
    reason,
    summary: "",
    patches: [],
    warnings: [],
    generatedAt: new Date().toISOString(),
  };
}

export const generateDesignBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    parseServerInput<BriefInput>(BriefSchema, input, "design brief"),
  )
  .handler(async ({ data }): Promise<BriefOutput> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return unavailable("No AI provider configured for this project.");

    const prompt = `You are HALISIA AI, a Kenyan development concept assistant working inside a SANDBOX.
Return STRICT JSON only, no code fences, matching:
{"summary":string,"patches":[{"id":"A"|"B"|"C","name":string,"useType":string,"floors":number,"footprintSqm":number,"unitCount":number,"rationale":string}]}

CONTEXT (all figures are PROPOSED sandbox assumptions, not evidence):
- Owner goal: ${data.goal || "not stated"}
- Intended use: ${data.intendedUse}
- Simulation site area: ${data.siteAreaSqm ?? "unknown"} m²
- Buildable area after setbacks: ${data.buildableAreaSqm ?? "unknown"} m²
- Maximum footprint: ${data.maxFootprintSqm ?? "unknown"} m²
- Maximum floors: ${data.maxFloors ?? "unknown"}
- Budget: ${data.budgetKes ?? "not stated"} KES
- Deterministic options: ${JSON.stringify(data.options)}

RULES:
- NEVER output coordinates, boundaries, polygons, title numbers or plot dimensions.
- NEVER claim anything is verified, approved, cadastral or legally compliant.
- Numbers must stay within the stated maximum footprint and maximum floors.
- Keep exactly the three ids A, B and C.
- summary <= 700 characters, plain English, concept-stage framing only.
- JSON must parse.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
        body: JSON.stringify({
          model: "google/gemini-3.8-flash",
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error("design brief gateway error", res.status, body);
        if (res.status === 402)
          return unavailable(
            "AI credits are exhausted for this workspace — add credits to re-enable.",
          );
        if (res.status === 403) return unavailable("AI is disabled by workspace policy.");
        if (res.status === 429)
          return unavailable("AI is rate limited right now — try again shortly.");
        return unavailable(`AI provider returned ${res.status}.`);
      }
      const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}") as {
        summary?: unknown;
        patches?: unknown;
      };
      const patches: AiOptionPatch[] = Array.isArray(parsed.patches)
        ? (parsed.patches as Array<Record<string, unknown>>).slice(0, 3).map((p) => ({
            id: String(p["id"] ?? "")
              .toUpperCase()
              .slice(0, 1),
            name: typeof p["name"] === "string" ? p["name"].slice(0, 90) : undefined,
            useType: typeof p["useType"] === "string" ? p["useType"].slice(0, 90) : undefined,
            floors: Number(p["floors"]) || undefined,
            footprintSqm: Number(p["footprintSqm"]) || undefined,
            unitCount: Number(p["unitCount"]) || undefined,
            rationale:
              typeof p["rationale"] === "string" ? p["rationale"].slice(0, 400) : undefined,
          }))
        : [];

      return {
        available: true,
        summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 900) : "",
        patches,
        warnings: [],
        generatedAt: new Date().toISOString(),
      };
    } catch (e) {
      console.error("design brief failed", e);
      return unavailable("AI request failed — deterministic generator remains active.");
    }
  });
