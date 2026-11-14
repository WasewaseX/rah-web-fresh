#!/usr/bin/env bash
# Task 141 UI verification: the Guide panel's "this week" chip renders from the
# real /api/guide-practice payload in the production build.
set -uo pipefail
BASE="http://127.0.0.1:3000"
CHROME=/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome
PORT=9251
rm -rf /tmp/chip-profile
setsid nohup "$CHROME" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --remote-debugging-port=$PORT --window-size=1440,900 --user-data-dir=/tmp/chip-profile \
  about:blank > /tmp/chip-chrome.log 2>&1 < /dev/null &
for _ in $(seq 1 15); do
  curl -sf --max-time 2 "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1 && break
  sleep 1
done
B() { agent-browser --cdp $PORT "$@"; }

JAR=$(mktemp)
CODE="$(sed -n 's/^RAH_ACCESS_CODE=//p' "$(dirname "$0")/../.env" | head -1 | tr -d '\"')"
TOKEN="$(curl -s -c - -X POST "$BASE/api/auth/verify" -H 'Content-Type: application/json' \
  -d "{\"email\":\"geministudent@atomicmail.io\",\"code\":\"$CODE\"}" | grep rah_session | awk '{print $NF}')"
[ -n "$TOKEN" ] || { echo "FAIL: no session token"; exit 1; }

echo "--- payload check (authenticated) ---"
curl -s -b "$JAR" -c "$JAR" "$BASE/api/guide-practice" | head -c 120
echo
COOKED_JAR="$JAR"
printf '.127.0.0.1\tTRUE\t/\tFALSE\t0\trah_session\t%s\n' "$TOKEN" > "$JAR.2"
curl -s -b "$JAR.2" "$BASE/api/guide-practice" | python3 -c "import json,sys; d=json.load(sys.stdin); print('week block:', json.dumps(d.get('week')))" || true

B cookies set rah_session "$TOKEN" --url "$BASE/" >/dev/null 2>&1
B open "$BASE/" >/dev/null 2>&1
B wait --load networkidle >/dev/null 2>&1 || true
sleep 4
B find role button click --name "Progress" >/dev/null 2>&1
sleep 4
# Targeted boolean evals (agent-browser eval output can truncate long text).
GATE_GUIDE="$(B eval "document.body.innerText.includes('B1-C1 guide map') ? 'PRESENT' : 'ABSENT'" 2>/dev/null || echo "EVAL_FAIL")"
echo "guide map: $GATE_GUIDE"
CHIP="$(B eval "(document.body.innerText.match(/this week: \d+ requests?/)||['CHIP_ABSENT'])[0]" 2>/dev/null || echo "EVAL_FAIL")"
echo "chip eval: $CHIP"
if printf '%s' "$CHIP" | grep -qE "this week: [0-9]+ requests?"; then
  echo "WEEK CHIP: PRESENT - $CHIP"
  ERRS="$(B errors 2>/dev/null | grep -ciE 'error|uncaught' || true)"
  echo "client errors: $ERRS"
  B errors --clear >/dev/null 2>&1 || true
else
  echo "WEEK CHIP: MISSING"
fi
pkill -f chip-profile 2>/dev/null || true
