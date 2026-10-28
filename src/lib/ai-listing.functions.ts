import { createServerFn } from "@tanstack/react-start";
import { parseServerInput, ListingAiSchema } from "@/lib/server-input";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ListingAiInput = {
  title: string;
  description?: string | null;
  kind: string;
  intent: string;
  price?: number | null;
  currency?: string | null;
  size_value?: number | null;
  size_unit?: string | null;
  county?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  amenities?: string[];
  utilities?: string[];
  access_type?: string | null;
};

export type ConceptOption = {
  name: string;
  description: string;
  useCase: string;
  siteLayout: string;
  confidencePct: number;
};

export type ListingAiOutput = {
  ok: true;
  polishedTitle: string;
  headline: string;
  aiSummary: string;
  marketingHighlights: string[];
  seoDescription: string;
  priceEstimate: {
    min: number | null;
    max: number | null;
    currency: string;
    note: string;
  };
  socialCaptions: {
    twitter: string;
    facebook: string;
    whatsapp: string;
    instagram: string;
  };
  disclaimers: string[];
  concepts: ConceptOption[];
  confidencePct: number;
  generatedAt: string;
};

const BASE_DISCLAIMERS = [
  "AI-generated content is a draft to accelerate marketing — verify every fact with the seller and licensed professionals.",
  "Price ranges are indicative estimates from open signals, not a formal valuation.",
  "Concept layouts are conceptual only — not architectural, engineering or planning approvals.",
];

function num(n: unknown): number | null {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function heuristicPrice(input: ListingAiInput): { min: number | null; max: number | null } {
  const p = num(input.price);
  if (p != null && p > 0) return { min: Math.round(p * 0.9), max: Math.round(p * 1.15) };
  const size = num(input.size_value);
  if (size == null) return { min: null, max: null };
  // Very rough KES/acre baseline — deliberately wide.
  const perAcre =
    input.kind === "agricultural"
      ? 450_000
      : input.kind === "commercial" || input.kind === "industrial"
        ? 18_000_000
        : 3_500_000;
  const acres =
    input.size_unit === "ha"
      ? size * 2.471
      : input.size_unit === "sqm"
        ? size / 4046.86
        : input.size_unit === "sqft"
          ? size / 43_560
          : size;
  const mid = Math.max(150_000, acres * perAcre);
  return { min: Math.round(mid * 0.7), max: Math.round(mid * 1.3) };
}

function fallback(input: ListingAiInput): ListingAiOutput {
  const loc = input.address ?? input.county ?? "Kenya";
  const size = input.size_value != null ? `${input.size_value} ${input.size_unit ?? "acres"} ` : "";
  const kind = input.kind.replace("_", " ");
  const price = heuristicPrice(input);
  const currency = input.currency || "KES";
  const isLand = input.kind === "land" || input.kind === "agricultural";
  return {
    ok: true,
    polishedTitle: `${size}${kind} in ${loc}`.trim(),
    headline: `${kind[0]?.toUpperCase()}${kind.slice(1)} opportunity in ${loc}`,
    aiSummary: `${size}${kind} listed for ${input.intent} in ${loc}. ${
      input.amenities?.length ? `Amenities include ${input.amenities.slice(0, 4).join(", ")}.` : ""
    } ${input.utilities?.length ? `Utilities on-site: ${input.utilities.join(", ")}.` : ""}`.trim(),
    marketingHighlights: [
      input.access_type ? `${input.access_type} access` : "Motorable access",
      input.utilities?.length
        ? `${input.utilities.length} utilities on-site`
        : "Utility-ready plot",
      input.amenities?.[0] ?? "Established neighbourhood",
      "Priced for a fast decision",
    ].filter(Boolean) as string[],
    seoDescription:
      `${size}${kind} for ${input.intent} in ${loc}. HALISIA AI Land Intelligence brief with amenities, utilities and confidence-scored insights.`.slice(
        0,
        158,
      ),
    priceEstimate: {
      min: price.min,
      max: price.max,
      currency,
      note: "Heuristic band from size, kind and county baselines — refine with local comps.",
    },
    socialCaptions: {
      twitter:
        `🇰🇪 New on HALISIA AI: ${size}${kind} in ${loc}. AI-scored & ready to explore.`.slice(
          0,
          260,
        ),
      facebook: `Now on HALISIA AI — ${size}${kind} in ${loc}. Every listing is scored by our Land Intelligence Engine so you buy with confidence.`,
      whatsapp: `*${size}${kind} in ${loc}* — listed on HALISIA AI with a full Land Intelligence breakdown. DM for details.`,
      instagram: `${size}${kind} · ${loc}\n\nAI-scored on HALISIA AI. Tap the link in bio for the full intelligence report.\n\n#HalisiaAI #Kenya #RealEstate`,
    },
    disclaimers: BASE_DISCLAIMERS,
    concepts: isLand
      ? [
          {
            name: "Family homestead",
            description: "3-bed bungalow with a rear kitchen garden and rain-water harvesting.",
            useCase: "Owner-occupier household on a peri-urban plot.",
            siteLayout:
              "Setback 6m from the front boundary, house on the north edge, garden and borehole on the south, side driveway to a detached carport.",
            confidencePct: 60,
          },
          {
            name: "Rental micro-court",
            description: "4 x studio units around a shared courtyard with off-street parking.",
            useCase: "Yield-focused landlord targeting workforce tenants.",
            siteLayout:
              "Central courtyard, units on the east/west edges, service block (laundry + water tank) on the north, gated entry on the south.",
            confidencePct: 55,
          },
          {
            name: "Agri-lifestyle plot",
            description: "Small farm block with a caretaker cottage and greenhouse.",
            useCase: "Weekend farmer or export-grade horticulture pilot.",
            siteLayout:
              "Cottage near the road, greenhouse and shade nets on the flattest quadrant, borehole downhill, orchard along the west boundary.",
            confidencePct: 50,
          },
        ]
      : [],
    confidencePct: 58,
    generatedAt: new Date().toISOString(),
  };
}

export const generateListingAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    parseServerInput<ListingAiInput>(ListingAiSchema, input, "listing"),
  )
  .handler(async ({ data }): Promise<ListingAiOutput> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return fallback(data);

    const isLand = data.kind === "land" || data.kind === "agricultural";
    const prompt = `You are HALISIA AI, a Kenyan real-estate copywriter and land-intelligence analyst.
Return STRICT JSON only — no prose, no code fences — matching this TypeScript shape:
{
  "polishedTitle": string,          // 6-14 words, factual, keyword-rich
  "headline": string,               // <= 12 words, evocative
  "aiSummary": string,              // 2-3 sentences, plain English, no hype
  "marketingHighlights": string[],  // 4-6 short bullets (max 90 chars each)
  "seoDescription": string,         // <= 158 chars, keyword-rich
  "priceEstimate": { "min": number|null, "max": number|null, "currency": string, "note": string },
  "socialCaptions": { "twitter": string, "facebook": string, "whatsapp": string, "instagram": string },
  "disclaimers": string[],          // 2-4 buyer-safety disclaimers
  "concepts": { "name": string, "description": string, "useCase": string, "siteLayout": string, "confidencePct": number }[],
  "confidencePct": number
}

LISTING FACTS:
- Kind: ${data.kind} (${data.intent})
- Title from seller: ${data.title}
- Description from seller: ${data.description ?? "—"}
- Location: ${data.address ?? "—"}${data.county ? ", " + data.county : ""}${data.latitude != null && data.longitude != null ? ` (${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)})` : ""}
- Size: ${data.size_value ?? "—"} ${data.size_unit ?? ""}
- Asking price: ${data.price != null ? `${data.currency ?? "KES"} ${data.price}` : "not specified"}
- Access: ${data.access_type ?? "unspecified"}
- Utilities: ${(data.utilities ?? []).join(", ") || "unspecified"}
- Amenities: ${(data.amenities ?? []).join(", ") || "unspecified"}

RULES:
- Highlights must reference concrete facts from above, not invented features.
- Price band: if the seller supplied a price, centre the band on it (±15%). Otherwise infer a wide band from size/kind and clearly say so in the note.
- concepts: ${isLand ? "return 3 distinct conceptual development options with realistic Kenyan-context layouts. Label each as conceptual." : "return an empty array []."}
- disclaimers must include: AI content is a draft; price is an estimate not a valuation; concepts are conceptual only.
- Do NOT claim legal, zoning or title status as fact.
- Kenyan context (long rains, matatus, KPLC, borehole, murram) only when relevant.
- Keep JSON parseable. No trailing commas.`;

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
      const parsed = JSON.parse(raw) as Partial<ListingAiOutput>;
      const fb = fallback(data);
      const asStrArr = (v: unknown, n: number, cap = 200) =>
        Array.isArray(v) ? v.slice(0, n).map((x) => String(x).slice(0, cap)) : [];
      const concepts: ConceptOption[] = Array.isArray(parsed.concepts)
        ? parsed.concepts.slice(0, 4).map((c) => ({
            name: String((c as ConceptOption)?.name ?? "").slice(0, 60) || "Concept",
            description: String((c as ConceptOption)?.description ?? "").slice(0, 240),
            useCase: String((c as ConceptOption)?.useCase ?? "").slice(0, 180),
            siteLayout: String((c as ConceptOption)?.siteLayout ?? "").slice(0, 320),
            confidencePct: Math.max(
              0,
              Math.min(100, Math.round(Number((c as ConceptOption)?.confidencePct) || 50)),
            ),
          }))
        : [];
      const pe = (parsed.priceEstimate ?? {}) as ListingAiOutput["priceEstimate"];
      return {
        ok: true,
        polishedTitle: String(parsed.polishedTitle ?? fb.polishedTitle).slice(0, 140),
        headline: String(parsed.headline ?? fb.headline).slice(0, 120),
        aiSummary: String(parsed.aiSummary ?? fb.aiSummary).slice(0, 600),
        marketingHighlights: asStrArr(parsed.marketingHighlights, 6, 120),
        seoDescription: String(parsed.seoDescription ?? fb.seoDescription).slice(0, 158),
        priceEstimate: {
          min: num(pe.min),
          max: num(pe.max),
          currency: String(pe.currency ?? data.currency ?? "KES").slice(0, 4),
          note: String(pe.note ?? fb.priceEstimate.note).slice(0, 240),
        },
        socialCaptions: {
          twitter: String(parsed.socialCaptions?.twitter ?? fb.socialCaptions.twitter).slice(
            0,
            280,
          ),
          facebook: String(parsed.socialCaptions?.facebook ?? fb.socialCaptions.facebook).slice(
            0,
            600,
          ),
          whatsapp: String(parsed.socialCaptions?.whatsapp ?? fb.socialCaptions.whatsapp).slice(
            0,
            600,
          ),
          instagram: String(parsed.socialCaptions?.instagram ?? fb.socialCaptions.instagram).slice(
            0,
            800,
          ),
        },
        disclaimers: asStrArr(parsed.disclaimers, 5, 240).length
          ? asStrArr(parsed.disclaimers, 5, 240)
          : BASE_DISCLAIMERS,
        concepts: isLand ? concepts : [],
        confidencePct: Math.max(0, Math.min(100, Math.round(Number(parsed.confidencePct) || 62))),
        generatedAt: new Date().toISOString(),
      };
    } catch (e) {
      console.error("listing ai failed", e);
      return fallback(data);
    }
  });
