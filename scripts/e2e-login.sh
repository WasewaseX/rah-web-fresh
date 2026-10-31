#!/usr/bin/env bash
# Task 107 - reusable login for browser e2e batteries.
# Drives the dev-only devCode fallback (request-code -> verify) with curl and
# injects the resulting httpOnly session cookie into the agent-browser session.
# Safe: dev servers only print devCode; production keeps the honest 503.
# Usage: bash scripts/e2e-login.sh [EMAIL] [BASE_URL]
set -eu
EMAIL="${1:-filixah964@aravites.com}"
BASE="${2:-http://127.0.0.1:3000}"

CODE=$(curl -s -X POST "$BASE/api/auth/request-code" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\"}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('devCode',''))")
[ -n "$CODE" ] || { echo "no devCode returned (is NODE_ENV=development? did SMTP actually deliver?)"; exit 2; }

TOKEN=$(curl -s -c - -X POST "$BASE/api/auth/verify" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"code\":\"$CODE\"}" | grep rah_session | awk '{print $NF}')
[ -n "$TOKEN" ] || { echo "verify did not set rah_session"; exit 3; }

agent-browser cookies set rah_session "$TOKEN" >/dev/null
echo "session injected (${#TOKEN} bytes)"
