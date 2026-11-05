import { test, expect } from "@playwright/test";

test("county cards are labelled and their Compare button works from the keyboard", async ({
  page,
}) => {
  await page.goto("/");

  const card = page.getByTestId("county-card-47"); // Nairobi
  await expect(card).toBeVisible({ timeout: 15_000 });

  // The card is an information card whose label names the county and its sourced metric.
  const label = await card.getAttribute("aria-label");
  expect(label).toBeTruthy();
  expect(label!.toLowerCase()).toContain("nairobi");
  expect(label!.toLowerCase()).toContain("census");

  // Comparison is a separate button: Enter adds, Space removes.
  const compare = card.getByRole("button", { name: /Nairobi .*comparison/i });
  await compare.focus();
  await expect(compare).toBeFocused();
  await expect(compare).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Enter");
  await expect(compare).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press(" ");
  await expect(compare).toHaveAttribute("aria-pressed", "false");

  // The map itself has an application role for AT users
  const map = page.getByTestId("county-map");
  await expect(map).toHaveAttribute("aria-label", /Kenya counties/i);
});
