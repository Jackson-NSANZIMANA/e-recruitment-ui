#!/usr/bin/env bash
# The visual gate: build Storybook, serve it statically, and diff every story.
#
# WHY A SCRIPT AND NOT JUST THE PLAYWRIGHT COMMAND. `pnpm a11y` is wrapped for a
# reason recorded in run-storybook-a11y.sh: a dev server re-optimises
# dependencies and reloads the page mid-run. The visual gate needs the same
# static-build discipline plus one thing more — Playwright must be told which
# directory the index came from, because playwright.visual.config.ts builds its
# test cases by reading `index.json` at COLLECTION time (before any server is up).
# Wiring that inline in a package.json script would be unreadable; wiring it here
# means the a11y run and the visual run serve the SAME artefact.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
STATIC_DIR="${ROOT}/packages/design-system/storybook-static"

if [ ! -f "${STATIC_DIR}/index.json" ]; then
  pnpm --filter @usrp/design-system run build-storybook --quiet
fi

# Baselines are per-platform. Chromium's rasterisation of text is not identical
# across operating systems, so a Linux baseline compared on macOS fails for a
# reason that has nothing to do with the UI. Refusing to run is the honest
# behaviour: a diff is only meaningful against a baseline of the same kind.
REFERENCE_OS_FILE="${ROOT}/packages/design-system/storybook/visual-baseline-os.txt"
REFERENCE_OS="$(cat "${REFERENCE_OS_FILE}" 2>/dev/null || echo linux)"
if [ "$(uname -s | tr '[:upper:]' '[:lower:]')" != "${REFERENCE_OS}" ]; then
  echo "[visual] SKIPPED: baselines are committed for ${REFERENCE_OS}; this host is $(uname -s)."
  echo "[visual] Run it in CI, or regenerate the baselines on ${REFERENCE_OS} and commit them."
  exit 0
fi

# THE HOLLOW-GATE CHECK. Playwright writes a baseline the first time it sees a
# screenshot assertion and PASSES that run. A gate that has never compared
# anything therefore reports success, which is the exact pattern this repository
# keeps finding and calling out (see `scriptCoverage` in gates.config.json and the
# review's §6). Exiting 0 on an empty baseline directory would make this script a
# comment with a green tick beside it.
BASELINE_DIR="${ROOT}/packages/design-system/storybook/__screenshots__"
if ! compgen -G "${BASELINE_DIR}/*.png" > /dev/null 2>&1; then
  echo "[visual] NO BASELINES in ${BASELINE_DIR}." >&2
  echo "[visual] The gate is wired but has never compared anything - Playwright would" >&2
  echo "[visual] write a baseline for every story, pass this run, and call that a proof." >&2
  echo "[visual] Record them deliberately, review them, and commit them:" >&2
  echo "[visual]   pnpm --filter @usrp/design-system run test:visual:update" >&2
  exit 1
fi

pnpm exec playwright install --with-deps chromium
STORYBOOK_STATIC_DIR="${STATIC_DIR}" \
  pnpm --filter @usrp/design-system run test:visual
echo "[visual] done"
