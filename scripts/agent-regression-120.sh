#!/usr/bin/env bash
# Task 120 - conversational regression battery (audit 2026-11-03, P0-6/P2 v1).
# Drives the LIVE canonical agent loop (/api/coach-agent) in PROBE mode
# (x-rah-probe: 1): real model, real tools, ZERO history writes and ZERO
# rewards (evidence hygiene). The theme case is the one tool that persists -
# the battery captures the learner's current theme first and restores it after.
#
# Cases (from the holder's acceptance table):
#   1. greeting            -> no tools, non-empty reply
#   2. direct vocab answer -> non-empty answer, no tool required (warn on tools)
#   3. state question      -> read_state is ENFORCED by the loop (deterministic)
#   4. theme repaint       -> set_theme tool ran + server-verified command returned
#   5. probe hygiene       -> ChatMsg count unchanged across the whole battery
set -u
cd "$(dirname "$0")/.."
BASE="http://127.0.0.1:3000"
JAR="/tmp/rah-battery-cookies.txt"
rm -f "$JAR"; touch "$JAR"; chmod 600 "$JAR"

# --- auth (same pattern as e2e-login.sh; never prints the code)
CODE=$(curl -s -X POST "$BASE/api/auth/request-code" -H "Content-Type: application/json" \
  -d '{"email":"geministudent@atomicmail.io"}' | python3 -c "import json,sys; print(json.load(sys.stdin).get('devCode',''))")
if [ -z "$CODE" ]; then
  RAH_ACCESS_CODE="$(sed -n 's/^RAH_ACCESS_CODE=//p' .env | head -1 | tr -d '\"')"
  [ -n "${RAH_ACCESS_CODE:-}" ] || { echo "FAIL auth: no devCode and no RAH_ACCESS_CODE"; exit 2; }
  CODE="$RAH_ACCESS_CODE"
fi
curl -s -c "$JAR" -o /dev/null -X POST "$BASE/api/auth/verify" -H "Content-Type: application/json" \
  -d "{\"email\":\"geministudent@atomicmail.io\",\"code\":\"$CODE\"}"
TOKEN=$(grep -c rah_session "$JAR")
[ "$TOKEN" -ge 1 ] || { echo "FAIL auth: verify did not set a session"; exit 2; }

chat_count() {
  curl -s -b "$JAR" "$BASE/api/chat" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('messages',[])))"
}
run_case() { # $1 = message -> prints "tools=<csv>|reply=<text>|commands=<json>"
  curl -s -N -b "$JAR" --max-time 150 -X POST "$BASE/api/coach-agent" \
    -H "content-type: application/json" -H "x-rah-probe: 1" \
    -d "{\"message\":$(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$1"), \"view\":\"home\"}" \
  | python3 -c '
import json, sys
tools, reply, commands, done = [], "", [], False
for line in sys.stdin:
    line = line.strip()
    if not line.startswith("data: "): continue
    try: ev = json.loads(line[6:])
    except Exception: continue
    if ev.get("type") == "tool": tools.append(ev.get("label",""))
    elif ev.get("type") == "final":
        reply = str(ev.get("reply","")); commands = ev.get("commands",[]) or []
    elif ev.get("type") == "done": done = True
print(json.dumps({"tools": tools, "reply": reply, "commands": commands, "done": done}))'
}

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "PASS $1"; }
bad() { FAIL=$((FAIL+1)); echo "FAIL $1 - $2"; }

BEFORE_COUNT=$(chat_count)
CAPTURED_TOKENS=$(curl -s -b "$JAR" "$BASE/api/theme" | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin).get('tokens')))")
echo "theme captured: $CAPTURED_TOKENS"

# --- case 1: greeting
R=$(run_case "hi there!")
python3 - "$R" <<'PYEOF' || true
PYEOF
TOOLS=$(echo "$R" | python3 -c "import json,sys; d=json.load(sys.stdin); print(','.join(d['tools']))")
REPLY=$(echo "$R" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['reply'][:80])")
DONE=$(echo "$R" | python3 -c "import json,sys; print(json.load(sys.stdin)['done'])")
if [ "$DONE" = "True" ] && [ -n "$REPLY" ] && [ -z "$TOOLS" ]; then ok "greeting: no tools, warm reply"; else bad "greeting" "tools=[$TOOLS] reply='$REPLY' done=$DONE"; fi

# --- case 2: direct question gets a direct answer (no lecture-gate tools)
R=$(run_case "What does notwithstanding mean? Just tell me directly.")
TOOLS=$(echo "$R" | python3 -c "import json,sys; d=json.load(sys.stdin); print(','.join(d['tools']))")
REPLY=$(echo "$R" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['reply'])")
LEN=$(echo -n "$REPLY" | wc -c)
if [ "$LEN" -gt 60 ]; then ok "direct question: answered ($LEN chars)"; else bad "direct question" "reply too short ($LEN): $REPLY"; fi
case "$TOOLS" in *read_state*) echo "WARN direct question pulled read_state (over-trigger)";; esac

# --- case 3: state question MUST read real state (loop-enforced)
R=$(run_case "What's my streak and how many reviews are due right now?")
TOOLS=$(echo "$R" | python3 -c "import json,sys; d=json.load(sys.stdin); print(','.join(d['tools']))")
REPLY=$(echo "$R" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['reply'][:100])")
case "$TOOLS" in *read_state*) ok "state question: read_state enforced"; ;; *) bad "state question" "no read_state in [$TOOLS] reply='$REPLY'";; esac

# --- case 4: theme repaint for real
R=$(run_case "make the UI theme green")
TOOLS=$(echo "$R" | python3 -c "import json,sys; d=json.load(sys.stdin); print(','.join(d['tools']))")
CMDS=$(echo "$R" | python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps(d['commands']))")
case "$TOOLS" in *set_theme*) ok "theme: set_theme tool ran"; ;; *) bad "theme" "no set_theme in [$TOOLS] cmds=$CMDS";; esac
echo "$CMDS" | python3 -c '
import json, sys
cmds = json.load(sys.stdin)
tok = next((c for c in cmds if c.get("type") == "set_theme"), None)
sys.exit(0 if tok and "34d399" in str(tok.get("tokens", "")) else 1)' \
  && ok "theme: server-verified set_theme command with forest tokens" \
  || bad "theme command" "cmds=$CMDS"

# --- case 5: probe hygiene - zero history writes
AFTER_COUNT=$(chat_count)
[ "$AFTER_COUNT" = "$BEFORE_COUNT" ] && ok "probe hygiene: history untouched ($BEFORE_COUNT rows)" \
  || bad "probe hygiene" "chat rows $BEFORE_COUNT -> $AFTER_COUNT"

# --- restore the learner's theme exactly as captured
if [ "$CAPTURED_TOKENS" = "null" ] || [ "$CAPTURED_TOKENS" = "None" ]; then
  curl -s -b "$JAR" -X POST "$BASE/api/theme" -H "content-type: application/json" -d '{"reset":true}' >/dev/null
else
  curl -s -b "$JAR" -X POST "$BASE/api/theme" -H "content-type: application/json" \
    -d "{\"tokens\":$CAPTURED_TOKENS}" >/dev/null
fi
echo "theme restored: $CAPTURED_TOKENS"

echo ""
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
