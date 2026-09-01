#!/usr/bin/env bash
# =============================================================================
# prove-gates.sh - proves every hygiene gate is real.
#
# THE STANDARD THIS MEETS. USRP's contract is "prove it, don't assert it", and
# the backend's audit established the specific failure mode to guard against: a
# job that reports green while running nothing. A gate is only real if it FAILS
# on a deliberate violation and PASSES once the violation is removed. Asserting
# a gate works is worth nothing; this script demonstrates it.
#
# Every check runs against a disposable fixture repository in a temp directory.
# It never modifies the working tree, so it is safe to run at any time.
#
#   bash tooling/repo-hygiene/prove-gates.sh
#
# Exit 0 only if every gate was observed failing AND passing.
# =============================================================================
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
FIXTURE="$(mktemp -d)"
trap 'rm -rf "$FIXTURE"' EXIT

PASS=0
FAIL=0

c_red()   { printf '\033[31m%s\033[0m' "$1"; }
c_green() { printf '\033[32m%s\033[0m' "$1"; }
hr()      { printf '%s\n' "------------------------------------------------------------------------"; }

# expect_exit <expected> <label> <command...>
expect_exit() {
  local expected="$1"; shift
  local label="$1"; shift
  local out rc
  out="$("$@" 2>&1)"; rc=$?
  if [ "$rc" -eq "$expected" ]; then
    printf '  %s %s (exit %s)\n' "$(c_green 'OK  ')" "$label" "$rc"
    PASS=$((PASS+1))
  else
    printf '  %s %s (expected exit %s, got %s)\n' "$(c_red 'BAD ')" "$label" "$expected" "$rc"
    printf '%s\n' "$out" | sed 's/^/        | /'
    FAIL=$((FAIL+1))
  fi
}

# --- fixture scaffold --------------------------------------------------------
# A minimal but structurally faithful replica: same workspace shape, same config
# file, so the gates run their real code paths rather than a special test mode.
mkdir -p "$FIXTURE"/packages/design-system/src/components/Widget
mkdir -p "$FIXTURE"/packages/good-pkg
mkdir -p "$FIXTURE"/apps/tiny-app/dist/assets
cd "$FIXTURE"
git init -q .
git config user.email "gate@usrp.local"
git config user.name "Gate Proof"

cat > pnpm-workspace.yaml <<'YAML'
packages:
  - "apps/*"
  - "packages/*"
YAML

cat > packages/design-system/package.json <<'JSON'
{ "name": "@usrp/design-system", "scripts": { "typecheck": "tsc", "lint": "eslint", "test": "node --test" } }
JSON
cat > packages/good-pkg/package.json <<'JSON'
{ "name": "@usrp/good-pkg", "scripts": { "typecheck": "tsc", "lint": "eslint", "test": "vitest run" } }
JSON
cat > apps/tiny-app/package.json <<'JSON'
{ "name": "@usrp/tiny-app", "scripts": { "typecheck": "tsc", "lint": "eslint", "test": "vitest run" } }
JSON

# A clean, compliant component: tokens only, 48px floor, no domain knowledge.
cat > packages/design-system/src/components/Widget/index.tsx <<'TSX'
import React from 'react';
import { Box } from '@atlaskit/primitives/compiled';
import { cssMap } from '@atlaskit/css';

const styles = cssMap({ base: { minWidth: '48px', minHeight: '48px' } });

export function Widget(): React.ReactElement {
  return <Box xcss={styles['base']} />;
}
TSX

# Gate config pointed at the fixture.
cat > gates.config.json <<'JSON'
{
  "largeFiles": { "maxBytes": 5242880, "allow": [] },
  "boundaries": { "roots": ["packages/design-system/src"], "extensions": [".ts", ".tsx"] },
  "hexScan": { "roots": ["packages/design-system"], "extensions": [".ts", ".tsx", ".json"], "allowPaths": [] },
  "touchTargets": { "minPx": 48, "roots": ["packages/design-system/src"], "extensions": [".ts", ".tsx"] },
  "scriptCoverage": { "required": ["typecheck", "lint", "test"], "exempt": {} },
  "bundles": { "apps/tiny-app": { "distDir": "dist", "maxTotalGzipKb": 50, "maxChunkGzipKb": 40 } },
  "compiledExtraction": { "apps": ["apps/tiny-app"], "distDir": "dist" }
}
JSON

# A small, in-budget build output with extracted atomic CSS.
head -c 20000 /dev/urandom | base64 | head -c 20000 > apps/tiny-app/dist/assets/app.js
printf '._1a2b3c4d{color:var(--ds-text)}\n' > apps/tiny-app/dist/assets/app.css
git add -A >/dev/null 2>&1

CFG="$FIXTURE/gates.config.json"
LARGE="$REPO_ROOT/tooling/repo-hygiene/check-large-files.mjs"
BOUND="$REPO_ROOT/tooling/repo-hygiene/check-boundaries.mjs"
COVER="$REPO_ROOT/tooling/repo-hygiene/check-script-coverage.mjs"
SIZE="$REPO_ROOT/tooling/repo-hygiene/check-bundle-size.mjs"
EXTRACT="$REPO_ROOT/tooling/repo-hygiene/verify-compiled-extraction.mjs"

echo ""
hr; echo "BASELINE - a clean fixture must be green on every gate"; hr
expect_exit 0 "large files"      node "$LARGE"   --root "$FIXTURE" --config "$CFG"
expect_exit 0 "boundaries"       node "$BOUND"   --root "$FIXTURE" --config "$CFG"
expect_exit 0 "script coverage"  node "$COVER"   --root "$FIXTURE" --config "$CFG"
expect_exit 0 "bundle size"      node "$SIZE"    --root "$FIXTURE" --config "$CFG"
expect_exit 0 "compiled extract" node "$EXTRACT" --root "$FIXTURE" --config "$CFG"

echo ""
hr; echo "PLANT 1 - raw hex colour (brief invariant 5)"; hr
sed -i "s|const styles = cssMap({ base: { minWidth: '48px', minHeight: '48px' } });|const styles = cssMap({ base: { minWidth: '48px', minHeight: '48px', color: '#0052CC' } });|" packages/design-system/src/components/Widget/index.tsx
expect_exit 1 "boundaries FAILS on #0052CC" node "$BOUND" --root "$FIXTURE" --config "$CFG"
sed -i "s|, color: '#0052CC' } });|} });|" packages/design-system/src/components/Widget/index.tsx
expect_exit 0 "boundaries PASSES once removed" node "$BOUND" --root "$FIXTURE" --config "$CFG"

echo ""
hr; echo "PLANT 2 - 40px touch target (WCAG 2.1 AA SC 2.5.5)"; hr
sed -i "s|minWidth: '48px'|minWidth: '40px'|" packages/design-system/src/components/Widget/index.tsx
expect_exit 1 "boundaries FAILS on 40px target" node "$BOUND" --root "$FIXTURE" --config "$CFG"
sed -i "s|minWidth: '40px'|minWidth: '48px'|" packages/design-system/src/components/Widget/index.tsx
expect_exit 0 "boundaries PASSES at 48px" node "$BOUND" --root "$FIXTURE" --config "$CFG"

echo ""
hr; echo "PLANT 3 - domain import into the domain-free layer"; hr
sed -i "1i import type { Agency } from '@usrp/shared-types';" packages/design-system/src/components/Widget/index.tsx
expect_exit 1 "boundaries FAILS on @usrp/shared-types import" node "$BOUND" --root "$FIXTURE" --config "$CFG"
sed -i "1d" packages/design-system/src/components/Widget/index.tsx
expect_exit 0 "boundaries PASSES once removed" node "$BOUND" --root "$FIXTURE" --config "$CFG"

echo ""
hr; echo "PLANT 4 - domain vocabulary, no import needed"; hr
printf 'export const bad = "RDF";\n' >> packages/design-system/src/components/Widget/index.tsx
expect_exit 1 "boundaries FAILS on the string \"RDF\"" node "$BOUND" --root "$FIXTURE" --config "$CFG"
sed -i '$d' packages/design-system/src/components/Widget/index.tsx
expect_exit 0 "boundaries PASSES once removed" node "$BOUND" --root "$FIXTURE" --config "$CFG"

echo ""
hr; echo "PLANT 5 - oversized committed file (the 70 MiB mistake, in miniature)"; hr
head -c 6291456 /dev/zero > vendor-blob.bin
git add vendor-blob.bin >/dev/null 2>&1
expect_exit 1 "large files FAILS on a 6 MiB tracked blob" node "$LARGE" --root "$FIXTURE" --config "$CFG"
git rm -q --cached vendor-blob.bin >/dev/null 2>&1; rm -f vendor-blob.bin
expect_exit 0 "large files PASSES once untracked" node "$LARGE" --root "$FIXTURE" --config "$CFG"

echo ""
hr; echo "PLANT 6 - a hollow package (declares no test script)"; hr
cat > packages/good-pkg/package.json <<'JSON'
{ "name": "@usrp/good-pkg", "scripts": { "typecheck": "tsc", "lint": "eslint" } }
JSON
expect_exit 1 "script coverage FAILS on a package turbo would skip" node "$COVER" --root "$FIXTURE" --config "$CFG"
cat > packages/good-pkg/package.json <<'JSON'
{ "name": "@usrp/good-pkg", "scripts": { "typecheck": "tsc", "lint": "eslint", "test": "vitest run" } }
JSON
expect_exit 0 "script coverage PASSES once declared" node "$COVER" --root "$FIXTURE" --config "$CFG"

echo ""
hr; echo "PLANT 7 - bundle over budget"; hr
head -c 600000 /dev/urandom | base64 > apps/tiny-app/dist/assets/bloat.js
expect_exit 1 "bundle size FAILS over the 50 KB gzip ceiling" node "$SIZE" --root "$FIXTURE" --config "$CFG"
rm -f apps/tiny-app/dist/assets/bloat.js
expect_exit 0 "bundle size PASSES once trimmed" node "$SIZE" --root "$FIXTURE" --config "$CFG"

echo ""
hr; echo "PLANT 8 - compiled runtime leaked via an authored source map"; hr
cat > apps/tiny-app/dist/assets/app.js.map <<'MAP'
{
  "version": 3,
  "file": "app.js",
  "sources": ["../../src/components/Widget/index.tsx"],
  "sourcesContent": ["import \"@compiled/react\";\n"],
  "names": [],
  "mappings": ""
}
MAP
printf '//# sourceMappingURL=app.js.map\n' >> apps/tiny-app/dist/assets/app.js
expect_exit 1 "extraction proof FAILS when the runtime leaks via an authored source map" node "$EXTRACT" --root "$FIXTURE" --config "$CFG"
rm -f apps/tiny-app/dist/assets/app.js.map
sed -i '$d' apps/tiny-app/dist/assets/app.js
expect_exit 0 "extraction proof PASSES once the leaked map is removed" node "$EXTRACT" --root "$FIXTURE" --config "$CFG"
echo ""
hr; echo "PLANT 9 - extraction claim with no extracted CSS at all"; hr
mv apps/tiny-app/dist/assets/app.css "$FIXTURE/app.css.bak"
expect_exit 1 "extraction proof FAILS with zero atomic classes" node "$EXTRACT" --root "$FIXTURE" --config "$CFG"
mv "$FIXTURE/app.css.bak" apps/tiny-app/dist/assets/app.css
expect_exit 0 "extraction proof PASSES once CSS is present" node "$EXTRACT" --root "$FIXTURE" --config "$CFG"

echo ""
hr; echo "PLANT 10 - budget gate must not pass a missing build"; hr
mv apps/tiny-app/dist "$FIXTURE/dist.bak"
expect_exit 1 "bundle size FAILS when dist is absent" node "$SIZE" --root "$FIXTURE" --config "$CFG"
mv "$FIXTURE/dist.bak" apps/tiny-app/dist
expect_exit 0 "bundle size PASSES with the build restored" node "$SIZE" --root "$FIXTURE" --config "$CFG"

echo ""
hr; echo "RULE UNIT TESTS - both directions, every predicate"; hr
expect_exit 0 "node --test tooling/repo-hygiene/test/" \
  node --test "$REPO_ROOT/tooling/repo-hygiene/test/predicates.test.mjs"

echo ""
hr
printf 'PROOF RESULT: %s observation(s) as expected, %s unexpected\n' "$PASS" "$FAIL"
hr
if [ "$FAIL" -ne 0 ]; then
  echo "A gate did not behave as claimed. Do not trust the suite until this is green."
  exit 1
fi
echo "Every gate was observed FAILING on a planted violation and PASSING once removed."
echo ""
echo "NOT PROVEN HERE (needs node_modules, so it is proven in CI by the same scripts):"
echo "  - ADS/@atlaskit lint errors        -> pnpm lint            (needs eslint + plugins)"
echo "  - strict typecheck, zero errors    -> pnpm typecheck       (needs typescript)"
echo "  - axe-core WCAG 2.1 AA on stories  -> pnpm a11y            (needs storybook + browser)"
echo "  - Playwright e2e                   -> pnpm test:e2e        (needs browsers)"
echo "  - Trivy CRITICAL/HIGH              -> the security job     (needs trivy)"
exit 0
