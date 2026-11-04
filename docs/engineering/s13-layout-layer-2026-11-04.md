# S13 — the layout and chart layer, built

**Date:** 2026-11-04
**Branch:** `arena/4f8fd39e-e-recruitment-ui`
**Commits:** `a37b86e` (the layer), `0ada99c` (render suite + two a11y fixes)
**Preceded by:** [`ui-visual-gap-2026-11-04.md`](ui-visual-gap-2026-11-04.md) (what was missing) and
[`atlassian-brief-verification-2026-11-04.md`](atlassian-brief-verification-2026-11-04.md) (what the brief
actually claimed, and its verdict).

This is the "build" step. It adds six components to `@usrp/ui` and moves one real screen onto them. Every
claim below is a command in §6, not an assertion.

---

## 1. What shipped

| Component       | What it replaces                                                                              | The decision behind it                                                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PageShell`     | Seven copies of `maxWidth: 1200px`                                                            | Three widths, named and tested: `header` 1280px (the national header's inner edge, the default), `standard` 1200px (what six slices already ship), `narrow` 640px. `bleed` has no cap.                  |
| `Card`          | A `panel` cssMap block in `panels.tsx` and a second, disagreeing one in `DashboardMetricCard` | A titled card is a named `<section aria-labelledby>`. The surface is `elevation.surface.raised` — a raised plane, not a neutral fill behind a border. Two copies of a panel cannot drift again.         |
| `MetricCard`    | `DashboardMetricCard`                                                                         | The figure is ADS `font.metric.large` (28px, tabular), not a heading sized up. Urgency appears on the number _and_ as the words `chart.needs_attention`; never on the border alone. Optional sparkline. |
| `Sparkline`     | nothing                                                                                       | Pure SVG over `model.ts`. The real interface is a visually-hidden table of every reading; the line is decoration. `goodDirection` is **required** — a rising queue is bad news.                         |
| `StackedBar`    | five separate 100%-width stage tracks                                                         | One composition bar with one total. Eight categorical slots; a status colour is never borrowed for a category. Every value is repeated as text in the legend.                                           |
| `SkeletonPanel` | a centred `Spinner` on an empty page                                                          | Four shapes (`metrics`/`table`/`chart`/`prose`) sized like the content that replaces them, `aria-hidden`, with one polite live-region announcement.                                                     |

Supporting work: `model.ts` holds the widths and all chart geometry as pure functions; `StateBoundary` gained
`loadingShape`; the officer dashboard and its panels now render through `PageShell` + `Card` + `MetricCard`;
`DashboardMetricCard` was **deleted**, not deprecated; three legacy `var(--ds-border-radius-*, 8px|3px)`
fallbacks became real tokens (`radius.large` = 8px, `radius.small` = 4px); `chart.*` strings landed in en/fr/rw
at key parity (561 keys).

## 2. The one thing worth reading twice

**Rendering the components in jsdom found two accessibility defects that the model tests could not.** Both
were mine, from this branch, and both are fixed in `0ada99c`:

1. `Sparkline` and `StackedBar` were `<div role="img">` inside layout wrappers. A screen reader does not
   treat that as an image, so the graphic announced **nothing** — the line was pure paint. Both are now named
   `<figure>` elements. The readings were always in the table; the figure is what makes the graphic reachable
   at all.
2. `MetricCard`'s number was a `<Text as="p">` with no name of its own. Entering the tile now says "Awaiting
   adjudication" before it says "128", because the tile is a named region.

This is the argument for the render suite, not against the model tests: arithmetic tests cannot tell you that
a component is invisible to assistive technology.

## 3. Verification verdict on the supplied brief

Carried forward from `atlassian-brief-verification-2026-11-04.md`, since it was never delivered in chat:

- **Confirmed:** React 18 concurrent root for Jira/Confluence; Compiled (`@compiled/react`) as the styling
  runtime and its `extract: true` requirement; the 8px base unit and its percentage suffixes; the lozenge /
  tag / badge uplift; Rovo UI as a real scoped dialect; `Box`/`Inline`/`Stack` as the layout primitives;
  `@atlaskit/charts` is dead; elevation tokens come in pairs.
- **Rejected:** the **3px border radius** rule. ADS ships 2/4/6/8/12/16/9999/25%; the closest thing to the
  brief's claim is `radius.xsmall` = 2px. Nothing in the system is 3px.
- **Unsupported:** Next.js, ISR, the 1.5s figure. Confluence moved to React 18 streaming SSR and says so;
  no Next.js anywhere. Server/DC products are Java + JSP/Velocity/AUI.
- **Charts:** the brief's chart advice could not be taken from `@atlaskit/charts` because that package is
  dead (0.0.9). The layer is hand-built over ADS tokens and the eight `color.chart.categorical.*` slots.

## 4. The measurement that outranks the rest

`packages/design-system/src/a11y/index.ts` sets `MIN_BODY_TEXT_PX = 16`. `@atlaskit/primitives` maps
`size="medium"` to **14px** and `size="small"` to 12px. Census of the repo: **377 `<Text>` per-line
occurrences — 267 with no `size` (14px), 105 `small` (12px), 3 `large`. That is 372 of 377 below the floor.**

The new layer never adds to that number: `PageShell`'s lead line is `size="large"` (16px) by deliberate choice
with a comment saying why. Fixing the remaining 372 is a separate, mechanical, high-risk restyle and is **not**
part of this change.

## 5. What is not done

- **372/377 `<Text>` below the 16px floor** (above). Needs its own change with visual review per screen.
- **Five copies of `@atlaskit/tokens` in the lockfile**, pulled in by `@atlaskit/select@21.12.15` (also two
  `primitives`, three `icon`). Fix is a `select` major bump to `23.1.5` plus a gate asserting one major per
  package. All 41 tokens this repo uses exist in both 16.4.0 and 20.9.0, so the bump is not blocked by token
  drift — it is blocked by the peer ranges, which want `^20` for tokens.
- **Six other 1200px shells** (ApplicationsPage, ApplicationDetailPage, campaigns `shared.tsx`, DpoQueuePage,
  QueuesPage, StaffPage) still carry their own copy. `PageShell` exists for them; adopting it is one line each
  and deliberately left out of this change so the diff stays reviewable.
- **The applicant portal's 640/560/360px pages** and the field station's 600–960px field width are untouched.

## 6. Reproduce

```bash
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack pnpm@9.15.0 install --frozen-lockfile          # lockfile is consistent as committed

corepack pnpm@9.15.0 -r typecheck                        # 0 errors
corepack pnpm@9.15.0 -r lint                             # 0 errors (warnings pre-exist)
corepack pnpm@9.15.0 -r test                             # every suite passes
corepack pnpm@9.15.0 --filter @usrp/i18n test            # 17, key parity over 561 keys

node packages/ui/scripts/scan-cssmap.cjs packages/ui/src # no cssMap staticness violations
node tooling/repo-hygiene/verify.mjs                     # all gates green
corepack pnpm@9.15.0 --filter @usrp/surface-contract lint # status: PASS

# extraction is measured, not assumed - build first, then assert
VITE_EDGE_URL=https://edge.example.test corepack pnpm@9.15.0 --filter @usrp/officer-console build
node tooling/repo-hygiene/verify-compiled-extraction.mjs  # PASS, 2054 atomic classes in 10 css assets
```

`pnpm build` at the root and Playwright both need things this sandbox lacks: a production `VITE_EDGE_URL` for
all three apps, and a Chromium download that the network blocks. The extraction gate was therefore run against
a real per-app build rather than a full root build, and the screenshot review was replaced with a jsdom render
suite (§2). Do not read this as "visually verified" — it is "rendered and asserted".

## 7. Why the width is 1280 and not 1200

`NationalHeader` centres at `80rem` (1280px) with `space.300` inner padding. A 1200px page under it leaves a
40px mismatch on each side at wide viewports — visible as a page that does not line up with the lockup above
it. `PageShell` defaults to `align="header"` for that reason, and `standard` exists for the six screens already
shipped at 1200px so adopting the shell changes nothing about them. The console dashboard now uses `header`;
its own `1200px` literal is gone.
