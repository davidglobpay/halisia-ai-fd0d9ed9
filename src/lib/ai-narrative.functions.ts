import { createServerFn } from "@tanstack/react-start";

export type NarrativeInput = {
  address: string;
  lat: number;
  lng: number;
  elevationM?: number | null;
  airQuality?: { aqi: number | null; category: string | null; dominant: string | null } | null;
  counts: {
    schools: number;
    hospitals: number;
    groceries: number;
    transit: number;
    restaurants: number;
    banks: number;
  };
};

export type NarrativeOutput = {
  ok: true;
  headline: string;
  livability: number;
  confidence: "Low" | "Medium" | "High";
  paragraphs: string[];
  strengths: string[];
  watchouts: string[];
  nextSteps: string[];
};

function fallback(input: NarrativeInput): NarrativeOutput {
  const infra =
    input.counts.schools + input.counts.hospitals + input.counts.groceries + input.counts.transit;
  const liv = Math.min(95, 40 + infra * 4);
  return {
    ok: true,
    headline: `${input.address} — quick read`,
    livability: liv,
    confidence: "Medium",
    paragraphs: [
      `We detected ${input.counts.schools} schools, ${input.counts.hospitals} health facilities, and ${input.counts.groceries} groceries within ~3 km. Elevation is around ${input.elevationM?.toFixed(0) ?? "—"} m.`,
    ],
    strengths: [
      input.counts.transit > 2 ? "Reasonable transit coverage" : "Some transit access",
      input.counts.groceries > 2 ? "Daily essentials nearby" : "Basic amenities present",
    ],
    watchouts: ["Verify title and zoning locally", "Field-check flood behaviour in long rains"],
    nextSteps: ["Visit at different times of day", "Speak with two neighbours before deciding"],
  };
}

export const generateNarrative = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as NarrativeInput)
  .handler(async ({ data }): Promise<NarrativeOutput> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return fallback(data);

    const prompt = `You are HALISIA AI, a Kenyan land-intelligence analyst. Return STRICT JSON matching this TypeScript type — no prose, no markdown fencing:
{
  "headline": string, // 6-12 words, evocative but factual
  "livability": number, // 0-100 composite score based on the signals provided
  "confidence": "Low" | "Medium" | "High",
  "paragraphs": string[], // 2 short paragraphs (max 55 words each) explaining what this place is like and why the score
  "strengths": string[], // 3 concise bullets
  "watchouts": string[], // 3 concise bullets (risks, uncertainty, things to verify)
  "nextSteps": string[]  // 3 concise verification actions a buyer/builder should take
}

SIGNALS:
- Location: ${data.address} (${data.lat.toFixed(4)}, ${data.lng.toFixed(4)})
- Elevation: ${data.elevationM != null ? data.elevationM.toFixed(0) + " m" : "unknown"}
- Air quality: ${data.airQuality?.aqi != null ? `AQI ${data.airQuality.aqi} — ${data.airQuality.category ?? ""}${data.airQuality.dominant ? ", dominant " + data.airQuality.dominant : ""}` : "unknown"}
- Nearby (within ~3km): ${data.counts.schools} schools, ${data.counts.hospitals} health, ${data.counts.groceries} groceries, ${data.counts.transit} transit stops, ${data.counts.restaurants} restaurants/cafes, ${data.counts.banks} banks/ATMs.

Rules:
- Never claim legality, safety, or ownership as fact.
- Prefer specific numbers over generic praise.
- Kenyan context: mention long rains, murram/tarmac, matatus, water rationing, or KPLC only when relevant.
- Keep JSON parseable. No trailing commas.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) return fallback(data);
      const j = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = j.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(raw) as Omit<NarrativeOutput, "ok">;
      return {
        ok: true,
        headline: String(parsed.headline ?? "").slice(0, 140),
        livability: Math.max(0, Math.min(100, Math.round(Number(parsed.livability) || 60))),
        confidence: (["Low", "Medium", "High"] as const).includes(
          parsed.confidence as "Low" | "Medium" | "High",
        )
          ? (parsed.confidence as "Low" | "Medium" | "High")
          : "Medium",
        paragraphs: (parsed.paragraphs ?? []).slice(0, 3).map(String),
        strengths: (parsed.strengths ?? []).slice(0, 4).map(String),
        watchouts: (parsed.watchouts ?? []).slice(0, 4).map(String),
        nextSteps: (parsed.nextSteps ?? []).slice(0, 4).map(String),
      };
    } catch (e) {
      console.error("narrative failed", e);
      return fallback(data);
    }
  });
