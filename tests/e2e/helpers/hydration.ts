import type { Page } from "@playwright/test";

/**
 * Wait until React has attached to the element with this test id.
 *
 * The server sends working HTML first. A tap made before React attaches can
 * be undone when the router takes over (it re-applies the URL and scroll
 * position), so specs that test where a control leads wait for this first.
 * The early-tap behaviour itself is tracked as a defect, not hidden here.
 */
export async function waitForHydration(page: Page, testId: string, timeout = 30_000) {
  await page.waitForFunction(
    (id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      return !!el && Object.keys(el).some((k) => k.startsWith("__reactProps"));
    },
    testId,
    { timeout },
  );
}
