#!/usr/bin/env bash
# Task 117: coach-chat verification probe + evidence-hygiene cleanup.
# Probes never count as learning: every XP point, chat row and quest tick
# this probe creates is reverted before the script exits.
set -uo pipefail
cd /home/z/my-project

source <(grep -E '^(DATABASE_URL|RAH_ACCESS_CODE|OWNER_EMAIL)=' .env 2>/dev/null || true)
EMAIL="${OWNER_EMAIL:-geministudent@atomicmail.io}"
JAR=/tmp/rah-jar-117
rm -f "$JAR"

psqlq() { psql "$DATABASE_URL" -tA -c "$1" 2>&1; }

xp() { curl -s http://127.0.0.1:3000/api/version | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['xp'])" 2>/dev/null; }

XP_BEFORE="$(xp)"
START_SQL="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
echo "xp before: $XP_BEFORE | probe window starts $START_SQL"

# 1. auth -> cookie
AUTH=$(curl -s -c "$JAR" -X POST http://127.0.0.1:3000/api/auth/verify \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"code\":\"$RAH_ACCESS_CODE\"}")
echo "auth: $(echo "$AUTH" | head -c 120)"

# 2. the probe turn: plain "hi" - the exact holder-reported misroute
RESP=$(curl -s -b "$JAR" -X POST http://127.0.0.1:3000/api/chat \
  -H 'Content-Type: application/json' -d '{"message":"hi"}')
echo "--- envelope ---"
echo "$RESP" | python3 -m json.tool 2>/dev/null | head -30 || echo "$RESP"

SKILL=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('skill','?'))" 2>/dev/null)
REPLY=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('reply',''))" 2>/dev/null)
WORDS=$(echo "$REPLY" | wc -w | tr -d ' ')
echo "--- verdict ---"
echo "skill=$SKILL reply_words=$WORDS"
if [ "$SKILL" = "chat" ] && [ "$WORDS" -le 90 ]; then
  echo "PASS: small talk routed to chat, Socratic-length reply"
else
  echo "FAIL: expected skill=chat with <=90 words"
fi

# 3. hygiene: revert everything the probe created (prisma road: no psql in
#    this sandbox; DATABASE_URL comes from .env and stamps the right user)
XP_AFTER="$(xp)"
echo "xp after probe: $XP_AFTER (delta $((XP_AFTER - XP_BEFORE)))"
export $(grep -E '^DATABASE_URL=' .env)
CLEANUP=$(START_SQL="$START_SQL" XP_BEFORE="$XP_BEFORE" timeout 120 node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const d = await p.chatMsg.deleteMany({ where: { at: { gte: new Date(process.env.START_SQL) } } });
  const u = await p.learner.update({ where: { id: 'me' }, data: { xp: parseInt(process.env.XP_BEFORE, 10) } });
  const q = await p.quest.updateMany({ where: { userId: 'me', key: 'chat_10' }, data: { progress: { decrement: 1 } } });
  console.log('rows', d.count, 'xp', u.xp, 'quests', q.count);
  await p.\$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
")
echo "cleanup: $CLEANUP"
XP_FINAL="$(xp)"
echo "xp final: $XP_FINAL (must equal $XP_BEFORE)"
[ "$XP_FINAL" = "$XP_BEFORE" ] && echo "HYGIENE: CLEAN" || echo "HYGIENE: DRIFT - investigate"
rm -f "$JAR"
