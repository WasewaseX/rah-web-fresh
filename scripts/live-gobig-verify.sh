#!/usr/bin/env bash
# Live verification battery for the go-big session (Tasks: shadowing, mission
# recap, write-draft sync, listenvocab, audio caps). Zero learner-ledger
# damage: everything is probe-mode (x-rah-probe:1) except the two
# self-cleaning writes (write-draft Setting row + one UserCard mint, both
# deleted afterwards). Run AFTER build-prod + ensure-server.
set -uo pipefail
BASE="http://127.0.0.1:3000"
JAR=$(mktemp)
PG="/home/z/rah-pg/pgvenv/lib/python3.12/site-packages/pgserver/pginstall/bin/psql"
export PGHOST=127.0.0.1 PGPORT=5433 PGUSER=postgres PGDATABASE=rah
export PGPASSWORD="$(grep -E '^DATABASE_URL=' /home/z/my-project/.env | head -1 | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')"

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ok  $1"; }
bad() { FAIL=$((FAIL+1)); echo "FAIL  $1${2:+ - $2}"; }

CODE="$(sed -n 's/^RAH_ACCESS_CODE=//p' /home/z/my-project/.env | head -1 | tr -d '"')"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -c "$JAR" -X POST "$BASE/api/auth/verify" -H "Content-Type: application/json" -d "{\"email\":\"geministudent@atomicmail.io\",\"code\":\"$CODE\"}")
[ "$HTTP" = "200" ] && ok "auth verify" || bad "auth verify" "HTTP $HTTP"

SS0=$($PG -t -A -c "SELECT count(*) FROM \"SpeakSession\"")
UC0=$($PG -t -A -c "SELECT count(*) FROM \"UserCard\"")
echo "ledger before: SpeakSession=$SS0 UserCard=$UC0"

echo "--- A. shadowing GET ---"
A=$(curl -s -b "$JAR" "$BASE/api/speak/shadow")
echo "$A" | python3 -c "
import json,sys
j=json.load(sys.stdin)
t=j.get('targets',[])
print('  ok  shadow GET' if len(t)==12 and j.get('threshold')==3 else 'FAIL  shadow GET', len(t), j.get('threshold'))
print('  first target:', t[0]['id'] if t else 'none')
" 
echo "$A" | grep -q '"targets"' && ok "shadow GET payload" || bad "shadow GET payload" "$A"

echo "--- B. shadow probe POST (TTS clip, zero writes) ---"
curl -s -b "$JAR" -X POST "$BASE/api/tts" -H "Content-Type: application/json" \
  -d '{"text":"We went to see a very wide river in the west on a windy Wednesday.","speed":1.0}' -o /tmp/tts.wav
python3 -c "
import base64, json
b=open('/tmp/tts.wav','rb').read()
print(len(b), 'wav bytes')
json.dump({'target':'We went to see a very wide river in the west on a windy Wednesday.','targetId':'sh1','audio':base64.b64encode(b).decode()}, open('/tmp/shadow-probe.json','w'))
"
B=$(curl -s -b "$JAR" -X POST "$BASE/api/speak/shadow" -H "Content-Type: application/json" -H "x-rah-probe: 1" -d @/tmp/shadow-probe.json)
echo "$B" | python3 -c "
import json,sys
j=json.load(sys.stdin)
r=j.get('report',{})
acc=r.get('accuracy')
good = j.get('ok') and j.get('probe') and isinstance(acc,int) and acc>=70 and r.get('tier')=='measured:asr-alignment'
print(('  ok' if good else '  FAIL'), 'shadow probe roundtrip accuracy', acc, 'tier', r.get('tier'))
print('  heard:', (j.get('transcript') or '')[:80])
"
SS1=$($PG -t -A -c "SELECT count(*) FROM \"SpeakSession\"")
[ "$SS1" = "$SS0" ] && ok "probe wrote nothing (SpeakSession $SS1)" || bad "probe wrote!" "$SS0 -> $SS1"

echo "--- C. mission GET (recap + restart) ---"
C=$(curl -s -b "$JAR" "$BASE/api/mission")
echo "$C" | python3 -c "
import json,sys
j=json.load(sys.stdin)
has_recap = 'recap' in j and isinstance(j['recap'].get('items'), list)
has_restart = 'restart' in j and 'show' in j['restart']
print(('  ok' if has_recap else '  FAIL'), 'recap block present,', len(j['recap'].get('items',[])), 'items')
print(('  ok' if has_restart else '  FAIL'), 'restart block present (show=%s)' % j['restart'].get('show'))
steps=j.get('steps',[])
print(('  ok' if len(steps)==4 else '  FAIL'), 'four mission steps intact')
"

echo "--- D. write-draft sync ---"
DP='{"text":"Cross-device draft probe text for the battery.","goalSel":"work","revisingId":null,"at":1730000000000}'
DP=$(python3 -c "import json,time; print(json.dumps({'text':'Cross-device draft probe text for the battery.','goalSel':'work','revisingId':None,'at':int(time.time()*1000)}))")
HP=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR" -X PUT "$BASE/api/write-draft" -H "Content-Type: application/json" -H "x-rah-probe: 1" -d "$DP")
[ "$HP" = "204" ] && ok "write-draft PUT refused under probe (204)" || bad "probe PUT not refused" "HTTP $HP"
HR=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR" -X PUT "$BASE/api/write-draft" -H "Content-Type: application/json" -d "$DP")
[ "$HR" = "200" ] && ok "write-draft PUT saved" || bad "write-draft PUT" "HTTP $HR"
GD=$(curl -s -b "$JAR" "$BASE/api/write-draft" | python3 -c "import json,sys; d=json.load(sys.stdin).get('draft'); print(d['text'] if d else 'MISSING')")
[ "$GD" = "Cross-device draft probe text for the battery." ] && ok "write-draft GET round-trips" || bad "write-draft GET" "$GD"
curl -s -b "$JAR" -X DELETE "$BASE/api/write-draft" >/dev/null
ROW=$($PG -t -A -c "SELECT count(*) FROM \"Setting\" WHERE key LIKE 'write-draft:%'")
[ "$ROW" = "0" ] && ok "write-draft DELETE cleaned the Setting row" || bad "write-draft row remains" "$ROW"

echo "--- E. listenvocab mint + dedupe (one UserCard, deleted after) ---"
LV='{"kind":"listenvocab","word":"curation","fa":"گزینش و گردآوری","passageId":"l5","sentence":"The shelf with forty titles had a kind of curation we now pay subscriptions to imitate."}'
L1=$(curl -s -b "$JAR" -X POST "$BASE/api/track" -H "Content-Type: application/json" -d "$LV" | python3 -c "import json,sys; j=json.load(sys.stdin); print(j.get('created'))")
L2=$(curl -s -b "$JAR" -X POST "$BASE/api/track" -H "Content-Type: application/json" -d "$LV" | python3 -c "import json,sys; j=json.load(sys.stdin); print(j.get('created'), j.get('reason',''))")
[ "$L1" = "True" ] && ok "listenvocab minted a card" || bad "listenvocab mint" "$L1"
echo "$L2" | grep -q "False" && ok "second call dedupes (created=false)" || bad "listenvocab dedupe" "$L2"
MARK=$($PG -t -A -c "SELECT count(*) FROM \"UserCard\" WHERE note LIKE 'listen-vocab:l5:curation%'")
[ "$MARK" = "1" ] && ok "exactly one card row with the marker" || bad "marker rows" "$MARK"
$PG -q -c "DELETE FROM \"UserCard\" WHERE note LIKE 'listen-vocab:l5:curation%'" && ok "test card deleted (ledger restored)"
UC1=$($PG -t -A -c "SELECT count(*) FROM \"UserCard\"")
[ "$UC1" = "$UC0" ] && ok "UserCard count back to baseline ($UC1)" || bad "UserCard drift" "$UC0 -> $UC1"

echo "--- F. asr duration cap (synthetic 200s WAV -> 413, no ASR call) ---"
python3 -c "
import base64, json, struct
rate=16000; secs=200; data=rate*secs*2
buf=b'RIFF'+struct.pack('<I',36+data)+b'WAVEfmt '+struct.pack('<IHHIIHH',16,1,1,rate,rate*2,2,16)+b'data'+struct.pack('<I',data)
json.dump({'audio':base64.b64encode(buf).decode()}, open('/tmp/long.wav.json','w'))
"
FC=$(curl -s -o /tmp/long-resp.json -w "%{http_code}" -b "$JAR" -X POST "$BASE/api/asr" -H "Content-Type: application/json" -d @/tmp/long.wav.json)
MSG=$(python3 -c "import json; print(json.load(open('/tmp/long-resp.json')).get('error','')[:70])")
[ "$FC" = "413" ] && ok "200s clip refused with 413" || bad "duration cap" "HTTP $FC $MSG"
python3 -c "
import base64, json, struct
rate=16000; secs=120; data=rate*secs*2
buf=b'RIFF'+struct.pack('<I',36+data)+b'WAVEfmt '+struct.pack('<IHHIIHH',16,1,1,rate,rate*2,2,16)+b'data'+struct.pack('<I',data)
json.dump({'audio':base64.b64encode(buf).decode()}, open('/tmp/ok.wav.json','w'))
"
FO=$(curl -s -o /tmp/ok-resp.json -w "%{http_code}" -b "$JAR" -X POST "$BASE/api/asr" -H "Content-Type: application/json" -d @/tmp/ok.wav.json)
[ "$FO" = "502" ] || [ "$FO" = "200" ] && ok "120s clip passes the cap (engine said HTTP $FO: silence is a 502, expected)" || bad "120s clip" "HTTP $FO"

echo "--- G. shadow GET recurring ledger unchanged ---"
UC2=$($PG -t -A -c "SELECT count(*) FROM \"UserCard\" WHERE note LIKE 'shadow-miss:%'")
[ "$UC2" = "0" ] && ok "no shadow cards minted by probes" || bad "shadow cards exist" "$UC2"

echo "==================================="
echo "live battery: $PASS pass, $FAIL fail"
exit $([ "$FAIL" = "0" ] && echo 0 || echo 1)
