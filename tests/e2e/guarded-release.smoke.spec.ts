import { test, expect } from "@playwright/test";

// Route-shell and logged-out checks deliberately do not authenticate, purchase,
// upload evidence, or assert that external providers returned real site data.
test.describe("guarded release route shells", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__halisiaMapsAuthFailed = true;
      localStorage.setItem("halisia:navguide:v1:seen", "1");
    });
    await page.route(/https:\/\/maps\.(googleapis|gstatic)\.com\//, (route) => route.abort());
  });

  for (const route of [
    "/",
    "/explore",
    "/marketplace",
    "/title-deed",
    "/spatial",
    "/connections",
    "/compare",
    "/reports",
    "/pricing",
  ]) {
    test(`${route} renders without an uncaught application exception`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator("body")).not.toContainText("Something went wrong");
      await expect(page.getByRole("heading").first()).toBeVisible();
      await expect(page.locator('meta[name="halisia-build"]')).toHaveAttribute(
        "content",
        "2026-10-16.1",
      );
      expect(errors).toEqual([]);
    });
  }

  test("dashboard redirects an unauthenticated visitor to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\?redirect=%2Fdashboard/);
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("mobile navigation exposes named controls without horizontal page overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.getByRole("link", { name: /HALISIA AI home/i })).toBeVisible();
  });
});
