# UI visual gap — what the Atlassian screenshots have that this repository does not

**Date:** 2026-11-04  
**Question:** the owner supplied five screenshots of production Atlassian surfaces (Jira home, Jira
_dashboards_ with widgets, the "Name your space" onboarding modal, the template picker with illustrated
cards, and a Confluence team-performance dashboard) and asked what is missing here to build a UI of that
quality.  
**Method:** every claim below is a `grep`/`npm registry` result against this checkout at `038e5e3`, not an
impression. File and line references are given so each row can be re-run.  
**Companion documents:** [`frontend-architecture.md`](../architecture/frontend-architecture.md) (baseline),
[`atlassian-design-system.md`](../vendor/atlassian-design-system.md) (canonical ADS references),
[`AGENTS.md`](../../AGENTS.md) §3 (composition ladder) and §5 (styling rules).

---

## 0. The short answer

Those screenshots look the way they do because of **nine primitives**. This repository has the bones of
six of them and the skin of none:

| #   | Primitive the screenshots use                                                         | Here today                                                                                                                                                  | Gap                                                                                      |
| --- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | App shell with global search, `Create`, breadcrumbs, sectioned side nav               | `apps/officer-console/src/components/AppShell/index.tsx` — `navigation-system` Root/TopNav/SideNav/Main, flat menu                                          | **partial** — assembled from defaults, no search, no create, no breadcrumbs, no sections |
| 2   | Card as the unit of layout (border + radius + surface + shadow)                       | hand-rolled `cssMap` panel in `apps/officer-console/src/dashboard/panels.tsx:28` and again in `packages/ui/src/components/DashboardMetricCard/index.tsx:20` | **duplicated** — no shared `Card`; page shell copied 7×                                  |
| 3   | Charts: sparklines with trend deltas, stacked bars, distribution tables               | none — no chart dependency anywhere; the only "chart" is a CSS meter (`panels.tsx:36,40`)                                                                   | **missing**                                                                              |
| 4   | Skeletons / optimistic placeholder layout                                             | `packages/ui/src/states/StateBoundary.tsx:45` returns a centred `Spinner` for `loading`                                                                     | **missing** (`@atlaskit/skeleton` not installed)                                         |
| 5   | People affordances: avatars, avatar groups, assignees                                 | none — officer names render as `<Text>` only                                                                                                                | **missing** (`@atlaskit/avatar`, `avatar-group` not installed)                           |
| 6   | Motion: content fades, panels slide, reduced-motion respected                         | zero `prefers-reduced-motion` occurrences in `packages/`/`apps/`                                                                                            | **missing**                                                                              |
| 7   | Illustration (onboarding cards, empty states)                                         | `packages/ui/src/national/assets/*.webp` (emblems only); ADS ships no illustration package                                                                  | **missing**                                                                              |
| 8   | Widget/board composition (drag, reorder, "Add widget")                                | none; `pragmatic-drag-and-drop` exists in `pnpm-lock.yaml` only as an ADS transitive dependency, not a direct one                                           | **missing**                                                                              |
| 9   | A gallery that proves a component looks right (visual + a11y + screenshot regression) | 3 Storybook stories for 125 `.tsx` files; zero `toHaveScreenshot`/Chromatic/Percy hits                                                                      | **thin**                                                                                 |

The one-sentence version: **this repo has an ADS foundation and almost no ADS _surface_ layer, and nothing
that would tell us if the surface looked wrong.**

---

## 1. What the screenshots are actually made of

Useful to separate them, because they are not the same product surface and not the same amount of work:

1. **Jira home (screenshot 1).** Shell + a "For you" tabbed feed + a dismissible promo card with an
   icon, `Try it`, and a close button. Nothing here is a chart. It is _composition_.
2. **Jira dashboard (screenshot 2).** The expensive one. Three KPI cards carrying a big number, a
   percentage delta badge and a **sparkline**; a stacked bar chart with legend, axis titles and gridlines;
   a right-hand _Confluence page_ card with author, read time, and an embedded document body. Plus the
   chrome that makes it feel finished: star, lock, `Add widget`, `Done`, filter pills.
3. **"Name your space" modal (screenshot 3).** Form on the left, **illustration** on the right, example-name
   chips, one primary action. 50% of the perceived quality is the illustration.
4. **Template picker (screenshot 4).** Three illustrated cards, selected card = brand border + tinted
   surface, one primary action. Again: illustration plus a _selected_ state.
5. **Team performance dashboard (screenshot 5).** Widgets built on a chart library: tables with heat
   shading, grouped bars, area chart, stat pairs. This is what widget-level analytics costs.

So: **1, 3 and 4 are composition and illustration. 2 and 5 are a real data-visualisation layer.** They are
separate purchases and should be sequenced separately.

---

## 2. What is genuinely already good here

Worth stating plainly, because several items people usually "fix" are already correct and better than
Atlassian's own product:

- **The shell package is the right one.** `@atlaskit/navigation-system` (not the deprecated
  `@atlaskit/navigation`/`atlassian-navigation`), wired in `apps/officer-console/src/components/AppShell/index.tsx`.
  Skip links, responsive grid and the collapse shortcut come free.
- **Brand theming is real.** `NATIONAL_THEME` seeds the ADS brand ramp from GoR Primary Blue
  (`packages/ui/src/national/identity.ts:45`), passed to `AppProvider` in `apps/officer-console/src/main.tsx`.
  Atlassian's screenshots use stock blue; ours derive a whole ramp from a statutory colour. That is a
  better foundation than the screenshots have.
- **Token discipline is enforced, not requested** — `hexScan` over `apps`, `packages`,
  `tooling/repo-hygiene` (`tooling/repo-hygiene/gates.config.json`), with one documented allow-path for the
  coat of arms.
- **Fonts are self-hosted** (`packages/design-system/src/fonts/`), so no third-party origin on a field
  tablet.
- **Asset provenance is a solved pattern.** The owner-supplied masters in `apps/assets/logo&graphics/` are
  tracked and traced to their shipped WebP renditions in
  `packages/ui/src/national/assets/PROVENANCE.md` (source, processing, SHA-256). That is exactly the
  process any commissioned illustration set should follow — the template exists before the art does.
- **States are modelled** (`packages/ui/src/states/`): loading, empty, filtered-empty, partial, stale,
  conflict, upstream-failure. Most Atlassian screens only do loading and empty.
- **Tables are ADS `DynamicTable`** in the officer dashboard, so density, sorting and keyboard behaviour
  are already at Atlassian quality.

The visual gap is therefore **not** a foundations problem. It is a missing product-surface layer.

---

## 3. The five gaps, in order of visual return per unit of risk

### G1 — No data-visualisation layer (the biggest missing piece)

**Symptom.** Screenshots 2 and 5 carry 80% of their perceived quality in charts. This repo has no chart
capability at all:

```
grep -nE "atlaskit/(charts|chart)|recharts|visx|nivo|victory|d3-|chart\.js" pnpm-lock.yaml   → no matches
```

The only quantitative visualisation is two `cssMap` bars in a feature-adjacent app file
(`apps/officer-console/src/dashboard/panels.tsx:36` `meterTrack`, `:40` `stageTrack`) plus an inline
`width` percentage at `:213`. That is fine engineering and the wrong layer: it is unreachable from
`packages/ui`, unavailable to the applicant portal, and untestable in isolation.

**Do not reach for `@atlaskit/charts`.** Registry check 2026-11-04: latest `0.0.9`, last published
**2021-05-10**, peer on `react-spring@^8`. It is effectively abandoned and would fail the React 18 peer
graph. Atlassian's own dashboards are not built on that package.

**Minimum viable fix.** A token-bound chart layer in `@usrp/ui` (domain-free enough to live there, since a
sparkline names no domain concept):

- `Sparkline` — series + optional delta; the KPI-card idiom from screenshot 2.
- `BarSeries` / `StackedBar` — with legend and axis titles.
- `DistributionTable` — heat-shaded counts (screenshot 5 top-right).
- Rules: every series colour comes from an **accent** token pair, never a status token; every chart renders
  a `<table>` or text alternative for screen readers; `role="img"` + `aria-label` on the SVG; charts
  degrade to a summary at `prefers-reduced-motion` and at narrow widths.
- Render as plain SVG via primitives + `cssMap` (no new dependency) **or** a ~15 KB library, measured
  against the budget in `gates.config.json` (`apps/officer-console` ceiling: 1200 KB total / 500 KB chunk).
  Do not add 100 KB of charting to a repo whose budget comment explicitly calls out a field tablet.

**Why it matters beyond looks.** Today the pipeline is a set of _counts_ (`PipelinePanel`,
`apps/officer-console/src/dashboard/panels.tsx:189`). A recruiting officer needs the **shape** — inflow vs clearance over the last 5 days, queue
age distribution, per-district load. That is a decision-support change, not decoration.

### G2 — The shell is assembled from defaults, not designed

**Symptom.** Compare screenshot 1/2's top bar to ours. Atlassian has: logo, global **search** field, primary
**Create** button, then chat, notifications, help, settings, avatar. We have logo, language switcher, profile
(`apps/officer-console/src/components/AppShell/index.tsx:92-110`). A `grep` for `Search` in the shell returns nothing.

Also missing:

- **Breadcrumbs.** `PageHeader` supports them (`@atlaskit/page-header` is installed) but the console passes
  only an `AgencyLogo` as `breadcrumbs` (`apps/officer-console/src/routes/dashboard.tsx:79`). On a
  hierarchical admin tool that is the single cheapest wayfinding win.
- **Sectioned side nav.** Ours is a flat 6-item `MenuList`. Atlassian groups: Recents, Starred, Apps,
  Plans, Spaces, then a "Recommended" group with `Try` lozenges. `@atlaskit/side-nav-items` supports
  section headings and nested items — the structure exists, we are not using it.
- **A shared page shell — duplicated seven times, with three different widths.** The same
  `root: { maxWidth: '1200px', marginInline: 'auto', paddingBlock/paddingInline: ... }` recipe is copy-pasted
  in `packages/features/applications/src/ui/ApplicationsPage.tsx:22`,
  `ApplicationDetailPage.tsx:33`, `packages/features/campaigns/src/ui/shared.tsx:17`,
  `packages/features/compliance/src/ui/DpoQueuePage.tsx:15`,
  `packages/features/adjudication/src/ui/QueuesPage.tsx:30`,
  `packages/features/identity/src/ui/StaffPage.tsx:39`, and again in the host at
  `apps/officer-console/src/routes/dashboard.tsx:18`. The six feature copies are byte-identical; the host's
  copy differs (double quotes, `paddingBlock: space.400` / `paddingInline: space.500` instead of
  `space.300` / `space.400`) — which is exactly how a shared constant rots when it is not one. Worse, the
  header above them is `maxWidth: '80rem'` = **1280px** (`packages/ui/src/national/NationalHeader.tsx:22`),
  so on a 1440px screen the page content's left edge sits 40px inside the header's. That is exactly the
  kind of misalignment that reads as "unfinished" without anyone being able to name it.

**Minimum viable fix.** One `PageShell` in `@usrp/ui` (max width from a single token-backed constant,
padding, optional breadcrumbs, optional page actions), adopted by all three apps; `main`'s `TopNav` gains a
`Search` trigger and a `Create` primary action behind the existing feature-flag resolver
(`packages/design-system/src/runtime/feature-flags.ts`); side nav moved to sectioned items using data
already in `apps/officer-console/src/nav.ts`.

**Cost:** no new dependencies. This is the highest visual return per line of code in the whole list.

### G3 — Loading looks like waiting, not like a product

**Symptom.** `packages/ui/src/states/StateBoundary.tsx:45` — for `state === "loading"` it renders a centred
`Spinner` and nothing else. Every screen that refetches therefore _blanks_, including the officer dashboard
which refetches across five independent reads (`apps/officer-console/src/routes/dashboard.tsx:90-97`) with
`staleTime` between 30s and 60s (`packages/api-client/src/queries/admin.ts:9-17`,
`apps/officer-console/src/main.tsx:41`). Screenshot 2 never blanks: the
cards are there and their interiors shimmer.

`@atlaskit/skeleton` is not a dependency of any package (registry latest `4.4.4`, published, maintained).

**Minimum viable fix.** Install `@atlaskit/skeleton` in `packages/ui`; add a `skeleton` variant to
`StateBoundary` (or a `SkeletonPanel` companion) shaped like the content it replaces — metric card, table
rows, chart block — so the layout is stable on first paint. Keep the spinner only for _inter-block_ waits.

This also fixes a real perception bug on the field tablet: `ConnectionStatus` + a blanked page reads as
"the app crashed", not "the network is slow".

### G4 — No motion layer, and no reduced-motion contract

**Symptom.** Zero occurrences of `prefers-reduced-motion` anywhere in `packages/` or `apps/`. ADS components
bring their own motion (modal, drawer, side nav), so nothing is broken today — but the moment we build
screenshot-style cards, tab panels or a widget grid, every transition we write will ignore the user's OS
setting.

**Minimum viable fix.** Adopt `@atlaskit/motion` (`9.6.1`, peer `react@^18.2 || ^19`) in `packages/ui` and
export a small `useRespectMotion()`/`<FadeIn>` pair. Add a hygiene assertion next to `touchTargets` in
`gates.config.json` that any raw `transition:`/`animation:` in our own `cssMap` sits behind the motion
helper. Motion is what makes the screenshots feel expensive; it also costs battery on the tablet, so it
needs a ceiling, not just a library.

### G5 — No people layer, no illustration, no widget composition

Each is small on its own and together they are the difference between "an admin form" and "a product":

- **People.** `@atlaskit/avatar` (`30.0.6`) and `@atlaskit/avatar-group` (`14.4.8`) are not installed.
  Officers, assignees and reviewers currently appear as plain text. Avatars + `AvatarGroup` are the largest
  single "feels like Jira" signal per KB.
- **Illustration.** Neither the onboarding modal (screenshot 3) nor the template picker (screenshot 4) is
  reproducible without art. There is **no** ADS illustration package (`@atlaskit/illustrations` and
  `illustration-objects` both 404 as of 2026-11-04). ADS `EmptyState` accepts `imageUrl` and we already
  depend on `@atlaskit/empty-state` (`packages/ui/src/states/StateBoundary.tsx:2`) — so the mechanism
  exists and the assets do not. Note the constraint: art added here must be **our own**, commissioned or
  licensed. Copying Atlassian's illustrations into a GoR product is a licence problem, not a shortcut.
- **Widgets / drag.** Screenshot 2's `Add widget` and the dashboard grid need drag-to-reorder.
  `pragmatic-drag-and-drop` is in `pnpm-lock.yaml` via ADS (`@atlaskit/pragmatic-drag-and-drop*`) but is
  **not a direct dependency of any workspace package**, so no package owns an API for it and no gate
  covers it. Defer this until G1 exists — a widget grid with nothing to put in it is theatre.
- **Dead dependencies.** `@atlaskit/badge` and `@atlaskit/drawer` are declared in
  `packages/ui/package.json` and imported by **zero** files. They are counted against the officer-console
  gzip budget only if imported, so this is hygiene rather than bytes — but `AGENTS.md` §3 says the ladder
  is about _composition_, and an unused parent is an invitation to a lookalike.

### G6 — Nothing proves what a screen looks like

This is the gap that makes the other five permanent.

- **3 stories for 125 `.tsx` files.** `find packages apps -name "*.stories.tsx"` returns
  `TouchTarget.stories.tsx`, `National.stories.tsx`, `states.stories.tsx`. Storybook is configured
  (`packages/design-system/.storybook/main.ts`) and its `stories` glob already includes
  `../../ui/src/**/*.stories.@(ts|tsx)` — the gallery exists, empty, waiting.
- **No visual regression.** Zero hits for `toHaveScreenshot`, Chromatic or Percy across `apps/`, `packages/`,
  `tooling/`, `.github/`. `playwright` is already a devDependency at the root and `@storybook/test-runner`
  is installed in `design-system`, so screenshot-diffing Storybook is config, not new infrastructure.
- **No a11y in CI for new components** beyond the existing `pnpm a11y` script (`tooling/repo-hygiene/run-storybook-a11y.sh`),
  which can only test what has a story.

**Minimum viable fix.** A rule of the same shape as the existing ones: _a component in `@usrp/ui` ships a
story in the same PR_, and `pnpm a11y` + a `toHaveScreenshot` baseline cover it. That converts "does it look
right?" from an opinion into a gate — which is the only thing this repository's own philosophy
(`llms.txt`: "Prove it, don't assert it") will actually accept.

**Status, 2026-11-04.** The gallery is filled and the rule is mechanical; the baselines are not captured yet.

| Part | State |
|---|---|
| Stories for every component in `packages/ui/src/components` | **done** — 11 of 11, 42 stories across 15 titles, up from 3 stories total |
| The "ships a story" rule as a gate | **done** — `packages/ui/test/story-coverage.test.ts` fails on a component with no story, a story module with no exported story, or two modules claiming one title. Dependency-free, so it runs before `pnpm install`. |
| `toHaveScreenshot` configuration | **done** — `packages/design-system/storybook/playwright.visual.config.ts` + `visual.spec.ts`, one case per story read from the build's own `index.json`, plus a console-error sweep. `pnpm visual` runs it. |
| Committed screenshot baselines | **NOT DONE, and not faked.** No Chromium exists in the authoring sandbox and `cdn.playwright.dev` is unreachable, so no baseline could be produced or verified here. The gate is wired and will run on a machine that has the browser; the first run records the baselines, and a human must review them before they are committed, because a baseline captures whatever shipped — including a broken layout. |

The one thing this does not solve, stated so it is not mistaken for a solved problem: the first baseline has no
judgement in it. It freezes the current appearance. Whether that appearance is *right* is still a review
question, and the a11y runner is what answers the subset of it that can be verified mechanically.

---

## 4. The stack is also behind, and one package matters more than the rest

Measured against `registry.npmjs.org` on 2026-11-04:

| Package                       | Here       | Latest     | Note                                                                                                                         |
| ----------------------------- | ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `@atlaskit/tokens`            | `^16.4.0`  | **20.9.0** | 4 majors. This is the package that decides colour roles, elevation and spacing — i.e. most of the "look". **Do this first.** |
| `@atlaskit/heading`           | `^7.0.1`   | 8.0.0      | major, type scale                                                                                                            |
| `@atlaskit/lozenge`           | `^15.0.1`  | 17.0.6     | two majors                                                                                                                   |
| `@atlaskit/select`            | `^21.0.0`  | 23.1.5     | two majors                                                                                                                   |
| `@atlaskit/form`              | `^16.1.5`  | 18.3.1     | two majors                                                                                                                   |
| `@atlaskit/badge`             | `^21.0.1`  | 22.0.0     | unused anyway (see G5)                                                                                                       |
| `@atlaskit/icon`              | `^37.3.0`  | 38.0.2     | major                                                                                                                        |
| `@atlaskit/button`            | `^25.0.2`  | 25.7.0     | minor                                                                                                                        |
| `@atlaskit/primitives`        | `^22.2.1`  | 22.6.0     | minor                                                                                                                        |
| `@atlaskit/navigation-system` | `^10.11.1` | 11.5.0     | major; G2 touches this file, so decide before G2                                                                             |
| `@atlaskit/logo`              | `^21.4.3`  | 23.3.1     | two majors                                                                                                                   |

Do **not** treat this as a bulk `pnpm up`. `@atlaskit/tokens` majors change token _names_; a bump is a
rename sweep across every `token(...)` call in `packages/` and `apps/`, and `hexScan` will not catch a
removed token — it returns `undefined` and renders nothing. Grep for each removed name, and let `pnpm
typecheck` + the Storybook gallery be the proof.

**Measured example of that risk** (registry tarball for `@atlaskit/tokens@16.4.0`, checked 2026-11-04).
Token names that exist in 16.4.0 and are **already used** here: `elevation.surface`,
`elevation.surface.sunken` (`NationalFooter.tsx:17`, `NationalFrame.tsx:22`), `elevation.surface.overlay`,
`elevation.shadow.raised` (three auth cards, `OfficialDocument.tsx:24`), `elevation.shadow.overlay`, and
`color.background.selected.hovered` (`DocumentUpload/index.tsx:31`). So the elevation vocabulary is
available and partly spent — good.

The gap is narrower and more specific than "we are behind": **`elevation.surface.raised` is used by zero
files**, and `color.background.brand.subtlest` is used by zero files. Those two are exactly what makes
screenshot 2 read as a product:

- Atlassian's cards in the screenshot sit _raised_ on a _subtly tinted_ page; ours are flat
  `elevation.surface` panels separated only by a 1px `color.border` (`apps/officer-console/src/dashboard/panels.tsx:28-35`,
  the same recipe again in `packages/ui/src/components/DashboardMetricCard/index.tsx:20-24`). Flat + border
  is a valid ADS card, but on a page with five such panels it produces the "everything is a form field" look.
  (The KPI tile is worse than flat: it sets `backgroundColor="color.background.neutral"` via the Box prop
  _and_ a border — a grey tile on a white page reads as disabled at a glance.)
- `color.background.brand.subtlest` + `color.border.brand` is the selected-card treatment in screenshots 3
  and 4. We have neither, so no screen can express "this item is chosen" other than with a status badge.

That is the cheapest real upgrade in this document and it needs **no token bump at all**:
`token("elevation.surface.raised")` on cards, `color.background.brand.subtlest` for selected states.

Two naming cautions for the same sweep: `border.brand.selected` is **absent** from 16.4.0 (use
`color.border.brand`), and a removed token returns `undefined` rather than throwing, so `hexScan` will never
catch it — verify each name against the installed version with `pnpm ads token <name>` (`AGENTS.md` §6)
rather than trusting memory.

---

## 5. What we must not copy from those screenshots

Saying this explicitly, because "make it look like Atlassian" taken literally would break invariants this
repo has paid for:

| Atlassian does                                         | Why we cannot                                                                                                                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12–14px metadata, 14px table text                      | `AGENTS.md` §5: 16px minimum body text. Sunlight, gloves, cheap screens. Keep the _hierarchy_, raise the _floor_.                                               |
| Subtle grey-on-grey secondary text                     | Contrast floor is our a11y contract (`packages/design-system/src/a11y/`). Borrow the rhythm, not the contrast ratio.                                            |
| Dense icon-only toolbar                                | 48px minimum interactive target (stronger than WCAG 2.5.5 AAA). Icon-only is acceptable, small is not.                                                          |
| Dark-mode dashboards                                   | Positive polarity only (§5) — light bg, dark text.                                                                                                              |
| Personalised "Recent" lists (screenshot 1's `Recent`)  | Recents imply client-side history storage. The security invariants govern storage; any "Recent" must be server-session-backed or short-lived and named as such. |
| Illustrated marketing cards, upsell banners ("Try it") | A government recruitment portal does not upsell. Illustrations yes; promos no.                                                                                  |

---

## 6. Ordered plan

Each step is small, separable and has an acceptance criterion a gate can check.

| Step | Work                                                                              | Acceptance                                                                                                                                                     |
| ---- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **`tokens` 16 → 20** + rename sweep                                               | `pnpm typecheck` green; every `token(...)` name resolved against the installed version (`pnpm ads token`), not memory; before/after story screenshots attached |
| 2    | **`PageShell` + breadcrumbs + sectioned nav** in `@usrp/ui` (G2)                  | one `maxWidth` source; all three apps adopt it; header left edge == content left edge at 1440px, proven by a `toHaveScreenshot`                                |
| 3    | **Storybook backfill** for the 12 components in `packages/ui/src/components` (G6) | `pnpm a11y` covers ≥ 15 stories; `toHaveScreenshot` baseline committed                                                                                         |
| 4    | **`SkeletonPanel`** and a `skeleton` state in `StateBoundary` (G3)                | officer dashboard first paint keeps its layout — screenshot proof                                                                                              |
| 5    | **`Avatar` / `AvatarGroup` people layer** (G5)                                    | officers page + application workspace show avatars; no new raw colours                                                                                         |
| 6    | **Chart primitives** `Sparkline`, `StackedBar`, `DistributionTable` (G1)          | pipeline + campaign panels use them; each has a table fallback and a story; `pnpm size` still green                                                            |
| 7    | **`@atlaskit/motion` + reduced-motion rule** (G4)                                 | hygiene gate asserts no bare `transition:` in our `cssMap`s                                                                                                    |
| 8    | **Illustration set** (G5) — commissioned, not copied                              | `EmptyState` images land; licence recorded next to the asset, as `PROVENANCE.md` already does for the coat of arms                                             |
| 9    | **Widget grid + drag** (G5) — only after 6                                        | direct `pragmatic-drag-and-drop` dependency owned by one package; keyboard reorder path proven                                                                 |

Steps 2–4 need **no new dependencies** and deliver most of the perceived difference between the current
screens and screenshot 2. That is where I would start.

---

## 7. Reproduce every claim

```bash
cd /home/user/e-recruitment-ui

# G1 — no chart library, CSS meters are the only chart
grep -nE "atlaskit/(charts|chart)|recharts|visx|nivo|victory|d3-|chart\.js" pnpm-lock.yaml
sed -n '36,40p' apps/officer-console/src/dashboard/panels.tsx

# G2 — shell has no search/create; breadcrumbs carry a logo
grep -n "Search\|Create" apps/officer-console/src/components/AppShell/index.tsx
grep -n "breadcrumbs" apps/officer-console/src/routes/dashboard.tsx

# ...and two page widths that disagree
grep -n 'maxWidth: "1200px"' apps/officer-console/src/routes/dashboard.tsx
grep -n 'maxWidth: "80rem"'   packages/ui/src/national/NationalHeader.tsx

# G3 — loading is a spinner
sed -n '45,50p' packages/ui/src/states/StateBoundary.tsx

# G4 — no reduced-motion support anywhere
grep -rn "prefers-reduced-motion" packages apps

# G5 — missing packages, unused deps
node -e "const p=require('./packages/ui/package.json');console.log(['@atlaskit/avatar','@atlaskit/skeleton','@atlaskit/motion'].map(k=>k+' '+(p.dependencies[k]??'MISSING')).join('\n'))"
grep -rl "@atlaskit/badge" --include=*.tsx packages apps | wc -l

# G6 — gallery and visual gate
find packages apps -name "*.stories.tsx" | wc -l
grep -rn "toHaveScreenshot\|chromatic\|percy" apps packages tooling .github | wc -l
```
