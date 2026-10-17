import type { EvidenceItem } from "./passport-evidence";

/** Populated source-backed context and labelled estimates; never a verification decision. */
export function isVisiblePassportEvidence(item: EvidenceItem): boolean {
  if (!item.value?.trim() || !item.source.trim() || !item.method.trim() || item.cls === "gap")
    return false;
  if (/NaN|undefined|Infinity|^None found/.test(item.value)) return false;
  if (
    ["foundation", "bedrock", "groundwater", "finance", "title", "owner", "boundary"].includes(
      item.id,
    )
  )
    return false;
  if (item.cls === "user") return ["ref", "coords"].includes(item.id);
  if (item.cls === "ai") return item.id === "landform" && item.source.includes("ASTER");
  if (item.cls === "official") return ["pop", "economy"].includes(item.id);
  if (item.cls === "modelled")
    return (
      ["soil", "subsoil", "slope", "rain", "temp", "weather"].includes(item.id) &&
      /ISRIC|SoilGrids|ASTER|Open-Meteo|NASA|MET Norway/.test(item.source)
    );
  if (item.id === "elev") return item.source === "Google Elevation API";
  if (item.id.startsWith("acc-")) return item.source === "Google Places API (New)";
  return ["aqi", "coords", "county", "subcounty", "ward", "osm-fac"].includes(item.id);
}
