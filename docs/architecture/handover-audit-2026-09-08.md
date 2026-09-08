# Handover audit — incoming frontend architect, 2026-09-08

**Status:** findings of record. Written on takeover, before feature work.
**Method:** every claim below cites the file or the commit that proves it.
**Predecessor's equivalent:** `frontend-architecture.md` §9.

---

## Why this document exists

The single most useful artefact the previous engineer left is not the
architecture, the contract layer or the proof harness. It is
`frontend-architecture.md` §9 — the Corrections table that records **twelve**
false claims from the document it replaced, and names how each was found. That
table is why this handover took hours rather than weeks.

So this is the same instrument turned on the state I inherited. Three sections,
and they are **not interchangeable**:

| Section | Status of every claim |
|---|---|
| **§1 Broken** | Verified against files in this repository. Evidence cited inline. |
| **§2 Fixed** | Corrected on a branch, with the commit named. |
| **§3 Unverified** | Suspected, **not proven.** I could not run it. Nothing here may be relied on. |

If a claim in §1 or §2 has no citation, treat it as a defect in this document.

---

## 1. Broken

### 1.1 `main` was un-installable for eleven hours, and the gate said so to nobody

**THE FINDING THAT OUTRANKS EVERYTHING ELSE.**
`pnpm install --frozen-lockfile` fails in ~8 seconds on `main` and has failed on
every CI run since PR #9 merged at 2026-09-08 13:41.

Provable from two files:

- `packages/testing/package.json` declares six `workspace:*` dependencies:
  `@usrp/feature-adjudication`, `-applications`, `-compliance`, `-field-ops`,
  `-identity`, `-scheduling`.
- `pnpm-workspace.yaml` globbed only `apps/*` and `packages/*`.

A pnpm workspace glob matches **one path segment**. `packages/*` matches
`packages/features`; it does **not** match `packages/features/identity`. All six
slice packages exist, with exactly the names `@usrp/testing` asks for, and all
six were invisible to the workspace. pnpm exits
`ERR_PNPM_NO_MATCHING_VERSION_INSIDE_WORKSPACE` before fetching anything.

The 8-second failure is the signature: an install that had begun resolving a tree
this size could not finish, or fail, that fast.

**Every downstream CI job was `skipped`, and the Quality Gate correctly reported
RED.** The gate worked. Nobody read it. A required check that goes red and
changes no behaviour is indistinguishable from one that is not required.

Same class as the backend's Turbo env allowlist, twice: a hand-maintained list of
paths that nothing executes end to end, so a gap is invisible until the thing it
feeds cannot start.

### 1.2 A tracked 9 MiB binary archive, through the fence the repo had already built

`usrp-edge-agent2-feat-edge-and-auth.tar.gz` was tracked on `main`, together with
its `.sha256`, `SHA256SUMS`, `manifest.txt` and `APPLY.md` — the file overlay for
work that had **already been merged** through PRs #7–#9 and #12–#14.

`.gitignore` names `*.tar.gz` explicitly, with a comment explaining that a
70.45 MiB vendored ADS mirror had already done this once. It was still added,
because `git add -f` walks straight through an ignore rule. The repository's own
comment predicted this exactly: *"The ignore rule is the fence; the CI check is
the lock."* The lock (`check-large-files.mjs`) exists and runs first in the
hygiene gate — which is consistent with Hygiene having been RED on `main`.

### 1.3 A major-version split in the styling runtime

All six feature slices declared `@compiled/react: ^0.18.0` and
`@atlaskit/css: ^0.10.0`. Both apps, `@usrp/ui` and `@usrp/design-system` declare
`^1.0.0` for both.

Two majors of `@compiled/react` in one graph means two runtimes in one bundle,
and `verify:extraction` exists specifically to fail when the `@compiled` runtime
appears in a shipped asset **at all**. So the extraction gate could not have
passed once any slice was actually mounted in an app. It has never been tested,
because no build has completed.

### 1.4 Fourteen unpinned dependency ranges

Fourteen `@atlaskit/*` entries across the six slices were `"*"` — any version,
including tomorrow's breaking one. In a national-security dependency tree that is
not laxity, it is an unpinned supply chain: a compromised or merely breaking
upstream release enters on the next install with no diff to review.

### 1.5 React was a dependency, not a peer

Each slice declared `react: ^18.3.1` and `react-router-dom: ^6.26.0` as **runtime
dependencies**, while the apps pin `18.3.1` and `6.30.1` exactly. Under
`shamefully-hoist=false` that permits a second React instance. Two Reacts is not
a duplication warning — it is `invalid hook call` at runtime and context silently
resolving to the wrong provider. `@usrp/ui` and `@usrp/design-system` already had
this right, as peers.

### 1.6 Six `test` scripts that could not resolve their own runner

Every slice declared `test: "vitest run"` and `lint: "eslint ."`. **Neither
vitest nor eslint was a dependency of any slice.** vitest is a devDependency of
`@usrp/testing`, and a transitive dependency's binary is not placed on a
consumer's `node_modules/.bin`, so `pnpm --filter @usrp/feature-identity test`
fails with `vitest: command not found`.

This is the hollow gate that `check-script-coverage.mjs` was written to prevent,
entering through the one door that gate does not watch: **it asserts a script is
DECLARED, never that the declaration can RUN.** The blind spot is recorded in
`gates.config.json`; closing it needs a resolve check, not another exemption.

### 1.7 The debt ledger overstated debt by four packages

`gates.config.json > scriptCoverage.exempt` claimed 13 gaps across 7 packages.
`@usrp/contracts`, `@usrp/shared-types`, `@usrp/auth` and `@usrp/api-client` have
declared `lint` and `test` since 2026-08-31. The gate prints a `NOTE` for a stale
exemption and does not fail, so eight lines of "KNOWN GAPS" printed on every run
describing debt already paid.

A ledger that overstates debt gets skimmed, and then the entries that are still
real stop being read.

Two packages were missing entirely: `@usrp/contract-drift` and `@usrp/edge-dev`.

### 1.8 `@usrp/edge-dev` is not typechecked by anything

It ships a `tsconfig.json`, and every script runs through
`node --experimental-strip-types`, which **erases types without checking them**.
Nothing anywhere verifies the types of the dev edge gateway that terminates the
session cookie and brokers system tokens. Its 143-assertion `selfcheck` proves
behaviour; nothing proves types.

It was also outside the workspace, so the
`pnpm --filter @usrp/edge-dev check:contracts` command documented in
`edge-contract.md` §12 could not resolve.

### 1.9 `pnpm security:scan` did not exist

`ci.yml` invoked `aquasecurity/trivy-action` directly, while
`ci-quality-gate.md` requires CI to run the repository's own scripts so a
developer and CI execute identical code. The backend has
`scripts/security-scan.sh`. The frontend had no script and no manifest entry, so
the only scanning that happened lived in YAML nobody could run before pushing.

### 1.10 Five verified defects in the shared locale bundles

Read directly from `packages/i18n/src/locales/{en,rw,fr}/common.json`:

1. `status` holds **17** keys. **Twelve are fictional** — `UNDER_REVIEW`,
   `SHORTLISTED`, `PHYSICAL_SCHEDULED`, `PHYSICAL_PASSED`, `PHYSICAL_FAILED`,
   `MEDICAL_SCHEDULED`, `MEDICAL_PASSED`, `MEDICAL_FAILED`,
   `VETTING_IN_PROGRESS`, `VETTING_PASSED`, `VETTING_FAILED`, `EXPIRED`. Not one
   appears in `rdf_ops`, `rnp_ops` or `rcs_ops`. Exactly the twelve
   `@usrp/shared-types` was frozen for carrying.
2. **Thirteen real statuses have no label at all**, including all four
   `WALK_IN_*` states. An RDF officer working the walk-in lane — the only agency
   with one — sees a raw enum.
3. `auth.email` says "Email address" in all three languages. The wire field is
   `loginHandle`; `officer_accounts` has `login_handle varchar(128)` and **no
   email column**. Every officer in all three agencies is asked for a credential
   that does not exist.
4. `auth.invalid_credentials` names email too.
5. `document_type` models 6 values agency-agnostically; one is real and the three
   agencies accept three different sets.

**What is CORRECT and must stay so:** all three locales are at exact three-way
key parity, no value is empty, and `{{agencyName}}` / `{{name}}` / `{{maxSize}}`
are intact in every locale. Verified by reading all three files in full.

### 1.11 CI defects beyond the install failure

| # | Defect |
|---|---|
| 1 | `develop` in `on.push` and `on.pull_request` — **that branch does not exist** |
| 2 | `chore/**` absent from push triggers, so the pattern that produced PR #5 ran no CI |
| 3 | the `install` job produced nothing any downstream job consumed; all seven re-installed independently |
| 4 | `e2e` declared `needs: build` and **never downloaded the artifact** — it tested source, not the bundle that ships |
| 5 | build upload used `if: always()` + `if-no-files-found: ignore`, so a failed build "uploaded" nothing and `e2e` failed later with a confusing error |
| 6 | the Quality Gate parsed `toJSON(needs)` with a whitespace-sensitive `grep -o` regex |

---

## 2. Fixed

| Finding | Fix | Where |
|---|---|---|
| 1.1 workspace glob | added `packages/features/*` and `tooling/*` | `fix/ci-overhaul-and-hygiene` |
| 1.2 tracked archive + stale bundle files | 5 files untracked | `fix/ci-overhaul-and-hygiene` |
| 1.3 runtime major split | aligned to `^1.0.0` in all six slices | `fix/ci-overhaul-and-hygiene` |
| 1.4 unpinned ranges | 13 of 14 pinned to ranges the repo already uses | `fix/ci-overhaul-and-hygiene` |
| 1.5 React as dependency | moved to `peerDependencies` + dev copies | `fix/ci-overhaul-and-hygiene` |
| 1.6 unresolvable runners | vitest, eslint, React types declared per slice | `fix/ci-overhaul-and-hygiene` |
| 1.7 lying ledger | 4 stale removed, 2 missing added; real count 10 | `chore/honest-script-coverage` |
| 1.9 no security script | `tooling/security/security-scan.sh`, 13 selftest assertions | `feat/frontend-security-scan` |
| 1.10 no i18n gate | real `lint` + `test`, 7 rules, zero dependencies | `chore/honest-script-coverage` |
| 1.11 CI defects | all six corrected | `fix/ci-overhaul-and-hygiene` |

**One pinned range was deliberately NOT invented.** `@atlaskit/textarea` in the
compliance slice has no other consumer in this repository, so there is no in-repo
evidence for the correct major. It keeps `"*"` and carries a `//dependencies`
note naming it as the single outstanding version decision. An honest marker beats
a plausible invention — the same reason the backend's edge OpenAPI carries
`x-usrp-verified: pending-controller-read`.

---

## 3. Unverified — nothing here may be relied on

### 3.1 The lockfile must be regenerated, and I could not do it

Adding workspace packages and changing dependency ranges both change the set of
lockfile importers, so `--frozen-lockfile` **must** fail until `pnpm-lock.yaml`
is regenerated against a registry. One command, and CI stays RED until it lands:

```bash
pnpm install
git add pnpm-lock.yaml
git commit -m 'chore: regenerate lockfile for workspace and slice manifests'
```

The lockfile is machine-generated and **must never be hand-edited**. The
handover doc says so and it is right.

### 3.2 Two dependency removals I declined to make blind

`frontend-architecture.md` §8.4 records that `zustand@4.5.5` is a dependency of
both apps and imported nowhere, and that `@usrp/shared-types` is still a
dependency of both apps while `.dependency-cruiser.cjs` forbids importing it.
Both should be removed.

I did **not** remove them. GitHub code search returned
`total_count: 0, incomplete_results: true` for this repository — including for a
literal string I had already read in `apps/*/package.json` — so the index does
not cover it and a zero result is not evidence of absence. Removing a dependency
that *is* imported breaks `typecheck` and `build`.

Verify with a real grep, then remove both in one commit alongside a lockfile
regeneration:

```bash
git grep -n "from 'zustand'\|require('zustand')" -- apps packages
git grep -n "@usrp/shared-types" -- apps
```

Note `@usrp/ui` **does** depend on `@usrp/shared-types` and likely imports it;
only the two apps are candidates.

### 3.3 The Hygiene job's exact failure is not known

Hygiene was RED on `main` and on the first pushes of
`fix/ci-overhaul-and-hygiene`. `check-large-files.mjs` runs first and the tracked
9 MiB archive is sufficient to explain the failure on `main` — but the hygiene
runner is fail-fast, so **only the first failing gate is visible** and any
subsequent failure is masked. No log-retrieval tool was available to me.

After the archive removal, re-read the Hygiene log before assuming it is closed.

### 3.4 The browser-storage check has not been run against the real tree

Check 5 of the security scan is proven in both directions against planted
fixtures, not against `apps/**` or `packages/**`. `frontend-architecture.md` §1.3
says the session token lives in memory for the tab's lifetime, so it *should* be
clean — but "should" is not evidence, and the keyword set includes a bare `token`
that will also match a benign `tokenExpiry`.

If it goes red, **read the named file before assuming the rule is wrong.**

### 3.5 Bundle budgets are still uncalibrated

`gates.config.json > bundles` carries 700 KB / 1200 KB gzip ceilings marked
PROVISIONAL. No CI build has ever completed, so no `dist` has ever been measured.
A ceiling nobody has calibrated either never fires or always does. Calibrate on
the first green run.

---

## 4. Standing corrections to the inherited documentation

`frontend-architecture.md` is broadly honest and its §9 is exemplary. Two claims
in it are now stale, recorded here rather than edited into it, so the correction
has a date and an author:

1. **§7 reports `pnpm verify:fe` as 9 proofs / 2 546 assertions.** Proofs 08 and
   09 require `node_modules`, and installation has been impossible since
   2026-09-08 13:41. The 2 546 figure has therefore never been observed on
   `main`. Treat the seven install-free proofs as the verified subset until a
   green run exists.
2. **§8.1 says "ports 4021-4024 are reserved for nothing".** `edge-contract.md`
   §0 already corrects this: those ports are named, loaded by real loaders in
   `packages/shared-config`, and the topology behind them is a decision on the
   record. The two documents disagree; `edge-contract.md` is the later and
   better-evidenced one.

---

## 5. The one thing worth carrying forward above all

The Quality Gate was **RED and correct** for eleven hours while work continued on
top of it. Every mechanism functioned: the gate ran, evaluated the right
condition, and reported failure.

The missing part was not a gate. It was that a red required check did not stop
anything. A proof nobody reads is a proof that has already failed, and it fails
silently — which is the exact failure mode every other gate in this repository
was built to prevent.

Make `Quality Gate` a **required, branch-protected** status check on `main`
before the next feature lands.
