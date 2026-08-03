import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = ["/style-guide", "/"];

test.describe("Design system accessibility", () => {
  test.beforeEach(async ({ context }) => {
    // Suppress the first-run navigation guide so it cannot trap focus.
    await context.addInitScript(() => {
      try {
        window.localStorage.setItem("halisia:navguide:v1:seen", String(Date.now()));
      } catch {
        /* storage disabled */
      }
    });
  });
  for (const path of PAGES) {
    test(`no serious axe violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const serious = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      if (serious.length) {
        console.log(
          serious
            .map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0]?.target.join(" ")}`)
            .join("\n"),
        );
      }
      expect(serious, JSON.stringify(serious.map((v) => v.id))).toHaveLength(0);
    });
  }

  test("glass panels and controls pass contrast checks", async ({ page }) => {
    await page.goto("/style-guide");
    await expect(page.getByTestId("style-guide")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .include('[data-testid="style-guide"]')
      .withRules(["color-contrast"])
      .analyze();
    expect(
      results.violations,
      JSON.stringify(results.violations.map((v) => v.nodes.length)),
    ).toEqual([]);
  });

  test("buttons and tabs expose a visible focus ring", async ({ page }) => {
    await page.goto("/style-guide");
    await page.getByRole("tab", { name: "Controls" }).click();
    const button = page.getByRole("button", { name: "Run analysis" });
    await button.evaluate((el: HTMLElement) => el.focus());
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    const style = await button.evaluate((el) => {
      const s = getComputedStyle(el);
      return { width: s.outlineWidth, style: s.outlineStyle, color: s.outlineColor };
    });
    expect(style.style).not.toBe("none");
    expect(parseFloat(style.width)).toBeGreaterThanOrEqual(2);
  });

  test("segmented tabs support arrow-key roving focus", async ({ page }) => {
    await page.goto("/style-guide");
    const first = page.getByRole("tab", { name: "Foundations" });
    await first.click();
    await first.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Surfaces" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.keyboard.press("End");
    await expect(page.getByRole("tab", { name: "Motion & a11y" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("reduced motion toggle disables transitions app-wide", async ({ page }) => {
    await page.goto("/style-guide");
    await page.getByRole("tab", { name: "Motion & a11y" }).click();
    const toggle = page.getByTestId("style-guide-reduce-motion");
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-reduced-motion", "1");
    const duration = await toggle.evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(parseFloat(duration)).toBeLessThan(0.01);
  });

  test("OS-level prefers-reduced-motion is honoured", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/style-guide");
    const duration = await page
      .getByTestId("elev-demo-2")
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(parseFloat(duration)).toBeLessThan(0.01);
  });
});
