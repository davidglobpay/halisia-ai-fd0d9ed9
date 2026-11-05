import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 180_000,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8080",
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://localhost:8080",
          localStorage: [{ name: "halisia:navguide:v1:seen", value: "1" }],
        },
      ],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node .output/server/index.mjs",
    cwd: "../..",
    url: "http://localhost:8080",
    env: { PORT: "8080", HOST: "0.0.0.0" },
    timeout: 120_000,
  },
});
