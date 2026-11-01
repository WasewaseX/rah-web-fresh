#!/usr/bin/env bash
# Task 90: usable prod boot-regression runner. Prod deliberately withholds
# devCode (security gate), so the regression script's RAH_SESSION preset needs
# a REAL session - minted here against the live db (hashed at rest like every
# session), used for one drive, then deleted. No stray auth artifacts left.
# Task 112: the mint/cleanup still spoke SQLite (db/custom.db) years after
# the PG cutover - the battery could only fail with "no such table: User".
# Re-homed onto the live PostgreSQL; same contract: mint, drive, delete.
set -eu
cd /home/z/my-project

PSQL="/home/z/rah-pg/pgvenv/lib64/python3.12/site-packages/pgserver/pginstall/bin/psql"
[ -x "$PSQL" ] || PSQL="/home/z/rah-pg/pgvenv/lib/python3.12/site-packages/pgserver/pginstall/bin/psql"
DB="$(sed -n 's/^DATABASE_URL=//p' .env | head -1 | tr -d '\"')"
[ -n "$DB" ] || { echo "no DATABASE_URL in .env"; exit 2; }

TOKEN="$(python3 - <<'PY'
import hashlib, secrets
print(secrets.token_hex(32))
PY
)"
HASHED="$(python3 -c "import hashlib;print(hashlib.sha256('$TOKEN'.encode()).hexdigest())")"
SID="bootreg-$(date +%s)"

# The AUTH user id lives in User (a cuid) - the oldest row is the primary
# learner (Task 109 identity unification keeps owner emails on this row).
UID_="$($PSQL "$DB" -tAc 'SELECT id FROM "User" ORDER BY "createdAt" LIMIT 1')"
[ -n "$UID_" ] || { echo "no User row in PG"; exit 3; }

$PSQL "$DB" -qAc "INSERT INTO \"Session\" (id, token, \"userId\", \"expiresAt\", \"createdAt\") VALUES ('$SID', '$HASHED', '$UID_', NOW() + INTERVAL '15 minutes', NOW())"

cleanup() {
  $PSQL "$DB" -qAc "DELETE FROM \"Session\" WHERE id LIKE 'bootreg-%'" || true
}
trap cleanup EXIT

# Task 107 contract: boot-regression-check.mjs wraps the preset in the
# cookie name itself - pass the RAW token, never "rah_session=...".
RAH_SESSION="${TOKEN}" node scripts/boot-regression-check.mjs
