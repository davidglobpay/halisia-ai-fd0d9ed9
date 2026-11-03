import { test, expect } from "@playwright/test";

const NAV_GUIDE_KEY = "halisia:navguide:v1:seen";

/**
 * Pre-seeds the nav-guide "seen" flag so the first-visit dialog does not
 * intercept clicks. We deliberately let storage errors throw so a broken
 * localStorage surfaces as a real test failure with an actionable stack,
 * instead of the guide silently auto-opening and breaking downstream
 * selectors.
 */
async function suppressNavGuide(context: import("@playwright/test").BrowserContext) {
  await context.addInitScript((key) => {
    window.localStorage.setItem(key, String(Date.now()));
  }, NAV_GUIDE_KEY);
}

test.describe("search panel + nav guide", () => {
  test("floating search opens, shows curated chips, and Kilimani navigates to /explore", async ({
    page,
    context,
  }) => {
    await suppressNavGuide(context);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const searchbox = page.getByRole("combobox").first();
    await expect(
      searchbox,
      "floating search combobox should mount on the landing page",
    ).toBeVisible({ timeout: 15_000 });
    await expect(searchbox).toBeEnabled();
    await searchbox.click();
    await expect(
      page.getByText(/Try one of these/i),
      "curated prompts panel should appear once the search is focused",
    ).toBeVisible({ timeout: 5_000 });
    const kilimani = page.getByRole("button", { name: /Kilimani, Nairobi/ });
    await expect(kilimani, "Kilimani curated chip should render").toBeVisible();
    await kilimani.click();
    await page.waitForURL(/\/explore\?q=Kilimani/i, { timeout: 10_000 });
  });

  test("⌘K / Ctrl+K opens and focuses the search input", async ({ page, context }) => {
    await suppressNavGuide(context);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Wait for the search trigger to mount before firing the shortcut so
    // the global keydown handler is guaranteed to be registered.
    await expect(page.getByRole("combobox").first()).toBeVisible({ timeout: 15_000 });
    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+KeyK`);
    const input = page.getByRole("textbox", { name: /Search Kenya/i });
    await expect(input, "⌘K should mount and focus the search input").toBeFocused({
      timeout: 5_000,
    });
  });

  test("first-visit navigation guide opens and is dismissible", async ({ page }) => {
    // playwright.config pre-marks the guide as seen; this test needs a true first visit.
    await page.addInitScript((key) => window.localStorage.removeItem(key), NAV_GUIDE_KEY);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const dialog = page.getByRole("dialog");
    // Auto-open uses a 1.2s timeout on mount; give cold starts headroom.
    await expect(dialog, "guided tour should auto-open on first visit").toBeVisible({
      timeout: 10_000,
    });
    const close = page.getByRole("button", { name: /Close tour/i });
    await expect(close).toBeVisible();
    await close.click();
    await expect(dialog, "dialog should unmount after clicking Close tour").toBeHidden({
      timeout: 5_000,
    });
  });

  test("? key re-opens the guided tour", async ({ page, context }) => {
    await suppressNavGuide(context);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // The `?` handler is attached inside a useEffect. Wait for the trigger
    // button (rendered by the same component) before firing the shortcut.
    await expect(page.getByRole("button", { name: /Open guided tour/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.keyboard.press("Shift+Slash");
    await expect(
      page.getByRole("dialog"),
      "pressing ? should re-open the guided tour dialog",
    ).toBeVisible({ timeout: 5_000 });
  });
});
