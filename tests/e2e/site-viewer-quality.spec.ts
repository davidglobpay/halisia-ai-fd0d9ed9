import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";

/**
 * 3D site viewer smoke: a real WebGL frame is drawn, the controls work, the
 * real sofa and the sky light load, exports produce valid files, and phones
 * start without the heavy effects. Timings are printed (`[3d]` lines) so a CI
 * log shows them; screenshots go to test-results/site-3d/.
 *
 * Emulation in headless Chromium (often SwiftShader, a software GPU) is not
 * a physical phone: frame times here are far slower than real hardware.
 */

// A plain 1×1 PNG stands in for Esri tiles so the test never depends on the network.
const TILE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOo6okBAALmAWPQX80GAAAAAElFTkSuQmCC",
  "base64",
);
// 32×24 synthetic "house photo": cream trim, brick walls, dark roof.
const PHOTO = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAYCAIAAAAUMWhjAAAASElEQVR4XmN89vASAzYwyd0HqzipgIlUDaSCUQsIgtEgIghGg4ggoHkQseBygoWFEkHXEQNo7oNRCwiC0SAiCEaDiCCgeRABAFzrBILOphoGAAAAAElFTkSuQmCC",
  "base64",
);

const AT = "lat=-1.583568&lng=36.918865";
const MASONRY = `/model-lab?type=3br_masonry_stone&${AT}`;
// `type=<typology>_<structure>`; structures are listed in site-params.ts.
const CONTAINER = `/model-lab?type=3br_container_40ft&${AT}`;
const SHOTS = "test-results/site-3d";

// three.js compiles and SwiftShader draws slowly on CI runners.
test.setTimeout(180_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("halisia:navguide:v1:seen", String(Date.now()));
    } catch {
      /* storage unavailable: the tour may show, tests still scope their clicks */
    }
  });
  await page.route("**/World_Imagery/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: TILE,
      headers: { "access-control-allow-origin": "*" },
    }),
  );
});

function log(info: TestInfo, what: string, value: unknown) {
  console.log(`[3d] ${info.project.name} · ${what}: ${JSON.stringify(value)}`);
}

async function shot(page: Page, info: TestInfo, name: string) {
  await mkdir(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-${name}.png` });
}

/**
 * Files made after a long wait cannot start a download by themselves (the
 * browser's tap permission has expired), so the app shows a "file ready"
 * panel with a save link instead. Accept either path.
 */
async function download(page: Page, click: () => Promise<void>) {
  const dl = page.waitForEvent("download", { timeout: 150_000 });
  await click();
  const save = page.getByTestId("file-ready-save");
  const first = await Promise.race([
    dl.then(() => "download" as const),
    save.waitFor({ state: "visible", timeout: 150_000 }).then(() => "panel" as const),
  ]);
  if (first === "panel") await save.click();
  return { file: await dl, via: first };
}

const viewer = (page: Page) => page.getByTestId("model-lab-site-mode").locator("canvas");

/**
 * Copy the WebGL canvas into a small 2D canvas right after three.js draws
 * (a later requestAnimationFrame callback in the same frame) and count the
 * distinct colours. A blank or cleared canvas has one or two.
 */
async function drawnColours(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        requestAnimationFrame(() => {
          const c = document.querySelector<HTMLCanvasElement>(
            '[data-testid="model-lab-site-mode"] canvas',
          );
          const o = document.createElement("canvas");
          o.width = 64;
          o.height = 40;
          const g = o.getContext("2d");
          if (!c || !g) return resolve(0);
          g.drawImage(c, 0, 0, 64, 40);
          const d = g.getImageData(0, 0, 64, 40).data;
          const seen = new Set<number>();
          for (let i = 0; i < d.length; i += 4)
            seen.add(((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3));
          resolve(seen.size);
        });
      }),
  );
}

async function openViewer(page: Page, url: string, info: TestInfo) {
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  const assets: Record<string, number> = {};
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("response", (r) => {
    const name = /\/site-assets\/([^?]+)/.exec(r.url())?.[1];
    if (name) assets[name] = r.status();
  });
  await page.goto(url);
  const canvas = viewer(page);
  await expect(canvas).toBeVisible({ timeout: 60_000 });
  await expect(canvas).toHaveAttribute("data-first-frame-ms", /\d+/, { timeout: 60_000 });
  // A house on ground has many colours; give slow software GPUs a few tries.
  await expect.poll(() => drawnColours(page), { timeout: 30_000 }).toBeGreaterThan(20);
  log(
    info,
    "first frame ms after navigation",
    Number(await canvas.getAttribute("data-first-frame-ms")),
  );
  return { errors, consoleErrors, assets, canvas };
}

test("masonry house: frame, controls, sofa and sky light", async ({ page }, info) => {
  const { errors, consoleErrors, assets, canvas } = await openViewer(page, MASONRY, info);
  await shot(page, info, "masonry-exterior");

  // Best picture: on by default for a mouse, off for touch. On a slow
  // software GPU the frame-time watch may switch it off by itself (with a note).
  const hq = page.getByTestId("site-hq").getByRole("checkbox");
  const note = page.getByTestId("site-hq-note");
  const coarse = await page.evaluate(() => matchMedia("(pointer: coarse)").matches);
  log(info, "coarse pointer", coarse);
  if (coarse) await expect(hq).not.toBeChecked();
  else
    await expect
      .poll(async () => (await hq.isChecked()) || (await note.isVisible()), { timeout: 30_000 })
      .toBe(true);
  // Let the watch settle before using the controls.
  await page.waitForTimeout(7000);
  log(info, "after settling: effects / pixel ratio / note", [
    await canvas.getAttribute("data-effects"),
    await canvas.getAttribute("data-pixel-ratio"),
    (await note.isVisible()) ? await note.textContent() : null,
  ]);
  const before = await hq.isChecked();
  await hq.click();
  await expect(hq).toBeChecked({ checked: !before, timeout: 30_000 });
  if (!before)
    await expect
      .poll(
        async () =>
          (await canvas.getAttribute("data-effects")) === "on" || (await note.isVisible()),
        { timeout: 30_000 },
      )
      .toBe(true);
  // Leave the effects off for the rest, so slow runners stay responsive.
  if (await hq.isChecked()) await hq.click();
  await expect(hq).not.toBeChecked({ timeout: 30_000 });

  // The real sofa replaces the box sofa; both asset files answer 200.
  await expect(canvas).toHaveAttribute("data-real-models", /[1-9]/, { timeout: 60_000 });
  await expect.poll(() => assets["sky-day.hdr"], { timeout: 30_000 }).toBe(200);
  expect(assets["sofa.glb"]).toBe(200);
  const timing = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((e) => /site-assets\/(sofa\.glb|sky-day\.hdr)/.test(e.name))
      .map((e) => {
        const r = e as PerformanceResourceTiming;
        return {
          file: r.name.split("/").pop(),
          startMs: Math.round(r.startTime),
          doneMs: Math.round(r.responseEnd),
          bytes: r.encodedBodySize,
        };
      }),
  );
  log(info, "asset timing", timing);

  const seeInside = page.getByTestId("site-see-inside");
  await seeInside.click();
  await expect(seeInside).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(500);
  await shot(page, info, "masonry-inside");
  await seeInside.click();
  await expect(seeInside).toHaveAttribute("aria-pressed", "false");

  const controls = page.getByTestId("site-view-controls");
  await controls.getByRole("button", { name: "Walk around" }).click();
  await expect(controls.getByRole("button", { name: "Exit walk mode" })).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(500);
  await shot(page, info, "walk");
  await controls.getByRole("button", { name: "Exit walk mode" }).click();

  const fly = controls.getByRole("button", { name: "Fly around" });
  if (await fly.count()) {
    await fly.click();
    await expect(controls.getByRole("button", { name: "Stop fly-around" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.waitForTimeout(1000);
    await shot(page, info, "fly");
    await controls.getByRole("button", { name: "Stop fly-around" }).click();
  }

  expect(await drawnColours(page)).toBeGreaterThan(20);
  log(info, "effects / pixel ratio at end", [
    await canvas.getAttribute("data-effects"),
    await canvas.getAttribute("data-pixel-ratio"),
  ]);
  log(info, "console errors", consoleErrors);
  expect(errors).toEqual([]);
});

test("container house: stacking changes the model", async ({ page }, info) => {
  const { errors } = await openViewer(page, CONTAINER, info);
  const facts = page.getByTestId("site-house-facts");
  await expect(facts).toContainText("container units");
  const stack = page.getByTestId("site-stack").getByRole("checkbox");
  await expect(stack).toBeVisible();
  await expect(facts).not.toContainText("levels");
  await stack.check();
  await expect(facts).toContainText("on 2 levels", { timeout: 30_000 });
  await page.waitForTimeout(500);
  expect(await drawnColours(page)).toBeGreaterThan(20);
  await shot(page, info, "container-stacked");
  expect(errors).toEqual([]);
});

test("exports: site pack PDF and GLB are valid files", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "exports are checked once, on desktop");
  const { errors } = await openViewer(page, MASONRY, info);
  const files = page.getByTestId("site-files");

  const { file: pdf, via: pdfVia } = await download(page, () =>
    files.getByTestId("site-pack-pdf").click(),
  );
  const pdfBytes = await readFile(await pdf.path());
  expect(pdfBytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  const pages = (pdfBytes.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
  expect(pages).toBeGreaterThan(0);
  log(info, "pdf", { name: pdf.suggestedFilename(), bytes: pdfBytes.length, pages, via: pdfVia });

  const { file: glb, via: glbVia } = await download(page, () =>
    files.getByTestId("site-glb").click(),
  );
  const glbBytes = await readFile(await glb.path());
  expect(glbBytes.subarray(0, 4).toString("latin1")).toBe("glTF");
  expect(glbBytes.readUInt32LE(4)).toBe(2);
  expect(glbBytes.readUInt32LE(8)).toBe(glbBytes.length);
  const jsonLen = glbBytes.readUInt32LE(12);
  const gltf = JSON.parse(glbBytes.subarray(20, 20 + jsonLen).toString("utf8")) as {
    meshes?: unknown[];
    images?: unknown[];
    textures?: unknown[];
  };
  expect(gltf.meshes?.length ?? 0).toBeGreaterThan(10);
  log(info, "glb", {
    name: glb.suggestedFilename(),
    bytes: glbBytes.length,
    meshes: gltf.meshes?.length,
    images: gltf.images?.length ?? 0,
    via: glbVia,
  });
  expect(errors).toEqual([]);
});

test("plot planner: inspiration panel and walk link", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    "/plot-planner?lat=-1.502157&lng=36.955288&typology=3br&structure=container_40ft&plot=50x100",
  );
  const panel = page.getByTestId("pp-inspiration");
  await expect(panel).toBeVisible({ timeout: 60_000 });
  await expect(panel.getByLabel("Choose inspiration photos")).toBeAttached();
  await expect(panel.getByLabel("Choose an inspiration video")).toBeAttached();
  await expect(panel.getByTestId("pp-inspiration-link")).toBeVisible();

  // A synthetic photo is read on the device (signed out: colours only, no AI).
  await panel.getByLabel("Choose inspiration photos").setInputFiles({
    name: "house.png",
    mimeType: "image/png",
    buffer: PHOTO,
  });
  await expect(panel.getByRole("list", { name: "Your inspiration pictures" })).toBeVisible();
  await panel.getByTestId("pp-inspiration-read").click();
  await expect(panel.getByTestId("pp-inspiration-result")).toBeVisible({ timeout: 30_000 });
  await panel.scrollIntoViewIfNeeded();
  await shot(page, info, "plot-planner-inspiration");

  const walk = page.getByTestId("pp-walk-link");
  const href = (await walk.getAttribute("href")) ?? "";
  const q = new URL(href, "https://x.test").searchParams;
  const unquote = (v: string | null) => Number((v ?? "").replace(/"/g, ""));
  expect(href).toContain("/model-lab");
  expect(q.get("type")).toBe("3br_container_40ft");
  expect(unquote(q.get("lat"))).toBeCloseTo(-1.502157, 5);
  expect(unquote(q.get("lng"))).toBeCloseTo(36.955288, 5);
  log(info, "walk link", href);
  await walk.click();
  await expect(page).toHaveURL(/\/model-lab\?.*type=3br_container_40ft/);
  await expect(viewer(page)).toBeVisible({ timeout: 60_000 });
  expect(errors).toEqual([]);
});

test("mid-range phone: effects start off and the viewer stays usable", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile-chrome", "phone emulation only");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const { errors } = await openViewer(page, MASONRY, info);
  await expect(page.getByTestId("site-hq").getByRole("checkbox")).not.toBeChecked();
  await expect(viewer(page)).toHaveAttribute("data-effects", "off");

  const frames = await page.evaluate(
    () =>
      new Promise<{ frames: number; avgMs: number; worstMs: number }>((resolve) => {
        const t: number[] = [];
        const start = performance.now();
        const tick = (now: number) => {
          t.push(now);
          if (now - start < 3000) requestAnimationFrame(tick);
          else {
            const d = t.slice(1).map((x, i) => x - t[i]);
            resolve({
              frames: d.length,
              avgMs: Math.round(d.reduce((a, b) => a + b, 0) / Math.max(1, d.length)),
              worstMs: Math.round(Math.max(0, ...d)),
            });
          }
        };
        requestAnimationFrame(tick);
      }),
  );
  log(info, "frame times at 4x CPU throttle (emulated, not a real phone)", frames);
  log(info, "pixel ratio", await viewer(page).getAttribute("data-pixel-ratio"));

  // Controls respond and nothing scrolls sideways.
  const seeInside = page.getByTestId("site-see-inside");
  await seeInside.click();
  await expect(seeInside).toHaveAttribute("aria-pressed", "true");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await shot(page, info, "mobile");
  expect(errors).toEqual([]);
});

test("fallback: no sky file and no sofa file still gives a drawn house", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "checked once, on desktop");
  await page.route("**/site-assets/**", (route) => route.abort());
  const { errors, canvas } = await openViewer(page, MASONRY, info);
  // Boxes stay in place of the sofa; the studio light stays in place of the sky.
  await page.waitForTimeout(3000);
  await expect(canvas).not.toHaveAttribute("data-real-models", /.+/);
  expect(await drawnColours(page)).toBeGreaterThan(20);
  const hq = page.getByTestId("site-hq").getByRole("checkbox");
  if (!(await hq.isChecked())) await hq.click();
  await expect(canvas).toHaveAttribute("data-effects", "on", { timeout: 30_000 });
  expect(await drawnColours(page)).toBeGreaterThan(20);
  await shot(page, info, "fallback-no-assets");
  expect(errors).toEqual([]);
});
