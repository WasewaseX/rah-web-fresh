#!/usr/bin/env bash
# Task 118 - authed curl probes for the Daily English Mission endpoint.
# Never prints the session token; keeps it in /tmp/rah-token only.
set -eu
cd "$(dirname "$0")/.."
BASE="http://127.0.0.1:3000"
EMAIL="geministudent@atomicmail.io"
RAH_ACCESS_CODE="$(sed -n 's/^RAH_ACCESS_CODE=//p' .env | head -1 | tr -d '\"')"

curl -s -c /tmp/rah-cookies.txt -X POST "$BASE/api/auth/verify" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"code\":\"$RAH_ACCESS_CODE\"}" > /tmp/rah-verify.json
chmod 600 /tmp/rah-cookies.txt /tmp/rah-verify.json

# The verify response sets the httpOnly rah_session cookie via Set-Cookie -
# the cookie jar IS the token store. Pull it from there, never from stdout.
TOKEN=$(grep rah_session /tmp/rah-cookies.txt | awk '{print $NF}')
[ -n "$TOKEN" ] || { echo "no token in verify response; keys: $(python3 -c "import json;print(list(json.load(open('/tmp/rah-verify.json')).keys()))")"; exit 3; }

case "${1:-get}" in
  get)  curl -s -m 10 -H "Cookie: rah_session=$TOKEN" "$BASE/api/mission" | python3 -m json.tool ;;
  post) curl -s -m 10 -o /tmp/mission-post.json -w "http=%{http_code}\n" -X POST -H "Cookie: rah_session=$TOKEN" "$BASE/api/mission"; head -c 300 /tmp/mission-post.json; echo ;;
  both) curl -s -m 10 -H "Cookie: rah_session=$TOKEN" "$BASE/api/mission" | python3 -m json.tool
        echo "--- negative POST (expect 400 while mission incomplete):"
        curl -s -m 10 -o /tmp/mission-post.json -w "http=%{http_code}\n" -X POST -H "Cookie: rah_session=$TOKEN" "$BASE/api/mission"
        head -c 300 /tmp/mission-post.json; echo ;;
esac
