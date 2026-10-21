import { defineConfig, devices } from "@playwright/test";

/**
 * Field Station E2E configuration.
 *
 * Tests the production bundle served by `vite preview` on :3002, with the edge
 * boundary intercepted by each spec, exactly like officer-console: a fresh
 * server per run and no service worker, so the harness always exercises the
 * bundle that was just built. The field-tablet project is the device class
 * this app exists for.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  // CI also writes JSON: the evidence bundle reads it (tooling/ci/evidence-bundle.mjs).
  reporter: process.env["CI"]
    ? [["github"], ["json", { outputFile: "playwright-report/results.json" }]]
    : "html",
  use: {
    baseURL: "http://localhost:3002",
    trace: "on-first-retry",
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "field-tablet",
      use: { ...devices["Galaxy Tab S4 landscape"] },
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm preview --host 127.0.0.1",
    url: "http://localhost:3002",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
