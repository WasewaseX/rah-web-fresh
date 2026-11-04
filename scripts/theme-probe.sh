#!/usr/bin/env bash
# Task 124 live theme probe: does the canonical loop repaint on a color-only
# theme ask ("make the UI theme blue again" - the exact holder phrasing that
# once fell through)? Probe mode (x-rah-probe:1) = zero writes.
set -uo pipefail
BASE="http://127.0.0.1:3000"
JAR=$(mktemp)

CODE="$(sed -n 's/^RAH_ACCESS_CODE=//p' "$(dirname "$0")/../.env" | head -1 | tr -d '\"')"
curl -s -c "$JAR" -o /dev/null -X POST "$BASE/api/auth/verify" -H "Content-Type: application/json" \
  -d "{\"email\":\"geministudent@atomicmail.io\",\"code\":\"$CODE\"}"

for MSG in "make the UI theme blue again" "go green please"; do
  echo "--- theme probe: \"$MSG\" ---"
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
    elif e.get('type') == 'observe':
        print(f\"  observe: {e.get('label', '')[:110]}\")
    elif e.get('type') == 'final':
        final = e.get('reply', '')
    elif e.get('type') in ('error', 'done'):
        print(f\"  {e.get('type')}: {str(e.get('label', ''))[:140]}\")
print('TOOLS USED:', tools or '(none)')
print('SET_THEME HIT:', 'set_theme' in tools)
print('FINAL REPLY (first 400):')
print(final[:400])
"
done
rm -f "$JAR"
