import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { mapPreviewTiles } from "@/lib/map-evidence-preview";
import { MapEvidencePreview } from "@/components/halisia/map-evidence-preview";
import type { MapEvidence } from "@/lib/map-evidence";

afterEach(cleanup);
const target = { lat: -1.15123, lng: 36.96123, accuracyM: null };
const item: MapEvidence = {
  id: "soil",
  label: "Soil",
  finding: "Synthetic regional estimate",
  source: "Synthetic fixture",
  evidenceClass: "model_inference",
  capturedAt: null,
  position: target,
  positionScope: "sample",
  supports: "Regional screening",
  limitations: "Not a soil test",
};
describe("inline map evidence", () => {
  it("centers native satellite tiles on the exact supplied coordinate", () => {
    const tiles = mapPreviewTiles({ lat: 0, lng: 0, accuracyM: null }, "satellite", 16)!;
    expect(tiles).toHaveLength(9);
    expect(tiles[4]).toEqual({
      src: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/16/32768/32768",
      left: 0,
      top: 0,
    });
  });
  it("wraps longitude edges without requesting out-of-range tile columns", () => {
    for (const lng of [-180, 180]) {
      const tiles = mapPreviewTiles({ ...target, lng }, "terrain", 12)!;
      expect(
        tiles.every((tile) => {
          const column = Number(tile.src.split("/").at(-2));
          return column >= 0 && column < 4096;
        }),
      ).toBe(true);
    }
  });
  it.each([NaN, Infinity, 86, -86])(
    "withholds unsupported latitude %s instead of moving the point",
    (lat) => {
      expect(mapPreviewTiles({ ...target, lat }, "satellite", 16)).toBeNull();
    },
  );
  it("keeps regional sampling broad and explicitly unverified", () => {
    render(createElement(MapEvidencePreview, { item, target, selected: false, onFocus: vi.fn() }));
    expect(screen.getByText(/Regional sampling context/)).toBeTruthy();
    expect(screen.getByText(/zoom 12/)).toBeTruthy();
    expect(screen.getByText(/does not independently confirm/)).toBeTruthy();
    expect(screen.getByText(/capture date unavailable/)).toBeTruthy();
  });
  it("switches reference layers without changing the target", () => {
    const onFocus = vi.fn();
    const { container } = render(
      createElement(MapEvidencePreview, { item, target, selected: false, onFocus }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Terrain", exact: true }));
    expect(container.querySelector("img")?.src).toContain("tile.opentopomap.org/12/");
    fireEvent.click(screen.getByRole("button", { name: "Inspect map evidence for Soil" }));
    expect(onFocus).toHaveBeenCalledOnce();
    expect(screen.getByText(/-1.15123, 36.96123/)).toBeTruthy();
  });
  it("shows an honest failure state and never substitutes generated imagery", () => {
    const { container } = render(
      createElement(MapEvidencePreview, { item, target, selected: false, onFocus: vi.fn() }),
    );
    fireEvent.error(container.querySelector("img")!);
    expect(screen.getByText(/No substitute image has been generated/)).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Map", exact: true }));
    expect(container.querySelector("img")?.src).toContain("basemaps.cartocdn.com");
  });
});
