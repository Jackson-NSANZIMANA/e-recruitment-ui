# ADR-FE-003 — `pnpm verify:fe`, and mocks generated from the contract

**Status:** Accepted · 2026-08-30

## Context

The backend's contract is **"prove it, don't assert it"**: every increment ships a
runnable selfcheck, and `ci-quality-gate.md` records what happens when that is not
enforced on change — CI reported "Unit Tests ✓" while running **zero tests**,
because no package defined a `test` script. A green-but-hollow gate is worse than
no gate: it tells the owner "verified" when nothing was.

This frontend started from that same position: no `test` script anywhere, no e2e,
no boundary check, no locale check.

## Decision

### 1. One command, mirroring `pnpm verify`

`pnpm verify:fe` runs nine proofs in order, reports pass/fail and an assertion
count per proof, **fails fast** on the first failure and exits non-zero. It is the
same script CI runs — no CI-only reimplementation to drift.

A **failed** proof stops the run. A **blocked** proof (exit 2, a missing dev
dependency) does not: its static half already ran, and hiding seven proofs behind
an uninstalled `vitest` punishes the wrong thing. The run still exits non-zero.

### 2. Seven of nine proofs need no `node_modules`

Boundaries, URL literals, PII greps, status exhaustiveness, locale parity and mock
drift are all **facts about files**. A gate that needs a working lockfile to answer
"did anyone import across a slice boundary" is a gate that gets skipped the first
time install breaks. Model logic runs on `node:test` with
`--experimental-strip-types` for the same reason. Only component rendering (jsdom
+ axe) and browser journeys (Playwright) genuinely need a runtime, and the runner
says so out loud instead of reporting a hollow pass.

### 3. MSW handlers are generated from `@usrp/contracts`

```
method + exact path  <- ROUTE_TABLE            (generated from openapi/*.yaml)
response bodies      <- fixtures/*.json        (VERBATIM)
which fixture = which outcome  <- operation-fixtures.json  (no bodies in it)
```

`operation-fixtures.json` is the only hand-authored file in the pipeline and it
contains no response bodies. Proof 07 fails if a browser route is unmocked, if a
**service-internal** route is mocked, if a body diverges from its fixture by a
byte, if an `expect: 'reject'` fixture is served — those encode responses the
platform must never emit — or if a mocked status is absent from that route's
contract status list.

The generator also emits the branches that have burned somebody, so a test can
reach them: `SYNCED` with nothing saved, `verified: false` as a 200, an amber row
with every document field null, the one retryable 409, the honest 501, the
idempotent replay, the bare 404.

### 4. a11y is asserted in every component test

Not a separate suite someone remembers. Field officers read these screens in
sunlight on a tablet; accessibility here is legibility, not compliance theatre.
Proof 08 fails a component suite that asserts behaviour without calling
`expectAccessible`, and fails if any exported slice component has no suite at all.

## Results

7/9 green, **2 546 assertions**, 55 model tests. Proofs 08 and 09 verified
statically (40 assertions) and blocked on install, reported as `BLOCK`, never as
`PASS`.

## Requests

- **Root `package.json`** (not an owned path): add
  `"verify:fe": "node packages/testing/scripts/verify-fe.mjs"`. Until then the
  runner is `pnpm --filter @usrp/testing verify`.
- **`.github/`** (not an owned path): add a `verify-fe` job running
  `pnpm install → pnpm typecheck → pnpm verify:fe`, plus
  `pnpm exec playwright install --with-deps`. Proofs 01-07 can also run in a
  pre-install job in seconds.
- **`turbo.json`**: no change needed; the runner is intentionally not a turbo task
  so that fail-fast ordering is preserved.
