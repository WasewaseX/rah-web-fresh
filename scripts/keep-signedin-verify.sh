#!/usr/bin/env bash
# Live verification: easy access code (6767) + keep-me-signed-in (365d cookie,
# sliding refresh). No secrets printed beyond the code itself (owner-chosen).
set -u
cd "$(dirname "$0")/.."
# Shell env may carry a stale SQLite-style DATABASE_URL that overrides .env -
# always re-export the project value for the standalone node/prisma calls.
export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | cut -d= -f2-)"
BASE="http://127.0.0.1:3000"
EMAIL="$(sed -n 's/^RAH_OWNER_EMAILS=//p' .env | cut -d, -f1)"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "PASS: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL: $1"; }

# 1. Access code 6767 signs the owner in (4-digit path).
H=$(mktemp)
BODY=$(curl -s -D "$H" -X POST "$BASE/api/auth/verify" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"code\":\"6767\"}")
echo "$BODY" | grep -q '"ok":true' && ok "verify accepts 4-digit access code" || bad "verify rejected 6767: $BODY"
MAXAGE=$(grep -io 'rah_session=.*' "$H" | grep -io 'Max-Age=[0-9]*' | head -1 | cut -d= -f2)
[ "$MAXAGE" = "31536000" ] && ok "session cookie Max-Age=31536000 (365 days)" || bad "cookie Max-Age=$MAXAGE (want 31536000)"
TOKEN=$(grep -io 'rah_session=[^;]*' "$H" | head -1 | cut -d= -f2)
rm -f "$H"

# 2. Wrong 4-digit code is rejected gracefully (no crash, honest error).
BODY=$(curl -s -X POST "$BASE/api/auth/verify" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"code\":\"1111\"}")
echo "$BODY" | grep -q '"error"' && ok "wrong code rejected with error message" || bad "wrong code handling: $BODY"

# 3. Session route resolves the new session.
BODY=$(curl -s "$BASE/api/auth/session" -H "Cookie: rah_session=$TOKEN")
echo "$BODY" | grep -q '"user":{' && ok "session resolves via new cookie" || bad "session route: $BODY"

# 4. Sliding refresh: age the session past half-TTL in the DB, hit an authed
#    route, confirm expiresAt got pushed back out to ~365 days.
node -e '
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const crypto = require("crypto");
  const hash = crypto.createHash("sha256").update(process.argv[1]).digest("hex");
  const old = new Date(Date.now() + 100 * 24 * 3600 * 1000); // 100 days left < 182.5 half-life
  await p.session.update({ where: { token: hash }, data: { expiresAt: old } });
  await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
' "$TOKEN" && ok "session aged to 100d remaining (below half-life)" || bad "could not age session"
curl -s "$BASE/api/auth/session" -H "Cookie: rah_session=$TOKEN" | grep -q '"user":{' || bad "authed call after aging failed"
node -e '
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const crypto = require("crypto");
  const hash = crypto.createHash("sha256").update(process.argv[1]).digest("hex");
  const s = await p.session.findUnique({ where: { token: hash } });
  const days = (s.expiresAt.getTime() - Date.now()) / 86400000;
  console.log(days > 360 ? "REFRESHED:" + days.toFixed(1) + "d" : "NOT_REFRESHED:" + days.toFixed(1) + "d");
  await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
' "$TOKEN" | grep -q '^REFRESHED' && ok "sliding refresh pushed expiry back to ~365d" || bad "sliding refresh did not fire"

echo "----"
echo "RESULT: $PASS passed, $FAIL failed"
exit $([ "$FAIL" -eq 0 ] && echo 0 || echo 1)
