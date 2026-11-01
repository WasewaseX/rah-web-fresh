#!/usr/bin/env bash
# Task 115: visual verification capture - screenshots of the surfaces the
# stimulation wave touched. One script, one Chrome session (the sandbox reaps
# process groups when a tool call ends).
# Usage: bash scripts/ui-capture-115.sh
set -uo pipefail
cd /home/z/my-project

CHROME=/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome
PORT=9223
OUT=/tmp/shots-115
rm -rf "$OUT" /tmp/cdp-profile-115; mkdir -p "$OUT"

setsid nohup "$CHROME" --headless=new --no-sandbox --disable-gpu \
  --disable-dev-shm-usage --remote-debugging-port=$PORT \
  --window-size=1440,900 --user-data-dir=/tmp/cdp-profile-115 \
  about:blank > /tmp/chrome-115.log 2>&1 < /dev/null &
UP=0
for _ in $(seq 1 15); do
  curl -sf --max-time 2 "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1 && { UP=1; break; }
  sleep 1
done
[ "$UP" -eq 1 ] || { echo "FATAL: chrome CDP never came up"; exit 1; }
echo "chrome up on $PORT"

AB="agent-browser --cdp $PORT"

# 1. login screen (pre-auth, first impression)
$AB open http://127.0.0.1:3000/ >/dev/null 2>&1
sleep 4
$AB screenshot "$OUT/login.png" >/dev/null 2>&1 && echo "shot: login"

# 2. cookie login
TOKEN="$(curl -s -c - -X POST http://127.0.0.1:3000/api/auth/verify \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"geministudent@atomicmail.io\",\"code\":\"$(sed -n 's/^RAH_ACCESS_CODE=//p' .env | head -1 | tr -d '\"')\"}" \
  | grep rah_session | awk '{print $NF}')"
[ -n "$TOKEN" ] || { echo "FATAL: no session token"; pkill -f cdp-profile-115; exit 1; }
$AB cookies set rah_session "$TOKEN" >/dev/null 2>&1
# Full reload (plain / - a hash-only change would NOT re-run the auth effect)
$AB open http://127.0.0.1:3000/ >/dev/null 2>&1
$AB wait --load networkidle >/dev/null 2>&1 || true
sleep 6
echo "title: $($AB get title 2>/dev/null)"

# 3. desktop views
$AB screenshot "$OUT/today.png" >/dev/null 2>&1 && echo "shot: today"
$AB find role button click --name "Review" >/dev/null 2>&1; sleep 4
$AB screenshot "$OUT/review.png" >/dev/null 2>&1 && echo "shot: review"
$AB find role button click --name "Progress" >/dev/null 2>&1; sleep 4
$AB screenshot "$OUT/progress.png" >/dev/null 2>&1 && echo "shot: progress"
$AB find role button click --name "Arcade" >/dev/null 2>&1; sleep 4
$AB screenshot "$OUT/arcade.png" >/dev/null 2>&1 && echo "shot: arcade"

# 4. mobile viewport - Today (full reload after viewport change)
$AB set viewport 390 844 >/dev/null 2>&1
$AB open http://127.0.0.1:3000/ >/dev/null 2>&1
sleep 5
$AB screenshot "$OUT/mobile-today.png" >/dev/null 2>&1 && echo "shot: mobile-today"

# 5. client errors?
echo "--- errors ---"
$AB errors 2>/dev/null | head -8

pkill -f cdp-profile-115 2>/dev/null
echo "done"
ls -la "$OUT"
