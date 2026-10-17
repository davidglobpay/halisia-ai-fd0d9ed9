import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
vi.mock("@/components/halisia/listen-button", () => ({ ListenButton: () => null }));
vi.mock("@/components/halisia/output-tools", () => ({
  OutputTools: () => null,
  OutputIcon: () => null,
  OutputVisual: () => createElement("span", { "data-testid": "representative-visual" }),
}));
import { EvidenceRow } from "@/components/halisia/land-passport/evidence-row";
import type { EvidenceItem } from "@/lib/passport-evidence";
import type { MapEvidence } from "@/lib/map-evidence";

afterEach(cleanup);
const item: EvidenceItem = {
  id: "soil",
  chapter: "physical",
  label: "Soil",
  value: "Synthetic regional estimate",
  source: "Synthetic fixture",
  method: "Regional grid",
  usedFor: ["Context"],
  cls: "modelled",
  confidence: "low",
  retrieved: null,
};
const mapItem: MapEvidence = {
  id: item.id,
  label: item.label,
  finding: item.value!,
  source: item.source,
  evidenceClass: "model_inference",
  capturedAt: null,
  position: { lat: -1, lng: 37, accuracyM: null },
  positionScope: "sample",
  supports: "Context",
  limitations: "Not a laboratory soil test",
};
it("puts the actual map preview in the data row instead of a representative visual", () => {
  render(createElement(EvidenceRow, { item, mapItem, onMapFocus: vi.fn() }));
  expect(
    screen.getByTestId("evidence-row").contains(screen.getByTestId("map-evidence-preview")),
  ).toBe(true);
  expect(screen.queryByTestId("representative-visual")).toBeNull();
  expect(screen.getByText("Not a laboratory soil test")).toBeTruthy();
  expect(screen.getByText(/Accuracy unavailable/)).toBeTruthy();
});
it("does not add a map to an unlocated output", () => {
  render(
    createElement(EvidenceRow, {
      item,
      mapItem: { ...mapItem, position: null },
      onMapFocus: vi.fn(),
    }),
  );
  expect(screen.queryByTestId("map-evidence-preview")).toBeNull();
  expect(screen.getByText(item.value!)).toBeTruthy();
});
it("withholds unsupported map evidence without removing the written finding", () => {
  render(
    createElement(EvidenceRow, { item, mapItem: { ...mapItem, source: "" }, onMapFocus: vi.fn() }),
  );
  expect(screen.queryByTestId("map-evidence-preview")).toBeNull();
  expect(screen.getByText(item.value!)).toBeTruthy();
});
it("explains missing evidence without inventing a value or showing imagery", () => {
  render(
    createElement(EvidenceRow, {
      item: { ...item, value: null, cls: "gap", chapter: "trust", note: "Registry not connected" },
    }),
  );
  expect(screen.getByText("Evidence needed")).toBeTruthy();
  expect(screen.getByText("Not checked yet")).toBeTruthy();
  expect(screen.getByText(/licensed professional/)).toBeTruthy();
  expect(screen.queryByTestId("map-evidence-preview")).toBeNull();
  expect(screen.getByText("Registry not connected").closest("details")).toBeTruthy();
});
it("labels model outputs as interpretations rather than site inspections", () => {
  render(createElement(EvidenceRow, { item }));
  expect(screen.getByText(/not a site inspection/)).toBeTruthy();
  expect(screen.getByText(item.source)).toBeTruthy();
});
