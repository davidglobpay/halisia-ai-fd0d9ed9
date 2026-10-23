import { afterEach, expect, it, vi } from "vitest";
const { load, detail } = vi.hoisted(() => ({ load: vi.fn(), detail: vi.fn() }));
vi.mock("@/lib/brand-asset", () => ({ loadBrandImage: load }));
vi.mock("@/lib/map-image-quality", () => ({ hasMapDetail: detail }));
vi.mock("@/lib/map-evidence-preview", () => ({
  mapPreviewTiles: () => [{ src: "fixture-tile", left: -128, top: -128 }],
}));
import { passportMapImage } from "@/lib/passport-visual-assets";
const tile = {
  dataUrl: "data:image/png;base64,fixture",
  width: 256,
  height: 256,
  ratio: 1,
};
function canvas() {
  const ctx = {
    drawImage: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/png;base64,composite",
  );
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      decode() {
        return Promise.resolve();
      }
    },
  );
  return ctx;
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  load.mockReset();
  detail.mockReset();
});
it("recovers one transient tile failure without changing the map geometry", async () => {
  const ctx = canvas();
  detail.mockReturnValue(true);
  load.mockResolvedValueOnce(null).mockResolvedValueOnce(tile);
  expect(await passportMapImage(-1.38, 36.93, "satellite", 16)).toMatchObject({
    width: 512,
    height: 320,
  });
  expect(load.mock.calls).toEqual([["fixture-tile"], ["fixture-tile"]]);
  expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 128, 32, 256, 256);
});
it("bounds retries and does not embed a map with a persistently missing tile", async () => {
  canvas();
  load.mockResolvedValue(null);
  expect(await passportMapImage(-1.38, 36.93, "map")).toBeNull();
  expect(load).toHaveBeenCalledTimes(2);
});
it("continues rejecting blank imagery after successful loading", async () => {
  canvas();
  load.mockResolvedValue(tile);
  detail.mockReturnValue(false);
  expect(await passportMapImage(-1.38, 36.93, "map")).toBeNull();
  expect(load).toHaveBeenCalledTimes(1);
});
