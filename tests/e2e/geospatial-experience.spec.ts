import { expect, test } from "@playwright/test";

test("landing hands off from a streamed Earth-to-Kenya intro", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => sessionStorage.removeItem("halisia:globe-intro:v2"));
  await page.goto("/");
  const intro = page.getByTestId("globe-intro");
  await expect(intro).toBeVisible({ timeout: 15_000 });
  await expect(intro).toContainText("Earth · Africa · Kenya");
  await expect(intro).toContainText("provider dates and coverage vary");
  await expect(intro).toBeHidden({ timeout: 20_000 });
});

test("Explore exposes a closable Street View experience", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByTestId("explore-page")).toHaveAttribute("data-hydrated", "true", {
    timeout: 30_000,
  });
  const open = page.locator('[data-testid="open-street-view"]:visible').first();
  await expect(open).toBeVisible();
  await open.click();
  await expect(page.getByTestId("street-view-panel")).toBeVisible();
  await expect(page.getByText("Google Street View · coverage varies")).toBeVisible();
  await page.getByTestId("close-street-view").click();
  await expect(page.getByTestId("street-view-panel")).toBeHidden();
});
