#!/usr/bin/env bash
# Task 107 - PERSISTENT surface-sweep e2e (the repeatable artifact the Task 106
# verification should have left behind). Drives every hash-routed surface in a
# real browser, then reports per-surface: render proof (main text length),
# page errors, console errors. Exit 1 on any failure.
#
# Usage:  bash scripts/e2e-surface-sweep.sh [BASE_URL]
#         BASE_URL default http://127.0.0.1:3000
# Auth:   expects an existing rah_session cookie in the agent-browser session
#         (see scripts/e2e-login.sh) OR the app's signed-out home render.
set -u
BASE="${1:-http://127.0.0.1:3000}"
OUT="db/evidence/surface-sweep-latest.log"
mkdir -p db/evidence
: > "$OUT"

# Surfaces: hash -> label (strand aliases included; they must normalize, not break)
SURFACES=(
  "#today:Today(home alias)"
  "#home:Home"
  "#review:Review"
  "#writing:Writing(alias)"
  "#write:Writing"
  "#speaking:Speaking(alias)"
  "#speak:Speaking"
  "#listening:Listening(alias)"
  "#listen:Listening"
  "#reading:Reading(alias)"
  "#read:Reading"
  "#tutor:Tutor"
  "#grammar:Grammar"
  "#sound:Sound"
  "#placement:Placement"
  "#arcade:Arcade"
  "#progress:Progress"
  "#checkpoint:Checkpoint"
  "#settings:AISettings"
)

FAIL=0
echo "surface-sweep start $(date -u +%Y-%m-%dT%H:%M:%SZ) base=$BASE" | tee -a "$OUT"
for entry in "${SURFACES[@]}"; do
  hash="${entry%%:*}"; label="${entry#*:}"
  agent-browser open "$BASE/$hash" >/dev/null 2>&1
  agent-browser wait --load networkidle >/dev/null 2>&1
  sleep 1.2
  ERRS=$(agent-browser errors 2>/dev/null | grep -v "✓" | grep -v "^\s*$" | wc -l)
  MAINLEN=$(agent-browser eval "document.querySelector('main')?.innerText.length ?? 0" 2>/dev/null | tr -dc '0-9')
  HEADING=$(agent-browser eval "document.querySelector('main h1')?.innerText ?? '(none)'" 2>/dev/null | head -1)
  STATUS=PASS
  [ "${MAINLEN:-0}" -lt 40 ] && { STATUS=FAIL; FAIL=1; }
  [ "${ERRS:-0}" -gt 0 ] && { STATUS=FAIL; FAIL=1; }
  printf "%-14s %-20s %-6s main=%-5s errs=%-2s h1=%s\n" "$hash" "$label" "$STATUS" "${MAINLEN:-0}" "$ERRS" "$HEADING" | tee -a "$OUT"
done

echo "---" | tee -a "$OUT"
echo "overall: $([ $FAIL -eq 0 ] && echo ALL-PASS || echo FAILURES-PRESENT)" | tee -a "$OUT"
exit $FAIL
