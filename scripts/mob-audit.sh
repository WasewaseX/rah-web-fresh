#!/usr/bin/env bash
# Mobile (390x844) UI audit: horizontal-overflow detector + screenshots.
# Pattern per memo: open page -> set session cookie -> reload (else login page).
set -uo pipefail
BASE="http://127.0.0.1:3000"
AB="agent-browser"

# --- session cookie via the owner access-code path (same as deploy-gate) ---
OWNER=$(grep -E '^RAH_OWNER_EMAILS=' .env | cut -d= -f2- | cut -d, -f1)
AC=$(grep -E '^RAH_ACCESS_CODE=' .env | cut -d= -f2-)
JAR=$(mktemp)
CODE_JSON=$(curl -s -X POST "$BASE/api/auth/request-code" -H "Content-Type: application/json" -d "{\"email\":\"$OWNER\"}")
# SMTP path returns no devCode; the owner access-code path takes RAH_ACCESS_CODE directly.
curl -s -c "$JAR" -o /dev/null -X POST "$BASE/api/auth/verify" -H "Content-Type: application/json" \
  -d "{\"email\":\"$OWNER\",\"code\":\"$AC\"}"
SESS=$(grep rah_session "$JAR" | awk '{print $NF}')
if [ -z "$SESS" ]; then echo "AUTH FAILED - no rah_session cookie"; exit 1; fi
echo "auth ok (cookie len ${#SESS})"

$AB close >/dev/null 2>&1 || true
$AB set viewport 390 844 >/dev/null
$AB open "$BASE" >/dev/null
$AB cookies set rah_session "$SESS" >/dev/null
$AB reload >/dev/null
sleep 2

check_view () {
  local name="$1"
  local m
  m=$($AB eval "JSON.stringify({sw: document.documentElement.scrollWidth, iw: window.innerWidth, broken: (function(){var bad=[];document.querySelectorAll('body *').forEach(function(el){var r=el.getBoundingClientRect();if(r.width>0&&(r.right>window.innerWidth+1||r.left<-1)&&!el.closest('script')){var cls=(el.className&&el.className.toString?el.className.toString():'').slice(0,40);if(bad.length<6)bad.push(el.tagName+'.'+cls+' w='+Math.round(r.width)+' right='+Math.round(r.right));}});return bad;})()})")
  echo "== $name: $m"
  $AB screenshot "/tmp/render/mob-$name.png" >/dev/null
}

rm -rf /tmp/render && mkdir -p /tmp/render
check_view home
echo "--- navigate via bottom nav / tabs ---"
$AB snapshot -i -c 2>/dev/null | grep -iE 'button|tab|link' | head -25
