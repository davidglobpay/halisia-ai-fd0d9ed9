import { test } from "@playwright/test";
import { stubLocationServices } from "./helpers/server-fns";

// Temporary diagnostic on the probe branch only.
test("probe landing CTA timeline", async ({ page }) => {
  await page.goto("/");
  const cta = page.getByTestId("launch-cta");
  await cta.waitFor();
  await cta.click();
  for (const ms of [0, 300, 1000, 2500, 5000]) {
    await page.waitForTimeout(ms === 0 ? 0 : ms);
    const info = await page.evaluate(() => {
      const r = document.getElementById("hero-map")?.getBoundingClientRect();
      return { url: location.href, y: scrollY, top: r?.top, h: innerHeight };
    });
    console.log(`[probe-cta] +${ms} ${JSON.stringify(info)}`);
  }
});

test("probe map tools", async ({ page }) => {
  await stubLocationServices(page);
  await page.goto("/explore?q=Nairobi");
  await page.getByTestId("tab-layers").click();
  await page.waitForTimeout(8000);
  const info = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="tool-distance"]')).map((e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return {
        r: [r.x, r.y, r.width, r.height],
        vis: cs.visibility,
        op: cs.opacity,
        disp: cs.display,
        hit: hit ? `${hit.tagName}.${String(hit.className).slice(0, 80)}` : null,
      };
    }),
  );
  console.log(`[probe-tools] ${JSON.stringify(info)}`);
});
