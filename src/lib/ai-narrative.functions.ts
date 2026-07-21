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
  confidencePct: number;
  lastUpdated: string;
  paragraphs: string[];
  overview: string;
  keyFindings: string[];
  strengths: { point: string; why: string }[];
  weaknesses: { point: string; why: string }[];
  recommendations: string[];
  constructionAdvice: string[];
  investmentAdvice: string[];
  familySuitability: { score: number; note: string };
  businessSuitability: { score: number; note: string };
  environmentalNotes: string[];
  futureOutlook: string;
  watchouts: string[];
  nextSteps: string[];
  dataSources: string[];
};

function fallback(input: NarrativeInput): NarrativeOutput {
  const infra =
    input.counts.schools + input.counts.hospitals + input.counts.groceries + input.counts.transit;
  const liv = Math.min(95, 40 + infra * 4);
  const now = new Date().toISOString();
  return {
    ok: true,
    headline: `${input.address} — quick read`,
    livability: liv,
    confidence: "Medium",
    confidencePct: 62,
    lastUpdated: now,
    paragraphs: [
      `We detected ${input.counts.schools} schools, ${input.counts.hospitals} health facilities, and ${input.counts.groceries} groceries within ~3 km. Elevation is around ${input.elevationM?.toFixed(0) ?? "—"} m.`,
    ],
    overview: `${input.address} is analysed from open geospatial signals (elevation, air quality, amenity density). Livability composite: ${liv}/100.`,
    keyFindings: [
      `${input.counts.schools} schools and ${input.counts.hospitals} health facilities within ~3 km`,
      `${input.counts.transit} transit stops and ${input.counts.groceries} groceries nearby`,
      `Elevation ~${input.elevationM?.toFixed(0) ?? "—"} m; air quality ${input.airQuality?.category ?? "unknown"}`,
    ],
    strengths: [
      {
        point: input.counts.transit > 2 ? "Reasonable transit coverage" : "Basic transit access",
        why: `${input.counts.transit} transit stops mapped within 3 km — matatu and bus reach is workable.`,
      },
      {
        point: input.counts.groceries > 2 ? "Daily essentials nearby" : "Some amenities present",
        why: `${input.counts.groceries} groceries and ${input.counts.restaurants} eateries reduce daily-trip friction.`,
      },
    ],
    weaknesses: [
      {
        point: "Signals limited to open datasets",
        why: "No parcel-level survey or title data — field verification required.",
      },
    ],
    recommendations: [
      "Commission a licensed surveyor for parcel boundaries",
      "Pull the official title search at Ardhisasa or the local registry",
    ],
    constructionAdvice: [
      "Soil test (SPT + moisture) before foundation design",
      "Design drainage assuming long-rain peak intensity",
    ],
    investmentAdvice: [
      "Compare against comparable-plot asking prices in the same ward",
      "Confirm zoning class and permitted use with the county planning office",
    ],
    familySuitability: {
      score: Math.min(95, 45 + (input.counts.schools + input.counts.hospitals) * 5),
      note: "Weighted by schools, health access, groceries and transit within a 3 km radius.",
    },
    businessSuitability: {
      score: Math.min(95, 40 + (input.counts.banks + input.counts.transit) * 4),
      note: "Weighted by banking access, transit exposure and daytime foot-traffic proxies.",
    },
    environmentalNotes: [
      input.airQuality?.aqi != null
        ? `Air quality AQI ${input.airQuality.aqi} — ${input.airQuality.category ?? "moderate"}.`
        : "Air quality unknown — capture a 7-day sensor sample before committing.",
      "Verify flood behaviour on-site during the long rains (March–May).",
    ],
    futureOutlook:
      "Amenity density and infrastructure trend suggest gradual appreciation; monitor county infrastructure plans and Ardhisasa updates.",
    watchouts: ["Verify title and zoning locally", "Field-check flood behaviour in long rains"],
    nextSteps: ["Visit at different times of day", "Speak with two neighbours before deciding"],
    dataSources: [
      "Google Places (amenity counts)",
      "Open-Topo-Data ASTER 30m (elevation)",
      "Google Air Quality API",
    ],
  };
}

export const generateNarrative = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as NarrativeInput)
  .handler(async ({ data }): Promise<NarrativeOutput> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return fallback(data);

    const prompt = `You are HALISIA AI, a Kenyan land-intelligence analyst producing an EXECUTIVE SUMMARY. Return STRICT JSON matching this TypeScript type — no prose, no markdown fencing:
{
  "headline": string, // 6-12 words, evocative but factual
  "livability": number, // 0-100 composite score based on the signals provided
  "confidence": "Low" | "Medium" | "High",
  "confidencePct": number, // 0-100 numeric confidence
  "paragraphs": string[], // 2 short paragraphs (max 55 words each) — a plain-English read
  "overview": string, // 2-3 sentence executive overview
  "keyFindings": string[], // 3-5 crisp findings, each with a specific number where possible
  "strengths": { "point": string, "why": string }[], // 3 items; the WHY must cite a specific signal/number
  "weaknesses": { "point": string, "why": string }[], // 3 items; WHY cites a specific signal/gap
  "recommendations": string[], // 3 concrete actions
  "constructionAdvice": string[], // 3 items — soil, drainage, foundations
  "investmentAdvice": string[], // 3 items — comps, zoning, exit
  "familySuitability": { "score": number, "note": string }, // 0-100, one-sentence note
  "businessSuitability": { "score": number, "note": string }, // 0-100, one-sentence note
  "environmentalNotes": string[], // 2-4 items — AQI, flood, drainage, water
  "futureOutlook": string, // 1-2 sentences on 3-5 year trajectory
  "watchouts": string[], // 3 concise bullets (risks, uncertainty, things to verify)
  "nextSteps": string[], // 3 concise verification actions a buyer/builder should take
  "dataSources": string[] // list the specific datasets you leaned on
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
      const now = new Date().toISOString();
      const asStrArr = (v: unknown, n = 5) =>
        Array.isArray(v) ? v.slice(0, n).map((x) => String(x)) : [];
      const asPointArr = (v: unknown, n = 4) =>
        Array.isArray(v)
          ? v.slice(0, n).map((x) => {
              const o = (x ?? {}) as { point?: unknown; why?: unknown };
              return { point: String(o.point ?? ""), why: String(o.why ?? "") };
            })
          : [];
      const asScoreNote = (v: unknown) => {
        const o = (v ?? {}) as { score?: unknown; note?: unknown };
        return {
          score: Math.max(0, Math.min(100, Math.round(Number(o.score) || 60))),
          note: String(o.note ?? ""),
        };
      };
      return {
        ok: true,
        headline: String(parsed.headline ?? "").slice(0, 140),
        livability: Math.max(0, Math.min(100, Math.round(Number(parsed.livability) || 60))),
        confidence: (["Low", "Medium", "High"] as const).includes(
          parsed.confidence as "Low" | "Medium" | "High",
        )
          ? (parsed.confidence as "Low" | "Medium" | "High")
          : "Medium",
        confidencePct: Math.max(
          0,
          Math.min(
            100,
            Math.round(
              Number((parsed as { confidencePct?: unknown }).confidencePct) ||
                (parsed.confidence === "High" ? 82 : parsed.confidence === "Low" ? 45 : 65),
            ),
          ),
        ),
        lastUpdated: now,
        paragraphs: asStrArr(parsed.paragraphs, 3),
        overview: String((parsed as { overview?: unknown }).overview ?? ""),
        keyFindings: asStrArr((parsed as { keyFindings?: unknown }).keyFindings, 6),
        strengths: asPointArr(parsed.strengths as unknown, 4),
        weaknesses: asPointArr((parsed as { weaknesses?: unknown }).weaknesses, 4),
        recommendations: asStrArr((parsed as { recommendations?: unknown }).recommendations, 5),
        constructionAdvice: asStrArr(
          (parsed as { constructionAdvice?: unknown }).constructionAdvice,
          5,
        ),
        investmentAdvice: asStrArr((parsed as { investmentAdvice?: unknown }).investmentAdvice, 5),
        familySuitability: asScoreNote((parsed as { familySuitability?: unknown }).familySuitability),
        businessSuitability: asScoreNote(
          (parsed as { businessSuitability?: unknown }).businessSuitability,
        ),
        environmentalNotes: asStrArr(
          (parsed as { environmentalNotes?: unknown }).environmentalNotes,
          5,
        ),
        futureOutlook: String((parsed as { futureOutlook?: unknown }).futureOutlook ?? ""),
        watchouts: asStrArr(parsed.watchouts, 5),
        nextSteps: asStrArr(parsed.nextSteps, 5),
        dataSources: asStrArr((parsed as { dataSources?: unknown }).dataSources, 8),
      };
    } catch (e) {
      console.error("narrative failed", e);
      return fallback(data);
    }
  });
