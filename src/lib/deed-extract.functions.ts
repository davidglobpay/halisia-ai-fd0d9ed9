import { createServerFn } from "@tanstack/react-start";

export type ValidationStep = {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  score: number; // 0-100
};

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
  fieldConfidence: Record<string, number>;
  validationSteps: ValidationStep[];
};

const KENYAN_COUNTIES = [
  "Nairobi","Mombasa","Kisumu","Kiambu","Nakuru","Machakos","Kajiado","Uasin Gishu",
  "Nyeri","Meru","Kilifi","Kwale","Kakamega","Bungoma","Kericho","Bomet","Trans Nzoia",
  "Nandi","Laikipia","Nyandarua","Muranga","Embu","Kirinyaga","Tharaka Nithi","Isiolo",
  "Marsabit","Turkana","West Pokot","Baringo","Samburu","Narok","Migori","Homa Bay",
  "Siaya","Busia","Vihiga","Elgeyo Marakwet","Taita Taveta","Tana River","Lamu",
  "Garissa","Wajir","Mandera","Kitui","Makueni",
];

function scoreField(value: string | null, patterns: RegExp[]): number {
  if (!value) return 0;
  const v = value.trim();
  if (v.length < 2) return 20;
  const matches = patterns.filter((p) => p.test(v)).length;
  const base = 40 + Math.min(30, v.length * 2);
  return Math.min(100, base + matches * 15);
}

function computeValidation(f: Omit<DeedFields, "fieldConfidence" | "validationSteps">): {
  steps: ValidationStep[];
  overall: number;
} {
  const steps: ValidationStep[] = [];

  // 1. Format normalization
  const refPresent = !!(f.titleNumber || f.lrNumber || f.parcelNumber);
  steps.push({
    name: "Reference format",
    status: refPresent ? "pass" : "fail",
    detail: refPresent
      ? "At least one identifier (Title / L.R. / Parcel) detected."
      : "No recognisable deed reference in the input.",
    score: refPresent ? 90 : 20,
  });

  // 2. Kenyan county validity
  const countyMatch = f.county
    ? KENYAN_COUNTIES.find((c) => c.toLowerCase() === f.county!.toLowerCase().trim())
    : null;
  steps.push({
    name: "County recognised",
    status: countyMatch ? "pass" : f.county ? "warn" : "warn",
    detail: countyMatch
      ? `Matched Kenyan county "${countyMatch}".`
      : f.county
        ? `"${f.county}" isn't in the 47-county list — check spelling.`
        : "No county provided; geolocation will fall back to registry.",
    score: countyMatch ? 95 : f.county ? 55 : 40,
  });

  // 3. Locality resolvable
  const localityOk = !!(f.locationHint || f.county || f.registry);
  steps.push({
    name: "Locality resolvable",
    status: localityOk ? "pass" : "fail",
    detail: localityOk
      ? "Enough information to attempt geolocation."
      : "Missing locality — cannot place on the map.",
    score: localityOk ? 80 : 15,
  });

  // 4. Registered date sanity
  const yearMatch = f.registrationDate?.match(/(19|20)\d{2}/);
  const year = yearMatch ? Number(yearMatch[0]) : null;
  const now = new Date().getFullYear();
  const dateOk = year ? year >= 1900 && year <= now : false;
  steps.push({
    name: "Registration date",
    status: dateOk ? "pass" : f.registrationDate ? "warn" : "warn",
    detail: dateOk
      ? `Year ${year} is within a plausible range.`
      : f.registrationDate
        ? `Could not parse a valid year from "${f.registrationDate}".`
        : "No registration date extracted.",
    score: dateOk ? 85 : 45,
  });

  // 5. Area unit sanity
  const areaOk = f.registeredArea
    ? /(ha|hectare|acre|m2|sqm|sq\s*m)/i.test(f.registeredArea)
    : false;
  steps.push({
    name: "Area units",
    status: areaOk ? "pass" : f.registeredArea ? "warn" : "warn",
    detail: areaOk
      ? "Registered area includes a recognised unit."
      : f.registeredArea
        ? "Area found but no unit — verify against the source."
        : "Registered area not extracted.",
    score: areaOk ? 80 : 40,
  });

  const overall = Math.round(steps.reduce((a, s) => a + s.score, 0) / steps.length);
  return { steps, overall };
}

function computeFieldConfidence(
  f: Omit<DeedFields, "fieldConfidence" | "validationSteps" | "confidence" | "notes">,
): Record<string, number> {
  return {
    titleNumber: scoreField(f.titleNumber, [/^[A-Z]{2,4}[\s\-/]?\d/i, /\d{3,}/]),
    lrNumber: scoreField(f.lrNumber, [/^\d+\/\d+/, /BLOCK/i]),
    parcelNumber: scoreField(f.parcelNumber, [/\//, /\d{3,}/]),
    registry: scoreField(f.registry, [/registry/i, /^[A-Z][a-z]/]),
    county: scoreField(f.county, [/^[A-Z][a-z]{2,}/]),
    registeredArea: scoreField(f.registeredArea, [/(ha|acre|m2|sqm)/i, /\d/]),
    surveyNumber: scoreField(f.surveyNumber, [/\d{2,}/]),
    leaseTerm: scoreField(f.leaseTerm, [/\d+\s*year/i]),
    registrationDate: scoreField(f.registrationDate, [/\d{4}/, /[/\-.]/]),
    registeredOwner: scoreField(f.registeredOwner, [/^[A-Z][a-z]/]),
    locationHint: scoreField(f.locationHint, [/[A-Z][a-z]/]),
  };
}

function enrich(
  base: Omit<DeedFields, "fieldConfidence" | "validationSteps">,
): DeedFields {
  const fieldConfidence = computeFieldConfidence(base);
  const { steps, overall } = computeValidation(base);
  const blended = Math.round(base.confidence * 0.5 + overall * 0.5);
  return { ...base, confidence: blended, fieldConfidence, validationSteps: steps };
}

function heuristicExtract(text: string): DeedFields {
  const t = text.replace(/\s+/g, " ");
  const pick = (re: RegExp) => {
    const m = t.match(re);
    return m ? m[1].trim() : null;
  };
  const base = {
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
  return enrich(base);
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
      const base = {
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
      return enrich(base);
    } catch (e) {
      console.error("deed extract failed", e);
      return heuristicExtract(data.text);
    }
  });
