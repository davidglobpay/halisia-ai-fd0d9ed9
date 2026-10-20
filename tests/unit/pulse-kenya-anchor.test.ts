import { describe, expect, it } from "vitest";
import { classify } from "@/lib/pulse/classify";

/**
 * The Kenyan anchor.
 *
 * The word-boundary fix removed substring false positives ("Poland" -> land).
 * It did not remove the structural one: CORE categories passed the gate with
 * no Kenyan anchor required, and eight CORE keywords are ordinary English
 * words. Nine of twelve foreign probe headlines were still admitted, and 747
 * live articles (16.0% of the feed) were core-tagged with no Kenyan anchor
 * anywhere in their text.
 */

const art = (title: string, excerpt: string | null = null) => ({
  provider: "rss" as const,
  externalId: null,
  url: "https://example.test/a",
  title,
  author: null,
  sourceName: "Test",
  sourceLogoUrl: null,
  imageUrl: null,
  language: "en",
  excerpt,
  publishedAt: null,
  categoryHint: null,
});

describe("foreign news is not Kenyan land intelligence, whatever it mentions", () => {
  it.each([
    ["Forest fires rage across southern California", "forest -> environment"],
    ["Bridge collapses in Genoa killing dozens", "bridge -> infrastructure"],
    ["Tenants in New York rally against rent increases", "tenant/rent -> housing"],
    ["A survey of 2,000 consumers found confidence falling", "survey -> land"],
    ["Patient left waiting 14 hours on a hospital ward", "ward -> county-government"],
    ["Court rules on the estate of the late businessman", "estate -> housing"],
    ["Thousands displaced by conflict in Sudan", "displaced -> flooding"],
  ])("rejects %j (was admitted via %s)", (title) => {
    expect(classify(art(title)).relevant).toBe(false);
  });
});

describe("a Kenyan anchor can come from a place, the country, or an institution", () => {
  it("accepts a detected gazetteer place", () => {
    expect(classify(art("Developer launches 400 apartments in Ruaka")).relevant).toBe(true);
  });

  it("accepts an explicit country mention", () => {
    expect(classify(art("Survey of Kenya digitises records for 12 counties")).relevant).toBe(true);
  });

  it("accepts a Kenyan institution with no placename at all", () => {
    expect(
      classify(art("Ardhisasa rollout stalls as Lands ministry clears title deed backlog"))
        .relevant,
    ).toBe(true);
  });

  it("finds the anchor in the excerpt, not only the title", () => {
    expect(classify(art("New bypass opens", "The road links Thika to the city.")).relevant).toBe(
      true,
    );
  });
});

describe("the anchor is necessary, not sufficient", () => {
  it("still requires a topical hit", () => {
    expect(classify(art("Kenya names squad for the World Cup qualifier")).relevant).toBe(false);
  });
});
