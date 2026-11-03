#!/usr/bin/env bash
# Live RE probe: does the canonical loop reach for the new RE tools on a
# malware-analysis ask? Probe mode (x-rah-probe:1) = zero writes, zero rewards.
set -uo pipefail
BASE="http://127.0.0.1:3000"
JAR=$(mktemp)

CODE=$(curl -s -X POST "$BASE/api/auth/request-code" -H "Content-Type: application/json" \
  -d '{"email":"geministudent@atomicmail.io"}' | python3 -c "import json,sys; print(json.load(sys.stdin).get('devCode',''))")
curl -s -c "$JAR" -o /dev/null -X POST "$BASE/api/auth/verify" -H "Content-Type: application/json" \
  -d "{\"email\":\"geministudent@atomicmail.io\",\"code\":\"$CODE\"}"

echo "--- RE probe: IOC triage on truncated hash + IOCs ---"
curl -s -N -b "$JAR" --max-time 170 -X POST "$BASE/api/coach-agent" \
  -H "Content-Type: application/json" -H "x-rah-probe: 1" \
  -d '{"message":"Analysis request: abuse.ch gave me 1124e79d23f3ecdaceb348affad9d975231140146101e7cc and VirusTotal showed nothing. Also in my notes: 45.33.32.156 and hxxp://cdn-update[.]top/p.bin. Triage this for me.","view":"home"}' \
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
        print(f\"  {e.get('type')}: {str(e.get('label', ''))[:140]} {str(e.get('detail', ''))[:140]}\")
print('TOOLS USED:', tools or '(none)')
print('RE TOOL HIT:', any(t.startswith('re_') for t in tools))
print('FINAL REPLY (first 500):')
print(final[:500])
"
rm -f "$JAR"
