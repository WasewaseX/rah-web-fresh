#!/usr/bin/env bash
# Walk every main tab at 390px, measure horizontal overflow, screenshot each.
set -uo pipefail
AB="agent-browser"

check_view () {
  local name="$1"
  local m
  m=$($AB eval "JSON.stringify({view: (document.querySelector('h1,h2')||{}).textContent||'', sw: document.documentElement.scrollWidth, iw: window.innerWidth, worst: (function(){var w=0,who='';document.querySelectorAll('main *,[class*=sidebar] *').forEach(function(el){var r=el.getBoundingClientRect();if(r.width>0&&r.right>w){w=r.right;who=el.tagName+'.'+((el.className&&el.className.toString?el.className.toString():'').slice(0,50));}});return who+' right='+Math.round(w);})()})")
  echo "== $name: $m"
  $AB screenshot "/tmp/render/mob-$name.png" >/dev/null
}

click_nav () {
  local name="$1"
  local ref
  ref=$($AB snapshot -i -c 2>/dev/null | grep -E "button \"$name\"" | head -1 | sed -E 's/.*\[ref=(e[0-9]+)\].*/@\1/')
  if [ ! "$ref" =~ ^@e[0-9]+$ ]; then echo "== $name: NAV REF NOT RESOLVED ('$ref')"; return 1; fi
  $AB click "$ref" >/dev/null 2>&1
  sleep 1.2
}

# Dismiss the PWA install banner so it cannot intercept clicks.
$AB find text "Later" click >/dev/null 2>&1 || true
sleep 0.5

for v in Review Writing Speaking Listening Reading Progress Arcade; do
  click_nav "$v" || true
  check_view "$v"
done

# Coach sidebar (chat): long tokens live here - highest overflow risk.
ref=$($AB snapshot -i -c 2>/dev/null | grep -E 'button "Talk to the coach"' | head -1 | sed -E 's/.*\[ref=(e[0-9]+)\].*/@\1/')
if [ -n "$ref" ]; then $AB click "$ref" >/dev/null 2>&1; sleep 1.5; check_view coach; fi
