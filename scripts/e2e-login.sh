#!/usr/bin/env bash
# Task 107 - reusable login for browser e2e batteries.
# Drives the dev-only devCode fallback (request-code -> verify) with curl and
# injects the resulting httpOnly session cookie into the agent-browser session.
# Safe: dev servers only print devCode; production keeps the honest 503.
# Task 109: on PRODUCTION (no devCode), falls back to the owner access code
# from RAH_ACCESS_CODE (env or .env) - same verify endpoint, server-side
# owner-allowlist match. No secret is ever printed.
# Usage: bash scripts/e2e-login.sh [EMAIL] [BASE_URL]
set -eu
EMAIL="${1:-geministudent@atomicmail.io}"
BASE="${2:-http://127.0.0.1:3000}"
cd "$(dirname "$0")/.."

CODE=$(curl -s -X POST "$BASE/api/auth/request-code" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\"}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('devCode',''))")
MODE="devcode"

if [ -z "$CODE" ]; then
  # Production road: devCode is never exposed. Fall back to the owner access
  # code when this deployment armed one (Task 109).
  if [ -z "${RAH_ACCESS_CODE:-}" ] && [ -f .env ]; then
    RAH_ACCESS_CODE="$(sed -n 's/^RAH_ACCESS_CODE=//p' .env | head -1 | tr -d '\"')"
  fi
  [ -n "${RAH_ACCESS_CODE:-}" ] || { echo "no devCode returned and no RAH_ACCESS_CODE available (prod needs the access code)"; exit 2; }
  CODE="$RAH_ACCESS_CODE"
  MODE="access-code"
fi

TOKEN=$(curl -s -c - -X POST "$BASE/api/auth/verify" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"code\":\"$CODE\"}" | grep rah_session | awk '{print $NF}')
[ -n "$TOKEN" ] || { echo "verify did not set rah_session"; exit 3; }

agent-browser open "$BASE/" >/dev/null 2>&1 || true
agent-browser wait --load networkidle >/dev/null 2>&1 || true
agent-browser cookies set rah_session "$TOKEN" >/dev/null
echo "session injected (${#TOKEN} bytes, via $MODE)"
