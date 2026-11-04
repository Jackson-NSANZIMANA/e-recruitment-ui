import { defineConfig, devices } from "@playwright/test";
import { join, resolve } from "node:path";

/**
 * THE VISUAL GATE: every story in the gallery, rendered and diffed.
 *
 * WHY THIS FILE EXISTS. `docs/engineering/ui-visual-gap-2026-11-04.md` §G6
 * records that nothing in this repository proved what a screen looks like:
 * three stories for 125 `.tsx` files, and zero uses of `toHaveScreenshot`. The
 * a11y runner (`packages/design-system/.storybook/test-runner.ts`) visits every
 * story in a real browser and fails on a WCAG violation, but it is blind to a
 * layout that is merely WRONG rather than inaccessible - a card that lost its
 * elevation, a metric tile whose sparkline overflows, a badge that fell back to
 * grey because a status was renamed. Those are exactly the defects this layer of
 * work keeps touching, and every one of them compiles, lints and passes axe.
 *
 * WHY PLAYWRIGHT DIRECTLY, NOT `storybook test-runner`. @storybook/test-runner
 * is installed for axe, but it has no first-class screenshot assertion, and
 * bolting a custom `postVisit` screenshot onto it would mean the baseline name
 * comes from a context object rather than from the story id. Playwright can read
 * Storybook's own `index.json` and visit `iframe.html?id=<storyId>` itself, so
 * the run needs no new dependency, no dev server and no Storybook plugin: the
 * static build is the artefact, and the story id is the name.
 *
 * AGAINST THE STATIC BUILD, NOT THE DEV SERVER, for the reason
 * run-storybook-a11y.sh spells out: a dev server re-optimises dependencies on
 * first import of a new package and reloads the page mid-run, which makes a
 * screenshot diff flaky for reasons that have nothing to do with the UI. A
 * static build never reloads.
 *
 * WHAT IS DELIBERATELY FIXED IN `use`: device scale factor, colour scheme,
 * viewport and `animations: "disabled"`. A baseline taken at DPR 1 in a light
 * theme cannot be compared with one taken at DPR 2 on a machine that prefers
 * dark mode, and an animation caught mid-frame would produce a different
 * baseline every run. Pinning them is what makes "the pixels changed" mean "the
 * code changed".
 *
 * `reducedMotion` is emulated per page in the spec, not set here: it is a
 * browser-context option that this Playwright version's `use` type does not
 * accept, and emulating it at the page is the smaller lie than leaving it out
 * (the `stillness` wrapper around the skeleton keys off exactly that media
 * query).
 */
/**
 * The package root, resolved from this file's own location.
 *
 * LOAD-BEARING, and the reason it is explicit: Playwright resolves BOTH
 * `webServer.command` and the relative paths inside a spec against the CONFIG
 * FILE's directory, which is `storybook/`. That directory has no package.json
 * and no scripts/, so `pnpm run build-storybook` and
 * `node scripts/serve-storybook-static.mjs` both failed at startup - the gate
 * could not run anywhere, and the failure looked like infrastructure rather than
 * like a bug in this file.
 */
const PACKAGE_ROOT = resolve(import.meta.dirname, "..");
const STATIC_DIR = join(PACKAGE_ROOT, "storybook-static");

export default defineConfig({
  // Everything below is relative to the package root, not to storybook/.
  testDir: PACKAGE_ROOT,
  outputDir: join(PACKAGE_ROOT, "test-results"),
  // The one spec beside this config. `testDir` is the package root (see
  // PACKAGE_ROOT), so this glob is what keeps the gate from collecting the
  // component's unit tests or any future spec as a screenshot case.
  testMatch: /storybook\/visual\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  retries: 0,
  // Not `undefined` locally: `exactOptionalPropertyTypes` is on repo-wide and
  // Playwright types `workers` as a required string|number when present.
  ...(process.env["CI"] ? { workers: 2 } : {}),
  // A pixel diff is either a change someone made or noise; a retry would hide
  // the second case rather than report it.
  reporter: process.env["CI"] ? [["github"], ["list"]] : [["list"]],
  // Baselines are per-platform. Chromium rasterises identically across macOS
  // and Linux for this content, but `expect.toHaveScreenshot` still scopes by
  // project by default; the single `chromium` project below keeps one baseline
  // directory, which is only safe because CI and local both run Linux x64.
  // Baselines live beside the spec, in the package, and are COMMITTED: a
  // screenshot gate whose baselines are not in the repository has nothing to
  // compare against on a fresh checkout and reports green by skipping.
  snapshotPathTemplate: "{testDir}/storybook/__screenshots__/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      // Zero tolerance on layout, a small tolerance on rasterisation: subpixel
      // font antialiasing differs between GPU and software rendering, and a
      // threshold of 0 would make the gate fail on the CI runner's driver
      // rather than on a UI change.
      maxDiffPixelRatio: 0.001,
      // An animation caught mid-frame is not a regression. `stillness` covers
      // our own skeleton, this covers a library's.
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },
  use: {
    // The static build is served by the webServer below; 127.0.0.1 rather than
    // localhost so a machine with a stale hosts entry cannot resolve elsewhere.
    baseURL: "http://127.0.0.1:6007",
    colorScheme: "light",
    deviceScaleFactor: 1,
    serviceWorkers: "block",
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } } }],
  webServer: {
    // `storybook build` then a plain static server: no dependency on a
    // long-running dev process, and the artefact is the same one `pnpm a11y`
    // audits.
    command:
      "pnpm run build-storybook --quiet && node scripts/serve-storybook-static.mjs storybook-static 6007",
    cwd: PACKAGE_ROOT,
    url: "http://127.0.0.1:6007/index.json",
    reuseExistingServer: false,
    timeout: 600_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
