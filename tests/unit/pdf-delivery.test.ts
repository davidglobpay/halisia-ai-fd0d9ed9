import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearReadyFile,
  deliverBlob,
  deliverPdf,
  formatFileSize,
  getReadyFile,
  subscribeReadyFile,
  tapStillFresh,
} from "@/lib/pdf-delivery";
import { AMENITY_CAP_NOTE, PLACES_PER_CATEGORY, amenityCount } from "@/lib/amenity-count";

let urlCount = 0;
const revoked: string[] = [];

beforeEach(() => {
  urlCount = 0;
  revoked.length = 0;
  // jsdom does not implement object URLs.
  URL.createObjectURL = vi.fn(() => `blob:test/${++urlCount}`);
  URL.revokeObjectURL = vi.fn((u: string) => {
    revoked.push(u);
  });
});

afterEach(() => {
  clearReadyFile();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function fakeDoc() {
  return {
    save: vi.fn(),
    output: vi.fn(() => new Blob(["%PDF-1.7 test"], { type: "application/pdf" })),
  };
}

function setActivation(isActive: boolean | undefined) {
  Object.defineProperty(navigator, "userActivation", {
    configurable: true,
    value: isActive === undefined ? undefined : { isActive },
  });
}

describe("tap freshness", () => {
  it("is fresh only when the browser says so", () => {
    expect(tapStillFresh({ userActivation: { isActive: true } })).toBe(true);
    expect(tapStillFresh({ userActivation: { isActive: false } })).toBe(false);
    expect(tapStillFresh({})).toBe(false);
    expect(tapStillFresh(undefined)).toBe(false);
  });
});

describe("delivering a generated PDF", () => {
  it("saves immediately and shows no panel while the tap is still fresh", () => {
    setActivation(true);
    const doc = fakeDoc();
    deliverPdf(doc, "a.pdf");
    expect(doc.save).toHaveBeenCalledWith("a.pdf");
    expect(getReadyFile()).toBeNull();
  });

  it("still tries to save, and also offers the file, once the tap has gone stale", () => {
    setActivation(false);
    const doc = fakeDoc();
    deliverPdf(doc, "halisia-land-passport-kitengela.pdf");
    expect(doc.save).toHaveBeenCalledWith("halisia-land-passport-kitengela.pdf");
    const ready = getReadyFile();
    expect(ready?.filename).toBe("halisia-land-passport-kitengela.pdf");
    expect(ready?.mimeType).toBe("application/pdf");
    expect(ready?.url).toMatch(/^blob:/);
  });

  it("offers the file when the browser cannot report tap freshness", () => {
    setActivation(undefined);
    deliverPdf(fakeDoc(), "b.pdf");
    expect(getReadyFile()?.filename).toBe("b.pdf");
  });

  it("lets a second export replace the first and releases the old link", () => {
    setActivation(false);
    deliverPdf(fakeDoc(), "first.pdf");
    const firstUrl = getReadyFile()!.url;
    deliverPdf(fakeDoc(), "second.pdf");
    expect(getReadyFile()?.filename).toBe("second.pdf");
    expect(revoked).toContain(firstUrl);
  });

  it("notifies the panel and stops after unsubscribing", () => {
    setActivation(false);
    const seen: Array<string | null> = [];
    const off = subscribeReadyFile((f) => seen.push(f?.filename ?? null));
    deliverPdf(fakeDoc(), "c.pdf");
    clearReadyFile();
    off();
    deliverPdf(fakeDoc(), "d.pdf");
    expect(seen).toEqual(["c.pdf", null]);
  });
});

describe("delivering other files", () => {
  it("clicks a download link and keeps it alive long enough for slow phones", () => {
    vi.useFakeTimers();
    setActivation(true);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    deliverBlob(new Blob(["x"], { type: "text/plain" }), "brochure.txt");
    expect(click).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5_000);
    expect(revoked).toHaveLength(0);
    vi.advanceTimersByTime(60_000);
    expect(revoked).toHaveLength(1);
    expect(getReadyFile()).toBeNull();
    vi.useRealTimers();
  });

  it("offers a stale-tap blob in the panel too", () => {
    setActivation(false);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    deliverBlob(new Blob(["a,b"], { type: "text/csv" }), "listings.csv");
    expect(getReadyFile()?.filename).toBe("listings.csv");
  });
});

describe("file size label", () => {
  it("reads like a person would say it", () => {
    expect(formatFileSize(618_086)).toBe("604 KB");
    expect(formatFileSize(500)).toBe("1 KB");
    expect(formatFileSize(12_480_000)).toBe("11.9 MB");
    expect(formatFileSize(0)).toBe("");
  });
});

describe("amenity counts at the lookup cap", () => {
  it("shows exact counts below the cap and '6+' at it", () => {
    expect(PLACES_PER_CATEGORY).toBe(6);
    expect(amenityCount(0)).toBe("0");
    expect(amenityCount(3)).toBe("3");
    expect(amenityCount(5)).toBe("5");
    expect(amenityCount(6)).toBe("6+");
    expect(amenityCount(9)).toBe("6+");
  });

  it("never shows a negative or fractional count", () => {
    expect(amenityCount(-2)).toBe("0");
    expect(amenityCount(Number.NaN)).toBe("0");
    expect(amenityCount(2.7)).toBe("2");
  });

  it("explains what the plus sign means", () => {
    expect(AMENITY_CAP_NOTE).toContain("at least 6");
  });
});
