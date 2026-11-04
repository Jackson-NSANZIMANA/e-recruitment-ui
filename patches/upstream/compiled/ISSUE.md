**Title:** `merge-duplicate-at-rules` merges every `@font-face` into one rule (also breaks `@keyframes`, `@import`, `@layer` statements)

**Packages:** `@compiled/css` 3.1.0, `@compiled/vite-plugin` 2.0.4 (also present on `master` 46fdea7)

### What happens

`merge-duplicate-at-rules` keys each at-rule by `atRule.name + atRule.params` and unions the children of
rules with the same key. That is right for conditional group rules (`@media`, `@supports`, `@container`),
but it is applied to every at-rule:

```js
const { sort } = require('@compiled/css');
sort(`
  @font-face{font-family:Sans;src:url(sans.woff2);font-style:normal}
  @font-face{font-family:Sans;src:url(sans-italic.woff2);font-style:italic}
  @font-face{font-family:Mono;src:url(mono.woff2);font-style:normal}
`);
// -> @font-face{font-family:Sans;src:url(sans.woff2);font-style:normal;src:url(sans-italic.woff2);font-style:italic;font-family:Mono;src:url(mono.woff2)}
```

Every `@font-face` has empty params, so all of them collapse into one rule. Within one `@font-face` the
last declaration of each descriptor wins, so the browser registers a single face (`Mono`, the last `src`),
and text set in the other families falls back to a system font. The same merge:

- concatenates the bodies of same-named `@keyframes`
  (`@keyframes k{0%{opacity:0}}@keyframes k{0%{color:red}}` -> one `@keyframes k` with both bodies);
- moves statement at-rules to the end of the stylesheet as empty blocks
  (`@import url(a.css);` -> `@import url(a.css){}`, `@layer reset, base;` -> `@layer reset, base{}`).

`sortAtRules: false` does not avoid it: `sort()` always runs `mergeDuplicateAtRules()`; the option only
reaches `sortStyleSheet`.

### Why it is hit in practice

`@compiled/vite-plugin`'s `generateBundle` sorts every CSS asset that contains `._`. A global font
stylesheet imported in an app entry (a design system's `fonts.css`) is bundled into the same entry CSS
asset as the Atlaskit `.compiled.css` files imported by components, so it is sorted too. In our app all
four `@font-face` rules of a design system became one; every font file was still emitted and served (200),
and only `document.fonts` showed the single surviving face.

Related: #1959 (`sortOnlyCompiledCss`) would keep authored CSS out of the sort, but it is opt-in and does
not change what the merger does to at-rules inside the sorted CSS.

### Proposed fix

Merge only conditional group rules (`@media`, `@supports`, `@container`) and leave every other at-rule
untouched. PR to follow with tests.
