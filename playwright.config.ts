import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Sandboxes ship a pre-installed Chromium whose revision can differ from the
// one this Playwright version expects. Reuse whichever build exists.
const candidates = [
  "/chromium-1194/chrome-linux/chrome",
  "/opt/ms-playwright/chromium-1194/chrome-linux/chrome",
  "/opt/ms-playwright/chromium-1228/chrome-linux64/chrome",
];
const executablePath = candidates.find((p) => existsSync(p));

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8080";

// The first-visit guided tour is a full-screen modal; in CI it blocked over a
// hundred clicks in specs that never meant to test it. Every browser context
// starts with it marked as seen. Specs that test the guide clear this flag.
const NAV_GUIDE_SEEN = {
  cookies: [],
  origins: [
    {
      origin: new URL(baseURL).origin,
      localStorage: [{ name: "halisia:navguide:v1:seen", value: "1" }],
    },
  ],
};

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  // Sandbox/CI containers throttle badly with many browsers: cap parallelism so
  // hydration-dependent assertions stay deterministic.
  workers: Number(process.env["PLAYWRIGHT_WORKERS"] ?? 2),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    storageState: NAV_GUIDE_SEEN,
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 5"] } },
  ],
  // E2E_SERVER=prod tests the production Node build (CI builds it with
  // NITRO_PRESET=node-server). The dev server compiles hundreds of modules on
  // first visit, so pages stayed un-hydrated for many seconds and clicks did
  // nothing; real visitors get the production build.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : process.env.E2E_SERVER === "prod"
      ? {
          command: "node .output/server/index.mjs",
          url: "http://localhost:8080",
          env: { PORT: "8080", HOST: "0.0.0.0" },
          reuseExistingServer: false,
          timeout: 120_000,
        }
      : {
          command: "npm run dev -- --host 127.0.0.1",
          url: "http://localhost:8080",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
});
