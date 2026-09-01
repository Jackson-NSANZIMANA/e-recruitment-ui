#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

LOG_DIR="${ROOT}/.storybook-logs"
mkdir -p "$LOG_DIR"

pnpm --filter @usrp/design-system run storybook -- --ci --no-open \
  >"$LOG_DIR/storybook.log" 2>&1 &
STORYBOOK_PID=$!

cleanup() {
  kill "$STORYBOOK_PID" 2>/dev/null || true
  wait "$STORYBOOK_PID" 2>/dev/null || true
}
trap cleanup EXIT

for _ in $(seq 1 60); do
  if curl --silent --fail http://127.0.0.1:6006 >/dev/null; then
    break
  fi

  if ! kill -0 "$STORYBOOK_PID" 2>/dev/null; then
    cat "$LOG_DIR/storybook.log"
    exit 1
  fi

  sleep 2
done

curl --silent --fail http://127.0.0.1:6006 >/dev/null || {
  cat "$LOG_DIR/storybook.log"
  exit 1
}

pnpm --filter @usrp/design-system run test:a11y