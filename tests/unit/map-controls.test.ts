import { describe, expect, it } from "vitest";
import { activeOverlayCount, fullscreenSupported, nextLayerSelection } from "@/lib/map-controls";

const BASE = ["satellite", "map", "terrain"] as const;
const OVER = ["buildings", "plot", "streetview"] as const;

describe("layer selection", () => {
  it("keeps exactly one basemap in a single-choice group", () => {
    expect(nextLayerSelection("single", BASE, ["satellite"], "terrain")).toEqual(["terrain"]);
    expect(nextLayerSelection("single", BASE, ["satellite"], "satellite")).toEqual(["satellite"]);
  });

  it("toggles overlays and keeps the options' order", () => {
    expect(nextLayerSelection("multi", OVER, ["plot"], "buildings")).toEqual(["buildings", "plot"]);
    expect(nextLayerSelection("multi", OVER, ["buildings", "plot"], "buildings")).toEqual(["plot"]);
    expect(nextLayerSelection("multi", OVER, [], "streetview")).toEqual(["streetview"]);
  });

  it("ignores an id that is not one of the options", () => {
    expect(nextLayerSelection("single", BASE, ["map"], "nope")).toEqual(["map"]);
    expect(nextLayerSelection("multi", OVER, ["plot"], "nope")).toEqual(["plot"]);
  });

  it("counts only switched-on overlays for the badge", () => {
    expect(
      activeOverlayCount([
        { kind: "single", selected: ["satellite"] },
        { kind: "multi", selected: ["buildings", "plot"] },
        { kind: "multi", selected: [] },
      ]),
    ).toBe(2);
  });
});

describe("fullscreen support", () => {
  it("is false without a document or without the API", () => {
    expect(fullscreenSupported(undefined)).toBe(false);
    expect(fullscreenSupported({ documentElement: {} } as unknown as Document)).toBe(false);
    expect(
      fullscreenSupported({
        documentElement: { requestFullscreen: () => Promise.resolve() },
      } as unknown as Document),
    ).toBe(true);
  });
});
