**Title:** fix(css): only merge duplicate conditional group at-rules

Fixes #<issue number>.

`merge-duplicate-at-rules` keys at-rules by `name + params`, which identifies a block only for
conditional group rules. Applied to every at-rule it collapses all `@font-face` rules of a stylesheet
into one (repeated descriptors resolve last-wins, so only the last face survives), concatenates
same-named `@keyframes`, and moves `@import` / `@layer` statements to the end as empty blocks.
`@compiled/vite-plugin` sorts every CSS asset containing an atomic class, which includes global
stylesheets bundled next to `.compiled.css` imports, so this breaks font loading in real builds.

### Change

- `packages/css/src/plugins/merge-duplicate-at-rules.ts`: merge only `@media`, `@supports` and
  `@container` (case-insensitive) blocks with children; return early for every other at-rule.
- Tests (`merge-duplicate-at-rules.test.ts`): `@supports` / `@container` still merged; several
  `@font-face` rules kept as written; same-named `@keyframes` not merged; `@import` and `@layer` statements
  left in place. `sort.test.ts`: all `@font-face` rules of a stylesheet that also holds atomic rules
  survive `sort()`, with `sortAtRulesEnabled` true and false.
- Changeset: `@compiled/css` patch.

### Testing

- `yarn jest packages/css packages/vite-plugin`: 374 passed, 1 failed. The failure
  (`vite-plugin/src/__tests__/dev-css.test.ts`, "uses Vite-processed CSS and sorts the active modules in
  one stylesheet") fails the same way on unmodified `master` 46fdea7 (369 passed, 1 failed).
- Without the source change, 4 of the 5 new tests fail.
- Applied to `@compiled/css` 3.1.0 in a production Vite app: 8 of 9 CSS assets byte-identical to before;
  the entry stylesheet differs only in keeping its four `@font-face` rules; every atomic rule unchanged.
