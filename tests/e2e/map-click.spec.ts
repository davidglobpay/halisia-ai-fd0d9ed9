import { test, expect } from "@playwright/test";
import { stubLocationServices } from "./helpers/server-fns";

test("clicking the map reverse-geocodes and updates the sidebar address", async ({ page }) => {
  await stubLocationServices(page);
  await page.goto("/explore?q=Karen%2C%20Nairobi");

  // Wait for the default Nairobi address to render in the sidebar caption.
  const addressPill = page.getByTestId("active-address");
  await expect(addressPill).toBeVisible();
  const initial = (await addressPill.textContent()) ?? "";

  // The Google Map container fills the map card. Click in its middle to drop a pin.
  // Give the map a chance to finish loading (script + tiles).
  await page.waitForTimeout(3500);

  const mapCard = page.locator('[class*="glass-strong"]').first();
  const box = await mapCard.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  // Wait for the reverse-geocode status pill to appear, then disappear.
  await expect
    .poll(async () => (await addressPill.textContent()) ?? "", { timeout: 15_000 })
    .not.toBe(initial);
});
