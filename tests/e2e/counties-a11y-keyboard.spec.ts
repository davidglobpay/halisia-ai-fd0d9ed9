import { test, expect } from "@playwright/test";

test("county cards are keyboard accessible with ARIA labels and Enter/Space toggles selection", async ({
  page,
}) => {
  await page.goto("/");

  const firstCard = page.getByTestId("county-card-47"); // Nairobi
  await expect(firstCard).toBeVisible({ timeout: 15_000 });

  // ARIA label present and mentions the metric + county
  const label = await firstCard.getAttribute("aria-label");
  expect(label).toBeTruthy();
  expect(label!.toLowerCase()).toContain("nairobi");
  expect(label!.toLowerCase()).toContain("comparison");

  // Focus + Enter selects
  await firstCard.focus();
  await expect(firstCard).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(firstCard).toHaveAttribute("aria-pressed", "true");

  // Space toggles back off
  await page.keyboard.press(" ");
  await expect(firstCard).toHaveAttribute("aria-pressed", "false");

  // The map itself has an application role for AT users
  const map = page.getByTestId("county-map");
  await expect(map).toHaveAttribute("aria-label", /Kenya counties/i);
});
