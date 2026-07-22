import { test, expect } from "@playwright/test";

test.describe("search panel + nav guide", () => {
  test("floating search opens, shows curated chips, and Kilimani navigates to /explore", async ({ page, context }) => {
    await context.addInitScript(() => {
      try { window.localStorage.setItem("halisia:navguide:v1:seen", String(Date.now())); } catch {}
    });
    await page.goto("/");
    const searchbox = page.getByRole("combobox").first();
    await expect(searchbox).toBeVisible({ timeout: 15_000 });
    await searchbox.click();
    await expect(page.getByText(/Try one of these/i)).toBeVisible();
    await page.getByRole("button", { name: /Kilimani, Nairobi/ }).click();
    await page.waitForURL(/\/explore\?q=Kilimani/i, { timeout: 10_000 });
  });

  test("⌘K / Ctrl+K opens and focuses the search input", async ({ page, context }) => {
    await context.addInitScript(() => {
      try { window.localStorage.setItem("halisia:navguide:v1:seen", String(Date.now())); } catch {}
    });
    await page.goto("/");
    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+KeyK`);
    await expect(page.getByRole("textbox", { name: /Search Kenya/i })).toBeFocused();
  });

  test("first-visit navigation guide opens and is dismissible", async ({ page }) => {
    await page.goto("/");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: /Close tour/i }).click();
    await expect(dialog).toBeHidden();
  });

  test("? key re-opens the guided tour", async ({ page, context }) => {
    await context.addInitScript(() => {
      try { window.localStorage.setItem("halisia:navguide:v1:seen", String(Date.now())); } catch {}
    });
    await page.goto("/");
    await page.keyboard.press("Shift+Slash");
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});