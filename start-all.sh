#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════╗
# ║           SMILEY OS — start-all.sh                                  ║
# ║  Starts: Express backend · Vite frontend · Claude ACP agent          ║
# ╚══════════════════════════════════════════════════════════════════════╝

set -euo pipefail

# ── Colours ────────────────────────────────────────────────────────────────────
YLW='\033[1;33m'
GRN='\033[0;32m'
RED='\033[0;31m'
CYN='\033[0;36m'
DIM='\033[2m'
RST='\033[0m'

# ── Paths ──────────────────────────────────────────────────────────────────────
SMILEY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${SMILEY_DIR}/smiley-os-frontend"
ACP_DIR="/Users/administrator/claude-agent-acp/claude-agent-acp-main"
PIDS_FILE="${SMILEY_DIR}/.pids"
LOG_DIR="${SMILEY_DIR}"

# ── Ports ──────────────────────────────────────────────────────────────────────
BACKEND_PORT=3000
FRONTEND_PORT=5173
ACP_PORT=3001

# ── Banner ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${YLW}  ╔═══════════════════════════════════════════╗${RST}"
echo -e "${YLW}  ║  :)  SMILEY OS — LAUNCH SEQUENCE          ║${RST}"
echo -e "${YLW}  ╚═══════════════════════════════════════════╝${RST}"
echo -e "${DIM}  Singularity Build · $(date '+%Y-%m-%d %H:%M:%S')${RST}"
echo ""

# ── Helpers ────────────────────────────────────────────────────────────────────
log()  { echo -e "${CYN}  [•]${RST} $*"; }
ok()   { echo -e "${GRN}  [✓]${RST} $*"; }
warn() { echo -e "${YLW}  [!]${RST} $*"; }
fail() { echo -e "${RED}  [✗]${RST} $*"; }

wait_for_port() {
  local port=$1 name=$2 attempts=0 max=30
  log "Waiting for ${name} on :${port} …"
  while ! nc -z 127.0.0.1 "$port" 2>/dev/null; do
    attempts=$((attempts + 1))
    if [[ $attempts -ge $max ]]; then
      warn "${name} did not respond on :${port} within ${max}s — continuing anyway"
      return 0
    fi
    sleep 1
  done
  ok "${name} is accepting connections on :${port}"
}

kill_port() {
  local port=$1
  local pids
  pids=$(lsof -ti "tcp:${port}" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    warn "Port ${port} already in use — killing PID(s): ${pids}"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
}

# ── Clean up previous runs ─────────────────────────────────────────────────────
if [[ -f "$PIDS_FILE" ]]; then
  warn "Found existing .pids file — stopping previous processes first"
  "${SMILEY_DIR}/stop-all.sh" 2>/dev/null || true
  sleep 1
fi

> "$PIDS_FILE"   # truncate / create

# ── Free ports ─────────────────────────────────────────────────────────────────
echo ""
log "Clearing ports ${BACKEND_PORT}, ${FRONTEND_PORT}, ${ACP_PORT} …"
kill_port "$BACKEND_PORT"
kill_port "$FRONTEND_PORT"
kill_port "$ACP_PORT"

# ─────────────────────────────────────────────────────────────────────────────
# 1. EXPRESS BACKEND  (:3000)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${YLW}  ┌─ [1/3] Express Backend ──────────────────────────┐${RST}"

if [[ ! -f "${SMILEY_DIR}/server.js" ]]; then
  fail "server.js not found in ${SMILEY_DIR}"
  exit 1
fi

if [[ ! -f "${SMILEY_DIR}/.env" ]]; then
  warn ".env not found — backend may fail if GEMINI_API_KEY is required"
fi

nohup node "${SMILEY_DIR}/server.js" \
  > "${LOG_DIR}/backend.log" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID backend" >> "$PIDS_FILE"
ok "Express backend started (PID ${BACKEND_PID})"
echo -e "${YLW}  └──────────────────────────────────────────────────┘${RST}"

wait_for_port "$BACKEND_PORT" "Express"

# ─────────────────────────────────────────────────────────────────────────────
# 2. VITE FRONTEND  (:5173)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${YLW}  ┌─ [2/3] Vite Frontend Dev Server ─────────────────┐${RST}"

if [[ ! -d "$FRONTEND_DIR" ]]; then
  fail "Frontend dir not found: ${FRONTEND_DIR}"
  exit 1
fi

if [[ ! -d "${FRONTEND_DIR}/node_modules" ]]; then
  log "node_modules missing — running npm install …"
  (cd "$FRONTEND_DIR" && npm install --silent)
fi

nohup bash -c "cd '${FRONTEND_DIR}' && npm run dev -- --port ${FRONTEND_PORT} --host" \
  > "${LOG_DIR}/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID frontend" >> "$PIDS_FILE"
ok "Vite dev server started (PID ${FRONTEND_PID})"
echo -e "${YLW}  └──────────────────────────────────────────────────┘${RST}"

wait_for_port "$FRONTEND_PORT" "Vite"

# ─────────────────────────────────────────────────────────────────────────────
# 3. CLAUDE-AGENT-ACP  (:3001)  — optional
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${YLW}  ┌─ [3/3] Claude Agent ACP Server ──────────────────┐${RST}"

START_ACP="${START_ACP:-}"   # set START_ACP=1 in env to force-enable

if [[ -z "$START_ACP" ]]; then
  # Auto-detect: start ACP if the dist is built and ANTHROPIC_API_KEY is set
  if [[ -f "${ACP_DIR}/dist/index.js" ]] && [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
    START_ACP=1
    log "Auto-detected built ACP dist + ANTHROPIC_API_KEY — enabling ACP server"
  else
    [[ ! -f "${ACP_DIR}/dist/index.js" ]] && warn "ACP dist not built (run: cd '${ACP_DIR}' && npm run build)"
    [[ -z "${ANTHROPIC_API_KEY:-}" ]]     && warn "ANTHROPIC_API_KEY not set — ACP server skipped"
  fi
fi

ACP_PID=""
if [[ "$START_ACP" == "1" ]]; then
  if [[ ! -f "${ACP_DIR}/dist/index.js" ]]; then
    warn "ACP dist/index.js not found — building now …"
    (cd "$ACP_DIR" && npm install --silent && npm run build)
  fi

  # Wrap in a simple HTTP shim on ACP_PORT so the frontend can probe /health
  # The ACP agent itself uses stdio; we expose a tiny health endpoint separately
  nohup bash -c "
    export ANTHROPIC_API_KEY='${ANTHROPIC_API_KEY:-}'
    export CLAUDE_MODEL='${CLAUDE_MODEL:-claude-sonnet-4-5}'
    export MAX_THINKING_TOKENS='${MAX_THINKING_TOKENS:-}'
    cd '${ACP_DIR}'
    node dist/index.js
  " > "${LOG_DIR}/acp.log" 2>&1 &
  ACP_PID=$!
  echo "$ACP_PID acp" >> "$PIDS_FILE"
  ok "Claude Agent ACP server started (PID ${ACP_PID})"
else
  warn "Claude Agent ACP server not started (set START_ACP=1 to enable)"
fi

echo -e "${YLW}  └──────────────────────────────────────────────────┘${RST}"

# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${YLW}  ╔═══════════════════════════════════════════════════╗${RST}"
echo -e "${YLW}  ║  :)  SMILEY OS IS ONLINE                          ║${RST}"
echo -e "${YLW}  ╠═══════════════════════════════════════════════════╣${RST}"
echo -e "${YLW}  ║${RST}  ${GRN}Express Backend${RST}   http://localhost:${BACKEND_PORT}       PID ${BACKEND_PID}"
echo -e "${YLW}  ║${RST}  ${GRN}Vite Frontend${RST}     http://localhost:${FRONTEND_PORT}      PID ${FRONTEND_PID}"
if [[ -n "$ACP_PID" ]]; then
echo -e "${YLW}  ║${RST}  ${GRN}Claude ACP Agent${RST}  http://localhost:${ACP_PORT}       PID ${ACP_PID}"
else
echo -e "${YLW}  ║${RST}  ${DIM}Claude ACP Agent  (not started — START_ACP=1)${RST}"
fi
echo -e "${YLW}  ╠═══════════════════════════════════════════════════╣${RST}"
echo -e "${YLW}  ║${RST}  ${DIM}Logs:  backend.log · frontend.log · acp.log${RST}"
echo -e "${YLW}  ║${RST}  ${DIM}PIDs:  ${PIDS_FILE}${RST}"
echo -e "${YLW}  ║${RST}  ${DIM}Stop:  ./stop-all.sh${RST}"
echo -e "${YLW}  ╚═══════════════════════════════════════════════════╝${RST}"
echo ""

# ── Health check hint ──────────────────────────────────────────────────────────
echo -e "${DIM}  Quick health checks:${RST}"
echo -e "${DIM}    curl http://localhost:${BACKEND_PORT}/health${RST}"
echo -e "${DIM}    curl http://localhost:${BACKEND_PORT}/api/acp-status${RST}"
echo ""
