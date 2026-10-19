import { geotechAvailability } from "@/lib/geotech-availability";
import type { GeotechIntel } from "@/lib/geotech.functions";
import { downloadPassportPdf } from "@/lib/passport-pdf";

/** Shares the verified Passport renderer; no heuristic subsurface or foundation findings. */
export async function downloadGeotechPdf(g: GeotechIntel, address: string) {
  const availability = geotechAvailability(g.terrainMeasured);
  if (!availability.exportAvailable) throw new Error(availability.message);
  return downloadPassportPdf({
    place: address,
    locationLine: "Regional terrain / ISRIC SoilGrids model context",
    positionLabel: "Selected location; no surveyed boundary",
    coords: { lat: g.lat, lng: g.lng },
    items: [
      {
        id: "investigation",
        chapter: "build",
        label: "Ground investigation",
        value:
          "Not assessed: bedrock, groundwater, bearing capacity, erosion risk and foundation suitability.",
        source: "No site investigation supplied",
        method:
          "HALISIA does not sample a ground transect at this location, so no profile is drawn. Arrange site-specific sampling and testing with a licensed geotechnical engineer.",
        usedFor: ["Investigation planning"],
        cls: "gap",
        confidence: "not_assessed",
        retrieved: null,
      },
    ],
    ledger: [],
    coveragePct: 0,
    generatedAt: new Date().toISOString(),
    geotech: g,
  });
}
