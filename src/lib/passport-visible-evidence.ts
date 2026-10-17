import type { EvidenceItem } from "./passport-evidence";

/** Conservative presentation allowlist, not a verification or registry decision.
 * Only populated, high-confidence direct provider responses supported by the
 * current adapter are displayed. A model, local reference or missing response
 * must not become a fact merely because its text sounds confident.
 */
export function isVisiblePassportEvidence(item: EvidenceItem): boolean {
  if (!item.value?.trim() || item.cls !== "measured" || item.confidence !== "high") return false;
  if (!item.source.trim() || !item.method.trim()) return false;
  if (item.id === "elev") return item.source === "Google Elevation API";
  return item.id.startsWith("acc-") && item.source === "Google Places API (New)";
}
