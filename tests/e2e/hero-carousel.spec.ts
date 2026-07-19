import { test, expect } from "@playwright/test";

test.describe("Hero video carousel", () => {
  test("exposes accessible play/pause + mute controls", async ({ page }) => {
    await page.goto("/");

    const region = page.getByRole("region", { name: /halisia cinematic hero/i });
    await expect(region).toBeVisible();

    const playPause = page.getByTestId("hero-playpause");
    const mute = page.getByTestId("hero-mute");
    await expect(playPause).toBeVisible();
    await expect(mute).toBeVisible();

    // Starts playing (Pause label visible) and muted.
    await expect(playPause).toHaveAttribute("aria-label", /pause/i);
    await expect(mute).toHaveAttribute("aria-label", /unmute/i);

    // Toggle pause -> label flips to Play.
    await playPause.click();
    await expect(playPause).toHaveAttribute("aria-label", /play/i);
    await expect(playPause).toHaveAttribute("aria-pressed", "true");

    // Toggle mute -> label flips to Mute.
    await mute.click();
    await expect(mute).toHaveAttribute("aria-label", /^mute/i);
    await expect(mute).toHaveAttribute("aria-pressed", "true");

    // Keyboard: dot tabs are focusable and reachable.
    const dots = page.getByRole("tab");
    await expect(dots.first()).toBeVisible();
    await dots.nth(1).focus();
    await expect(dots.nth(1)).toBeFocused();
  });

  test("manual lat,lng fallback appears when geolocation is unavailable", async ({
    page,
    context,
  }) => {
    // Deny geolocation so the SearchBar surfaces the manual entry fallback.
    await context.clearPermissions();
    await page.goto("/");
    await page.getByTestId("search-my-location").click();
    const manual = page.getByLabel(/enter latitude and longitude/i);
    await expect(manual).toBeVisible();
    await manual.fill("-1.2921, 36.8219");
    await page.getByRole("button", { name: /^set$/i }).click();
    await expect(page).toHaveURL(/\/explore\?q=/);
  });
});
