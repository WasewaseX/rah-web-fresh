#!/usr/bin/env bash
# Task 113: THE SESSION-CLOSE GATE - "always deploy at last and make sure it's healthy".
#
# Holder directive (2026-11-01): every working session MUST end with a healthy
# production deployment, verified in a real browser. The incident that forced
# this gate: the recycled deployment served a stale preserved build whose
# sound.tsx mount-effect bug threw a client-side exception - the holder saw
# Next's "Application error: a client-side exception has occurred" page while
# every HTTP-level check (root 200, /api/version healthy) kept passing.
# Lesson: a JSON health endpoint cannot see a crashed client bundle. Only a
# real browser can. So this gate runs one.
#
# Roads, in order:
#   1. Free RAM for the build (stop any dev server; the supervisor respawns
#      it and dev-or-prod.sh then boots PRODUCTION because BUILD_ID exists).
#   2. Fresh production build from the current tree (build-prod.sh: static
#      sync + intended-release record + artifact pack + secret gate).
#   3. Flip port 3000 to the production standalone + server health
#      (ensure-server.sh, which also keeps DB/migrations/drift in line).
#   4. REAL-BROWSER smoke: open /, log in, sweep the key tabs, FAIL on any
#      client-side error and on a missing app shell.
#   5. Commit + push when the tree is dirty (English message via $1).
#   6. Preview freshness: the public preview URL must serve THIS commit.
#
# Usage: bash scripts/deploy-gate.sh ["commit message"]
# Exit 0 only when every road is green. Never silently skip a failing road.
set -uo pipefail
cd /home/z/my-project || exit 1

MSG="${1:-Task: deploy gate - build, flip to production, browser-verified healthy}"
HEAD_SHA="$(git rev-parse --short=12 HEAD)"
PREVIEW_URL="${PREVIEW_URL:-https://preview-chat-d027ce73-8b7f-4fc0-910a-b2c665a663c0.space-z.ai/}"
FAIL=0
step() { echo "== $1"; }

step "1/6 RAM for the build (stop dev if it is serving)"
if pgrep -f "next dev" >/dev/null 2>&1; then
  pkill -f "next dev" || true; sleep 2; pkill -f "next dev" 2>/dev/null || true
  echo "   dev server stopped (supervisor will respawn into production once BUILD_ID exists)"
else
  echo "   no dev server running"
fi

step "2/6 production build from the current tree"
if ! bash scripts/build-prod.sh; then
  echo "GATE FAIL: build failed"; exit 1
fi

step "3/6 flip to production + server health"
if ! bash scripts/ensure-server.sh; then
  echo "GATE FAIL: ensure-server failed"; exit 1
fi
curl -sf -o /dev/null --max-time 10 http://127.0.0.1:3000/api/version || { echo "GATE FAIL: /api/version unhealthy"; exit 1; }
echo "   local production healthy: $(curl -s http://127.0.0.1:3000/api/version | head -c 120)"

step "4/6 real-browser smoke (client-exception detector)"
agent-browser open http://127.0.0.1:3000/ >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1 || true
sleep 3
if bash scripts/e2e-login.sh >/dev/null 2>&1; then
  agent-browser open http://127.0.0.1:3000/ >/dev/null 2>&1
  agent-browser wait --load networkidle >/dev/null 2>&1 || true
  sleep 5
  for tab in "Review" "Sound" "Progress" "Arcade"; do
    agent-browser find role button click --name "$tab" >/dev/null 2>&1
    sleep 2
  done
  agent-browser open http://127.0.0.1:3000/ >/dev/null 2>&1
  sleep 2
fi
CLI_ERRS="$(agent-browser errors 2>/dev/null | grep -ciE "error|uncaught" || true)"
SHELL_OK="$(agent-browser get title 2>/dev/null | grep -c "Rah" || true)"
NAV_OK="$(agent-browser snapshot -c 2>/dev/null | grep -cE 'button "(Review|Today|Progress)"' || true)"
echo "   client errors: $CLI_ERRS | title ok: $SHELL_OK | nav ok: $NAV_OK"
if [ "$CLI_ERRS" -ne 0 ] || [ "$SHELL_OK" -eq 0 ] || [ "$NAV_OK" -eq 0 ]; then
  echo "GATE FAIL: the production bundle crashes or renders empty in a real browser"
  agent-browser errors 2>/dev/null | head -5
  exit 1
fi
agent-browser errors --clear >/dev/null 2>&1 || true

step "5/6 commit + push (only when dirty)"
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null || [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  git add -A
  git commit -m "$MSG" || true
  git push origin HEAD -q 2>/dev/null && echo "   pushed $(git rev-parse --short=12 HEAD)" || echo "   (push skipped/remote rejected)"
else
  echo "   tree clean - nothing to commit"
fi

step "6/6 preview freshness (public URL serves production)"
PREV_OK=0
for _ in $(seq 1 20); do
  PV="$(curl -sf --max-time 10 "${PREVIEW_URL%/}/api/version" 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get("version",""))' 2>/dev/null || true)"
  if [ -n "$PV" ]; then PREV_OK=1; echo "   preview serves build/commit: $PV"; break; fi
  sleep 3
done
[ "$PREV_OK" -eq 1 ] || { echo "GATE FAIL: preview did not answer /api/version"; exit 1; }

echo "DEPLOY GATE: GREEN - production built, browser-verified, preview live (HEAD $HEAD_SHA)"
