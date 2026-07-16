import { createServerFn } from "@tanstack/react-start";

export type DeedFields = {
  titleNumber: string | null;
  lrNumber: string | null;
  parcelNumber: string | null;
  registry: string | null;
  county: string | null;
  registeredArea: string | null;
  surveyNumber: string | null;
  leaseTerm: string | null;
  registrationDate: string | null;
  registeredOwner: string | null;
  locationHint: string | null;
  confidence: number; // 0-100
  notes: string | null;
};

function heuristicExtract(text: string): DeedFields {
  const t = text.replace(/\s+/g, " ");
  const pick = (re: RegExp) => {
    const m = t.match(re);
    return m ? m[1].trim() : null;
  };
  return {
    titleNumber: pick(/title\s*(?:no.?|number)[:\s]*([A-Z0-9/\-.]+)/i),
    lrNumber: pick(/\bL.?R.?\s*(?:no.?)?[:\s]*([A-Z0-9/\-.]+)/i),
    parcelNumber: pick(/parcel\s*(?:no.?|number)[:\s]*([A-Z0-9/\-.]+)/i),
    registry: pick(/registry[:\s]*([A-Za-z\s]{3,40})/i),
    county: pick(/county[:\s]*([A-Za-z\s\-']{3,40})/i),
    registeredArea: pick(
      /(?:area|hectares?|acres?)[:\s]*([0-9.,]+\s*(?:ha|hectares?|acres?|m2|sqm)?)/i,
    ),
    surveyNumber: pick(/survey\s*(?:plan|no.?|number)[:\s]*([A-Z0-9/\-.]+)/i),
    leaseTerm: pick(/(?:lease\s*term|term\s*of\s*years)[:\s]*([0-9]+\s*years?)/i),
    registrationDate: pick(
      /(?:registered|date)[:\s]*([0-9]{1,2}[/\-.][0-9]{1,2}[/\-.][0-9]{2,4})/i,
    ),
    registeredOwner: null,
    locationHint: null,
    confidence: 40,
    notes: "Extracted via local heuristics — AI enhancement unavailable.",
  };
}

export const extractDeedFields = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const v = input as { text?: string };
    if (!v?.text || typeof v.text !== "string") throw new Error("text required");
    return { text: v.text.slice(0, 12000) };
  })
  .handler(async ({ data }): Promise<DeedFields> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return heuristicExtract(data.text);

    const prompt = `You are HALISIA AI, extracting structured fields from OCR text of a Kenyan land title deed. OCR text may contain noise, broken words, or misread characters — correct obvious errors.

Return STRICT JSON matching this TypeScript type — no prose, no markdown fences:
{
  "titleNumber": string | null,
  "lrNumber": string | null,
  "parcelNumber": string | null,
  "registry": string | null,
  "county": string | null,
  "registeredArea": string | null,
  "surveyNumber": string | null,
  "leaseTerm": string | null,
  "registrationDate": string | null,
  "registeredOwner": string | null,
  "locationHint": string | null,   // best guess at town/sub-county/ward for geolocation
  "confidence": number,             // 0-100 based on OCR quality + format recognition
  "notes": string | null            // short note on quality/anomalies
}

Rules:
- Use null when a field truly isn't present. Never fabricate.
- Normalize LR/Parcel formats like "1234/56", "NAIROBI/BLOCK 82/234".
- Kenyan counties only for "county" (title-cased).
- Keep JSON parseable.

OCR_TEXT:
"""
${data.text}
"""`;

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
      if (!res.ok) return heuristicExtract(data.text);
      const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const raw = j.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(raw) as Partial<DeedFields>;
      return {
        titleNumber: parsed.titleNumber ?? null,
        lrNumber: parsed.lrNumber ?? null,
        parcelNumber: parsed.parcelNumber ?? null,
        registry: parsed.registry ?? null,
        county: parsed.county ?? null,
        registeredArea: parsed.registeredArea ?? null,
        surveyNumber: parsed.surveyNumber ?? null,
        leaseTerm: parsed.leaseTerm ?? null,
        registrationDate: parsed.registrationDate ?? null,
        registeredOwner: parsed.registeredOwner ?? null,
        locationHint: parsed.locationHint ?? null,
        confidence: Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 60))),
        notes: parsed.notes ?? null,
      };
    } catch (e) {
      console.error("deed extract failed", e);
      return heuristicExtract(data.text);
    }
  });
