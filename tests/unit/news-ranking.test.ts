import { describe, expect, it } from "vitest";
import { rankCountyNews, scoreArticle, placeTerms } from "@/lib/pulse/news-ranking";

/**
 * The six stories the Usenge Passport printed on 22 Oct 2026, in the order it
 * printed them — newest first. The pier project came last.
 */
const USENGE_FEED = [
  {
    title: "Homa Bay, Siaya and Migori infrastructure projects as key works advance across Nyanza",
    source_name: "Pulse Kenya",
    published_at: "2026-10-16T00:00:00Z",
    url: "https://example.test/1",
    category: "transport",
  },
  {
    title: "Natembeya, Orengo security withdrawal sparks concerns over govt critics ahead of 2027",
    source_name: "People Daily",
    published_at: "2026-10-16T00:00:00Z",
    url: "https://example.test/2",
    category: "business",
  },
  {
    title: "Removing Ruto is a pipe dream: Wandayi tells opposition ahead of 2027",
    source_name: "People Daily",
    published_at: "2026-10-15T00:00:00Z",
    url: "https://example.test/3",
    category: "politics",
  },
  {
    title: "Ida Odinga warns youth against disrupting Raila's memorial service",
    source_name: "People Daily",
    published_at: "2026-10-15T00:00:00Z",
    url: "https://example.test/4",
    category: "business",
  },
  {
    title: "Raila Odinga anniversary: Kalonzo heads to Bondo to honour late ODM leader",
    source_name: "People Daily",
    published_at: "2026-10-15T00:00:00Z",
    url: "https://example.test/5",
    category: "transport",
  },
  {
    title: "Govt Banks On Usenge Pier Project to Boost Lake Victoria Trade and Transport",
    source_name: "Business Today Kenya",
    published_at: "2026-10-11T00:00:00Z",
    url: "https://example.test/6",
    category: "transport",
  },
];

const TERMS = placeTerms("Usenge", "Bondo - Usenge Rd");
const COUNTY = placeTerms("Siaya");

describe("the Usenge regression", () => {
  const ranked = rankCountyNews(USENGE_FEED, { terms: TERMS, countyTerms: COUNTY });

  it("leads with the pier project at this exact place", () => {
    expect(ranked[0].title).toContain("Usenge Pier Project");
  });

  it("no longer ranks the pier story last", () => {
    // It was 6 of 6 by pure recency, despite being the oldest AND the most
    // consequential thing in the report.
    expect(ranked.findIndex((a) => a.title.includes("Pier"))).toBe(0);
  });

  it("ranks the infrastructure story above national politics", () => {
    const infra = ranked.findIndex((a) => a.title.includes("infrastructure projects"));
    const ruto = ranked.findIndex((a) => a.title.includes("Removing Ruto"));
    expect(infra).toBeLessThan(ruto);
  });

  it("scores the memorial service and the opposition story at zero", () => {
    expect(scoreArticle(USENGE_FEED[3], TERMS)).toBe(0);
    expect(scoreArticle(USENGE_FEED[2], TERMS)).toBe(0);
  });

  it("still returns all six — a thin feed shows what it has", () => {
    expect(ranked).toHaveLength(6);
  });

  it("keeps the zero-scoring stories at the bottom, newest first", () => {
    const tail = ranked.slice(-2).map((a) => a.relevanceScore);
    expect(tail.every((s) => s === 0)).toBe(true);
  });
});

describe("scoring signals", () => {
  const base = {
    source_name: "Daily Nation",
    published_at: "2026-10-20T00:00:00Z",
    url: null,
    category: null,
  };

  it("weighs a CORE land category above an adjacent one", () => {
    expect(scoreArticle({ ...base, title: "x", category: "land" })).toBeGreaterThan(
      scoreArticle({ ...base, title: "x", category: "transport" }),
    );
  });

  it("gives politics nothing", () => {
    expect(scoreArticle({ ...base, title: "x", category: "politics" })).toBe(0);
  });

  it("rewards a title about something being built", () => {
    expect(scoreArticle({ ...base, title: "New bypass construction begins" })).toBeGreaterThan(0);
  });

  it("does not fire 'port' inside 'important'", () => {
    // The substring bug that filled this feed with foreign wire copy.
    expect(scoreArticle({ ...base, title: "An important announcement today" })).toBe(0);
  });

  it("does not fire 'land' inside 'Thailand'", () => {
    expect(scoreArticle({ ...base, title: "Thailand opens a new season" })).toBe(0);
  });

  it("rewards a title naming the place", () => {
    const terms = placeTerms("Usenge");
    expect(scoreArticle({ ...base, title: "Usenge traders meet" }, terms)).toBe(2);
    expect(scoreArticle({ ...base, title: "Kisumu traders meet" }, terms)).toBe(0);
  });
});

describe("place terms", () => {
  it("splits a location label into usable tokens", () => {
    expect(placeTerms("Bondo - Usenge Rd")).toContain("usenge");
    expect(placeTerms("Bondo - Usenge Rd")).toContain("bondo");
  });

  it("drops fragments too short to be evidence", () => {
    expect(placeTerms("Rd, St, Usenge")).not.toContain("rd");
    expect(placeTerms("Rd, St, Usenge")).not.toContain("st");
  });

  it("ignores null and undefined parts", () => {
    expect(placeTerms(null, undefined, "Siaya")).toEqual(["siaya"]);
  });

  it("deduplicates repeated tokens", () => {
    expect(placeTerms("Usenge", "Usenge Rd")).toEqual(["usenge"]);
  });
});

describe("ordering and limits", () => {
  const a = (title: string, category: string, published_at: string) => ({
    title,
    category,
    published_at,
    source_name: null,
    url: null,
  });

  it("uses recency only to break a tie", () => {
    const r = rankCountyNews([
      a("Road project approved", "roads", "2026-01-01T00:00:00Z"),
      a("Road project approved again", "roads", "2026-06-01T00:00:00Z"),
    ]);
    expect(r[0].title).toBe("Road project approved again");
  });

  it("puts a relevant old story above an irrelevant new one", () => {
    const r = rankCountyNews([
      a("Celebrity wedding draws crowds", "business", "2026-10-20T00:00:00Z"),
      a("County allocates land for new market", "land", "2024-01-01T00:00:00Z"),
    ]);
    expect(r[0].title).toContain("allocates land");
  });

  it("honours the limit", () => {
    expect(rankCountyNews(USENGE_FEED, { limit: 3 })).toHaveLength(3);
  });

  it("survives an empty feed", () => {
    expect(rankCountyNews([])).toEqual([]);
  });

  it("survives a missing published_at", () => {
    const r = rankCountyNews([a("Land deal", "land", ""), a("Other land deal", "land", "")]);
    expect(r).toHaveLength(2);
  });

  it("does not mutate the input array", () => {
    const copy = [...USENGE_FEED];
    rankCountyNews(USENGE_FEED);
    expect(USENGE_FEED).toEqual(copy);
    expect(USENGE_FEED[0].title).toContain("Homa Bay");
  });
});
