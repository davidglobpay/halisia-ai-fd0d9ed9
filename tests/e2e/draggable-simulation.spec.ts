import { test, expect } from "@playwright/test";

test("dragging the simulated pin updates the URL and re-runs the location search", async ({
  page,
}) => {
  // Force the OSM map path so the draggable pin is deterministic in CI/local preview.
  await page.addInitScript(() => {
    window.__halisiaMapsAuthFailed = true;
  });

  await page.goto("/explore?q=-1.286389%2C36.817223");
  await expect(page.getByTestId("explore-page")).toHaveAttribute("data-hydrated", "true", {
    timeout: 15_000,
  });
  await expect(page.getByTestId("active-address")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("simulation-toggle").click();
  await expect(page.getByTestId("simulation-toggle")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("map-fallback-status")).toBeVisible({ timeout: 15_000 });

  const pin = page.getByTestId("simulated-map-pin");
  await expect(pin).toBeVisible({ timeout: 15_000 });

  const beforeUrl = page.url();
  const beforeAddress = (await page.getByTestId("active-address").textContent()) ?? "";
  const box = await pin.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 72, box.y + box.height / 2 - 48, { steps: 8 });
  await page.mouse.up();

  await expect.poll(() => page.url(), { timeout: 15_000 }).not.toBe(beforeUrl);
  await expect(page).toHaveURL(/\/explore\?q=-?\d/);
  await expect
    .poll(async () => (await page.getByTestId("active-address").textContent()) ?? "", {
      timeout: 15_000,
    })
    .not.toBe(beforeAddress);
});
