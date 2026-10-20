import { afterEach, expect, it, vi } from "vitest";
const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("jspdf", async () => {
  const actual = await vi.importActual<typeof import("jspdf")>("jspdf");
  return {
    ...actual,
    default: function (...args: ConstructorParameters<typeof actual.jsPDF>) {
      const doc = new actual.jsPDF(...args);
      doc.save = save;
      return doc;
    },
  };
});
vi.mock("@/lib/brand-asset", () => ({ loadBrandImage: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/passport-visual-assets", () => ({
  passportMapImage: vi.fn().mockResolvedValue(null),
}));
import { downloadPassportPdf } from "@/lib/passport-pdf";
import { loadBrandImage } from "@/lib/brand-asset";
afterEach(() => vi.clearAllMocks());
it("downloads with an honest named fallback even when artwork cannot decode", async () => {
  await expect(
    downloadPassportPdf({
      place: "Synthetic QA",
      locationLine: "Fixture",
      positionLabel: "Synthetic",
      items: [],
      ledger: [],
      coveragePct: 0,
      generatedAt: "2026-10-20",
    }),
  ).resolves.toBe("halisia-land-passport-synthetic-qa.pdf");
  expect(save).toHaveBeenCalledWith("halisia-land-passport-synthetic-qa.pdf");
  const urls = vi.mocked(loadBrandImage).mock.calls.map((c) => c[0]);
  expect(urls.every((u) => !u.includes("/__l5e/"))).toBe(true);
});
