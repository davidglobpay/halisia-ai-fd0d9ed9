import { test } from "@playwright/test";
import { stubLocationServices } from "./helpers/server-fns";

// Temporary diagnostic on the probe branch only.
test("probe map tools stability", async ({ page }) => {
  await stubLocationServices(page);
  await page.goto("/explore?q=Nairobi");
  await page.getByTestId("tab-layers").click();
  await page.waitForTimeout(6000);
  const tool = page.getByTestId("tool-distance").first();
  await tool.evaluate((e) => e.scrollIntoView({ block: "center" }));
  for (let i = 0; i < 8; i++) {
    const info = await page.evaluate(() => {
      const e = document.querySelector('[data-testid="tool-distance"]')!;
      const r = e.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const chain: string[] = [];
      let n: Element | null = e;
      while (n && chain.length < 14) {
        const cs = getComputedStyle(n);
        if (cs.transform !== "none" || cs.animationName !== "none" || cs.overflow !== "visible")
          chain.push(`${n.tagName}.${String(n.className).slice(0, 50)}[t=${cs.transform.slice(0, 30)} a=${cs.animationName} o=${cs.overflow}]`);
        n = n.parentElement;
      }
      return { r: [r.x, r.y], y: scrollY, hit: hit ? `${hit.tagName}.${String(hit.className).slice(0, 60)}` : null, chain };
    });
    console.log(`[probe-tools] ${i} ${JSON.stringify(info)}`);
    await page.waitForTimeout(250);
  }
  await tool.click({ timeout: 10_000 }).then(
    () => console.log("[probe-tools] click ok"),
    (e) => console.log(`[probe-tools] click failed ${String(e).slice(0, 600)}`),
  );
});
