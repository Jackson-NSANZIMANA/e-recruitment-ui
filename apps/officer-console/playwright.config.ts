import { defineConfig, devices } from "@playwright/test";

/**
 * Officer console E2E configuration.
 *
 * TESTS THE BUILT BUNDLE, NOT SOURCE. `pnpm preview` serves dist/ on port 3001
 * (vite.config.ts preview.strictPort), which is the same origin the dev server
 * uses, so baseURL is unchanged. turbo.json already declares
 * `test:e2e dependsOn: [build]`, so dist exists before this server starts.
 *
 * This matters beyond tidiness: the handover audit recorded "e2e declared
 * needs: build and NEVER DOWNLOADED THE ARTIFACT - it tested source, not the
 * bundle that ships" as a CI defect, and listed it as fixed. It was not fixed
 * here; the webServer still ran `pnpm dev`. A service worker in particular does
 * not exist in a dev server the way it exists in a build, so offline behaviour
 * is untestable against source.
 *
 * All edge calls are intercepted via page.route() in the specs — no live
 * backend required.
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
  },
  projects: [
    {
      // Institutional desktop client on an agency network.
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // THE FIELD TABLET. The device class this app is built for had zero
      // coverage: one Desktop Chrome project, no touch, no tablet viewport. A
      // 48px touch floor and a gloved-hand HCI mandate cannot be proven by a
      // mouse pointer at 1280x720. Landscape matches the PWA manifest.
      name: "field-tablet",
      use: { ...devices["Galaxy Tab S4 landscape"] },
    },
  ],
  webServer: {
    command: "pnpm preview",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
});
