#!/usr/bin/env bash
# learner-evidence.sh — weekly multi-week learner evidence report (Task 95 open item).
#
# Purpose: the holder's 30-Oct status check lists "multi-week learner evidence"
# as an open item. This script turns the live DB into a compact, privacy-safe
# evidence block: activity days, review volume, retention inputs, tutor chat
# volume, writing/speaking/listening counts — aggregates only. Run it weekly
# (or any time) and paste the output into the holder report; the trailing line
# is also appended to db/evidence/evidence-timeline.log so the multi-week
# record accumulates on disk even before reports are written.
#
# Privacy contract: counts, dates, durations, aggregates ONLY. Never learner
# name, never message content, never email addresses, never login codes.
# Read-only against the DB.
set -u

PSQL=/home/z/rah-pg/pgvenv/lib/python3.12/site-packages/pgserver/pginstall/bin/psql
URL="postgresql://postgres@127.0.0.1:5433/rah"
LOG_DIR=/home/z/my-project/db/evidence
LOG_FILE="$LOG_DIR/evidence-timeline.log"

if [ ! -x "$PSQL" ]; then echo "learner-evidence: psql not found at $PSQL" >&2; exit 3; fi
mkdir -p "$LOG_DIR"

q() { "$PSQL" "$URL" -tAc "$1" 2>/dev/null; }

NOW="$(date -u +%Y-%m-%dT%H:%MZ)"
LEARNER_CREATED="$(q "SELECT to_char(\"createdAt\" AT TIME ZONE 'UTC','YYYY-MM-DD') FROM \"Learner\" ORDER BY id LIMIT 1")"
STREAK="$(q "SELECT streak FROM \"Learner\" ORDER BY id LIMIT 1")"
BEST="$(q "SELECT \"bestStreak\" FROM \"Learner\" ORDER BY id LIMIT 1")"
XP="$(q "SELECT xp FROM \"Learner\" ORDER BY id LIMIT 1")"
RETENTION="$(q "SELECT COALESCE(retention::text,'-') FROM \"Learner\" ORDER BY id LIMIT 1")"

# day columns across the schema are INTEGER epoch-day serials (UTC-day floor),
# e.g. DailyStat.day, SessionLog.day, ReviewLog.day — not dates. Compute the
# serial for now once and window with plain integers (±1 day skew from any
# local-time convention in the app is immaterial for weekly aggregates).
TODAY="$(q "SELECT (extract(epoch from now())/86400)::int")"
D7="$(q "SELECT count(*) FROM \"DailyStat\" WHERE day > $TODAY - 7")"
D14="$(q "SELECT count(*) FROM \"DailyStat\" WHERE day > $TODAY - 14")"
D30="$(q "SELECT count(*) FROM \"DailyStat\" WHERE day > $TODAY - 30")"
RV7="$(q "SELECT COALESCE(sum(reviews),0) FROM \"DailyStat\" WHERE day > $TODAY - 7")"
CR7="$(q "SELECT COALESCE(sum(correct),0) FROM \"DailyStat\" WHERE day > $TODAY - 7")"
XP7="$(q "SELECT COALESCE(sum(xp),0) FROM \"DailyStat\" WHERE day > $TODAY - 7")"
LN7="$(q "SELECT COALESCE(sum(listened),0) FROM \"DailyStat\" WHERE day > $TODAY - 7")"
ACC7="$(q "SELECT CASE WHEN COALESCE(sum(reviews),0)=0 THEN '-' ELSE round(100.0*sum(correct)/sum(reviews),1)::text END FROM \"DailyStat\" WHERE day > $TODAY - 7")"

REV_TOTAL="$(q "SELECT count(*) FROM \"ReviewLog\"")"
REV30="$(q "SELECT count(*) FROM \"ReviewLog\" WHERE at > now() - interval '30 days'")"
CHAT="$(q "SELECT count(*) FROM \"ChatMsg\"")"
CHAT30="$(q "SELECT count(*) FROM \"ChatMsg\" WHERE at > now() - interval '30 days'")"
WRITE="$(q "SELECT count(*) FROM \"WritingSub\"")"
SPEAK="$(q "SELECT count(*) FROM \"SpeakingAttempt\"")"
SPEAK_SEC="$(q "SELECT COALESCE(sum(seconds),0) FROM \"SpeakingAttempt\"")"
LISTEN="$(q "SELECT count(*) FROM \"ListeningLog\"")"
MIN30="$(q "SELECT COALESCE(sum(minutes),0) FROM \"SessionLog\" WHERE day > $TODAY - 30")"
# MailLog.status observed values: 'dev' (dev-mode capture), 'failed'; report both.
MAIL_DEV="$(q "SELECT count(*) FROM \"MailLog\" WHERE status='dev'")"
MAIL_FAIL="$(q "SELECT count(*) FROM \"MailLog\" WHERE status='failed'")"

echo "================ LEARNER EVIDENCE $NOW ================"
echo "identity anchor: learner createdAt=$LEARNER_CREATED (UTC); streak=$STREAK best=$BEST xp=$XP retention=$RETENTION"
echo "activity days: trailing7=$D7  trailing14=$D14  trailing30=$D30"
echo "trailing 7d: reviews=$RV7 correct=$CR7 accuracy=${ACC7}% xp=$XP7 listening_items=$LN7"
echo "lifetimes: reviews=$REV_TOTAL (30d=$REV30) tutor_msgs=$CHAT (30d=$CHAT30) writing=$WRITE speaking=$SPEAK (${SPEAK_SEC}s) listening=$LISTEN"
echo "study minutes (SessionLog, 30d)=$MIN30; mails: dev-captured=$MAIL_DEV failed=$MAIL_FAIL (login-mail delivery itself is A-6-blocked)"
echo "======================================================="

LINE="$(printf '%s | d7=%s d14=%s d30=%s | rev7=%s acc7=%s xp7=%s | streak=%s best=%s | rev=%s chat=%s w=%s sp=%s min30=%s' \
  "$NOW" "$D7" "$D14" "$D30" "$RV7" "$ACC7" "$XP7" "$STREAK" "$BEST" "$REV_TOTAL" "$CHAT" "$WRITE" "$SPEAK" "$MIN30")"
echo "$LINE" >> "$LOG_FILE"
echo "timeline line appended: $LOG_FILE"
