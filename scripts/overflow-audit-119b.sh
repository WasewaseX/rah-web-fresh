#!/usr/bin/env bash
# Task 119 v2: mobile overflow audit. Two signals per view at 390px:
#   (1) TRUE viewport bleeders: element right edge past the viewport with NO
#       clipping ancestor (scroll/hidden/auto) - real "out of the screen".
#   (2) Text out of its box: a leaf-ish element whose scrollWidth exceeds its
#       clientWidth with no scrollable ancestor - text escaping its container.
set -uo pipefail
cd /home/z/my-project

CHROME=/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome
PORT=9229
rm -rf /tmp/cdp-profile-119b

setsid nohup "$CHROME" --headless=new --no-sandbox --disable-gpu \
  --disable-dev-shm-usage --remote-debugging-port=$PORT \
  --window-size=390,844 --user-data-dir=/tmp/cdp-profile-119b \
  about:blank > /tmp/chrome-119b.log 2>&1 < /dev/null &
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
[ -n "$TOKEN" ] || { echo "FATAL: no session token"; pkill -f cdp-profile-119b; exit 1; }

$AB open http://127.0.0.1:3000/ >/dev/null 2>&1
sleep 2
$AB cookies set rah_session "$TOKEN" >/dev/null 2>&1

PROBE='(() => {
  const vw = document.documentElement.clientWidth;
  const clipped = (el) => {
    let a = el.parentElement;
    while (a && a !== document.body) {
      const cs = getComputedStyle(a);
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) return true;
      a = a.parentElement;
    }
    return false;
  };
  const bleed = [], textbox = [];
  document.querySelectorAll("body *").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 2 && !clipped(el)) {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed") {
        bleed.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 60), over: Math.round(r.right - vw), txt: (el.textContent || "").trim().slice(0, 40) });
      }
    }
    const txt = (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 ? el.textContent : "").trim();
    if (txt && el.scrollWidth > el.clientWidth + 3) {
      const cs = getComputedStyle(el);
      if (/(nowrap|pre)/.test(cs.whiteSpace) || !clipped(el)) {
        textbox.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 60), over: el.scrollWidth - el.clientWidth, txt: txt.slice(0, 44) });
      }
    }
  });
  bleed.sort((a, b) => b.over - a.over);
  textbox.sort((a, b) => b.over - a.over);
  return JSON.stringify({ vw, hscroll: document.documentElement.scrollWidth > vw + 1, bleed: bleed.length, bleedTop: bleed.slice(0, 3), boxes: textbox.length, boxTop: textbox.slice(0, 5) });
})()'

for v in today review writing speaking listening reading tutor grammar sound placement arcade progress; do
  $AB viewport 390 844 >/dev/null 2>&1 || true
  $AB open "http://127.0.0.1:3000/#$v" >/dev/null 2>&1
  sleep 2
  OUT=$($AB eval "$PROBE" 2>/dev/null | tail -1)
  echo "== $v"
  echo "$OUT" | python3 -c "
import json,sys
try:
    d = json.loads(json.loads(sys.stdin.read())) if sys.stdin.read else None
except Exception:
    d = None
" 2>/dev/null || true
  echo "$OUT" | head -c 900
  echo
done

$AB screenshot /tmp/overflow-119/violin.png >/dev/null 2>&1 || true
pkill -f cdp-profile-119b 2>/dev/null || true
echo "overflow audit v2 done"
