import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * EVERY story in the gallery, screenshotted.
 *
 * The list comes from Storybook's own `index.json`, not from a hand-written
 * array. A hand-written list is a second registry: it goes stale the first time
 * someone adds a story and forgets to add it here, and the gate then reports
 * green over a gallery it never looked at. Reading the build's index means a new
 * story is captured on the run after it lands, with no edit to this file.
 *
 * ONE TEST PER STORY, not one test for all of them: a failure then names the
 * story in the report instead of dumping a diff from an anonymous screenshot, and
 * `--grep` can target one component while iterating.
 *
 * NOTHING IS ASSERTED ABOUT APPEARANCE HERE. This file says "these pixels did not
 * change"; it cannot say "these pixels are right". The first baseline is a
 * snapshot of whatever shipped, so a story committed with a broken layout gets a
 * baseline of the broken layout. That is a real limit of visual regression and
 * worth stating plainly rather than implying the gate has judgement: a human
 * approves the first capture, and the gate protects it from then on. The
 * companion a11y runner is what catches a story that is wrong in an
 * accessible-verifiable way.
 */

interface StoryEntry {
  readonly id: string;
  readonly title: string;
  readonly name: string;
  readonly type?: string;
}

test.describe.configure({ mode: "parallel" });

test("the gallery is not empty", async ({ request }) => {
  const res = await request.get("/index.json");
  expect(res.ok()).toBeTruthy();
  const { entries } = (await res.json()) as { entries: Record<string, StoryEntry> };
  const stories = Object.values(entries).filter((e) => e.type !== "docs");
  // A guard on the guard: a glob that stops matching, or a build that ships no
  // stories, would otherwise make this whole file pass while screenshotting
  // nothing at all.
  expect(stories.length).toBeGreaterThanOrEqual(15);
});

test("every story renders without a console error", async ({ page, request }) => {
  const res = await request.get("/index.json");
  const { entries } = (await res.json()) as { entries: Record<string, StoryEntry> };
  const stories = Object.values(entries).filter((e) => e.type !== "docs");

  const failures: string[] = [];
  for (const story of stories) {
    const errors: string[] = [];
    const onConsole = (msg: { type: () => string; text: () => string }): void => {
      if (msg.type() === "error") errors.push(msg.text());
    };
    page.on("console", onConsole);
    await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);
    // The root element gains this attribute once the story has rendered; waiting
    // for it is what makes the capture deterministic rather than timing-based.
    await page.waitForSelector("#storybook-root > *", { timeout: 15_000 });
    page.off("console", onConsole);
    // React's own dev warnings are errors in a story; a missing key or a
    // controlled-input warning is a real defect that axe will not see.
    for (const text of errors) failures.push(`${story.id}: ${text}`);
  }
  expect(failures, failures.join("\n")).toEqual([]);
});

/**
 * The capture itself.
 *
 * `test.describe` is built from the build's index at COLLECTION time, which is
 * why the index is read with `fs` here rather than through Playwright's
 * `request` fixture: a fixture needs a running server and a test, and this must
 * produce test CASES. The build therefore has to exist before Playwright
 * collects - which is what the webServer block in playwright.visual.config.ts
 * guarantees, because Playwright starts the server before collecting.
 */
const STATIC_DIR = process.env["STORYBOOK_STATIC_DIR"] ?? "storybook-static";
const INDEX = JSON.parse(readFileSync(join(STATIC_DIR, "index.json"), "utf8")) as {
  entries: Record<string, StoryEntry>;
};

const ALL_STORIES = Object.values(INDEX.entries).filter((e) => e.type !== "docs");

for (const story of ALL_STORIES) {
  test.describe(story.title, () => {
    test(story.name, async ({ page }) => {
      // Emulated per page: `use.reducedMotion` is a browser-context option this
      // Playwright version's config type does not carry (see the config's
      // header). `stillness` in SkeletonPanel keys off this query, so emulating
      // it is what makes a skeleton capture stable.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);
      await page.waitForSelector("#storybook-root > *", { timeout: 15_000 });
      // Wait for webfonts: the design-system self-hosts its faces, and a capture
      // taken between first paint and font swap is a capture of the fallback
      // stack. This is the difference between a stable baseline and a flaky one.
      await page.evaluate(() => document.fonts.ready);
      // No scrollbars, no hover state, no caret: a full-page screenshot would
      // otherwise change height with the viewport the runner happens to have.
      await expect(page.locator("#storybook-root")).toHaveScreenshot(`${story.id}.png`);
    });
  });
}
