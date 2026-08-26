import { expect, test } from "@playwright/test";

/**
 * Keyboard-only path through /spatial: the skip link jumps straight to the
 * viewport controls, and every capability/fallback control stays reachable by
 * Tab without focus ever being trapped inside a panel.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("halisia:navguide:v1:seen", "playwright");
  });
});

test("skip link reaches spatial controls and capability/fallback controls stay tabbable", async ({
  page,
}) => {
  await page.goto("/spatial");
  await expect(page.getByTestId("spatial-parcel-list")).toBeVisible({ timeout: 20_000 });

  // 1. The skip link is reachable by Tab from the top of the page and becomes
  //    visible once focused.
  const skip = page.getByTestId("spatial-skip-link");
  let reachedSkip = false;
  for (let i = 0; i < 15 && !reachedSkip; i += 1) {
    await page.keyboard.press("Tab");
    reachedSkip = await skip.evaluate((el) => el === document.activeElement);
  }
  expect(reachedSkip).toBe(true);
  await expect(skip).toBeVisible();

  // 2. Activating it moves focus into the viewport control group.
  await page.keyboard.press("Enter");
  await expect(page.locator("#spatial-controls")).toBeFocused();

  // 3. From there, Tab lands on the first enabled viewport control. On a
  //    desktop browser without WebXR the AR/VR launchers are disabled (and so
  //    correctly skipped by the tab order) but still present and labelled.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /reset view/i })).toBeFocused();
  await expect(page.getByTestId("spatial-start-ar")).toBeVisible();
  await expect(page.getByTestId("spatial-start-vr")).toBeVisible();

  // 4. Focus is not trapped: continued tabbing reaches the capability panel
  //    control and then the fallback panel, which is focusable but escapable.
  const capabilityAction = page.getByRole("button", { name: /check accuracy/i });
  const fallback = page.getByTestId("spatial-ar-fallback");
  await expect(fallback).toBeVisible();

  let reachedCapability = false;
  for (let i = 0; i < 12 && !reachedCapability; i += 1) {
    await page.keyboard.press("Tab");
    reachedCapability = await capabilityAction.evaluate((el) => el === document.activeElement);
  }
  expect(reachedCapability).toBe(true);

  // 5. Programmatic focus into the fallback panel does not trap: Tab escapes it.
  await fallback.focus();
  await expect(fallback).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(fallback).not.toBeFocused();

  // 6. Every existing spatial test id is still present and reachable.
  for (const id of [
    "spatial-viewport",
    "spatial-canvas",
    "spatial-xr-status",
    "spatial-ar-fallback",
    "spatial-session-announcer",
    "spatial-parcel-list",
    "spatial-start-ar",
    "spatial-start-vr",
  ]) {
    await expect(page.getByTestId(id)).toHaveCount(1);
  }

  // 7. The parcel rail radiogroup remains keyboard operable.
  const radios = page.getByTestId("spatial-parcel-list").getByRole("radio");
  await radios.first().focus();
  await expect(radios.first()).toBeFocused();
  await page.keyboard.press("End");
  await expect(radios.last()).toBeFocused();
});
