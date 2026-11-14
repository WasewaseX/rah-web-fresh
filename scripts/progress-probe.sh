#!/usr/bin/env bash
# Task 140 live probe: does the canonical loop answer a past-activity question
# ("how did my week go") from the REAL drill ledger (progress_review tool),
# with honest "requested" labeling? Probe mode (x-rah-probe:1) = zero writes.
set -uo pipefail
BASE="http://127.0.0.1:3000"
JAR=$(mktemp)

CODE="$(sed -n 's/^RAH_ACCESS_CODE=//p' "$(dirname "$0")/../.env" | head -1 | tr -d '\"')"
curl -s -c "$JAR" -o /dev/null -X POST "$BASE/api/auth/verify" -H "Content-Type: application/json" \
  -d "{\"email\":\"geministudent@atomicmail.io\",\"code\":\"$CODE\"}"

VERDICTS=()
for MSG in "how did my week go?" "what did I study this week?"; do
  echo "--- progress probe: \"$MSG\" ---"
  OUT=$(curl -s -N -b "$JAR" --max-time 170 -X POST "$BASE/api/coach-agent" \
    -H "Content-Type: application/json" -H "x-rah-probe: 1" \
    -d "{\"message\":\"$MSG\",\"view\":\"home\"}" \
    | python3 -c "
import json, sys
tools, final = [], ''
for line in sys.stdin:
    if not line.startswith('data: '):
        continue
    try:
        e = json.loads(line[6:])
    except Exception:
        continue
    if e.get('type') == 'tool':
        tools.append(e.get('label', ''))
        print(f\"  tool: {e.get('label')}\")
    if e.get('type') == 'final':
        final = e.get('reply', '')
print(f\"  tools used: {tools}\")
print(f\"  final ({len(final)} chars): {final[:400]}\")
ok = any('progress_review' in t for t in tools)
honest = ('request' in final.lower()) or ('completed' not in final.lower())
print(f\"  PROBE VERDICT: {'PASS - progress_review ran' if ok else 'CHECK - no progress_review call'}\")
print(f\"  HONESTY: {'labels look requested-safe' if honest else 'CHECK - reply may claim completions'}\")
")
  echo "$OUT"
  VERDICTS+=("$OUT")
  echo
done
if printf '%s\n' "${VERDICTS[@]}" | grep -q "PASS - progress_review ran"; then
  echo "PROBE SUITE: PASS (at least one past-activity ask fired progress_review)"
else
  echo "PROBE SUITE: FAIL"
  exit 1
fi
