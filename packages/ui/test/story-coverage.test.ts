/**
 * The story-coverage gate.
 *
 * WHY THIS EXISTS WHEN A VISUAL GATE ALSO EXISTS. The screenshot baselines
 * (`packages/design-system/storybook/visual.spec.ts`) only run where a Chromium
 * exists. This test is its dependency-free companion: it reads the component
 * sources straight off disk, so it runs on a clean checkout with no
 * `node_modules`, no browser and no build. It cannot tell you a story LOOKS
 * right. It can tell you the gallery has not silently emptied again, which is
 * the failure the 2026-11-04 audit found (three stories for 125 components) and
 * the one that would let every other gate go quietly blind.
 *
 * WHAT IT ASSERTS, and each clause earns its place:
 *
 *  1. Every exported component under `src/components/` has a story file beside
 *     it. The rule the gap doc asks for, made mechanical.
 *  2. Every story file exports at least one named story. A story module with
 *     only a `default` export renders nothing in Storybook and is invisible in
 *     the gallery, in the a11y sweep and in the screenshot run - the quietest
 *     possible way to appear covered.
 *  3. Story titles are unique per module. Two modules claiming one title means
 *     Storybook keeps one and drops the other, and the dropped one is never
 *     looked at again.
 *  4. The gallery's own count has a floor. A refactor that stops the Storybook
 *     glob matching should fail here, not in a report nobody reads.
 *
 * Each assertion is tested against a synthetic fixture as well as the repo, so a
 * broken regex in this file cannot pass by finding nothing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const UI_SRC = join(HERE, "..", "src");
const COMPONENTS_DIR = join(UI_SRC, "components");

interface StoryFile {
  readonly path: string;
  readonly source: string;
}

function storyFiles(dir: string): StoryFile[] {
  if (!existsSync(dir)) return [];
  const out: StoryFile[] = [];
  for (const name of readdirSync(dir, { recursive: true, encoding: "utf8" })) {
    if (!name.endsWith(".stories.tsx")) continue;
    const full = join(dir, name);
    out.push({ path: full, source: readFileSync(full, "utf8") });
  }
  return out;
}

/** Components with a directory under src/components and an index.tsx. */
function componentDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { encoding: "utf8" })
    .filter((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() && existsSync(join(full, "index.tsx"));
    })
    .sort();
}

/** `export const Foo: Story = {...}` and `export const Foo = {...}`. */
function exportedStories(source: string): string[] {
  return [...source.matchAll(/^export\s+const\s+([A-Za-z0-9_]+)\s*[:=]/gm)].map((m) => m[1] as string);
}

/** `export default { title: "..." }` */
function storyTitle(source: string): string | null {
  const m = /export\s+default\s+\{[^}]*?title:\s*["']([^"']+)["']/s.exec(source);
  return m?.[1] ?? null;
}

// ─── 1. every component in src/components ships a story ──────────────────────

test("every component directory ships a story file beside it", () => {
  const missing = componentDirs(COMPONENTS_DIR).filter(
    (name) => !existsSync(join(COMPONENTS_DIR, name, `${name}.stories.tsx`)),
  );
  assert.deepEqual(
    missing,
    [],
    "these components have no story, so the a11y sweep and the screenshot gate never see them: " +
      missing.join(", ") +
      " - add src/components/<Name>/<Name>.stories.tsx",
  );
});

test("the component census is not empty (a broken glob must fail, not pass)", () => {
  assert.ok(
    componentDirs(COMPONENTS_DIR).length >= 10,
    "found fewer component directories than the repo has; the directory walk is broken",
  );
});

// ─── 2 + 3. every story module exports stories, under a unique title ─────────

const ALL_STORY_FILES = [
  ...storyFiles(COMPONENTS_DIR),
  ...storyFiles(join(UI_SRC, "layout")),
  ...storyFiles(join(UI_SRC, "states")),
  ...storyFiles(join(UI_SRC, "national")),
];

test("every story file exports at least one story", () => {
  const barren = ALL_STORY_FILES.filter((f) => exportedStories(f.source).length === 0).map((f) =>
    relative(UI_SRC, f.path),
  );
  assert.deepEqual(
    barren,
    [],
    "a story module with no exported story renders nothing in the gallery: " + barren.join(", "),
  );
});

test("every story file declares a title, and no two share one", () => {
  const byTitle = new Map<string, string[]>();
  for (const file of ALL_STORY_FILES) {
    const title = storyTitle(file.source);
    assert.ok(title, relative(UI_SRC, file.path) + " has no `title` in its default export");
    const key = title as string;
    byTitle.set(key, [...(byTitle.get(key) ?? []), relative(UI_SRC, file.path)]);
  }
  const clashes = [...byTitle].filter(([, files]) => files.length > 1);
  assert.deepEqual(clashes, [], "two story modules claim the same title; Storybook keeps one");
});

test("the gallery clears its floor", () => {
  const stories = ALL_STORY_FILES.flatMap((f) => exportedStories(f.source));
  assert.ok(
    stories.length >= 30,
    "the gallery has " + String(stories.length) + " stories; the floor is 30",
  );
});

// ─── the detector itself ────────────────────────────────────────────────────
//
// A gate whose own parser is broken reports green forever. These fixtures pin
// the two shapes that matter: the convention in use, and the shapes that must
// NOT be counted as stories.

test("the story detector reads the repo's convention", () => {
  const source = [
    'interface Story { readonly render: () => React.ReactElement }',
    'export default { title: "Components/Thing", parameters: { layout: "padded" } };',
    "export const First: Story = { render: () => <p>x</p> };",
    "export const Second: Story = { render: () => <p>y</p> };",
  ].join("\n");
  assert.deepEqual(exportedStories(source), ["First", "Second"]);
  assert.equal(storyTitle(source), "Components/Thing");
});

test("the story detector ignores the default export and type aliases", () => {
  const source = [
    'export default { title: "X/Y" };',
    "export type Props = { a: string };",
    "const notExported = 1;",
  ].join("\n");
  assert.deepEqual(exportedStories(source), []);
});

test("the story detector handles a single-quoted title", () => {
  assert.equal(storyTitle("export default { title: 'National/Identity' };"), "National/Identity");
});
