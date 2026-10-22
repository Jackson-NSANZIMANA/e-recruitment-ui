#!/usr/bin/env bash
# axe-core over every story, against the STATIC Storybook build.
# A dev server re-optimises dependencies the first time a story imports a new
# package and reloads the page mid-test ("globalThis.__getContext is not a
# function"); a static build never reloads, so the run is deterministic.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
STATIC_DIR="${ROOT}/packages/design-system/storybook-static"
LOG_DIR="${ROOT}/.storybook-logs"
mkdir -p "$LOG_DIR"
[ -f "$STATIC_DIR/index.json" ] || pnpm --filter @usrp/design-system run build-storybook --quiet
python3 -m http.server 6006 --bind 127.0.0.1 --directory "$STATIC_DIR" >"$LOG_DIR/storybook.log" 2>&1 &
SERVER_PID=$!
cleanup(){ kill "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT
for _ in $(seq 1 30); do
  if curl --silent --fail http://127.0.0.1:6006/index.json >/dev/null; then break; fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then cat "$LOG_DIR/storybook.log"; exit 1; fi
  sleep 1
done
curl --silent --fail http://127.0.0.1:6006/index.json >/dev/null || { cat "$LOG_DIR/storybook.log"; exit 1; }
pnpm exec playwright install --with-deps chromium
pnpm --filter @usrp/design-system run test:a11y
