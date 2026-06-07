#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════╗
# ║           SMILEY OS — stop-all.sh                                   ║
# ║  Kills all processes recorded in .pids                               ║
# ╚══════════════════════════════════════════════════════════════════════╝

set -euo pipefail

# ── Colours ────────────────────────────────────────────────────────────────────
YLW='\033[1;33m'
GRN='\033[0;32m'
RED='\033[0;31m'
CYN='\033[0;36m'
DIM='\033[2m'
RST='\033[0m'

SMILEY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDS_FILE="${SMILEY_DIR}/.pids"

log()  { echo -e "${CYN}  [•]${RST} $*"; }
ok()   { echo -e "${GRN}  [✓]${RST} $*"; }
warn() { echo -e "${YLW}  [!]${RST} $*"; }
fail() { echo -e "${RED}  [✗]${RST} $*"; }

echo ""
echo -e "${YLW}  ╔═══════════════════════════════════════════╗${RST}"
echo -e "${YLW}  ║  :)  SMILEY OS — SHUTDOWN SEQUENCE        ║${RST}"
echo -e "${YLW}  ╚═══════════════════════════════════════════╝${RST}"
echo ""

# ── Read and kill from .pids ──────────────────────────────────────────────────
if [[ ! -f "$PIDS_FILE" ]]; then
  warn ".pids file not found at ${PIDS_FILE}"
  warn "Nothing to stop — use 'kill' manually if processes are still running"
  echo ""
  exit 0
fi

KILLED=0
MISSED=0

while IFS=' ' read -r pid name || [[ -n "$pid" ]]; do
  [[ -z "$pid" ]] && continue
  if kill -0 "$pid" 2>/dev/null; then
    log "Stopping ${name:-process} (PID ${pid}) …"
    kill -TERM "$pid" 2>/dev/null || true
    # Give it 3 seconds to exit gracefully, then SIGKILL
    for i in 1 2 3; do
      sleep 1
      if ! kill -0 "$pid" 2>/dev/null; then
        break
      fi
    done
    if kill -0 "$pid" 2>/dev/null; then
      warn "PID ${pid} did not exit — sending SIGKILL"
      kill -9 "$pid" 2>/dev/null || true
    fi
    ok "Stopped ${name:-process} (PID ${pid})"
    KILLED=$((KILLED + 1))
  else
    warn "PID ${pid} (${name:-unknown}) — already gone or not found"
    MISSED=$((MISSED + 1))
  fi
done < "$PIDS_FILE"

# ── Also nuke anything still holding our ports ─────────────────────────────────
for PORT in 3000 5173 3001; do
  LEFTOVER=$(lsof -ti "tcp:${PORT}" 2>/dev/null || true)
  if [[ -n "$LEFTOVER" ]]; then
    warn "Port ${PORT} still occupied by PID(s) ${LEFTOVER} — force-killing"
    echo "$LEFTOVER" | xargs kill -9 2>/dev/null || true
  fi
done

# ── Remove .pids ──────────────────────────────────────────────────────────────
rm -f "$PIDS_FILE"
ok ".pids file removed"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${YLW}  ╔═══════════════════════════════════════════╗${RST}"
if [[ $KILLED -gt 0 ]]; then
echo -e "${YLW}  ║${RST}  ${GRN}Stopped ${KILLED} process(es)${RST}"
fi
if [[ $MISSED -gt 0 ]]; then
echo -e "${YLW}  ║${RST}  ${DIM}${MISSED} process(es) were already gone${RST}"
fi
echo -e "${YLW}  ║${RST}  ${GRN}Smiley OS is offline${RST}"
echo -e "${YLW}  ╚═══════════════════════════════════════════╝${RST}"
echo ""
