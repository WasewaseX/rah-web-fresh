#!/usr/bin/env bash
# Task 117: visual verification of the professional-UI wave + logo.
# One script, one Chrome session (the sandbox reaps process groups when a
# tool call ends). Shots land in /tmp/shots-117; view them with Read.
set -uo pipefail
cd /home/z/my-project

CHROME=/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome
PORT=9224
OUT=/tmp/shots-117
rm -rf "$OUT" /tmp/cdp-profile-117; mkdir -p "$OUT"

setsid nohup "$CHROME" --headless=new --no-sandbox --disable-gpu \
  --disable-dev-shm-usage --remote-debugging-port=$PORT \
  --window-size=1440,900 --user-data-dir=/tmp/cdp-profile-117 \
  about:blank > /tmp/chrome-117.log 2>&1 < /dev/null &
UP=0
for _ in $(seq 1 15); do
  curl -sf --max-time 2 "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1 && { UP=1; break; }
  sleep 1
done
[ "$UP" -eq 1 ] || { echo "FATAL: chrome CDP never came up"; exit 1; }
echo "chrome up on $PORT"

AB="agent-browser --cdp $PORT"

# 1. login screen (the new logo is the first impression)
$AB open http://127.0.0.1:3000/ >/dev/null 2>&1
sleep 4
$AB screenshot "$OUT/login.png" >/dev/null 2>&1 && echo "shot: login"

# 2. cookie login
TOKEN="$(curl -s -c - -X POST http://127.0.0.1:3000/api/auth/verify \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"geministudent@atomicmail.io\",\"code\":\"$(sed -n 's/^RAH_ACCESS_CODE=//p' .env | head -1 | tr -d '\"')\"}" \
  | grep rah_session | awk '{print $NF}')"
[ -n "$TOKEN" ] || { echo "FATAL: no session token"; pkill -f cdp-profile-117; exit 1; }
$AB cookies set rah_session "$TOKEN" >/dev/null 2>&1
$AB open http://127.0.0.1:3000/ >/dev/null 2>&1
$AB wait --load networkidle >/dev/null 2>&1 || true
sleep 6
echo "title: $($AB get title 2>/dev/null)"

# 3. the redesigned surfaces
$AB screenshot "$OUT/today.png" >/dev/null 2>&1 && echo "shot: today"
$AB find role button click --name "Progress" >/dev/null 2>&1; sleep 4
$AB screenshot "$OUT/progress.png" >/dev/null 2>&1 && echo "shot: progress"
$AB find role button click --name "Writing" >/dev/null 2>&1; sleep 4
$AB screenshot "$OUT/writing-pick.png" >/dev/null 2>&1 && echo "shot: writing-pick"

# 4. mobile viewport - Today (full reload after viewport change)
$AB set viewport 390 844 >/dev/null 2>&1
$AB open http://127.0.0.1:3000/ >/dev/null 2>&1
sleep 5
$AB screenshot "$OUT/mobile-today.png" >/dev/null 2>&1 && echo "shot: mobile-today"

# 5. client errors?
echo "--- errors ---"
$AB errors 2>/dev/null | head -8

pkill -f cdp-profile-117 2>/dev/null
echo "done"
ls -la "$OUT"
