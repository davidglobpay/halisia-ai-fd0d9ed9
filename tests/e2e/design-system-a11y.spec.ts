import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = ["/style-guide", "/"];

/** Click a style-guide tab and wait until its panel is actually selected. */
async function selectTab(page: import("@playwright/test").Page, name: string) {
  const tab = page.getByRole("tab", { name });
  await expect(tab).toBeVisible();
  await expect(async () => {
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true", { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

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
      await page.waitForLoadState("load");
      await page.waitForTimeout(1_500);
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
    await selectTab(page, "Controls");
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
    await selectTab(page, "Foundations");
    const first = page.getByRole("tab", { name: "Foundations" });
    await expect(async () => {
      await first.focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByRole("tab", { name: "Surfaces" })).toHaveAttribute(
        "aria-selected",
        "true",
        { timeout: 2_000 },
      );
    }).toPass({ timeout: 20_000 });
    await page.keyboard.press("End");
    await expect(page.getByRole("tab", { name: "Motion & a11y" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("reduced motion toggle disables transitions app-wide", async ({ page }) => {
    await page.goto("/style-guide");
    await selectTab(page, "Motion & a11y");
    const toggle = page.getByTestId("style-guide-reduce-motion");
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-reduced-motion", "1");
    const duration = await toggle.evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(parseFloat(duration)).toBeLessThan(0.01);
  });

  test("OS-level prefers-reduced-motion is honoured", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/style-guide");
    await selectTab(page, "Surfaces");
    const duration = await page
      .getByTestId("elev-demo-2")
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(parseFloat(duration)).toBeLessThan(0.01);
  });
});
