import { CATEGORY_KEYWORDS, COUNTIES, type Classification } from "./classify";
export { classify } from "./classify";
import type { RawArticle } from "./providers.server";

export type AiEnrichment = {
  summary: string;
  whyItMatters: string;
  propertyImpact: string | null;
  landImpact: string | null;
  infrastructureImpact: string | null;
  investmentImpact: string | null;
  environmentalImpact: string | null;
  category: string | null;
  tags: string[];
  county: string | null;
  importance: number;
};

const SYSTEM = `You are HALISIA Pulse, a Kenyan land & property intelligence analyst.
You read a news headline and excerpt and explain, in plain professional English,
what it means for land, property, infrastructure, investment and the environment in Kenya.
Never invent facts that are not implied by the text. If a sector is not affected, return null for it.
Return STRICT JSON only.`;

/**
 * Enrich a batch of articles with one AI call each (bounded concurrency by the
 * caller). Returns null when the gateway is unavailable or the reply is unusable.
 */
export async function enrichWithAi(
  article: RawArticle,
  base: Classification,
): Promise<AiEnrichment | null> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;

  const prompt = `HEADLINE: ${article.title}
SOURCE: ${article.sourceName ?? "unknown"}
EXCERPT: ${(article.excerpt ?? "").slice(0, 1200) || "(no excerpt available)"}
DETECTED COUNTY: ${base.county ?? "unknown"}

Return JSON with exactly these keys:
{
  "summary": "2-3 sentence neutral summary",
  "why_it_matters": "1-2 sentences on why a Kenyan land or property decision-maker should care",
  "property_impact": "string or null",
  "land_impact": "string or null",
  "infrastructure_impact": "string or null",
  "investment_impact": "string or null",
  "environmental_impact": "string or null",
  "category": "one of: ${Object.keys(CATEGORY_KEYWORDS).join(", ")}",
  "tags": ["max 6 short lowercase tags"],
  "county": "Kenyan county name or null",
  "importance": 0-100
}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    return {
      summary: str(parsed["summary"]) ?? article.excerpt?.slice(0, 300) ?? article.title,
      whyItMatters: str(parsed["why_it_matters"]) ?? "",
      propertyImpact: str(parsed["property_impact"]),
      landImpact: str(parsed["land_impact"]),
      infrastructureImpact: str(parsed["infrastructure_impact"]),
      investmentImpact: str(parsed["investment_impact"]),
      environmentalImpact: str(parsed["environmental_impact"]),
      category: str(parsed["category"]),
      tags: Array.isArray(parsed["tags"])
        ? (parsed["tags"] as unknown[])
            .filter((t): t is string => typeof t === "string")
            .slice(0, 6)
        : [],
      county: str(parsed["county"]),
      importance: typeof parsed["importance"] === "number" ? parsed["importance"] : 50,
    };
  } catch {
    return null;
  }
}

/** Kenyan county names, exported for filters and validation. */
export const COUNTY_NAMES = COUNTIES.map((c) => c.name).sort();
