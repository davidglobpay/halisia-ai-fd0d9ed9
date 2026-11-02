import { expect, it, vi } from "vitest";
import { renderPassportPdf } from "@/lib/passport-pdf";
const { rect, text } = vi.hoisted(() => ({ rect: vi.fn(), text: vi.fn() }));
vi.mock("jspdf", async () => {
  const actual = await vi.importActual<typeof import("jspdf")>("jspdf");
  return {
    ...actual,
    default: function (...args: ConstructorParameters<typeof actual.jsPDF>) {
      const doc = new actual.jsPDF(...args);
      const originalRect = doc.rect.bind(doc);
      const originalText = doc.text.bind(doc);
      doc.rect = ((...a: Parameters<typeof doc.rect>) => {
        rect(...a);
        return originalRect(...a);
      }) as typeof doc.rect;
      doc.text = ((...a: Parameters<typeof doc.text>) => {
        text(...a);
        return originalText(...a);
      }) as typeof doc.text;
      return doc;
    },
  };
});
import type { Wave4Intel } from "@/lib/wave4-intel.functions";

it("keeps dense forecast bars positive and centers fallback branding on every page", () => {
  try {
    const doc = renderPassportPdf(
      {
        place: "Synthetic QA",
        locationLine: "Fixture",
        positionLabel: "Synthetic",
        items: [],
        ledger: [],
        coveragePct: 0,
        generatedAt: "2026-10-21",
        wave4: {
          weather: {
            updatedAt: "2026-10-21T00:00:00Z",
            points: Array.from({ length: 96 }, (_, i) => ({
              time: new Date(Date.UTC(2026, 9, 21, i)).toISOString(),
              temperatureC: (i % 20) - 5,
              rainfallMm: i % 4,
              windMS: 3,
              symbol: "clearsky_day",
            })),
          },
        } as Wave4Intel,
      },
      {
        lockup: null,
        symbol: null,
        county: null,
        maps: {},
        amenities: [],
        news: [],
      },
    );
    // The Passport deliberately charts only the next 24 hours of a longer
    // forecast: one temperature and one rainfall bar per hour.
    const printed = text.mock.calls.map((call) => [call[0]].flat().join(" "));
    expect(printed).toContain("Temperature forecast (next 24 h)");
    expect(rect.mock.calls.length).toBeGreaterThanOrEqual(2 * 24);
    for (const call of rect.mock.calls) expect(call[2]).toBeGreaterThan(0);
    const brand = text.mock.calls.filter((call) => call[0] === "HALISIA.AI");
    expect(brand).toHaveLength(doc.getNumberOfPages());
    for (const call of brand) {
      expect(call[1]).toBeCloseTo(doc.internal.pageSize.getWidth() / 2);
      expect(call[3]).toMatchObject({ align: "center" });
    }
  } finally {
    vi.restoreAllMocks();
  }
});
