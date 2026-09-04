# Runbook: purging the vendored ADS mirror from git history

**Status:** ready to execute, NOT executed · **Owner decision required**
**Target:** `atlassian-atlassian-frontend-mirror-2cfaa179c166.zip` — 73,876,569 bytes (70.45 MiB)
**Script:** `tooling/repo-hygiene/purge-vendor-zip.sh` (dry run by default)

---

## 1. What is wrong, in one paragraph

A 70.45 MiB zip archive is committed at the root of `e-recruitment-ui`. The
largest other tracked file is `pnpm-lock.yaml` at 0.34 MiB; everything else is
source text. So this single file is the overwhelming majority of clone weight,
and because git history is effectively append-only, deleting it in a new commit
**changes nothing about that** — every clone still downloads every historical
version of every object. `git rm` gets it out of your working tree and leaves the
tax in place forever. The only real removal is a history rewrite.

Measure it yourself rather than taking the number on trust:

```bash
# clone weight today
git clone --bare https://github.com/Jackson-NSANZIMANA/e-recruitment-ui.git size-check
du -sh size-check && rm -rf size-check

# the blob's share of history
git rev-list --objects --all \
  | grep atlassian-atlassian-frontend-mirror \
  | cut -d' ' -f1 \
  | git cat-file --batch-check='%(objectsize)' \
  | awk '{s+=$1} END {printf "%.2f MiB of history is this one file\n", s/1048576}'
```

---

## 2. What that mirror was actually FOR, and whether it is still needed

**What it was for.** `atlassian-frontend-mirror` is Atlassian's public read-only
source mirror of the Atlassian Design System monorepo. It is not a build input
and nothing in this repository imports it — verified: a code search for
`atlassian-frontend-mirror` across `e-recruitment-ui` returns **zero references**
outside the filename itself. It was vendored as a **reading aid**: somewhere to
grep for canonical ADS usage, because the published packages ship types and
compiled output but not source, examples or internal docs. The fingerprints of
that use are still in the code — `packages/ui/src/components/OfflineIndicator/
index.tsx` carries the comment *"this is the canonical ADS compiled pattern
confirmed in the mirror source."* That was a legitimate need. Solving it by
committing 70 MiB to the product repo was not.

**Is it redundant now? Substantially yes, on four counts.**

| Need it served | What covers it now |
|---|---|
| Component API surface, prop types | The pinned `@atlaskit/*` packages in `pnpm-lock.yaml` ship `.d.ts` for every component, resolved at the exact installed version — which the mirror snapshot is **not** guaranteed to match. |
| Correct usage patterns, examples | `@atlaskit/ads-mcp@1.7.3` is already a devDependency with `.mcp.json` wired at root. It answers ADS questions against current ADS, in-editor. |
| Human-readable docs | <https://atlassian.design> — versioned, searchable, always current. |
| Token names and values | `@atlaskit/tokens@^16.4.0` is installed; the token list is enumerable from the package itself. |

**The one thing the published packages genuinely do not give you** is the source
of internal implementation details and the full example corpus. That is a real
gap, and the honest fix is to clone the mirror **beside** the repo, not inside it:

```bash
git clone --depth 1 https://github.com/atlassian/atlassian-frontend-mirror.git \
  ~/reference/atlassian-frontend-mirror
```

**Verdict:** the mirror is redundant as a *committed artefact* and always was as
a *build input*. Purge it. Keep the capability, lose the 70 MiB.

**Second-order risk worth naming:** a snapshot pinned to commit `2cfaa179c166`
drifts from the installed `@atlaskit` versions the moment either moves. A stale
reference is worse than no reference, because it looks authoritative. That is an
argument for removal independent of size.

---

## 3. Prerequisites

```bash
pipx install git-filter-repo      # or: brew install git-filter-repo
```

`git-filter-repo` — not `filter-branch`. The latter is slow, mishandles tags in
subtle ways, and its own documentation recommends filter-repo instead.

**Work in a fresh clone made for the purpose.** The script refuses to run in a
directory containing `node_modules/` for this reason: filter-repo strips remotes
by design, and doing that to your daily working clone is how you lose work.

```bash
git clone --no-local https://github.com/Jackson-NSANZIMANA/e-recruitment-ui.git usrp-ui-rewrite
cd usrp-ui-rewrite
git fetch --all --tags        # the rewrite must see EVERY ref, or you orphan branches
```

---

## 4. The coordination cost — read this before touching anything

A force-push after a history rewrite is **the single most disruptive operation
available** on a shared repository. Every commit SHA from the first blob-bearing
commit onward changes. Concretely:

**Every existing clone becomes incompatible.** Anyone who pulls afterwards gets a
divergent-history error, and the intuitive response (`git pull`, then merge)
**reintroduces the 70 MiB blob** and undoes the entire exercise. This is the most
likely way this goes wrong. Every clone holder must do this instead:

```bash
# the safe recovery: re-clone. Boring, and it always works.
cd .. && rm -rf e-recruitment-ui
git clone https://github.com/Jackson-NSANZIMANA/e-recruitment-ui.git

# if there is unpushed local work, rescue it as patches FIRST
cd e-recruitment-ui-old
git format-patch origin/main..HEAD -o ~/rescued-patches
# then, in the fresh clone:
git checkout -b my-branch && git am ~/rescued-patches/*.patch
```

**Every open pull request breaks.** GitHub PRs reference commits by SHA; after
the rewrite those SHAs no longer exist on the branch. PRs must be closed and
reopened from re-created branches. With four agents working in parallel on
`feat/**` branches, this cost scales with how long you wait.

**Everything SHA-pinned elsewhere breaks.** In this codebase specifically:
`.github/workflows/ci.yml` pins `BACKEND_SHA: 47d9ad3a...`, which points into the
*backend* repo and is unaffected — but audit for any pin pointing *into*
`e-recruitment-ui`: deploy manifests, submodules, docs links, release notes, task
references, `git blame` links in review comments. All of them rot.

**Forks keep the blob.** A fork's objects live in its own storage. Every fork must
be deleted and re-forked, or it will happily push the blob back.

**Timing.** Do this at the quietest possible moment and announce it before and
after. It costs less the sooner it happens, because both the number of clones and
the number of affected SHAs only grow.

### Recommended sequence

1. Announce a freeze window. Everyone pushes and lands what they have.
2. Confirm zero open PRs, or accept re-creating them.
3. Take a full backup: `git clone --mirror` to a safe location. **This is the only
   undo you get.**
4. Temporarily lift branch protection on `main` (a force-push needs it).
5. Run the rewrite (§5) and read the verification output.
6. Force-push only after verification is fully green.
7. Restore branch protection **immediately**.
8. Announce completion with the re-clone instructions above pasted in full.
9. Everyone re-clones. Nobody merges an old clone into the new history.

---

## 5. Execution

```bash
# 1. Dry run. Changes nothing. Reports the blob, its size, the exact command.
bash tooling/repo-hygiene/purge-vendor-zip.sh

# 2. Rewrite this LOCAL clone only. Still does not push.
bash tooling/repo-hygiene/purge-vendor-zip.sh --execute
```

### The pre-push verification, and why it is shaped this way

A history rewrite must change **exactly one thing**. The script fingerprints the
repository before the rewrite and re-checks afterwards:

| Check | Question it answers |
|---|---|
| blob absent from all refs | Did the removal actually happen? (A no-op rewrite tool would otherwise look successful.) |
| commit count unchanged | Did `--prune-empty` silently drop a commit? |
| author / date / message log identical | Did authorship or history get rewritten beyond the blob? |
| **all non-blob file content identical in every commit** | The one that matters. Every commit's tree is re-hashed with the blob excluded and compared. Byte-identical means no source was touched. |
| HEAD worktree structurally intact | Does a checkout still look like the repo? |

**Any FAIL means: do not push. Delete the clone, start again.** Fingerprints are
retained in a temp directory for forensics.

This verification was itself tested in both directions before being trusted —
against a rewrite tool that changes nothing (verification correctly refuses) and
against a genuine rewrite (verification correctly passes, with all commits, all
metadata and all non-blob content byte-identical).

### The push, which the script deliberately will not do for you

```bash
git remote add origin git@github.com:Jackson-NSANZIMANA/e-recruitment-ui.git
git push --force --all origin
git push --force --tags origin
```

Automating this behind a flag would make an irreversible, socially expensive act
one typo away. It stays manual.

### After the push

```bash
git count-objects -vH        # confirm size-pack fell
```

Ask GitHub Support to run `git gc` on the remote if the reported repository size
does not drop — unreferenced objects can linger server-side, and unlike a local
clone you cannot prune them yourself.

---

## 6. Preventing the recurrence

Three changes ship alongside this runbook, because a runbook alone prevents
nothing:

1. **`.gitignore`** now refuses `*.zip`, `*.tar`, `*.tar.gz`, `*.tgz`, `*.7z`,
   `*.rar`, `*.iso`, `*.dmg` and the mirror filename explicitly.
2. **CI fails on any tracked file over 5 MiB** —
   `tooling/repo-hygiene/check-large-files.mjs`, proven to fail on a planted
   6 MiB blob and pass once removed. It runs **before `pnpm install`**, so a
   dependency problem can never disable it.
3. **The ADS MCP server is the documented replacement** for grepping a vendored
   mirror: `@atlaskit/ads-mcp@1.7.3` with `.mcp.json` at the repo root. Open the
   repo root in an MCP-aware editor and ask it for component APIs, token names
   and the canonical `@compiled`/`cssMap` pattern **before** writing styles —
   faster than discovering the same answer from a lint error.

A `.gitignore` entry does not stop `git add -f`. The CI check does.
