import { defineConfig, devices } from "@playwright/test";

/**
 * Applicant portal E2E configuration.
 *
 * Dev server runs on port 3000 (vite.config.ts strictPort).
 * All BFF calls are intercepted via page.route() in the specs — no live
 * backend required.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  /**
   * A retry is DIAGNOSTIC EVIDENCE, not insurance.
   *
   * `retries: 2` re-runs a failed test so a transient fault leaves a trace and
   * a second chance. On its own it is also a way to turn a red test green and
   * say nothing: the job passes, "0 flaky" is inferred from the absence of
   * red, and the only record of the failure is inside an artifact nobody
   * reads. That is exactly how run 41364349616 reported green on 11 flaky
   * tests, 7 of them D8.
   *
   * So in CI the retry allowance is kept — a re-run is still worth having —
   * but a test that only passes on a later attempt fails the run. Green then
   * means every test passed on its first attempt, which is the claim the D8
   * evidence depends on.
   */
  failOnFlakyTests: !!process.env["CI"],
  workers: process.env["CI"] ? 1 : undefined,
  // CI also writes JSON: the evidence bundle reads it to count and name
  // skipped specs (tooling/ci/evidence-bundle.mjs).
  reporter: process.env["CI"]
    ? [["github"], ["json", { outputFile: "playwright-report/results.json" }]]
    : "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
});
