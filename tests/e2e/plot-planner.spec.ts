import { expect, test, type Page } from "@playwright/test";

// A plain 1×1 PNG stands in for Esri tiles so the test never depends on the network.
const TILE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOo6okBAALmAWPQX80GAAAAAElFTkSuQmCC",
  "base64",
);

async function stubImagery(page: Page, mode: "ok" | "fail" = "ok") {
  await page.route("**/World_Imagery/**", (route) =>
    mode === "ok"
      ? route.fulfill({
          status: 200,
          contentType: "image/png",
          body: TILE,
          headers: { "access-control-allow-origin": "*" },
        })
      : route.abort(),
  );
}

// The 3D page compiles three.js on the CI dev server; passing runs take
// 50-60 s, at the edge of the global 60 s limit.
test.setTimeout(120_000);

// The first-visit guided tour would otherwise sit over the page.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("halisia:navguide:v1:seen", String(Date.now()));
    } catch {
      /* storage unavailable: the tour may show, tests still scope their clicks */
    }
  });
});

const URL =
  "/plot-planner?lat=-1.502157&lng=36.955288&typology=3br&structure=container_40ft&plot=50x100";

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
]) {
  test(`plot planner renders, drags and rotates at ${viewport.width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize(viewport);
    await stubImagery(page);
    await page.goto(URL);

    const canvas = page.getByTestId("plot-viewer-canvas");
    await expect(canvas).toBeVisible({ timeout: 30_000 });
    const readout = page.getByTestId("pp-readout");
    await expect(readout).toContainText("(4 units)");
    await expect(readout).toContainText("3 bedrooms");
    await expect(readout).toContainText("Left: 1.5 m");
    // Imagery loaded: no status banner over the scene.
    await expect(page.getByTestId("pp-viewer").getByRole("status")).toHaveCount(0);

    // Drag the house from the centre of the scene. The header and form can
    // push the viewer below the fold, so bring it on screen first.
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 90, cy + 20, { steps: 12 });
    await page.mouse.up();
    await expect(readout).not.toContainText("Left: 1.5 m");

    await page.getByRole("slider", { name: "Rotate house" }).fill("45");
    await expect(page.getByText("45°")).toBeVisible();

    await page.getByTestId("pp-structure").selectOption("eps");
    await page.getByTestId("pp-plot").selectOption("quarter-acre");
    await page.getByRole("button", { name: "Centre house on plot" }).click();
    await expect(readout).toContainText("EPS (Styrofoam) panels");
    await expect(readout).toContainText("Left: 8.8 m");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}

test("plot planner floating controls and layer menu work", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await stubImagery(page);
  await page.goto(URL);
  await expect(page.getByTestId("plot-viewer-canvas")).toBeVisible({ timeout: 30_000 });

  // Scope to HALISIA's dock: Google Street View on the same page has its own
  // "Zoom in"/"Zoom out" buttons.
  const dock = page.getByTestId("pp-dock");
  for (const name of ["Zoom in", "Zoom out", "Back to the plot", "Top-down view", "Map layers"]) {
    await expect(dock.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await dock.getByRole("button", { name: "Zoom in", exact: true }).click();
  await dock.getByRole("button", { name: "Top-down view", exact: true }).click();
  await dock.getByRole("button", { name: "Back to the plot", exact: true }).click();

  await dock.getByRole("button", { name: "Map layers", exact: true }).click();
  const panel = page.getByTestId("pp-dock-panel");
  await expect(panel).toBeVisible();
  await page.getByTestId("pp-dock-layer-ground-plain").click();
  await expect(page.getByTestId("pp-dock-layer-ground-plain")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByTestId("pp-dock-layer-context-streetview").click();
  await expect(page.getByTestId("pp-streetview")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);

  // The context notes always say where terrain and buildings came from, or why not.
  await expect(page.getByTestId("pp-context")).toContainText("Terrain:");
  await expect(page.getByTestId("pp-context")).toContainText("Neighbouring buildings:");
  expect(errors).toEqual([]);
});

test("plot planner explains when imagery cannot load", async ({ page }) => {
  await stubImagery(page, "fail");
  await page.goto(URL);
  await expect(page.getByTestId("plot-viewer-canvas")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("pp-viewer").getByRole("status")).toContainText(
    "Satellite imagery could not be loaded",
  );
  await expect(page.getByTestId("pp-readout")).toContainText("(4 units)");
});
