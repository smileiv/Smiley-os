#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

run_if_present() {
  local dir="$1"
  local script="$2"
  if [[ -f "$dir/package.json" ]] && node -e "const p=require('$dir/package.json');process.exit(p.scripts&&p.scripts['$script']?0:1)" >/dev/null 2>&1; then
    echo "==> npm --prefix $dir run $script"
    npm --prefix "$dir" run "$script"
  else
    echo "==> skip: $dir has no '$script' script"
  fi
}

run_if_present "$ROOT_DIR" "lint"
run_if_present "$ROOT_DIR" "build"
run_if_present "$ROOT_DIR" "test"

run_if_present "$ROOT_DIR/smiley-os-frontend" "lint"
run_if_present "$ROOT_DIR/smiley-os-frontend" "build"
run_if_present "$ROOT_DIR/smiley-os-frontend" "test"

echo "Validation wave complete."
