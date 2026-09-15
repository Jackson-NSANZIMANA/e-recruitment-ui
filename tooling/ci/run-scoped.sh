#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# Run a turbo task over the AFFECTED set when that is a meaningful question,
# and over the WHOLE WORKSPACE when it is not.
#
# WHY THIS FILE EXISTS
# --------------------
# ci.yml ran `turbo run <task> --affected` on every event with
# TURBO_SCM_BASE=origin/main and TURBO_SCM_HEAD=HEAD. On a push to main,
# actions/checkout leaves HEAD pointing at origin/main, so the diff is empty and
# --affected selects nothing:
#
#     • Packages in scope:
#     • Running typecheck in 0 packages
#     Tasks:    0 successful, 0 total
#
# Three jobs — typecheck, ads-lint, test — reported SUCCESS on run 94637887182
# having executed zero packages, while `build` (which has no --affected filter)
# failed on a type error typecheck existed to catch. A gate that cannot go red
# is worse than no gate: it spends reviewer trust it never earned.
#
# The rule below is deliberately conservative. Affected-only is an optimisation
# and it is allowed exactly where it is sound — a pull request, where the base
# and head genuinely differ. Everywhere else runs everything.
#
#   usage: bash tooling/ci/run-scoped.sh <turbo-task>
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail

task="${1:?usage: run-scoped.sh <turbo-task>}"

base_ref="${TURBO_SCM_BASE:-origin/main}"
head_ref="${TURBO_SCM_HEAD:-HEAD}"

use_affected=0
if [ "${GITHUB_EVENT_NAME:-}" = "pull_request" ]; then
  if base_sha="$(git rev-parse --verify --quiet "$base_ref")" &&
     head_sha="$(git rev-parse --verify --quiet "$head_ref")"; then
    if [ "$base_sha" != "$head_sha" ]; then
      use_affected=1
    else
      echo "note: $base_ref and $head_ref are the same commit ($base_sha)."
      echo "      --affected would select nothing, so running the full workspace."
    fi
  else
    echo "note: could not resolve $base_ref or $head_ref; running the full workspace."
  fi
fi

if [ "$use_affected" -eq 1 ]; then
  echo "==> turbo run $task --affected  ($base_ref..$head_ref)"
  exec pnpm exec turbo run "$task" --affected
fi

echo "==> turbo run $task  (full workspace)"
exec pnpm exec turbo run "$task"
