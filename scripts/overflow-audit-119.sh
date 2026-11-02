#!/usr/bin/env bash
# Task 119: mobile overflow audit. For each of the 12 views at 390px, find
# elements whose box crosses the viewport edge (the holder's "text goes out
# of boxes") and report the worst offenders per view. One Chrome session.
set -uo pipefail
cd /home/z/my-project

CHROME=/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome
PORT=9228
rm -rf /tmp/cdp-profile-119; mkdir -p /tmp/overflow-119

setsid nohup "$CHROME" --headless=new --no-sandbox --disable-gpu \
  --disable-dev-shm-usage --remote-debugging-port=$PORT \
  --window-size=390,844 --user-data-dir=/tmp/cdp-profile-119 \
  about:blank > /tmp/chrome-119.log 2>&1 < /dev/null &
UP=0
for _ in $(seq 1 15); do
  curl -sf --max-time 2 "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1 && { UP=1; break; }
  sleep 1
done
[ "$UP" -eq 1 ] || { echo "FATAL: chrome CDP never came up"; exit 1; }

AB="agent-browser --cdp $PORT"
CODE="$(sed -n 's/^RAH_ACCESS_CODE=//p' .env | head -1 | tr -d '\"')"
TOKEN="$(curl -s -c - -X POST http://127.0.0.1:3000/api/auth/verify \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"geministudent@atomicmail.io\",\"code\":\"$CODE\"}" \
  | grep rah_session | awk '{print $NF}')"
[ -n "$TOKEN" ] || { echo "FATAL: no session token"; pkill -f cdp-profile-119; exit 1; }

$AB open http://127.0.0.1:3000/ >/dev/null 2>&1
sleep 2
$AB cookies set rah_session "$TOKEN" >/dev/null 2>&1
$AB viewport 390 844 >/dev/null 2>&1 || true

PROBE='(() => {
  const vw = document.documentElement.clientWidth;
  const bad = [];
  document.querySelectorAll("body *").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > vw + 1.5 || r.left < -1.5)) {
      const cs = getComputedStyle(el);
      bad.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).slice(0, 70),
        over: Math.round(Math.max(r.right - vw, -r.left)),
        pos: cs.position,
        txt: (el.textContent || "").trim().slice(0, 50),
      });
    }
  });
  bad.sort((a, b) => b.over - a.over);
  const real = bad.filter((b) => b.pos !== "fixed");
  return JSON.stringify({ vw, docW: document.documentElement.scrollWidth, hscroll: document.documentElement.scrollWidth > vw + 1, count: real.length, top: real.slice(0, 6) });
})()'

VIEWS="today: review: writing: speaking: listening: reading: tutor: grammar: sound: placement: arcade: progress:"
for v in today review writing speaking listening reading tutor grammar sound placement arcade progress; do
  $AB open "http://127.0.0.1:3000/#$v" >/dev/null 2>&1
  sleep 1.6
  OUT=$($AB eval "$PROBE" 2>/dev/null | tail -1)
  echo "== $v => $OUT" | head -c 700
  echo
done

pkill -f cdp-profile-119 2>/dev/null || true
echo "overflow audit done"
