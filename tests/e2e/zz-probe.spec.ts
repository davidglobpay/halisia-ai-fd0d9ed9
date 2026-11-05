import { test } from "@playwright/test";
import { stubLocationServices } from "./helpers/server-fns";

// Temporary diagnostic on the probe branch only.
test("probe dossier panel", async ({ page }) => {
  test.setTimeout(120_000);
  page.on("pageerror", (e) => console.log(`[probe-pageerror] ${e.message}`));
  await stubLocationServices(page);
  await page.goto("/explore?q=Kilimani");
  await page.waitForTimeout(20_000);
  const lios = page.getByTestId("land-intelligence-score");
  console.log(`[probe-lios-count] ${await lios.count()}`);
  const ids = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll('[data-testid="land-intelligence-score"] [data-testid]'),
    ).map((e) => e.getAttribute("data-testid")),
  );
  console.log(`[probe-lios-ids] ${JSON.stringify(ids)}`);
  const text = await lios.innerText().catch(() => "");
  console.log(`[probe-lios-text] ${text.replace(/\n+/g, " | ").slice(0, 3000)}`);
  const addr = await page.getByTestId("active-address").innerText().catch(() => "");
  console.log(`[probe-address] ${addr}`);
});

test("probe compare page", async ({ page }) => {
  test.setTimeout(120_000);
  await stubLocationServices(page);
  await page.goto("/compare-locations?a=Kilimani&b=Nakuru");
  await page.waitForTimeout(20_000);
  for (const id of ["cmp-col-a", "cmp-col-b", "cmp-delta"]) {
    const t = await page.getByTestId(id).innerText().catch(() => "missing");
    console.log(`[probe-${id}] ${t.replace(/\n+/g, " | ").slice(0, 1500)}`);
  }
});
