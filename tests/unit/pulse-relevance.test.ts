import { expect, it } from "vitest";
import { classify } from "@/lib/pulse/classify";
import type { RawArticle } from "@/lib/pulse/providers.server";
const article = (title: string): RawArticle => ({
  title,
  excerpt: null,
  provider: "rss",
  externalId: null,
  url: "https://example.invalid",
  author: null,
  sourceName: null,
  sourceLogoUrl: null,
  imageUrl: null,
  language: "en",
  publishedAt: null,
  categoryHint: null,
  countryHint: null,
});
it.each([
  "Thailand and Poland sign fundamental trade agreement",
  "Massacre memorial unveiled in Srebrenica",
  "Adam Smith biography wins literary prize",
  "England beat New Zealand in cricket thriller",
  "Teachers in Ireland stage walkout over pay",
  "Trump announces tariffs on steel imports",
  "Dubai airport named world's busiest",
  "Business leaders celebrate profits",
  "Team wins instead of losing",
  "Pennsylvania prison transfer announced",
  "Nairobi police recover stolen Land Rover",
  "Nairobi football team wins championship",
  "Karen Smith biography wins prize",
])("rejects unrelated headline: %s", (title) =>
  expect(classify(article(title)).relevant).toBe(false),
);
it.each([
  ["Kiambu county opens new roads", "roads"],
  ["Nairobi title deeds issued to land owners", "land"],
  ["Kenya unveils affordable homes housing programme", "housing"],
  ["Mombasa railway infrastructure extended", "infrastructure"],
  ["Flooding damages Tana River homes", "flooding"],
  ["NEMA protects Nairobi wetlands", "environment"],
  ["Kisumu real estate rents increase", "property"],
  ["Nakuru farmers expand maize agriculture", "agriculture"],
  ["Kenya mineral mining permits reviewed", "land"],
  ["Ruiru water sanitation supply restored", "utilities"],
])("retains relevant headline: %s", (title, tag) => {
  const c = classify(article(title));
  expect(c.relevant).toBe(true);
  expect(c.tags).toContain(tag);
});
it("keeps plurals without matching landing or subwords", () => {
  expect(classify(article("Farmers build roads in Kiambu")).tags).toContain("roads");
  expect(classify(article("Aircraft landing in Ireland")).tags).not.toContain("land");
});
it.each(["", "中文", ".*+?^${}()|[]\\", "a".repeat(5000)])("handles arbitrary text", (title) =>
  expect(() => classify(article(title))).not.toThrow(),
);
