import { afterEach, expect, it, vi } from "vitest";
import { loadBrandImage, resetBrandImageCache } from "@/lib/brand-asset";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetBrandImageCache();
});
it("retries an image after a transient failure instead of caching failure for the session", async () => {
  let attempts = 0;
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 100;
    naturalHeight = 50;
    crossOrigin = "";
    set src(_url: string) {
      attempts++;
      queueMicrotask(() => (attempts === 1 ? this.onerror?.() : this.onload?.()));
    }
  }
  vi.stubGlobal("Image", FakeImage);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/png;base64,synthetic",
  );
  expect(await loadBrandImage("/brand.png")).toBeNull();
  expect(await loadBrandImage("/brand.png")).toMatchObject({ width: 100, height: 50, ratio: 2 });
  expect(attempts).toBe(2);
});
