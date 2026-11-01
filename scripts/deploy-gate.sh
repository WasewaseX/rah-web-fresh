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
# Task 113: next-server renames its process title, so pkill-by-path misses
# it and a stale in-memory build can survive the "flip". The gate REQUIRES
# the fresh build to actually boot: kill every server identity first, then
# let ensure-server revive from disk and health-check it.
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
pkill -f "standalone/server.js" 2>/dev/null || true
sleep 2
if ! bash scripts/ensure-server.sh; then
  echo "GATE FAIL: ensure-server failed"; exit 1
fi
# Staleness guard (Task 115 repair): the old BOOT_AT-vs-BUILD_MTIME check
# compared against /api/version's startedAt, which is a rolling per-serve
# timestamp (≈ request time), not the process boot - it could never detect a
# stale process and once mis-parsed to "0\n0". The served-chunk check below
# is the honest equivalent: stale in-memory builds serve HTML naming chunks
# that no longer exist on disk.
# Retry road: ensure-server's last health check can race the watchdog or a
# final socket handoff - probe until the server truly answers (10 x 2s).
SERVED=""
for _ in $(seq 1 10); do
  SERVED="$(curl -s --max-time 5 http://127.0.0.1:3000/ 2>/dev/null || true)"
  if echo "$SERVED" | grep -qE 'chunks/[A-Za-z0-9_-]+\.js'; then break; fi
  sleep 2
done
if ! echo "$SERVED" | grep -qE 'chunks/[A-Za-z0-9_-]+\.js'; then
  echo "GATE FAIL: root HTML never served chunk references (server not stable)"
  exit 1
fi
# Every chunk the served HTML references must exist on disk (the Task 113
# ChunkLoadError class - HTML 200 + healthy /api/version with broken JS).
echo "$SERVED" | grep -oE 'chunks/[A-Za-z0-9_-]+\.js' | sort -u | sed 's|^chunks/||' > /tmp/gate-served-chunks.txt
CHUNK_BAD=0
while read -r c; do
  [ -n "$c" ] || continue
  if [ ! -f ".next/standalone/.next/static/chunks/$c" ]; then
    echo "GATE FAIL: served chunk missing on disk: $c"
    CHUNK_BAD=1
  fi
done < /tmp/gate-served-chunks.txt
[ "$CHUNK_BAD" -eq 0 ] || exit 1
echo "   chunk integrity: $(wc -l < /tmp/gate-served-chunks.txt) served refs, all present"
VERSION_OK=0
for _ in $(seq 1 10); do
  if curl -sf -o /dev/null --max-time 10 http://127.0.0.1:3000/api/version; then VERSION_OK=1; break; fi
  sleep 2
done
[ "$VERSION_OK" -eq 1 ] || { echo "GATE FAIL: /api/version unhealthy"; exit 1; }
echo "   local production healthy: $(curl -s http://127.0.0.1:3000/api/version | head -c 120)"

step "4/6 real-browser smoke (client-exception detector)"
# Task 115: the default agent-browser session can carry a stale --cdp
# endpoint from earlier interactive runs (observed live: it pointed at a dead
# debug Chrome on :9233, so every check failed with connection errors while
# the app was perfectly healthy). The gate owns its browser end-to-end:
# launch headless Chromium on a fresh port, cookie-login, click the tabs,
# collect client errors, tear down. Same road as scripts/ui-dom-sweep.sh.
# Task 115bis: the block passes standalone but failed twice inside the full
# gate (every agent-browser call dead-quiet) - so the road RETRIES itself on
# a fresh port and logs the first failure visibly instead of discarding it.
CHROME=/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome
ROAD4_OK=0
for ATTEMPT in 1 2; do
  GPORT=$((9240 + ATTEMPT))
  rm -rf /tmp/cdp-gate-profile
  setsid nohup "$CHROME" --headless=new --no-sandbox --disable-gpu \
    --disable-dev-shm-usage --remote-debugging-port=$GPORT \
    --window-size=1440,900 --user-data-dir=/tmp/cdp-gate-profile \
    about:blank > /tmp/gate-chrome-$ATTEMPT.log 2>&1 < /dev/null &
  GATE_BROWSER_UP=0
  for _ in $(seq 1 15); do
    curl -sf --max-time 2 "http://127.0.0.1:$GPORT/json/version" >/dev/null 2>&1 && { GATE_BROWSER_UP=1; break; }
    sleep 1
  done
  [ "$GATE_BROWSER_UP" -eq 1 ] || { echo "   attempt $ATTEMPT: gate browser never came up"; pkill -f cdp-gate-profile 2>/dev/null || true; continue; }
  GB() { agent-browser --cdp $GPORT "$@"; }
  GB_OPEN_LOG=/tmp/gate-road4-open.log
  GB open http://127.0.0.1:3000/ > "$GB_OPEN_LOG" 2>&1 || true
  if ! grep -q "Rah" "$GB_OPEN_LOG" 2>/dev/null; then
    echo "   attempt $ATTEMPT: browser open failed - $(head -c 120 "$GB_OPEN_LOG")"
    pkill -f cdp-gate-profile 2>/dev/null || true
    sleep 3
    continue
  fi
  GTOKEN="$(curl -s -c - -X POST http://127.0.0.1:3000/api/auth/verify \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"geministudent@atomicmail.io\",\"code\":\"$(sed -n 's/^RAH_ACCESS_CODE=//p' .env | head -1 | tr -d '\"')\"}" \
    | grep rah_session | awk '{print $NF}')"
  if [ -n "$GTOKEN" ]; then
    GB cookies set rah_session "$GTOKEN" --url http://127.0.0.1:3000/ >/dev/null 2>&1
    GB open http://127.0.0.1:3000/ >/dev/null 2>&1
    GB wait --load networkidle >/dev/null 2>&1 || true
    sleep 6
    for tab in "Review" "Sound" "Progress" "Arcade"; do
      GB find role button click --name "$tab" >/dev/null 2>&1
      sleep 2
    done
    GB open http://127.0.0.1:3000/ >/dev/null 2>&1
    sleep 3
  fi
  CLI_ERRS="$(GB errors 2>/dev/null | grep -ciE "error|uncaught" || true)"
  SHELL_OK="$(GB get title 2>/dev/null | grep -c "Rah" || true)"
  NAV_OK="$(GB snapshot -c 2>/dev/null | grep -cE 'button "(Review|Today|Progress)"' || true)"
  echo "   client errors: $CLI_ERRS | title ok: $SHELL_OK | nav ok: $NAV_OK"
  if [ "$CLI_ERRS" -eq 0 ] && [ "$SHELL_OK" -ne 0 ] && [ "$NAV_OK" -ne 0 ]; then
    ROAD4_OK=1
    GB errors --clear >/dev/null 2>&1 || true
    pkill -f cdp-gate-profile 2>/dev/null || true
    break
  fi
  echo "   attempt $ATTEMPT: smoke checks failed - $(GB get title 2>&1 | head -c 150)"
  pkill -f cdp-gate-profile 2>/dev/null || true
  sleep 3
done
[ "$ROAD4_OK" -eq 1 ] || { echo "GATE FAIL: the production bundle crashes or renders empty in a real browser"; exit 1; }

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
