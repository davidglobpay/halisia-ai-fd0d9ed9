import { test } from "@playwright/test";

// Temporary diagnostic: records how server functions are called in the
// production test build so fixtures can be written against the real format.
test.setTimeout(180_000);

for (const path of [
  "/passport?lat=-1.286389&lng=36.817223&label=Nairobi&source=Test&status=approximate",
  "/explore?q=Kisumu",
  "/explore?q=Nairobi",
]) {
  test(`probe ${path}`, async ({ page }) => {
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (!u.pathname.startsWith("/_serverFn/")) return;
      const id = u.pathname.split("/").pop() ?? "";
      let decoded = "";
      try {
        decoded = Buffer.from(id, "base64url").toString();
      } catch {
        decoded = "?";
      }
      console.log(
        `[probe-req] ${r.method()} ${u.pathname}${u.search.slice(0, 200)} decoded=${decoded.slice(0, 200)} headers=${JSON.stringify(r.headers()).slice(0, 300)} body=${(r.postData() ?? "").slice(0, 300)}`,
      );
    });
    page.on("response", async (r) => {
      const u = new URL(r.url());
      if (!u.pathname.startsWith("/_serverFn/")) return;
      let body = "";
      try {
        body = (await r.text()).slice(0, 600);
      } catch (e) {
        body = String(e);
      }
      console.log(
        `[probe-res] ${r.status()} ${u.pathname.slice(0, 120)} ct=${r.headers()["content-type"]} headers=${JSON.stringify(r.headers()).slice(0, 300)} body=${body}`,
      );
    });
    page.on("pageerror", (e) => console.log(`[probe-pageerror] ${e.message}`));
    await page.goto(path);
    await page.waitForTimeout(25_000);
    const ids = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-testid]"))
        .map((e) => e.getAttribute("data-testid"))
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 200),
    );
    console.log(`[probe-testids] ${path} ${JSON.stringify(ids)}`);
    console.log(`[probe-text] ${(await page.locator("main").first().innerText().catch(() => "")).slice(0, 1500).replace(/\n+/g, " | ")}`);
  });
}

test("probe landing CTA", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(5000);
  const cta = page.getByTestId("launch-cta");
  await cta.scrollIntoViewIfNeeded();
  const box = await cta.boundingBox();
  const top = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="launch-cta"]') as HTMLElement;
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return hit ? `${hit.tagName}.${hit.className}`.slice(0, 200) : "none";
  });
  console.log(`[probe-cta] box=${JSON.stringify(box)} topElement=${top}`);
  await cta.click();
  await page.waitForTimeout(2000);
  console.log(`[probe-cta] url=${page.url()} scrollY=${await page.evaluate(() => scrollY)}`);
  console.log(`[probe-landing] my-location count=${await page.getByTestId("search-my-location").count()}`);
});
