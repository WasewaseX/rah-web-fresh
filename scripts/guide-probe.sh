#!/usr/bin/env bash
# Task 130 live probe: does the canonical loop answer a level-contents question
# from the embedded guide map (study_guide tool), in learner language?
# Probe mode (x-rah-probe:1) = zero writes.
set -uo pipefail
BASE="http://127.0.0.1:3000"
JAR=$(mktemp)

CODE="$(sed -n 's/^RAH_ACCESS_CODE=//p' "$(dirname "$0")/../.env" | head -1 | tr -d '\"')"
curl -s -c "$JAR" -o /dev/null -X POST "$BASE/api/auth/verify" -H "Content-Type: application/json" \
  -d "{\"email\":\"geministudent@atomicmail.io\",\"code\":\"$CODE\"}"

for MSG in "what grammar do I need for B2 exactly?" "give me the B1 checklist"; do
  echo "--- guide probe: \"$MSG\" ---"
  curl -s -N -b "$JAR" --max-time 170 -X POST "$BASE/api/coach-agent" \
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
ok = any('study_guide' in t or 'guide' in t.lower() for t in tools)
print(f\"  PROBE VERDICT: {'PASS - study_guide ran' if ok else 'CHECK - no guide tool call'}\")
"
  echo
done
