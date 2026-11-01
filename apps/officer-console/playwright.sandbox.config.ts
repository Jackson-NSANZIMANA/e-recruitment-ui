import { defineConfig, devices } from "@playwright/test";

/**
 * Live journeys against the backend sandbox (`pnpm sandbox:up`), opt-in: USRP_SANDBOX=1.
 * No route mocks and no web server of its own: infrastructure/sandbox/live.sh in the backend starts the
 * three apps (sandbox builds, ports 4930-4932, proxying the sandbox edge) and then runs this config.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /live-sandbox\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 240_000,
  use: {
    baseURL: process.env["USRP_OFFICER_URL"] ?? "http://localhost:4931",
    trace: "retain-on-failure",
    serviceWorkers: "block",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
