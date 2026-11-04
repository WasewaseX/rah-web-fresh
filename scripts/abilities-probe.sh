#!/usr/bin/env bash
# Task 125 live abilities probe: (1) capability questions must answer in
# learner language, never a raw tool dump; (2) the new tools must actually
# fire (add_cards dry-run under probe, review_forecast, dictionary).
set -uo pipefail
BASE="http://127.0.0.1:3000"
JAR=$(mktemp)

CODE="$(sed -n 's/^RAH_ACCESS_CODE=//p' "$(dirname "$0")/../.env" | head -1 | tr -d '\"')"
curl -s -c "$JAR" -o /dev/null -X POST "$BASE/api/auth/verify" -H "Content-Type: application/json" \
  -d "{\"email\":\"geministudent@atomicmail.io\",\"code\":\"$CODE\"}"

for MSG in "what can you do?" "add the word serendipity to my vocab deck" "what does my review week look like?"; do
  echo "--- abilities probe: \"$MSG\" ---"
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
jargon = [w for w in ('re_ioc_normalize','re_intel_lookup','re_runbook','re_sample_upload','re_case_record','read_state','list_files','read_file','write_file','make_pdf','run_js','web_search','page_reader','coach_skill','set_theme','triage_flags','review_forecast','add_cards','set_goal','dictionary') if w in final]
print('RAW TOOL NAMES IN REPLY:', jargon or '(none)')
print('FINAL REPLY (first 600):')
print(final[:600])
"
done
rm -f "$JAR"
