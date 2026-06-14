import { defineConfig, devices } from "@playwright/test";

const port = 5173;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/global-setup.ts",
  snapshotPathTemplate: "{testDir}/snapshots/{testFilePath}/{arg}{ext}",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    viewport: { width: 1280, height: 720 },
    locale: "en-GB",
    timezoneId: "UTC",
    colorScheme: "light",
    reducedMotion: "reduce",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev --host 127.0.0.1 --port 5173 --strictPort",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.02,
    },
  },
});
