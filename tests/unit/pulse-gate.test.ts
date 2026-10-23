import { describe, expect, it } from "vitest";
import { classify } from "@/lib/pulse/classify";

/**
 * The relevance gate, against headlines taken from the live feed on
 * 22 Oct 2026 — not invented examples. Each case names what it is guarding.
 */

const article = (title: string, sourceName = "Daily Nation", excerpt = "") => ({
  provider: "rss" as const,
  externalId: title,
  url: `https://example.test/${encodeURIComponent(title)}`,
  title,
  excerpt,
  author: null,
  sourceName,
  sourceLogoUrl: null,
  imageUrl: null,
  language: "en",
  publishedAt: null,
  categoryHint: null,
});

describe("Kenyan institutions anchor a story", () => {
  it("admits a DCI title-deed fraud story from a Kenyan outlet", () => {
    const c = classify(
      article(
        "DCI moves to block release of title deeds in alleged land fraud case involving KCB official's sister",
        "The Standard",
      ),
    );
    expect(c.relevant).toBe(true);
  });

  it("admits an NSSF land-deal probe from a Kenyan outlet", () => {
    const c = classify(
      article("MPs order fresh DCI probe into NSSF Lenana Road land deal", "Capital FM"),
    );
    expect(c.relevant).toBe(true);
  });

  it("admits an EPRA story", () => {
    const c = classify(
      article("EPRA to announce October-November fuel prices", "People Daily", "energy sector"),
    );
    expect(c.relevant).toBe(true);
  });
});

describe("foreign publishers are refused whatever they say", () => {
  it("refuses Tanzania's NSSF Dege Eco Village", () => {
    const c = classify(
      article("NSSF's Dege Eco Village project now back on the drawing board", "The Citizen"),
    );
    expect(c.relevant).toBe(false);
  });

  it("refuses a gaming headline that scores the roads category", () => {
    const c = classify(
      article("Kat Dennings Recalls Her Six-Hour Mad Max: Fury Road Audition", "Ign Africa"),
    );
    expect(c.relevant).toBe(false);
  });

  it("refuses global climate copy", () => {
    const c = classify(
      article(
        'Nepal flood destruction shows "limits to adaptation", scientists say',
        "Climate Home News",
      ),
    );
    expect(c.relevant).toBe(false);
  });

  it("refuses Menafn financial wire", () => {
    const c = classify(
      article("Treasury Concludes $1 Billion Loan With New Development Bank", "Menafn"),
    );
    expect(c.relevant).toBe(false);
  });

  it("matches the publisher regardless of case or padding", () => {
    expect(
      classify(article("Egypt rail link bypasses the Suez Canal", "  AFRICANEWS ")).relevant,
    ).toBe(false);
  });
});

describe("the existing guarantees still hold", () => {
  it("still refuses a foreign story from an unknown publisher", () => {
    const c = classify(article("Poland opens new highway through farmland", "Some Wire"));
    expect(c.relevant).toBe(false);
  });

  it("still admits a plainly Kenyan county story", () => {
    const c = classify(article("Kiambu county assembly passes new land rates bill"));
    expect(c.relevant).toBe(true);
    expect(c.county).toBe("Kiambu");
  });

  it("does not let a Kenyan publisher alone carry a story", () => {
    // Publisher is a veto, never a licence: Kenyan outlets run foreign copy.
    const c = classify(
      article("Hurricane Polo sweeps over Mexico's Pacific coast", "Citizen Digital"),
    );
    expect(c.relevant).toBe(false);
  });
});
