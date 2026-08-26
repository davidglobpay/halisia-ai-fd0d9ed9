import { expect, test } from "@playwright/test";

/**
 * Mobile keyboard navigation for /spatial. Focus must be able to move into the
 * capability and fallback panels and return to the invoking control, without
 * ever being trapped away from the canvas/viewport controls.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("halisia:navguide:v1:seen", "playwright");
  });
});

test.describe("mobile keyboard navigation", () => {
  test.skip(
    ({ viewport }) => !viewport || viewport.width > 600,
    "mobile viewport projects only",
  );

  test("focus enters capability/fallback panels and returns without blocking the canvas", async ({
    page,
  }) => {
    await page.goto("/spatial");
    await expect(page.getByTestId("spatial-parcel-list")).toBeVisible({ timeout: 20_000 });

    // Skip link is the fast path to the viewport controls on small screens.
    const skip = page.getByTestId("spatial-skip-link");
    let reachedSkip = false;
    for (let i = 0; i < 15 && !reachedSkip; i += 1) {
      await page.keyboard.press("Tab");
      reachedSkip = await skip.evaluate((el) => el === document.activeElement);
    }
    expect(reachedSkip).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page.locator("#spatial-controls")).toBeFocused();

    // Capability panel: focus moves in and Tab escapes again (no trap).
    const capability = page.getByTestId("spatial-xr-status");
    await expect(capability).toBeVisible();
    const capabilityAction = page.getByRole("button", { name: /check accuracy/i });
    await capabilityAction.focus();
    await expect(capabilityAction).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(capabilityAction).not.toBeFocused();

    // Fallback panel is programmatically focusable and escapable.
    const fallback = page.getByTestId("spatial-ar-fallback");
    await expect(fallback).toBeVisible();
    await fallback.focus();
    await expect(fallback).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(fallback).not.toBeFocused();

    // Returning focus to the invoking control works and the canvas stays
    // interactive underneath (no overlay/trap blocking pointer events).
    await capabilityAction.focus();
    await expect(capabilityAction).toBeFocused();

    const canvas = page.locator('[data-testid="spatial-canvas"] canvas');
    await expect(canvas).toBeVisible({ timeout: 20_000 });
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect(canvas).toBeVisible();

    // Parcel rail stays keyboard operable after panel interaction.
    const radios = page.getByTestId("spatial-parcel-list").getByRole("radio");
    await radios.first().focus();
    await expect(radios.first()).toBeFocused();
    await page.keyboard.press("End");
    await expect(radios.last()).toBeFocused();
  });
});
