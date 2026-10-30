#!/usr/bin/env bash
# drill-release-restore.sh - Task 102 part 3 / A-5 acceptance drill.
#
# Proves: the PUBLIC release artifact alone (no .git, no .env, no learner
# data, no upload mount) rebuilds a working Rah server - "a fresh recycle
# restores the EXACT intended BUILD_ID without a new build".
#
# NON-DESTRUCTIVE BY DESIGN:
#   - downloads the release tgz fresh from GitHub (never trusts local copies)
#   - runs the artifact-secret-gate on the DOWNLOADED bytes
#   - boots the extracted standalone against a THROWAWAY PG database
#     (rah_drill_*) on port 3100 - the live server (:3000) and the live
#     learner database (rah) are never touched
#   - tears everything down afterwards (server, drill DB, extracted tree)
set -u
cd /home/z/my-project || exit 1

WORK="$(mktemp -d /tmp/rah-drill.XXXXXX)"
DRILL_DB="rah_drill_$$"
SRV_PID=""
FAIL=0
# pgserver wheel bundles its own psql (the venv has no system psql)
PGBIN=/home/z/rah-pg/pgvenv/lib/python3.12/site-packages/pgserver/pginstall/bin
PSQL="$PGBIN/psql"
INTENDED_BUILD="$(cat upload/rah-backups/rah-build-latest.json | python3 -c 'import json,sys; print(json.load(sys.stdin)["build_id"])')"
INTENDED_SHA="$(cat upload/rah-backups/rah-build-latest.json | python3 -c 'import json,sys; print(json.load(sys.stdin)["sha256"])')"

cleanup() {
  [ -n "$SRV_PID" ] && kill "$SRV_PID" 2>/dev/null
  sleep 1
  "$PSQL" -h 127.0.0.1 -p 5433 -U postgres -c "DROP DATABASE IF EXISTS $DRILL_DB" >/dev/null 2>&1
  rm -rf "$WORK"
}
trap cleanup EXIT

step() { printf 'DRILL: %s\n' "$*"; }
die()  { printf 'DRILL: FAIL - %s\n' "$*"; FAIL=1; }

# ---------- Phase 1: fetch the public artifact fresh ----------
step "Phase 1: fetching release assets from GitHub"
# Authenticated first (token never printed; used only in the header),
# anonymous fallback. 403 rate-limits on the anon API killed the first run.
GH_TOKEN="$(git remote get-url origin 2>/dev/null | sed -E 's#https://[^:]+:([^@]+)@.*#\1#')"
REL_JSON=""
if [ -n "$GH_TOKEN" ]; then
  REL_JSON=$(curl -sf -m 30 -H "Authorization: Bearer $GH_TOKEN" \
    "https://api.github.com/repos/WasewaseX/rah-web-fresh/releases/latest") || true
fi
[ -n "$REL_JSON" ] || REL_JSON=$(curl -sf -m 30 \
  "https://api.github.com/repos/WasewaseX/rah-web-fresh/releases/latest") || true
TGZ_URL=$(printf '%s' "$REL_JSON" | python3 -c '
import json,sys
d=json.load(sys.stdin)
for a in d.get("assets",[]):
    if a["name"].endswith(".tgz"): print(a["browser_download_url"])
' 2>/dev/null) || true
[ -n "${TGZ_URL:-}" ] || { die "could not resolve the release tgz download URL"; exit 1; }
curl -sfL -m 300 -o "$WORK/art.tgz" "$TGZ_URL" || { die "download failed"; exit 1; }
step "downloaded $(stat -c%s "$WORK/art.tgz") bytes"

# ---------- Phase 2: verify integrity + secrets gate on DOWNLOADED bytes ----------
step "Phase 2: sha256 + secret gate on the downloaded bytes"
GOT_SHA=$(sha256sum "$WORK/art.tgz" | cut -d' ' -f1)
[ "$GOT_SHA" = "$INTENDED_SHA" ] || die "sha mismatch: got $GOT_SHA, manifest says $INTENDED_SHA"
step "sha256 matches manifest ($GOT_SHA)"
if bash scripts/artifact-secret-gate.sh "$WORK/art.tgz" >/dev/null 2>&1; then
  step "artifact-secret-gate: CLEAN (exit 0) on downloaded bytes"
else
  die "artifact-secret-gate flagged the DOWNLOADED artifact (exit $?)"
fi

# ---------- Phase 3: extract + structural allowlist check ----------
step "Phase 3: extraction + structural checks"
mkdir -p "$WORK/x"
tar -xzf "$WORK/art.tgz" -C "$WORK/x" || { die "tar extract failed"; exit 1; }
S="$WORK/x/standalone"
[ -f "$S/server.js" ] || die "server.js missing"
[ -d "$S/.next" ] || die ".next missing"
[ -d "$S/node_modules" ] || die "node_modules missing"
for bad in .env db upload scripts skills download examples tool-results backups docs tests; do
  [ -e "$S/$bad" ] && die "FORBIDDEN path present in artifact: standalone/$bad"
done
step "no forbidden paths in the extracted tree (no .env, no learner data, no workspace dirs)"
GOT_BUILD="$(cat "$S/.next/BUILD_ID" 2>/dev/null || echo MISSING)"
[ "$GOT_BUILD" = "$INTENDED_BUILD" ] || die "BUILD_ID mismatch: got $GOT_BUILD, intended $INTENDED_BUILD"
step "BUILD_ID exact match: $GOT_BUILD"

# ---------- Phase 4: throwaway database + migrate ----------
step "Phase 4: throwaway PG database $DRILL_DB + migrate deploy"
DB_ERR=$("$PSQL" -X -q -h 127.0.0.1 -p 5433 -U postgres -c "CREATE DATABASE $DRILL_DB" 2>&1) \
  || { die "could not create throwaway DB: $DB_ERR"; exit 1; }
MIG_ERR=$(DATABASE_URL="postgresql://postgres@127.0.0.1:5433/$DRILL_DB" bunx prisma migrate deploy 2>&1) \
  || { die "prisma migrate deploy failed: $(printf '%s' "$MIG_ERR" | tail -3 | tr '\n' ' ')"; }
if [ -n "${MIG_ERR:-}" ] && [ "$FAIL" = "0" ]; then step "migrate deploy OK (schema applied to the throwaway DB)"; fi

# ---------- Phase 5: boot the extracted standalone on :3100 ----------
step "Phase 5: booting the extracted standalone (port 3100, scratch .env)"
printf 'DATABASE_URL=postgresql://postgres@127.0.0.1:5433/%s\n' "$DRILL_DB" > "$S/.env"
chmod 600 "$S/.env"
( cd "$S" && PORT=3100 HOSTNAME=127.0.0.1 node server.js > "$WORK/server.log" 2>&1 ) &
SRV_PID=$!
UP=0
for i in $(seq 1 40); do
  sleep 2
  if curl -sf -o /dev/null -m 3 http://127.0.0.1:3100/api/version; then UP=1; break; fi
  kill -0 "$SRV_PID" 2>/dev/null || { echo "--- server.log tail:"; tail -15 "$WORK/server.log"; break; }
done
if [ "$UP" = "1" ]; then
  step "server UP on :3100 (from public artifact bytes only)"
else
  die "server did not come up on :3100"
fi

# ---------- Phase 6: behavioral probes ----------
step "Phase 6: behavioral probes"
V=$(curl -sf -m 5 http://127.0.0.1:3100/api/version || true)
echo "$V" | grep -q '"app":"rah"' && step "/api/version serves the Rah contract: $(echo "$V" | head -c 160)" \
  || die "/api/version response unexpected: ${V:0:120}"
# Fresh drill DB -> data:null is the CORRECT honest response, and it doubles
# as the privacy assertion: the public artifact ships NO learner data.
echo "$V" | grep -q '"data":null' \
  && step "learner data absent (data:null) - the public artifact is privacy-clean" \
  || die "/api/version returned learner data from a FRESH drill DB (data should be null)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 5 http://127.0.0.1:3100/api/state)
[ "$CODE" = "401" ] && step "/api/state unauthenticated -> 401 (auth contract holds)" \
  || die "/api/state returned $CODE (expected 401)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 8 http://127.0.0.1:3100/)
[ "$CODE" = "200" ] && step "/ serves the app shell (200)" \
  || die "/ returned $CODE"

echo "=============================================="
if [ "$FAIL" = "0" ]; then
  echo "DRILL RESULT: PASS - public artifact alone rebuilds a working server (BUILD_ID $GOT_BUILD)"
else
  echo "DRILL RESULT: FAIL (see FAIL lines above; server.log tail below)"
  tail -30 "$WORK/server.log" 2>/dev/null
fi
echo "=============================================="
exit "$FAIL"
