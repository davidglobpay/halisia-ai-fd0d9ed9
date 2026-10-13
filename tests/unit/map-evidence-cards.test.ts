// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MapEvidenceCards } from "../../src/components/halisia/map-evidence-cards";
import type { MapEvidence } from "../../src/lib/map-evidence";
afterEach(cleanup);
const item: MapEvidence = {
  id: "test-road",
  label: "Recorded road",
  finding: "Synthetic test finding",
  evidenceClass: "open_data",
  source: "Synthetic fixture",
  capturedAt: null,
  position: { lat: -1, lng: 37, accuracyM: 20 },
  supports: "Recorded geometry",
  limitations: "Legal access unconfirmed",
};
describe("map evidence cards", () => {
  it("retains unknown accuracy and limitations", () => {
    render(
      createElement(MapEvidenceCards, {
        items: [{ ...item, position: { lat: -1, lng: 37, accuracyM: null } }],
        selectedId: null,
        onFocus: vi.fn(),
      }),
    );
    expect(screen.getByText("Accuracy unavailable")).toBeTruthy();
    expect(screen.getByText(item.limitations)).toBeTruthy();
    expect(screen.getByText(item.source)).toBeTruthy();
  });
  it("focuses the exact recorded target without a provider request", () => {
    const onFocus = vi.fn();
    render(
      createElement(MapEvidenceCards, {
        items: [item],
        selectedId: null,
        onFocus,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Show on map" }));
    expect(onFocus).toHaveBeenCalledExactlyOnceWith(item.id, item.position);
    expect(screen.getByText("Capture date unavailable")).toBeTruthy();
    expect(screen.getByText("Reported uncertainty: 20 m")).toBeTruthy();
  });
  it("disables focus when no physical location exists", () => {
    const onFocus = vi.fn();
    render(
      createElement(MapEvidenceCards, {
        items: [{ ...item, position: null }],
        selectedId: null,
        onFocus,
      }),
    );
    const button = screen.getByRole("button", {
      name: "Map evidence unavailable",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onFocus).not.toHaveBeenCalled();
  });
  it("exposes selected state to assistive technology", () => {
    render(
      createElement(MapEvidenceCards, {
        items: [item],
        selectedId: item.id,
        onFocus: vi.fn(),
      }),
    );
    expect(screen.getByRole("button", { name: "Show on map" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });
});
