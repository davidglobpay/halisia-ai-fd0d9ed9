import type { EvidenceItem, PassportEvidenceInput } from "@/lib/passport-evidence";
import { CONFIDENCE_LABEL } from "@/lib/passport-evidence";
import { evidenceTarget, type MapEvidence } from "@/lib/map-evidence";

// An explicit sampling allowlist prevents county aggregates or new findings
// from silently inheriting a precise-looking map pin.
const SAMPLED_IDS = new Set([
  "elev", "slope", "landform", "soil", "subsoil", "rain", "temp", "aqi",
  "water", "osm-fac", "foundation", "groundwater", "bedrock",
]);

/** No parsing, geocoding, provider calls, capture-date or accuracy inference. */
export function passportMapEvidence(
  items: readonly EvidenceItem[],
  input: Pick<PassportEvidenceInput, "lat" | "lng" | "intel">,
): MapEvidence[] {
  return items.filter((item) => item.cls !== "gap" && item.value != null && item.value.trim() !== "").map((item) => {
    const category = item.id.startsWith("acc-") ? item.id.slice(4) : null;
    const categories = input.intel?.categories;
    const places = categories && category && Object.prototype.hasOwnProperty.call(categories, category)
      ? categories[category as keyof typeof categories] : undefined;
    const located = places?.[0]?.location;
    const sampled = SAMPLED_IDS.has(item.id);
    const supplied = item.id === "coords";
    const point = located ?? (sampled || supplied ? { lat: input.lat, lng: input.lng } : null);
    const scope = located
      ? "Focus is the provider-reported nearest place, not the parcel or every result in this aggregate. Legal access and surveyed boundaries are unconfirmed."
      : supplied
        ? "Supplied Passport point only; not independently established as a parcel, survey or ownership record."
        : sampled
          ? "Regional/context sampled around this Passport point, not a located site observation. Grid resolution is not positional accuracy."
          : "Non-located context or aggregate; no physical finding location is supplied.";
    const result: MapEvidence = {
      id: item.id, label: item.label, finding: item.value ?? "",
      // 'official' here means official statistics, never registry evidence.
      // 'measured' does not establish a professional survey or attestation.
      evidenceClass: supplied || item.cls === "user" ? "user_submission"
        : item.cls === "modelled" || item.cls === "ai" ? "model_inference" : "open_data",
      source: item.source, capturedAt: null,
      position: point ? { lat: point.lat, lng: point.lng, accuracyM: null } : null,
      supports: item.usedFor.join("; "),
      limitations: [scope, item.note, "Does not confirm title, ownership or surveyed boundaries."].filter(Boolean).join(" "),
      method: item.method, confidence: CONFIDENCE_LABEL[item.confidence],
      retrievedAt: item.retrieved,
    };
    return { ...result, position: evidenceTarget(result) };
  });
}