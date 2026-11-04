# Upstream contribution: `@compiled/css` merge-duplicate-at-rules

Ready to submit to [atlassian-labs/compiled](https://github.com/atlassian-labs/compiled). It cannot be
opened from an automated session: Atlassian requires a signed Contributor License Agreement from
non-Atlassian contributors ([individual](https://opensource.atlassian.com/individual) or
[corporate](https://opensource.atlassian.com/corporate)), and the pull request must come from the
contributor's own fork.

| File | Use |
|---|---|
| `0001-fix-css-only-merge-duplicate-conditional-group-at-rules.patch` | the commit, for `git am` on Compiled `master` 46fdea7 |
| `ISSUE.md` | issue title and body (open first: their CONTRIBUTING asks for a discussion on changes) |
| `PULL_REQUEST.md` | pull request title and body |

Verified on Compiled `master` 46fdea7 with Node 24: `jest packages/css packages/vite-plugin` 374 passed,
1 failed; the failure (`vite-plugin/src/__tests__/dev-css.test.ts` "uses Vite-processed CSS and sorts the
active modules in one stylesheet") also fails on unmodified `master` (369 passed, 1 failed), so it is not
caused by this change. Without the source change, 4 of the 5 new tests fail. Prettier and ESLint clean.

```bash
# after signing the CLA and forking atlassian-labs/compiled to your account:
git clone https://github.com/<you>/compiled && cd compiled
git checkout -b fix/merge-only-conditional-group-at-rules
git am /path/to/0001-fix-css-only-merge-duplicate-conditional-group-at-rules.patch
yarn install --frozen-lockfile && yarn jest packages/css
git push -u origin fix/merge-only-conditional-group-at-rules
# then open the PR against atlassian-labs/compiled:master with PULL_REQUEST.md, linking the issue
```
