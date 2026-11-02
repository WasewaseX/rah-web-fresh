#!/usr/bin/env bash
# Task 117: verify the Writing register dial renders in the live DOM.
set -uo pipefail
cd /home/z/my-project
CHROME=/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome
PORT=9225
rm -rf /tmp/cdp-profile-117d
setsid nohup "$CHROME" --headless=new --no-sandbox --disable-gpu \
  --disable-dev-shm-usage --remote-debugging-port=$PORT \
  --window-size=1440,900 --user-data-dir=/tmp/cdp-profile-117d \
  about:blank > /tmp/chrome-117d.log 2>&1 < /dev/null &
for _ in $(seq 1 15); do curl -sf --max-time 2 "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1 && break; sleep 1; done
AB="agent-browser --cdp $PORT"
TOKEN="$(curl -s -c - -X POST http://127.0.0.1:3000/api/auth/verify \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"geministudent@atomicmail.io\",\"code\":\"$(sed -n 's/^RAH_ACCESS_CODE=//p' .env | head -1 | tr -d '\"')\"}" \
  | grep rah_session | awk '{print $NF}')"
$AB cookies set rah_session "$TOKEN" --url http://127.0.0.1:3000/ >/dev/null 2>&1
$AB open "http://127.0.0.1:3000/#write" >/dev/null 2>&1
sleep 5
TITLE="$($AB get title 2>/dev/null)"
echo "title: $TITLE"
case "$TITLE" in *Rah*) : ;; *) echo "FATAL: authed shell not detected (got: $TITLE)"; pkill -f cdp-profile-117d; exit 1 ;; esac
$AB find text "Some people believe schools should teach coding" click >/dev/null 2>&1 || true
sleep 3
echo "--- dial check ---"
$AB find text "Who grades this?" text 2>&1 | head -2
$AB find text "Exam board" text 2>&1 | head -2
$AB find text "Workplace" text 2>&1 | head -2
$AB find text "A friend reads this" text 2>&1 | head -2
$AB find text "Casual" click >/dev/null 2>&1; sleep 1
$AB find text "A friend reads this" text 2>&1 | head -2
$AB screenshot /tmp/shots-117/writing-dial.png >/dev/null 2>&1 && echo "shot: writing-dial"
echo "--- errors ---"
$AB errors 2>/dev/null | head -4
pkill -f cdp-profile-117d 2>/dev/null
echo done
