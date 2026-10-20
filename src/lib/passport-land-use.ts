import type { EvidenceItem } from "./passport-evidence";

/** Decision prompts, never parcel suitability, engineering designs or forecasts. */
export function landUseContext(item: EvidenceItem): string | null {
  if (item.value == null) return null;
  if (["soil", "subsoil"].includes(item.id))
    return "Farming: compare crop needs with soil tests and drainage. Construction: obtain a site investigation before choosing foundations or earthworks; this regional soil model cannot specify a foundation, material quantity or labour cost. Mining potential is not established.";
  if (["slope", "landform", "elev"].includes(item.id))
    return "Use terrain context to plan a survey of access, drainage, erosion controls and cut-and-fill. Slope can affect construction effort and farm operations, but these grid samples do not establish flood risk, buildability or engineering quantities.";
  if (["weather", "rain", "temp", "aqi", "water", "flood"].includes(item.id))
    return "Farming and outdoor work: compare the forecast with local observations; climate averages describe seasons. Design: assess shading, ventilation, water storage and drainage. Solar yield needs irradiance, shading and system data; temperature alone cannot predict it. No health, water-safety or flood verdict is inferred.";
  if (item.id === "pop")
    return "Population is a dated county reference for service and workforce planning. A single census total cannot show growth, decline, migration, employment availability or demand at this plot.";
  if (item.id === "economy")
    return "County activities suggest topics to investigate for farming, jobs, suppliers and land use. Confirm current local markets, workforce skills, input costs and planning rules before an investment; this is not a parcel return or employment forecast.";
  if (item.chapter === "access" || item.chapter === "market")
    return "Mapped services help compare daily access, potential workforce catchments and habitability. Confirm operating status, road conditions and travel times. Nearby amenities alone do not establish security, quality of life, job availability or investment returns.";
  if (item.chapter === "identity" || item.chapter === "admin")
    return "Use this location context to find the relevant county services and planning office. Confirm the parcel and permitted land use through current records before committing to farming, construction or purchase.";
  if (item.chapter === "build")
    return "Treat this as an investigation prompt. Foundation design, materials, labour and construction costs require site measurements, professional design and current supplier quotes.";
  return "Use this evidence within its stated scope and date. Land-use decisions also need current planning records and relevant professional or site checks.";
}
