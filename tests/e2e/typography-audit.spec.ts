import { expect, test, type Page } from "@playwright/test";

/**
 * Verifies the approved three-plus-mono type system is actually applied to the
 * right roles at desktop and mobile breakpoints:
 *   Space Grotesk      → display / headings / card titles
 *   Inter              → body copy and labels
 *   Cormorant Garamond → premium report / editorial headings
 *   IBM Plex Mono      → numeric + code
 */

const DESKTOP = { width: 1280, height: 1800 };
const MOBILE = { width: 390, height: 844 };

async function family(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((el) => getComputedStyle(el).fontFamily);
}

for (const [label, viewport] of [
  ["desktop", DESKTOP],
  ["mobile", MOBILE],
] as const) {
  test.describe(`typography (${label})`, () => {
    test.use({ viewport });

    test("headings use Space Grotesk and body uses Inter", async ({ page }) => {
      await page.goto("/");
      expect(await family(page, "h1")).toContain("Space Grotesk");
      expect(await family(page, "h2")).toContain("Space Grotesk");
      expect(await family(page, "body")).toContain("Inter");
      expect(await family(page, "p")).toContain("Inter");
    });

    test("token audit page reports no typography mismatches", async ({ page }) => {
      await page.goto("/token-audit");
      const summary = page.getByTestId("token-audit-summary");
      await expect(summary).toBeVisible();
      await expect(summary).toHaveAttribute("data-font-issue-count", "0");
      await expect(page.getByTestId("font-mismatch")).toHaveCount(0);
    });

    test("editorial and mono roles resolve to the approved families", async ({ page }) => {
      await page.goto("/token-audit");
      await expect(page.getByTestId("token-audit")).toBeVisible();
      const fams = await page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        return {
          editorial: cs.getPropertyValue("--font-editorial"),
          mono: cs.getPropertyValue("--font-mono"),
          numeric: cs.getPropertyValue("--font-numeric"),
        };
      });
      expect(fams.editorial).toContain("Cormorant Garamond");
      expect(fams.mono).toContain("IBM Plex Mono");
      expect(fams.numeric).toContain("IBM Plex Mono");
    });

    test("no legacy palette tokens remain active", async ({ page }) => {
      await page.goto("/token-audit");
      await expect(page.getByTestId("token-audit-summary")).toHaveAttribute(
        "data-legacy-count",
        "0",
      );
      await expect(page.getByTestId("token-legacy")).toHaveCount(0);
    });
  });
}
