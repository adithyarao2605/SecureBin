import { defineConfig, devices } from "@playwright/test";

const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./tests/e2e",
  forbidOnly: Boolean(process.env.CI),
  // Single worker: the dev server compiles routes on demand, and parallel
  // first-hits were the dominant source of timing flakes.
  workers: 1,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? "dot" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100",
    reuseExistingServer: !process.env.CI,
    url: "http://127.0.0.1:3100",
    timeout: 120_000
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : undefined } }
  ]
});
