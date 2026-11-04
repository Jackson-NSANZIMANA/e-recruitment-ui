# Claim verification — the Atlassian architecture brief and the five-step roadmap

**Date:** 2026-11-04
**Inputs verified:** (a) the "Atlassian Tech Stack & Architecture (2026 Status)" brief, (b) the
"bridge the visual gap" five-step implementation plan, (c) the three questions the brief asked me to route back
to it (bundle sizes / CSS-in-JS, spacing / radius / component libraries, which product is being critiqued).
**Method:** every verdict below is a measurement against this checkout at `038e5e3` or against a downloaded
registry artefact, not an opinion. Commands are in §6.
**Companion documents:** [`ui-visual-gap-2026-11-04.md`](./ui-visual-gap-2026-11-04.md) (the gap analysis both
inputs are reacting to), [`AGENTS.md`](../../AGENTS.md) §3/§5, [`llms.txt`](../../llms.txt).

---

## 0. Verdict in one paragraph

The five-step roadmap is **directionally right and largely already built**, and the brief it rests on is
**accurate on spacing, radius values and Rovo UI, and wrong on Next.js, on what our document claims, and on what
3px means here**. Three of its five steps are no-ops or already done: step 1 ("implement a compile-time `cssMap`
layer") is configured in all three apps and already has a proof gate; step 2's premise — that `NationalHeader`
is the header we must align to — is wrong for the console it names, because the authenticated console never
renders it; step 3's card recipe is right in principle and needs no version bump. Steps 4 and 5 are sound and are
already recommended in the gap doc. The two things neither input raises are the ones that matter most: **our own
accessibility floor is contradicted by our own components at 372 of 377 call sites**, and **the lockfile resolves
five generations of `@atlaskit/tokens` because one pinned dependency drags in a legacy design system**.

**Scorecard:** 9 claims accurate · 6 inaccurate or misleading · 3 that this repository directly disproves ·
3 pure-architecture statements with nothing to verify.

---

## 1. The three questions routed back to me

### 1.1 "What does the document claim about bundle sizes, performance, or CSS-in-JS?"

`ui-visual-gap-2026-11-04.md` makes **no performance claim**. Its CSS-in-JS statements are observations about
_composition and proof_, not runtime cost:

| Document claim                                                                         | Where    | Accurate?                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "no chart dependency anywhere; the only chart is a CSS meter"                          | §0 row 3 | **yes** — `grep -nE "atlaskit/(charts\|chart)\|recharts\|visx\|nivo\|victory\|d3-\|chart\.js" pnpm-lock.yaml` → 0 matches                                                                                                   |
| `@atlaskit/charts` is abandoned (0.0.9, published 2021-05-10, peers `react-spring@^8`) | §3 G1    | **yes** — registry metadata, re-checked 2026-11-04                                                                                                                                                                          |
| "`@atlaskit/skeleton` is not a dependency of any package"                              | §3 G3    | **yes, but incomplete** — it is not a _direct_ dependency of any workspace package; it is already in the graph transitively (`skeleton@2.2.0` and `4.4.4` resolve today), which makes step 5 cheaper than the brief assumes |
| "zero `prefers-reduced-motion` occurrences in `packages/` and `apps/`"                 | §3 G4    | **yes** — 0 hits (and `motion@6.2.5/8.8.1/9.3.0` already resolve transitively)                                                                                                                                              |
| "3 Storybook stories for 125 `.tsx` files; zero `toHaveScreenshot`/Chromatic/Percy"    | §3 G6    | **yes** — 3 and 0                                                                                                                                                                                                           |
| Ceilings of 1200 KB total / 500 KB chunk for `officer-console`                         | §3 G1    | **yes** — `tooling/repo-hygiene/gates.config.json` → `bundles`                                                                                                                                                              |

So the brief's framing — that our document is a critique of styling performance — is **not supported**. The
document critiques _capability_ and _proof_, plus one layout misalignment. It never claims the apps are slow and
never proposes re-architecting styling.

### 1.2 "Are there specific claims regarding the spacing grid, corner radiuses, or component libraries?"

Yes, and this is where the document and the brief mostly agree:

| Document claim                                                                          | Accurate?                                                                                                                      |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Spacing is token-backed; logical properties everywhere                                  | **yes** — 72 `paddingInline`/`marginInline`/`insetInline` uses, and **0** hardcoded `padding`/`margin`/`gap` px or rem values  |
| No shared `Card`; the panel recipe is duplicated                                        | **yes** — `apps/officer-console/src/dashboard/panels.tsx:28` and `packages/ui/src/components/DashboardMetricCard/index.tsx:20` |
| Page shell duplicated 7× at `1200px`, header at `80rem`                                 | **yes** — six byte-identical feature copies `+` one divergent host copy; `NationalHeader.tsx:22` is `80rem`                    |
| `elevation.surface.raised` and `color.background.brand.subtlest` used by **zero** files | **yes** — 0 hits each                                                                                                          |
| Radius is already tokenised                                                             | **yes** — 16 uses of `radius.xsmall`/`.small`/`.medium`, **0** hardcoded radius literals in `cssMap`                           |
| ADS is the component library                                                            | **yes** — 64 files import `@atlaskit/css`, 4 import `@compiled/react`, **0** import `@emotion/*`                               |

**Two corrections to the brief.**

1. It attributes a "signature **3px** corner radius" claim to the document, and to Atlassian. The document never
   says that, and 3px is not a token in any `@atlaskit/tokens` version in the lockfile. See **R3**.
2. It says the document "critiques Jira/Confluence". It does not; it critiques _the screenshots_ and explicitly
   lists what must **not** be copied from Jira.

### 1.3 "Is the document critiquing a specific product like Jira or Confluence?"

No — only the screenshots, plus a short "do not copy" table (12–14px metadata, grey-on-grey secondary text,
dense icon-only toolbars, dark dashboards, personalised "Recent" lists, upsell cards). The single product-level
statement is that a government recruitment portal does not do promos.

**A critique of the brief itself.** Its first bullet claims Jira and Confluence "utilize **Next.js** to achieve
SSR and ISR, targeting initial page loads under 1.5 seconds", citing a third-party blog. That is wrong, and
copying it would be a rewrite of three working PWAs:

- Atlassian's **own** engineering post describes Confluence's React 18 **streaming SSR** through
  `renderToPipeableStream`/`renderToReadableStream` over NodeJS streams, measured by FCP, TTVC/VC90 and hydration
  success rate, and reports "about **40% improvement for the first contentful paint**". Next.js, ISR and a 1.5 s
  target appear nowhere in it.
- Jira/Confluence Data Center's own frontend is JSP/Velocity/AUI/Soy; React appears in Cloud surfaces. Neither
  product is a Next.js application.

The true half of that bullet is the React 18 half: Atlassian's RFC-78 made React 18 concurrent
`createRoot`/`hydrateRoot` the default in Cloud, then `renderToPipeableStream`, and formally dropped React
16/17 inside `@atlaskit/*`. Our apps are already on React 18.3.1 with `createRoot` in all three `main.tsx`.

---

## 2. What is accurate in the brief

| #   | Claim                                                                                                       | Verdict      | Evidence                                                                                                                                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | 8px base; suffix is a percentage of it, so `space.100` = 8px                                                | **accurate** | `atlassian.design/foundations/spacing`; token artefact: `space.100=8px`, `space.200=16px`, 2px→80px plus negatives                                                                                                                                                            |
| A2  | Atlassian Sans type scale is the core face                                                                  | **accurate** | `packages/design-system/src/fonts/files/AtlassianSans.v3.woff2`, self-hosted, OFL notice kept                                                                                                                                                                                 |
| A3  | Historical runtime CSS-in-JS bottleneck; the fleet migrated to Compiled to cut runtime cost and bundle size | **accurate** | RFC-73, Atlassian's words: "reducing the runtime performance impact and bundle size… static CSS at build time"                                                                                                                                                                |
| A4  | `@atlaskit/*` is modular and open; product extensions stay siloed                                           | **accurate** | 583 token names, per-component entry points, subpath imports used here                                                                                                                                                                                                        |
| A5  | A lozenge/tag/badge/label overhaul shipped to clear design debt                                             | **accurate** | `@atlaskit/lozenge@16.0.0` CHANGELOG: "BREAKING: Removes the `platform-dst-lozenge-tag-badge-visual-uplifts` feature gate and makes the refreshed Lozenge implementation the default… use Tag for labels and categorization"; `17.0.0` restores `aria-haspopup` compatibility |
| A6  | Rovo UI is a scoped AI dialect with its own colour, elevation, motion, icons, voice                         | **accurate** | `atlassian.design/rovo-ui`; our pinned tokens already ship `elevation.rovo.surface.overlay{,.hovered,.pressed}`                                                                                                                                                               |
| A7  | Strict composition with `Box` / `Inline` / `Stack`                                                          | **accurate** | `@atlaskit/primitives/compiled`, used throughout                                                                                                                                                                                                                              |
| A8  | `@atlaskit/charts` is abandoned                                                                             | **accurate** | 0.0.9, 2021-05-10, `react-spring@^8` peer                                                                                                                                                                                                                                     |
| A9  | Elevation pairs a surface with a matching shadow                                                            | **accurate** | `elevation.surface.raised` ↔ `elevation.shadow.raised`; four planes, `sunken`/`surface`/`raised`/`overlay`                                                                                                                                                                   |

---

## 3. What is inaccurate, and what it would cost

### R1 — "Implement a compile-time transformation process" → already configured, already proven

All three apps pass `@compiled/vite-plugin` `extract: true` plus the tokens babel plugin and
`importSources: ["@compiled/react", "@atlaskit/css"]` (`apps/applicant-portal/vite.config.ts:44`,
`apps/field-station/vite.config.ts:43`, `apps/officer-console/vite.config.ts:37`). The repository does not assert
extraction — it proves it in `tooling/repo-hygiene/verify-compiled-extraction.mjs`: (1) a shipped `.css` asset
contains Compiled's atomic class signature, and (2) no authored source retains a `@compiled/react` reference after
build.

There is nothing to implement. The action is **run `pnpm verify:extraction` after a build to keep the proof
alive**, not new infrastructure.

### R2 — "Our apps ship runtime CSS-in-JS" → ours don't; but the lockfile carries five `@atlaskit/tokens` generations

This is the brief's most useful find, reached by the wrong route. No source file imports `@emotion/*`, and every
first-party style is Compiled. But `pnpm-lock.yaml` resolves:

| Package                | Copies resolved                                 | What our own importers use |
| ---------------------- | ----------------------------------------------- | -------------------------- |
| `@atlaskit/tokens`     | **13.4.0, 16.12.0, 19.0.0, 20.4.1, 20.6.0** (5) | 16.12.0                    |
| `@atlaskit/primitives` | **19.0.2, 22.5.4** (2)                          | 22.5.4                     |
| `@atlaskit/icon`       | **35.4.0, 37.7.3, 38.0.2** (3)                  | 38.0.2                     |

The legacy branch (`tokens@13.4.0`, `primitives@19`, `icon@35.4`, `lozenge@13.9.0`, `badge@18.7.1`,
`avatar@25.15.1`, `link@3.4.2`, `tag@14.16.0`) is reachable from a small set of packages, and the biggest single
source is one direct dependency: **`@atlaskit/select@21.12.15`** pins `primitives ^19`, `tokens 13.4.0`,
`icon 35.4.0`, and `react-select → tag@14.16.0 → lozenge@13.9.0 → badge@18.7.1`. Also on the old branch:
`@atlaskit/flag@18.5.7` (tokens 19), `@atlaskit/heading@7.2.3` (tokens 19), `@atlaskit/icon@37.7.3` (tokens 19).

Emotion is real but bounded: `@atlaskit/button@25.4.7` still declares `@emotion/react ^11.7.1`, and both
`primitives` majors declare `@emotion/react` and `@emotion/serialize`. So parts of the compiled tree retain a
runtime layer — but it is _inside ADS components we do not author_, not in our code.

**Action:** bump `@atlaskit/select` past the 21.12.15 pin (latest 23.1.5), re-resolve, then add a gate:
_at most one major of `@atlaskit/tokens`, `@atlaskit/primitives` and `@atlaskit/icon` in `pnpm-lock.yaml`_. Two
lines in `tooling/repo-hygiene`, and it would have caught this. Note the coupling: `lozenge@17.0.6` requires
`tokens ^20.6.0`, `navigation-system@11.5.0` requires `^20.9.0` — **the component upgrade and the token upgrade
must ship together**, which is why they have been deferred.

### R3 — "Use `borderRadius: '3px'` as the canonical Atlassian radius" → wrong, and it exposes a live bug

The locked tokens package ships exactly eight shape tokens — identical in 16.4.0 and 20.9.0:

```
radius.xsmall 2px   radius.small 4px   radius.medium 6px    radius.large 8px
radius.xlarge 12px  radius.xxlarge 16px radius.full 9999px  radius.tile 25%
```

What the brief calls 3px is `radius.medium`'s neighbourhood at best; the real scale is a modern t-shirt scale.
Hardcoding `'3px'` would also violate the repository's own rules (all radius values must come from `token(...)`;
there are currently zero radius literals in `cssMap`).

**The live bug this points at.** Three call sites hand-write _legacy_ CSS custom properties that do not exist in
the locked tokens package, so the hardcoded **fallback** is what actually renders:

- `packages/ui/src/components/DocumentUpload/index.tsx:194` — `var(--ds-border-radius-200, 8px)`
- `packages/ui/src/components/DocumentUpload/index.tsx:225` — `var(--ds-border-radius-100, 3px)`
- `packages/ui/src/components/QrScanner/index.tsx:245` — `var(--ds-border-radius-200, 8px)`

`@atlaskit/tokens@16.4.0` maps radius to `--ds-radius-{xsmall…tile}`; there is no `--ds-border-radius-*` key in
`token-names`. So two of the most-touched applicant components are rendering literal 3px and 8px corners while
`hexScan` and `touchTargets` stay green — because neither gate looks for legacy `var(--ds-*)` at all. That is
the same failure mode `llms.txt` names: _a gate scoped away from the code it describes is a comment._

### R4 — "The maxWidth must line up with `NationalHeader.tsx`" → right instinct, wrong component

Aligning page content with a header is correct. The target is wrong. `NationalHeader` is rendered by
`NationalFrame` (`packages/ui/src/national/NationalFrame.tsx:73`) and by `StationShell` — and `NationalFrame` is
used **only** for the pre-shell screens (`/login`, `/activate`). The authenticated console renders
`@atlaskit/navigation-system` `TopNav` instead (`apps/officer-console/src/components/AppShell/index.tsx:90`), and
that TopNav is **full-bleed**: the layout package contains no `maxWidth` for the top bar at all.

So there is a design decision the brief never surfaces:

- **Option A, full-bleed** — what Jira does and what the console already does: drop `maxWidth` from page shells,
  align to the header's 24px inner padding.
- **Option B, centred** — what `NationalHeader` does at 80rem: keep a max width, accept the header being
  full-bleed, and align content to the header's _inner padding_.

Mixing them is what looks unfinished. Pick one, encode it in one constant, screenshot it.

And the scope is wider than the brief assumes: the console's pages are `1200px`, but the **applicant portal's are
640px** (`home.tsx:14`, `documents/index.tsx:18`, `status.tsx:18`) and the **field station's are 600–960px**
(`walk-in.tsx:22`, `gate.tsx:39`, `stations.tsx:26`, `ui/Page.tsx:8`) — both rendered under the same 80rem
`NationalHeader`. A `PageShell` that only fixes the console leaves two of three apps misaligned.

### R5 — "Seven duplicated page recipes" → six identical copies plus one divergent copy

That distinction changes the fix. Six are byte-identical (`ApplicationsPage.tsx:22`,
`ApplicationDetailPage.tsx:33`, `campaigns/src/ui/shared.tsx:17`, `DpoQueuePage.tsx:15`, `QueuesPage.tsx:30`,
`StaffPage.tsx:39`). The seventh — `apps/officer-console/src/routes/dashboard.tsx:18` — already **diverged**:
double-quoted, `paddingBlock: space.400` / `paddingInline: space.500` instead of `space.300` / `space.400`. A
mechanical search-and-replace closes six; the host copy needs a decision.

### R6 — The elevation snippet would fail review, but its reasoning is half-done already

```ts
// from the brief
const cardStyles = cssMap({
  raisedCard: {
    backgroundColor: token("elevation.surface.raised"),
    boxShadow: token("elevation.shadow.raised"),
    borderRadius: "3px", // ← raw literal, and not the token value
  },
});
```

Both `token()` calls are real in the locked version and are the right tokens; the radius line is the defect
(R3). Use `token('radius.medium')`.

The reasoning behind it is sound and partly built: `NationalFrame` already paints the page
`elevation.surface.sunken` (`NationalFrame.tsx:22`), and panels are `elevation.surface`. The gap is the
**authenticated console**, whose `AppShell` paints no page background, so panels sit on the ADS reset's `#fff` —
flat on flat. Cheapest experiment before building anything: give `Root` an `elevation.surface.sunken` background
and see whether the existing `elevation.surface` panels start reading as raised.

---

## 4. The finding neither input raises: our a11y floor is contradicted by our own components

The policy is **16px minimum body text** (`AGENTS.md` §5), encoded as `MIN_BODY_TEXT_PX = 16` in
`packages/design-system/src/a11y/index.ts:23`, with this justification:

> _"ADS `Text size="medium"` already satisfies this; the constant exists so a test can assert it."_

Measured against the components actually resolved by the lockfile, **that sentence is false**:

| `@atlaskit/primitives@22.5.4` `textSizeMap` | Resolved value                           |
| ------------------------------------------- | ---------------------------------------- |
| `small`                                     | `--ds-font-body-small` → **12px / 16px** |
| `medium` (**the default**)                  | `--ds-font-body` → **14px / 20px**       |
| `large`                                     | `--ds-font-body-large` → **16px / 24px** |

`Text size="medium"` is 14px. Only `size="large"` reaches the floor. Now compare that with what the code does:

| Measurement                                 | Value   |
| ------------------------------------------- | ------- |
| `<Text>` elements in `packages/` + `apps/`  | **377** |
| with no `size` prop (→ `medium` = **14px**) | **267** |
| with `size="small"` (→ **12px**)            | **105** |
| with `size="large"` (→ **16px**)            | **3**   |

**372 of 377 text call sites render below the stated floor**, and the brief's "native Jira density" advice
points the same way (Jira body 14px, metadata 12px). Atlassian's density is the opposite of this project's HCI
mandate — sunlight, gloves, one hand, cheap Android, low vision.

**This is the single most consequential conflict between "beautiful like Atlassian" and "usable for USRP", and
neither input resolves it.** Three honest options:

1. **Lower the floor to 14px**, matching ADS. Cheap; a visible regression on the field tablet.
2. **Keep the floor, change the default.** Ship a `usrp/text` wrapper (or sweep `size="large"` across the 267
   sites). Density then comes from spacing, not type size — which is what the 8px scale is for.
3. **Scope the floor.** 16px on citizen and field surfaces; 14px allowed inside the console's dense data regions,
   recorded as an explicit exception with a reason — exactly how `hexScan` already allow-lists the coat of arms
   by path.

Today the repository does a fourth thing: it states the floor, unit-tests that the constant is 16, and never
asserts that any rendered `Text` uses it. That is the failure mode the repo's own philosophy names.

---

## 5. The five-step roadmap, re-scored

| Step | The brief says                                                                                    | Reality here                                                                                                                                           | Verdict                                              |
| ---- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| 1    | Build a Compiled zero-runtime layer in `design-system`; enforce spacing via tokens                | Configured in all 3 apps with `extract: true` + an extraction proof gate; spacing 100% tokenised, 0 hardcoded px                                       | **no-op**; the real work is R2's lockfile            |
| 2    | Unified `PageShell`; align to `NationalHeader`                                                    | Real defect; wrong target component; 6+1 copies; three apps on 640/960/1200px under one 80rem header                                                   | **do it**, after choosing full-bleed vs centred (R4) |
| 3    | Multi-mode elevation: `elevation.surface.raised` + `elevation.shadow.raised`, `sunken` containers | Tokens exist in the locked version and are used by zero files; but `'3px'` is wrong and 3 legacy vars silently fall back                               | **do it**, with the radius corrected (R3)            |
| 4    | Lightweight non-blocking SVG chart layer with table/`role` fallback                               | Sound; matches the gap doc; needs no dependency                                                                                                        | **do it** — unchanged                                |
| 5    | Install `@atlaskit/skeleton`, replace the spinner with layout-stable skeletons                    | Correct that `StateBoundary.tsx:45` renders a bare centred `Spinner`; `skeleton` is already in the graph transitively, so it is one devDependency away | **do it** — unchanged                                |

**Order I would run:** R2 lockfile → the §4 type-scale decision (every later component inherits it) →
`PageShell` + alignment decision → elevation pass → skeletons → charts.

---

## 6. Reproduce every verdict

```bash
cd /home/user/e-recruitment-ui

# A6 / R3 — shape tokens, from the package the lockfile actually resolves
npm pack @atlaskit/tokens@16.4.0
node -e 'const m=require("./package/dist/cjs/artifacts/tokens-raw/atlassian-shape.js");console.log((m.default||m).map(t=>t.name+"="+t.value).join("\n"))'
node -e 'const m=require("./package/dist/cjs/artifacts/token-names.js");console.log(Object.keys(m.default||m).filter(k=>/radius/.test(k)))'

# §4 — the type scale that actually ships
npm pack @atlaskit/primitives@22.5.4
cat package/dist/cjs/xcss/text-size.js | grep textSizeMap -A4
grep -rhoE "<Text( [^>]*)?>" --include=*.tsx packages apps | grep -vc "size="
grep -rhoE "<Text[^>]*size=\"[a-z]+\"" --include=*.tsx packages apps | grep -oE 'size="[a-z]+"' | sort | uniq -c
grep -n "MIN_BODY_TEXT_PX" -B6 packages/design-system/src/a11y/index.ts

# R1 — extraction is configured and proven
grep -n "extract: true" apps/*/vite.config.ts
sed -n '1,20p' tooling/repo-hygiene/verify-compiled-extraction.mjs

# R2 — the duplicate generations
python3 - <<'PY'
import re
txt=open('pnpm-lock.yaml').read(); pkg=txt[txt.find('\npackages:'):]
for b in re.split(r"\n(?=  \S)", pkg):
    h=b.strip().split('\n')[0].strip("'").split('(')[0]
    if re.match(r"@atlaskit/(tokens|primitives|icon)@", h): print(h)
PY

# R3 — the legacy var() call sites that silently fall back
grep -rn "var(--ds-border-radius" packages apps

# R4 — who renders NationalHeader vs TopNav, and the three app widths
grep -rn "NationalHeader" packages apps --include=*.tsx | grep -v stories
grep -n "TopNav" apps/officer-console/src/components/AppShell/index.tsx
grep -rn "maxWidth" apps/applicant-portal/src packages/features/field-ops/src | head

# §1.3 — Confluence's own account of its SSR work: no Next.js, no ISR, no 1.5s target
# https://www.atlassian.com/blog/how-we-build/streaming-server-side-rendering-in-confluence
```
