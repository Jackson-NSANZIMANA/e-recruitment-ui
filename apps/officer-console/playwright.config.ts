import { defineConfig, devices } from "@playwright/test";

/**
 * Officer console E2E configuration.
 *
 * Tests the production bundle served by `vite preview`, with the edge boundary
 * intercepted by each spec. The server and browser state are deliberately
 * isolated so a previous preview process or installed PWA worker cannot make
 * the test exercise a different bundle than the one just built.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: process.env["CI"] ? "github" : "html",
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    // The service worker is part of the shipped PWA, but it must not control
    // the harness. Blocking it prevents stale precache entries from masking a
    // newly built login bundle and keeps page.route() authoritative.
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "field-tablet",
      use: { ...devices["Galaxy Tab S4 landscape"] },
    },
  ],
  webServer: {
    command: "pnpm preview --host 127.0.0.1",
    url: "http://localhost:3001",
    // Never reuse an old server locally. Reuse made it possible to run a fresh
    // build while Playwright continued testing an older dist directory.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
