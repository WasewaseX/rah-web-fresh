#!/usr/bin/env bash
# Task 118: visual verification of the Daily English Mission card on Today.
# One script, one Chrome session (the sandbox reaps process groups when a
# tool call ends). Shots land in /tmp/shots-118; view them with Read.
set -uo pipefail
cd /home/z/my-project

CHROME=/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome
PORT=9226
OUT=/tmp/shots-118
rm -rf "$OUT" /tmp/cdp-profile-118; mkdir -p "$OUT"

setsid nohup "$CHROME" --headless=new --no-sandbox --disable-gpu \
  --disable-dev-shm-usage --remote-debugging-port=$PORT \
  --window-size=1440,900 --user-data-dir=/tmp/cdp-profile-118 \
  about:blank > /tmp/chrome-118.log 2>&1 < /dev/null &
UP=0
for _ in $(seq 1 15); do
  curl -sf --max-time 2 "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1 && { UP=1; break; }
  sleep 1
done
[ "$UP" -eq 1 ] || { echo "FATAL: chrome CDP never came up"; exit 1; }
echo "chrome up on $PORT"

AB="agent-browser --cdp $PORT"
CODE="$(sed -n 's/^RAH_ACCESS_CODE=//p' .env | head -1 | tr -d '\"')"

TOKEN="$(curl -s -c - -X POST http://127.0.0.1:3000/api/auth/verify \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"geministudent@atomicmail.io\",\"code\":\"$CODE\"}" \
  | grep rah_session | awk '{print $NF}')"
[ -n "$TOKEN" ] || { echo "FATAL: no session token"; pkill -f cdp-profile-118; exit 1; }
# Task 115 doctrine: open the page FIRST so the cookie has a domain context,
# then set, then reopen - otherwise the harness silently screenshots LOGIN.
$AB open http://127.0.0.1:3000/ >/dev/null 2>&1
sleep 2
$AB cookies set rah_session "$TOKEN" >/dev/null 2>&1
$AB open http://127.0.0.1:3000/ >/dev/null 2>&1
$AB wait --load networkidle >/dev/null 2>&1 || true
sleep 2
sleep 3
$AB screenshot "$OUT/today-desktop.png" >/dev/null 2>&1 && echo "shot: today-desktop"
$AB errors 2>/dev/null | tail -2 || true

# 2. mission text present?
$AB text 2>/dev/null | grep -i -A1 "mission" | head -6 || echo "MISSION TEXT NOT FOUND"

# 3. mobile Today
$AB viewport 390 844 >/dev/null 2>&1 || true
sleep 2
$AB screenshot "$OUT/today-mobile.png" >/dev/null 2>&1 && echo "shot: today-mobile"

echo "done"
pkill -f cdp-profile-118 2>/dev/null || true
