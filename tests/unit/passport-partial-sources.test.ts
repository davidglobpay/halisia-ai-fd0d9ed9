import { expect, it } from "vitest";
import { buildPassportEvidence } from "@/lib/passport-evidence";
import type { Wave4Intel } from "@/lib/wave4-intel.functions";
it("keeps climate evidence when mapping fails without claiming zero facilities", () => {
  const result = buildPassportEvidence({
    lat: 0.56,
    lng: 34.56,
    ref: "",
    positionLabel: "Approximate",
    positionExact: false,
    locationConfidencePct: 40,
    sourceLabel: "QA",
    countyName: "Bungoma",
    admin: null,
    facts: null,
    intel: null,
    intelState: "error",
    geotech: null,
    geoState: "error",
    w4State: "ok",
    retrievedAt: "2026-10-17",
    wave4: {
      admin: {
        county: null,
        constituency: null,
        ward: null,
        town: null,
        village: null,
        displayName: null,
      },
      facilities: { schools: [] },
      climate: {
        annualRainfallMm: 900,
        meanTempC: 21,
        tempMinC: 19,
        tempMaxC: 24,
        source: "NASA POWER",
        period: "QA",
      },
      sources: [
        { label: "NASA POWER climatology", url: "https://power.larc.nasa.gov", used: true },
        {
          label: "OpenStreetMap Overpass (facilities)",
          url: "https://overpass-api.de",
          used: false,
        },
      ],
      generatedAt: "2026-10-17",
    } as Wave4Intel,
  });
  expect(result.items.find((i) => i.id === "rain")?.value).toContain("900");
  expect(result.items.find((i) => i.id === "osm-fac")?.value).toBeNull();
  expect(result.ledger.find((i) => i.id === "om")?.status).toBe("ok");
  expect(result.ledger.find((i) => i.id === "ovp")?.status).not.toBe("ok");
});
