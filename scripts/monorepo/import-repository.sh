#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <repo-url> <branch> <target-subdir> [remote-name]" >&2
  exit 1
fi

REPO_URL="$1"
BRANCH="$2"
TARGET_SUBDIR="$3"
REMOTE_NAME="${4:-import-$(date +%s)}"

if [[ ! -d .git ]]; then
  echo "Run from destination repository root." >&2
  exit 1
fi

if git remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
  echo "Remote '$REMOTE_NAME' already exists." >&2
  exit 1
fi

mkdir -p "$(dirname "$TARGET_SUBDIR")"

git remote add "$REMOTE_NAME" "$REPO_URL"
trap 'git remote remove "$REMOTE_NAME" >/dev/null 2>&1 || true' EXIT

git fetch "$REMOTE_NAME" "$BRANCH"

git subtree add --prefix "$TARGET_SUBDIR" "$REMOTE_NAME" "$BRANCH" --message "Import $REPO_URL ($BRANCH) into $TARGET_SUBDIR"

echo "Imported $REPO_URL#$BRANCH -> $TARGET_SUBDIR with history preserved."
