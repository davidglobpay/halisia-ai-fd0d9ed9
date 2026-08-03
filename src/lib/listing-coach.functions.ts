import { createServerFn } from "@tanstack/react-start";

export type CoachInput = {
  title: string;
  description?: string | null;
  kind: string;
  intent: string;
  county?: string | null;
  address?: string | null;
  price?: number | null;
  monthly_rent?: number | null;
  currency?: string | null;
  size_value?: number | null;
  size_unit?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  amenities?: string[];
  utilities?: string[];
  access_type?: string | null;
  photos?: number;
  hasPin?: boolean;
  missingKeys?: string[];
};

export type CoachOutput = {
  suggestedTitle: string;
  suggestedDescription: string;
  missing: { label: string; why: string; severity: "high" | "medium" | "low" }[];
  improvements: string[];
  confidencePct: number;
  generatedAt: string;
};

function fallback(d: CoachInput): CoachOutput {
  const loc = d.address ?? d.county ?? "Kenya";
  const kind = d.kind.replace("_", " ");
  const size = d.size_value != null ? `${d.size_value} ${d.size_unit ?? "acres"} ` : "";
  const missing: CoachOutput["missing"] = [];
  if (!d.hasPin)
    missing.push({
      label: "Map pin / GPS coordinates",
      why: "Without coordinates we cannot compute the Land Intelligence Score or show maps.",
      severity: "high",
    });
  if ((d.photos ?? 0) < 3)
    missing.push({
      label: "At least three photos",
      why: "Photo-light listings are skipped by most buyers.",
      severity: "high",
    });
  if (!d.price && !d.monthly_rent)
    missing.push({
      label: "Price or monthly rent",
      why: "Price-on-request listings receive far fewer serious enquiries.",
      severity: "medium",
    });
  if (!d.access_type)
    missing.push({
      label: "Road access type",
      why: "Access affects value, financing and construction cost.",
      severity: "medium",
    });
  if (!(d.utilities ?? []).length)
    missing.push({
      label: "Utilities on-site",
      why: "Water and power availability is the most asked question.",
      severity: "medium",
    });
  if ((d.description ?? "").trim().length < 80)
    missing.push({
      label: "A fuller description",
      why: "Context filters out unqualified enquiries.",
      severity: "low",
    });

  return {
    suggestedTitle: `${size}${kind} for ${d.intent} in ${loc}`.trim(),
    suggestedDescription:
      `${size}${kind} available for ${d.intent} in ${loc}.` +
      `${(d.amenities ?? []).length ? ` Nearby: ${(d.amenities ?? []).slice(0, 4).join(", ")}.` : ""}` +
      `${(d.utilities ?? []).length ? ` Utilities on-site: ${(d.utilities ?? []).join(", ")}.` : ""}` +
      `${d.access_type ? ` Access is via ${d.access_type.toLowerCase()}.` : ""}` +
      " Contact the owner through HALISIA AI to arrange a viewing.",
    missing,
    improvements: [
      "Add a wide shot showing the access road and boundaries.",
      "State what is verified (survey, title search date) without claiming legal status.",
      "Mention distance in minutes to the nearest town or main road.",
    ],
    confidencePct: 55,
    generatedAt: new Date().toISOString(),
  };
}

export const coachListing = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as CoachInput)
  .handler(async ({ data }): Promise<CoachOutput> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return fallback(data);

    const prompt = `You are HALISIA AI, a Kenyan property listing coach.
Return STRICT JSON only (no code fences) matching:
{"suggestedTitle":string,"suggestedDescription":string,"missing":[{"label":string,"why":string,"severity":"high"|"medium"|"low"}],"improvements":string[],"confidencePct":number}

DRAFT LISTING:
- Kind: ${data.kind} (${data.intent})
- Title: ${data.title || "—"}
- Description: ${data.description || "—"}
- Location: ${data.address ?? "—"}${data.county ? ", " + data.county : ""} | GPS pin set: ${data.hasPin ? "yes" : "no"}
- Price: ${data.price ?? "—"} | Monthly rent: ${data.monthly_rent ?? "—"} ${data.currency ?? "KES"}
- Size: ${data.size_value ?? "—"} ${data.size_unit ?? ""}
- Bedrooms/bathrooms: ${data.bedrooms ?? "—"}/${data.bathrooms ?? "—"}
- Access: ${data.access_type ?? "—"}
- Utilities: ${(data.utilities ?? []).join(", ") || "—"}
- Amenities: ${(data.amenities ?? []).join(", ") || "—"}
- Photos uploaded: ${data.photos ?? 0}

RULES:
- suggestedTitle: 6-14 words, factual, includes location and size where known.
- suggestedDescription: 90-160 words, plain English, only facts given above, no invented features, no legal/title claims.
- missing: 3-7 concrete gaps a buyer or renter would ask about, ordered most important first.
- improvements: 3-5 short actions that raise listing quality.
- Kenyan context (KPLC, borehole, murram, matatu) only when relevant. JSON must parse.`;

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
      const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}") as Partial<CoachOutput>;
      const fb = fallback(data);
      const missing = Array.isArray(parsed.missing)
        ? parsed.missing.slice(0, 8).map((m) => ({
            label: String(m?.label ?? "").slice(0, 100) || "Missing detail",
            why: String(m?.why ?? "").slice(0, 220),
            severity: (["high", "medium", "low"] as const).includes(
              m?.severity as "high" | "medium" | "low",
            )
              ? (m.severity as "high" | "medium" | "low")
              : "medium",
          }))
        : fb.missing;
      return {
        suggestedTitle: String(parsed.suggestedTitle ?? fb.suggestedTitle).slice(0, 140),
        suggestedDescription: String(parsed.suggestedDescription ?? fb.suggestedDescription).slice(
          0,
          1800,
        ),
        missing: missing.length ? missing : fb.missing,
        improvements: Array.isArray(parsed.improvements)
          ? parsed.improvements.slice(0, 6).map((s) => String(s).slice(0, 200))
          : fb.improvements,
        confidencePct: Math.max(0, Math.min(100, Math.round(Number(parsed.confidencePct) || 62))),
        generatedAt: new Date().toISOString(),
      };
    } catch (e) {
      console.error("listing coach failed", e);
      return fallback(data);
    }
  });