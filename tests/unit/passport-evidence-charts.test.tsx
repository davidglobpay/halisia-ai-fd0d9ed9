import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  ClimateEvidence,
  EvidenceSeries,
  PhysicalEvidence,
} from "@/components/halisia/land-passport/evidence-charts";
import type { Wave4Intel } from "@/lib/wave4-intel.functions";
import type { GeotechIntel } from "@/lib/geotech.functions";
afterEach(cleanup);
it("keeps missing chart samples as gaps and shows the original values accessibly", () => {
  render(
    <EvidenceSeries
      title="Rainfall"
      unit="mm"
      bars
      points={[
        { label: "Jan", value: 20 },
        { label: "Feb", value: null },
        { label: "Mar", value: 0 },
      ]}
    />,
  );
  expect(screen.getByRole("table").textContent).toContain("Not returned");
  expect(screen.getAllByRole("row")[3].textContent).toContain("0.0");
  expect(document.querySelectorAll("rect")).toHaveLength(2);
});
it("does not draw a chart for absent or non-finite series", () => {
  const { container } = render(
    <EvidenceSeries title="Rainfall" unit="mm" points={[{ label: "Jan", value: NaN }]} />,
  );
  expect(container).toBeEmptyDOMElement();
});
it("uses monthly climate data without a map", () => {
  render(
    <ClimateEvidence
      id="rain"
      data={
        {
          climate: {
            monthly: [{ month: "Jan", temperatureC: 22, rainfallMm: 34 }],
            source: "Synthetic source",
            period: "Synthetic period",
          },
        } as Wave4Intel
      }
    />,
  );
  expect(screen.getByRole("img")).toHaveAccessibleName(/Monthly rainfall/);
  expect(screen.getByText(/Synthetic period/)).toBeVisible();
  expect(document.querySelectorAll("img")).toHaveLength(0);
});
it("shows modelled soil depth bands without inventing groundwater or bedrock depths", () => {
  render(
    <PhysicalEvidence
      id="soil"
      data={
        {
          soilLayers: [{ depth: "0-5cm", texture: "Loam", sandPct: 40, siltPct: 40, clayPct: 20 }],
        } as GeotechIntel
      }
    />,
  );
  expect(screen.getByText("0-5cm")).toBeVisible();
  expect(screen.getByText(/no depth plotted/i)).toBeVisible();
});
it("converts returned percent slope to degrees and keeps the model label", () => {
  render(
    <PhysicalEvidence
      id="slope"
      data={
        {
          terrainMeasured: true,
          terrain: { slopePct: 100, aspectDeg: 90, aspectLabel: "E", minM: 100, maxM: 110 },
        } as GeotechIntel
      }
    />,
  );
  expect(screen.getByRole("img")).toHaveAccessibleName(/45.0 degrees/);
  expect(screen.getByText(/Schematic with vertical exaggeration/)).toBeVisible();
});
