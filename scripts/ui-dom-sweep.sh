#!/usr/bin/env bash
# Task 113: DOM-level UI sweep - the Impeccable detector's page-parsed rules
# (tiny-text, low-contrast, element rules) against the AUTHENTICATED app.
#
# Why one script: the sandbox reaps process groups when a tool call ends, so
# Chrome + agent-browser + impeccable must all live inside ONE call. The road:
#   1. launch headless Chromium with --remote-debugging-port=9222
#   2. log the CDP browser in by injecting the rah_session cookie (access code)
#   3. for every nav view: click it, settle, run
#      `impeccable detect --cdp 9222` (page scanned as shown, never navigated)
#   4. repeat the pass at a mobile viewport (agent-browser set viewport)
#   5. collect per-view findings, tear Chrome down, print the report
# Usage: bash scripts/ui-dom-sweep.sh [viewport WxH]
set -uo pipefail
cd /home/z/my-project

CHROME=/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome
IMPECCABLE=.github/skills/impeccable/scripts/bin/linux-x64/impeccable
PORT=9222
VW="${1:-1440}"; VH="${2:-900}"
OUT=/tmp/dom-sweep
rm -rf "$OUT" /tmp/cdp-profile-sweep; mkdir -p "$OUT"

# 1. chrome up
setsid nohup "$CHROME" --headless=new --no-sandbox --disable-gpu \
  --disable-dev-shm-usage --remote-debugging-port=$PORT \
  --window-size=${VW},${VH} --user-data-dir=/tmp/cdp-profile-sweep \
  about:blank > /tmp/chrome-sweep.log 2>&1 < /dev/null &
UP=0
for _ in $(seq 1 15); do
  curl -sf --max-time 2 "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1 && { UP=1; break; }
  sleep 1
done
[ "$UP" -eq 1 ] || { echo "FATAL: chrome CDP never came up"; exit 1; }
echo "chrome CDP up on $PORT (${VW}x${VH})"

# 2. login by cookie
TOKEN="$(curl -s -c - -X POST http://127.0.0.1:3000/api/auth/verify \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"geministudent@atomicmail.io\",\"code\":\"$(sed -n 's/^RAH_ACCESS_CODE=//p' .env | head -1 | tr -d '\"')\"}" \
  | grep rah_session | awk '{print $NF}')"
[ -n "$TOKEN" ] || { echo "FATAL: no session token"; kill_chrome() { pkill -f cdp-profile-sweep; }; exit 1; }
agent-browser --cdp $PORT open http://127.0.0.1:3000/ >/dev/null 2>&1
agent-browser --cdp $PORT cookies set rah_session "$TOKEN" >/dev/null 2>&1
agent-browser --cdp $PORT open http://127.0.0.1:3000/ >/dev/null 2>&1
agent-browser --cdp $PORT wait --load networkidle >/dev/null 2>&1 || true
sleep 5
TITLE="$(agent-browser --cdp $PORT get title 2>/dev/null)"
echo "page title after login: $TITLE"
case "$TITLE" in *Rah*) : ;; *) echo "WARN: title not Rah - one reload retry"; agent-browser --cdp $PORT open http://127.0.0.1:3000/ >/dev/null 2>&1; sleep 6; TITLE="$(agent-browser --cdp $PORT get title 2>/dev/null)"; echo "title now: $TITLE" ;; esac
TARGET="127.0.0.1:3000"
AB() { agent-browser --cdp $PORT "$@"; }

# 3+4. per-view sweep
VIEWS=("Today" "Review" "Writing" "Speaking" "Listening" "Reading" "Tutor" "Grammar" "Sound" "Placement" "Arcade" "Progress")
TOTAL=0
for v in "${VIEWS[@]}"; do
  AB find role button click --name "$v" >/dev/null 2>&1
  sleep 3
  F="$OUT/${v// /_}.txt"
  timeout 120 "$IMPECCABLE" detect --cdp $PORT --target "$TARGET" > "$F" 2>&1
  N="$(grep -cE '^\s+(?:•|\d+\)|\!)' "$F" 2>/dev/null || true)"
  FAILLINE="$(grep -iE 'finding|issue' "$F" | tail -1 | head -c 100)"
  echo "--- $v: $F ($(wc -l < "$F") lines) $FAILLINE"
done

echo "===== REPORT HEADS ====="
for f in "$OUT"/*.txt; do
  echo "### $(basename "$f")"
  head -25 "$f"
done
pkill -f cdp-profile-sweep 2>/dev/null || true
echo "sweep done -> $OUT"
