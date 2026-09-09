#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# USRP FRONTEND SECURITY SCAN
#
# WHY THIS FILE EXISTS. ci.yml invoked aquasecurity/trivy-action DIRECTLY, while
# docs/architecture/ci-quality-gate.md requires that CI run the repository's own
# scripts so a developer and CI execute identical code. The backend has
# scripts/security-scan.sh; the frontend had nothing, so `pnpm security:scan` did
# not exist and the only scanning that happened lived in YAML a developer could
# not run before pushing.
#
# The checks below are the ones a CVE scanner cannot make: they are about what
# this repository TRACKS, not what its dependencies contain.
#
# Every check is proven in BOTH directions by --selftest, which builds a
# throwaway git repo, plants a real violation, asserts RED, removes it and
# asserts GREEN. A gate nobody has watched fail is a gate nobody should trust.
#
#   bash tooling/security/security-scan.sh
#   bash tooling/security/security-scan.sh --selftest
#   bash tooling/security/security-scan.sh --no-trivy --no-audit
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

FAILURES=0
SKIPS=0

c_red()  { printf '\033[31m%s\033[0m\n' "$*"; }
c_grn()  { printf '\033[32m%s\033[0m\n' "$*"; }
c_yel()  { printf '\033[33m%s\033[0m\n' "$*"; }
hr()     { printf '%s\n' "------------------------------------------------------------------------"; }

fail() { c_red "  FAIL  $*"; FAILURES=$((FAILURES + 1)); }
pass() { c_grn "  PASS  $*"; }
skip() { c_yel "  SKIP  $*"; SKIPS=$((SKIPS + 1)); }

# ── 1. No secret-bearing file is TRACKED ────────────────────────────────────
# Inspects the git INDEX, never the working tree, so a developer's untracked
# local .env can never fail someone else's run - the same choice
# check-large-files.mjs made, for the same reason. .gitignore is a request; this
# is the check, because `git add -f` walks straight through an ignore rule.
#
# .env.example and *.sample are explicitly allowed: a gate that flags the
# documented template gets switched off within a week.
check_tracked_secrets() {
  local found=0 f
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    case "$f" in
      *.example|*.example.*|*.sample) continue ;;
    esac
    fail "tracked secret-bearing file: $f"
    found=1
  done < <(git ls-files 2>/dev/null | grep -Ei '(^|/)\.env($|\.)|\.(pem|key|p12|pfx|jks|keystore)$' || true)
  [ "$found" -eq 0 ] && pass "no secret-bearing file is tracked"
  return 0
}

# ── 2. No tracked binary archive, at ANY size ───────────────────────────────
# usrp-edge-agent2-feat-edge-and-auth.tar.gz reached main through `git add -f`
# despite a .gitignore rule naming *.tar.gz explicitly. check-large-files.mjs
# catches anything over 5 MiB; this catches an archive of any size, because a
# small archive is still an opaque blob that cannot be reviewed in a diff.
check_tracked_archives() {
  local found=0 f
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    fail "tracked binary archive: $f"
    found=1
  done < <(git ls-files 2>/dev/null | grep -Ei '\.(zip|tar|tgz|7z|rar|iso|dmg|gz|bz2|xz)$' || true)
  [ "$found" -eq 0 ] && pass "no tracked binary archive"
  return 0
}

# ── 3. No inline private key material ───────────────────────────────────────
# A PEM pasted into a source file or a test fixture. docs/ and *.example are
# allowlisted as the places committed dev material legitimately lives.
check_inline_keys() {
  local found=0 f
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    case "$f" in
      *.example|docs/*|*/docs/*|tooling/security/*) continue ;;
    esac
    if grep -qE 'BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY' "$f" 2>/dev/null; then
      fail "inline private key material: $f"
      found=1
    fi
  done < <(git ls-files 2>/dev/null || true)
  [ "$found" -eq 0 ] && pass "no inline private key material"
  return 0
}

# ── 4. No deployable placeholder ────────────────────────────────────────────
# CHANGE_ME belongs in a template and nowhere else. The backend has already been
# bitten exactly here: MINIO_ENCRYPTION_KEY shipped as the literal
# CHANGE_ME_32_CHAR_MIN_AES256_KEY, which is EXACTLY 32 characters, so it
# CLEARED the minLength(32) floor and BOOTED - sealing scanned national IDs
# under a key published in git. A length check cannot catch that; this can.
check_placeholders() {
  local found=0 f
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    case "$f" in
      *.example|*.example.*|docs/*|*/docs/*|*.md|tooling/security/*) continue ;;
    esac
    if grep -qE 'CHANGE_ME|REPLACE_ME|YOUR_[A-Z_]+_HERE' "$f" 2>/dev/null; then
      fail "deployable placeholder in: $f"
      found=1
    fi
  done < <(git ls-files 2>/dev/null || true)
  [ "$found" -eq 0 ] && pass "no deployable placeholder outside templates"
  return 0
}

# ── 5. No credential parked in browser storage ──────────────────────────────
# FRONTEND-SPECIFIC, and the check with the sharpest reasoning behind it.
#
# ADR-018 records owner decision D5: the citizen session is a 32-byte opaque
# token in public_core.applicant_sessions rather than a JWT, and the platform
# accepted a permanent per-request database read - forever - to buy immediate
# revocability. The ADR gives the motivation plainly: "Citizens lose phones; a
# stateless token can't be recalled before expiry."
#
# A revocable token written to localStorage is a revocable token that HAS ALREADY
# BEEN COPIED. Revocation cancels the row; it does not un-exfiltrate the string.
# So a storage write carrying a credential does not merely add risk - it voids
# the exact property the backend paid a permanent performance cost to obtain.
#
# A NON-credential write stays green, and the selftest asserts that: nobody
# should have to fight this gate to persist a language preference, and a rule
# that blocks that gets deleted rather than narrowed.
check_browser_storage_credentials() {
  local found=0 f
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    case "$f" in
      *.test.*|*.spec.*|docs/*|*/docs/*|tooling/security/*) continue ;;
    esac
    if grep -qE '(localStorage|sessionStorage)\.setItem[[:space:]]*\([^)]*(sessionToken|accessToken|nationalId|password|otp|token)' "$f" 2>/dev/null; then
      fail "credential written to browser storage: $f"
      found=1
    fi
  done < <(git ls-files -- '*.ts' '*.tsx' '*.js' '*.jsx' 2>/dev/null || true)
  [ "$found" -eq 0 ] && pass "no credential written to browser storage"
  return 0
}

# ── 6. Trivy ────────────────────────────────────────────────────────────────
# Prefers a local binary, falls back to a pinned image, and SKIPS LOUDLY when
# neither is available rather than reporting a pass it did not earn. A scanner
# that silently no-ops is worse than no scanner: it produces a green line nobody
# investigates.
check_trivy() {
  if [ "${NO_TRIVY:-0}" = "1" ]; then skip "Trivy disabled by --no-trivy"; return 0; fi
  if command -v trivy >/dev/null 2>&1; then
    if trivy fs --scanners vuln --severity CRITICAL,HIGH --ignore-unfixed --exit-code 1 --quiet .; then
      pass "Trivy: no CRITICAL/HIGH findings"
    else
      fail "Trivy reported CRITICAL/HIGH findings"
    fi
  elif command -v docker >/dev/null 2>&1; then
    if docker run --rm -v "$PWD:/scan" aquasec/trivy:0.58.1 fs --scanners vuln \
         --severity CRITICAL,HIGH --ignore-unfixed --exit-code 1 --quiet /scan; then
      pass "Trivy (container): no CRITICAL/HIGH findings"
    else
      fail "Trivy (container) reported CRITICAL/HIGH findings"
    fi
  else
    skip "Trivy unavailable (no binary, no docker) - NOT a pass. CI runs it separately."
  fi
  return 0
}

# ── 7. pnpm audit ───────────────────────────────────────────────────────────
check_pnpm_audit() {
  if [ "${NO_AUDIT:-0}" = "1" ]; then skip "pnpm audit disabled by --no-audit"; return 0; fi
  if ! command -v pnpm >/dev/null 2>&1; then
    skip "pnpm unavailable - NOT a pass"
    return 0
  fi
  if pnpm audit --audit-level high >/dev/null 2>&1; then
    pass "pnpm audit: nothing at high or above"
  else
    fail "pnpm audit found advisories at high or above"
  fi
  return 0
}

run_all() {
  hr; echo "USRP FRONTEND SECURITY SCAN"; hr
  check_tracked_secrets
  check_tracked_archives
  check_inline_keys
  check_placeholders
  check_browser_storage_credentials
  check_trivy
  check_pnpm_audit
  echo ""
  hr
  if [ "$FAILURES" -gt 0 ]; then
    c_red "SECURITY SCAN RED - $FAILURES failure(s), $SKIPS skip(s)"
    hr
    return 1
  fi
  # A partial run must not be quotable as full coverage.
  if [ "$SKIPS" -gt 0 ]; then
    c_grn "SECURITY SCAN GREEN on what ran"
    c_yel "$SKIPS check(s) SKIPPED - this is not full coverage."
  else
    c_grn "SECURITY SCAN GREEN - every check ran and passed"
  fi
  hr
  return 0
}

# ── Selftest: every check proven RED then GREEN ─────────────────────────────
#
# Cleanup must be reachable from the EXIT trap, which runs in the top-level
# shell where a function-local would be out of scope - that reads as
# "tmp: unbound variable" under set -u, on every single run, after an otherwise
# clean pass. Exactly the class of noise that teaches people to ignore a gate's
# output. Caught by writing the selftest; fixed in the trap, not the test.
SELFTEST_TMP=""
_selftest_cleanup() { [ -n "${SELFTEST_TMP:-}" ] && rm -rf "$SELFTEST_TMP"; return 0; }

selftest() {
  local tmp asserts=0 bad=0 self
  self="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
  SELFTEST_TMP="$(mktemp -d)"
  tmp="$SELFTEST_TMP"
  trap _selftest_cleanup EXIT

  mkdir -p "$tmp/repo"
  ( cd "$tmp/repo" && git init -q . && git config user.email t@t.t && git config user.name t )

  _run() { ( cd "$tmp/repo" && NO_TRIVY=1 NO_AUDIT=1 bash "$self" >/dev/null 2>&1 ); }
  _expect() {
    local want="$1" label="$2" got
    _run; got=$?
    asserts=$((asserts + 1))
    if [ "$want" = red ] && [ "$got" -eq 0 ]; then
      echo "  ASSERT FAIL (expected RED, got GREEN)  $label"; bad=$((bad + 1))
    elif [ "$want" = green ] && [ "$got" -ne 0 ]; then
      echo "  ASSERT FAIL (expected GREEN, got RED)  $label"; bad=$((bad + 1))
    else
      echo "  ok   $label -> $want"
    fi
  }

  hr; echo "SELFTEST - each check planted, asserted RED, removed, asserted GREEN"; hr

  ( cd "$tmp/repo" && echo "console.log(1)" > app.ts && git add -A && git commit -qm base )
  _expect green "clean repo"

  ( cd "$tmp/repo" && echo "SECRET=x" > .env && git add -f .env && git commit -qm s )
  _expect red "tracked .env"
  ( cd "$tmp/repo" && git rm -q --cached .env && rm -f .env && git commit -qm r )
  _expect green ".env untracked"

  # The template must NOT trip it, or the gate gets switched off within a week.
  ( cd "$tmp/repo" && echo "SECRET=" > .env.example && git add -A && git commit -qm e )
  _expect green ".env.example is allowed"

  ( cd "$tmp/repo" && printf 'x' > bundle.tar.gz && git add -f bundle.tar.gz && git commit -qm a )
  _expect red "tracked tar.gz"
  ( cd "$tmp/repo" && git rm -q --cached bundle.tar.gz && rm -f bundle.tar.gz && git commit -qm r )
  _expect green "archive untracked"

  ( cd "$tmp/repo" && printf -- '-----BEGIN PRIVATE KEY-----\nabc\n' > k.ts && git add -A && git commit -qm k )
  _expect red "inline PEM in source"
  ( cd "$tmp/repo" && git rm -qf k.ts && git commit -qm r )
  _expect green "PEM removed"

  ( cd "$tmp/repo" && echo 'const k = "CHANGE_ME_32_CHAR"' > cfg.ts && git add -A && git commit -qm p )
  _expect red "CHANGE_ME in source"
  ( cd "$tmp/repo" && git rm -qf cfg.ts && git commit -qm r )
  _expect green "placeholder removed"

  ( cd "$tmp/repo" && echo 'localStorage.setItem("sessionToken", t)' > store.ts && git add -A && git commit -qm b )
  _expect red "sessionToken written to localStorage"
  ( cd "$tmp/repo" && git rm -qf store.ts && git commit -qm r )
  _expect green "storage write removed"

  # A benign write must stay green, or nobody can persist a language preference
  # and the rule gets deleted rather than narrowed.
  ( cd "$tmp/repo" && echo 'localStorage.setItem("locale", "rw")' > pref.ts && git add -A && git commit -qm n )
  _expect green "non-credential storage write is allowed"

  echo ""
  hr
  if [ "$bad" -gt 0 ]; then
    c_red "SELFTEST RED - $bad of $asserts assertions failed"
    hr
    return 1
  fi
  c_grn "SELFTEST GREEN - $asserts assertions, every check proven in both directions"
  hr
  return 0
}

DO_SELFTEST=0
for arg in "$@"; do
  case "$arg" in
    --selftest) DO_SELFTEST=1 ;;
    --no-trivy) NO_TRIVY=1 ;;
    --no-audit) NO_AUDIT=1 ;;
  esac
done

if [ "$DO_SELFTEST" = "1" ]; then
  selftest
  exit $?
fi

run_all
exit $?
