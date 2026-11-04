# Patched dependencies

Every file here is applied by pnpm (`pnpm.patchedDependencies` in the root `package.json`) and changes the
lockfile's hash for that package, so Turbo rebuilds everything that depends on it. A patch that no longer
applies fails `pnpm install` loudly. Each patch has an owner, an upstream status and a removal criterion.

## `@compiled__css@3.1.0.patch`

**What it fixes.** `@compiled/vite-plugin` runs `@compiled/css`'s `sort()` on every CSS asset that contains
an atomic class, and Vite bundles `@usrp/design-system/fonts.css` into the same entry asset as Atlaskit's
`.compiled.css`. Its `merge-duplicate-at-rules` plugin keys every at-rule by `name + params`; every
`@font-face` has empty params, so the four design-system faces became one rule, the browser kept the last
value of each descriptor, and only "Atlassian Mono" italic was registered: the whole UI rendered in a
system font. The same merge concatenated same-named `@keyframes` and turned `@import` / `@layer`
statements into empty blocks at the end of the file. `sortAtRules: false` does not reach this stage.

**The change.** Only conditional group rules (`@media`, `@supports`, `@container`) are merged; every other
at-rule stays where it is. On the real build, 8 of 9 CSS assets were byte-identical to the unpatched
output and the entry stylesheet differed only in keeping its four `@font-face` rules.

**Guard.** `tooling/repo-hygiene/verify-font-faces.mjs` (`pnpm verify:hygiene --with-build`) fails any
build whose CSS does not carry every design-system face as its own rule. It stays after the patch goes.

**Upstream.** Not reported upstream before this (searched: no issue or PR for `@font-face` merging).
`3.1.0` is the latest release and `master` (46fdea7) has the same code. The fix, with tests in
Compiled's own suite, is in [`upstream/compiled/`](upstream/compiled/): see its README for how to submit it.

**Remove when** a released `@compiled/css` contains the fix: drop the entry from
`pnpm.patchedDependencies`, delete this patch, `pnpm install`, `pnpm build`, `pnpm verify:hygiene --with-build`.

### Measured: Compiled also reorders CSS it does not own

The same `sort()` reorders the whole asset, including CSS that is not Compiled's (css-reset, the font
stylesheet): rules move and `@media` blocks go to the end. Upstream tracks this in
[atlassian-labs/compiled#1959](https://github.com/atlassian-labs/compiled/pull/1959) (`sortOnlyCompiledCss`,
opt-in, approved, unreleased as of 2026-11-04). Whether it changes what USRP renders was measured, not
assumed: each app's CSS was captured before the sort, and eight routes (applicant `/`, `/login`, `/apply`,
`/documents`; officer `/login`, `/activate`; field `/`, `/login`) were rendered twice in Chromium, with the
shipped (sorted) CSS and with the pre-sort CSS, comparing every computed property of every element by DOM
path. Six routes: zero differences. The officer console's language switcher: `font-weight` 500 sorted vs
400 pre-sort, because pre-sort order puts Atlaskit's `font` shorthand (`._11c8fhey`, weight 400) AFTER its
`font-weight` longhand (`._k48p1wq8`, medium 500). That is the sort doing its job (shorthands before
longhands), not damage. So today the reordering of authored CSS has no rendered effect; it is a latent
risk for future global CSS. Revisit when #1959 is released: adopting `sortOnlyCompiledCss` changes chunking
(a `compiled-css` chunk) and needs the same render comparison before it is turned on.
