import { test, expect } from "@playwright/test";
import { stubLocationServices } from "./helpers/server-fns";

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
  // The floating search and its Ctrl+K shortcut were removed from the layout
  // on 27 Sep 2026 (commit 0579826). The landing search now sits on the map
  // that answers it, and Explore keeps its own search bar.
  test("landing map search finds a place and offers the next steps", async ({ page, context }) => {
    await suppressNavGuide(context);
    await stubLocationServices(page);
    await page.goto("/");
    const input = page.getByRole("textbox", { name: "Search map" });
    await expect(input, "the landing map should carry its own search").toBeVisible({
      timeout: 15_000,
    });
    await input.fill("Kilimani");
    await input.press("Enter");
    const picked = page.getByTestId("hero-map-selection");
    await expect(picked, "a found place is shown under the map").toContainText(/Kilimani/i, {
      timeout: 15_000,
    });
  });

  test("Explore search bar sends the query to /explore", async ({ page, context }) => {
    await suppressNavGuide(context);
    await stubLocationServices(page);
    await page.goto("/explore");
    await expect(page.getByTestId("explore-page")).toHaveAttribute("data-hydrated", "true", {
      timeout: 15_000,
    });
    const input = page.getByPlaceholder("Search a town, road, place or coordinates…");
    await input.fill("Kilimani");
    await input.press("Enter");
    await page.waitForURL(/\/explore\?q=Kilimani/i, { timeout: 10_000 });
    await expect(page.getByTestId("active-address")).toContainText(/Kilimani/i, {
      timeout: 20_000,
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
