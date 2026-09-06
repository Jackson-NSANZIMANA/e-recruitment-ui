#!/usr/bin/env bash
# =============================================================================
# purge-vendor-zip.sh
#
# Removes atlassian-atlassian-frontend-mirror-2cfaa179c166.zip (70.45 MiB) from
# the ENTIRE git history of e-recruitment-ui.
#
#   *** THIS SCRIPT IS NOT RUN BY CI AND MUST NOT BE. ***
#
# It rewrites history. Every commit SHA after the first one containing the blob
# changes. Every existing clone becomes incompatible and every open pull request
# needs rebasing. That is a decision for the repository owner at a moment of
# their choosing, coordinated with everyone holding a clone.
#
# READ tooling/repo-hygiene/PURGE-RUNBOOK.md BEFORE RUNNING THIS.
#
# Default behaviour is a DRY RUN that changes nothing. You must pass --execute.
#
#   bash tooling/repo-hygiene/purge-vendor-zip.sh              # dry run
#   bash tooling/repo-hygiene/purge-vendor-zip.sh --execute    # rewrite (local only)
#
# Even with --execute this only rewrites your LOCAL clone. Pushing is a separate,
# manual step that the script prints but deliberately never performs.
# =============================================================================
set -euo pipefail

BLOB="atlassian-atlassian-frontend-mirror-2cfaa179c166.zip"
EXECUTE=0
[ "${1:-}" = "--execute" ] && EXECUTE=1

say()  { printf '\n\033[1m%s\033[0m\n' "$1"; }
info() { printf '  %s\n' "$1"; }
die()  { printf '\n\033[31mABORT:\033[0m %s\n\n' "$1" >&2; exit 1; }

# --- 0. Preconditions --------------------------------------------------------
say "0. Preconditions"

command -v git >/dev/null || die "git not found."

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "not inside a git repository."
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"
info "repo: $REPO_ROOT"

command -v git-filter-repo >/dev/null 2>&1 || {
  info "git-filter-repo not found. Install it first:"
  info "  pipx install git-filter-repo     # or: brew install git-filter-repo"
  info "  (do NOT use git filter-branch: it is slow, subtly wrong with tags,"
  info "   and its own documentation recommends filter-repo instead)"
  die "missing dependency: git-filter-repo"
}

# filter-repo refuses to run on a repo with uncommitted changes, and it is right to.
if [ -n "$(git status --porcelain)" ]; then
  die "working tree is dirty. Commit or stash everything before rewriting history."
fi

# filter-repo expects a fresh clone. Running it on your daily working clone can
# silently strip remotes and leave you unable to compare against origin.
if [ -z "${USRP_ALLOW_DIRTY_CLONE:-}" ] && [ -d "$REPO_ROOT/node_modules" ]; then
  info "node_modules/ present - this looks like a working clone, not a fresh one."
  info "filter-repo is designed to run against a FRESH clone made for the purpose:"
  info "  git clone --no-local <url> usrp-ui-rewrite && cd usrp-ui-rewrite"
  info "Set USRP_ALLOW_DIRTY_CLONE=1 only if you truly mean to rewrite this clone."
  die "refusing to rewrite a working clone by default."
fi

# --- 1. Measure, before ------------------------------------------------------
say "1. Before"

BEFORE_PACK="$(git count-objects -vH | awk '/size-pack/ {print $2 $3}')"
info "size-pack:        $BEFORE_PACK"

BLOB_COUNT="$(git rev-list --objects --all | grep -c "$BLOB" || true)"
info "blob references:  $BLOB_COUNT (across all refs)"

if [ "$BLOB_COUNT" -eq 0 ]; then
  info "The blob is not present in history. Nothing to purge."
  info "If you expected it here, confirm you fetched all refs: git fetch --all --tags"
  exit 0
fi

# The exact size of the largest version of the blob, from history not the worktree.
BLOB_BYTES="$(git rev-list --objects --all \
  | grep "$BLOB" \
  | cut -d' ' -f1 \
  | git cat-file --batch-check='%(objectsize)' \
  | sort -nr | head -1)"
info "largest version:  $(awk -v b="$BLOB_BYTES" 'BEGIN{printf "%.2f MiB", b/1048576}')"

# --- 2. Record the pre-rewrite fingerprint ----------------------------------
# The single most important safety step. A history rewrite must change exactly
# one thing: the presence of the blob. If commit COUNT, tree contents, tags, or
# authorship shift too, the rewrite did more than asked and must be discarded.
say "2. Recording the pre-rewrite fingerprint"

FP_DIR="$(mktemp -d)"
info "fingerprint dir:  $FP_DIR"

git rev-list --count --all                          > "$FP_DIR/commit-count.before"
git log --all --pretty='%an|%ae|%ad|%s' --date=iso   > "$FP_DIR/log.before"
git for-each-ref --format='%(refname) %(objecttype)' > "$FP_DIR/refs.before"
# Tree hash of every commit, blob EXCLUDED. This is the real equality test:
# it proves every file other than the blob survived byte-identical.
git log --all --pretty='%H' | while read -r sha; do
  printf '%s %s\n' "$sha" "$(git ls-tree -r "$sha" | grep -v "$BLOB" | git hash-object --stdin)"
done > "$FP_DIR/trees.before"

info "commits:          $(cat "$FP_DIR/commit-count.before")"
info "refs:             $(wc -l < "$FP_DIR/refs.before" | tr -d ' ')"

# --- 3. Rewrite --------------------------------------------------------------
say "3. Rewrite"

if [ "$EXECUTE" -eq 0 ]; then
  info "DRY RUN. The command that would run:"
  info ""
  info "  git filter-repo --invert-paths --path '$BLOB' --force"
  info ""
  info "Re-run with --execute to perform it. Read PURGE-RUNBOOK.md first."
  info "Fingerprint kept for comparison at: $FP_DIR"
  exit 0
fi

info "running git-filter-repo (this rewrites every commit after the blob landed)"
git filter-repo --invert-paths --path "$BLOB" --force

# --- 4. Verify: history intact, blob gone -----------------------------------
say "4. Verification (this is the part that decides whether to push)"

FAILED=0
check() {
  if [ "$2" = "$3" ]; then
    printf '  \033[32mOK  \033[0m %s\n' "$1"
  else
    printf '  \033[31mFAIL\033[0m %s\n        expected: %s\n        actual:   %s\n' "$1" "$2" "$3"
    FAILED=1
  fi
}

# 4a. the blob is actually gone from every ref
AFTER_BLOBS="$(git rev-list --objects --all | grep -c "$BLOB" || true)"
check "blob absent from all refs" "0" "$AFTER_BLOBS"

# 4b. no commit was lost
check "commit count unchanged" \
  "$(cat "$FP_DIR/commit-count.before")" "$(git rev-list --count --all)"

# 4c. authorship, dates and messages are byte-identical
git log --all --pretty='%an|%ae|%ad|%s' --date=iso > "$FP_DIR/log.after"
if diff -q "$FP_DIR/log.before" "$FP_DIR/log.after" >/dev/null; then
  printf '  \033[32mOK  \033[0m %s\n' "author / date / message log identical"
else
  printf '  \033[31mFAIL\033[0m %s\n' "commit metadata changed - inspect: diff $FP_DIR/log.before $FP_DIR/log.after"
  FAILED=1
fi

# 4d. EVERY OTHER FILE IS BYTE-IDENTICAL. The test that matters most.
git log --all --pretty='%H' | while read -r sha; do
  printf '%s %s\n' "$sha" "$(git ls-tree -r "$sha" | grep -v "$BLOB" | git hash-object --stdin)"
done > "$FP_DIR/trees.after"
if diff <(cut -d' ' -f2 "$FP_DIR/trees.before") <(cut -d' ' -f2 "$FP_DIR/trees.after") >/dev/null; then
  printf '  \033[32mOK  \033[0m %s\n' "all non-blob file content identical in every commit"
else
  printf '  \033[31mFAIL\033[0m %s\n' "file content changed somewhere - DO NOT PUSH. Inspect $FP_DIR/trees.*"
  FAILED=1
fi

# 4e. the tree still builds the same worktree at HEAD
if [ -f package.json ] && [ -f pnpm-workspace.yaml ] && [ -d packages ] && [ -d apps ]; then
  printf '  \033[32mOK  \033[0m %s\n' "HEAD worktree still has package.json / pnpm-workspace.yaml / packages / apps"
else
  printf '  \033[31mFAIL\033[0m %s\n' "HEAD worktree is missing expected files"
  FAILED=1
fi

# --- 5. Result ---------------------------------------------------------------
say "5. Result"

git reflog expire --expire=now --all
git gc --prune=now --aggressive >/dev/null 2>&1 || git gc --prune=now >/dev/null 2>&1
AFTER_PACK="$(git count-objects -vH | awk '/size-pack/ {print $2 $3}')"
info "size-pack before: $BEFORE_PACK"
info "size-pack after:  $AFTER_PACK"

if [ "$FAILED" -ne 0 ]; then
  printf '\n\033[31mVERIFICATION FAILED. DO NOT PUSH.\033[0m\n'
  printf 'Delete this clone and start again. Fingerprints kept at: %s\n\n' "$FP_DIR"
  exit 1
fi

cat <<NEXT

  All verification passed. History is intact and the blob is gone.

  NOTHING HAS BEEN PUSHED. The push is manual and irreversible:

    git remote add origin git@github.com:Jackson-NSANZIMANA/e-recruitment-ui.git
    git push --force --all origin
    git push --force --tags origin

  Before you run those two lines, do the coordination in PURGE-RUNBOOK.md
  section 4. Every clone in existence breaks the moment you do.

  Fingerprints retained for the record: $FP_DIR

NEXT
