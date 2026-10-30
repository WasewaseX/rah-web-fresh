#!/usr/bin/env bash
# Task 102 (2026-10-30): HARD SECRET GATE for build artifacts.
#
# Why this exists: Task 101 published release asset rah-build-latest.tgz on
# the PUBLIC repo WasewaseX/rah-web-fresh claiming "zero secrets by
# construction ... verified repeatedly by the secrets sweep". The claims-vs-
# diff audit on 2026-10-30 proved that FALSE: the 321 MB tgz contained
# standalone/.env (live SMTP key), standalone/db/vault-work/github-tokens.md
# (the account holder's ACTIVE GitHub fine-grained PAT), the full PG learner
# dump, ~30 SQLite learner snapshots, and upload/rah-backups/env-rah-latest.
# Root causes: (a) Next standalone copies .env into standalone/ by design,
# (b) outputFileTracing pulled db/ + scripts/ + upload/ (runtime-referenced
# paths) WITH THEIR BUILD-TIME CONTENTS into standalone/, (c) build-prod.sh
# packed standalone/ with no exclusions and no gate. The asset was deleted
# ~6h after publication; this gate makes the class structurally impossible
# to ship again.
#
# Usage: artifact-secret-gate.sh <file.tgz>
#   exit 0 = clean (publish allowed); exit 2 = LEAK (publish FORBIDDEN);
#   exit 3 = usage/environment error.
# Never prints secret values - only pattern classes and paths.
set -u
ART="${1:-}"
[ -n "$ART" ] && [ -f "$ART" ] || { echo "gate: usage: $0 <file.tgz>" >&2; exit 3; }
command -v tar >/dev/null || { echo "gate: tar missing" >&2; exit 3; }

FAIL=0

# ---------- Gate 1: ALLOWLIST (tar listing) ----------
# Everything in the artifact must be one of the runtime-essential subtrees.
# Anything else traced into standalone is bloat at best and a leak at worst
# (Task 102 evidence: db/, scripts/, skills/, upload/, download/,
# tool-results/, examples/, tests/, logs, .env all rode along once).
LIST="$(tar -tzf "$ART" 2>/dev/null)" || { echo "gate: unreadable tgz" >&2; exit 3; }
ALLOWED='^standalone/$|^standalone/\.next/|^standalone/public/|^standalone/node_modules/|^standalone/server\.js$|^standalone/package\.json$|^standalone/next\.config\.(ts|mjs|js)$|^standalone/prisma/'
BADLIST="$(printf '%s\n' "$LIST" | grep -v -E "$ALLOWED" | head -25 || true)"
if [ -n "$BADLIST" ]; then
  FAIL=1
  echo "gate: PATH LEAK - entries outside the runtime allowlist:" >&2
  printf '%s\n' "$BADLIST" | sed 's/^/  /' >&2
fi

# ---------- Gate 2: content patterns (stream grep, values never printed) ----------
PATTERNS="$(mktemp)"
trap 'rm -f "$PATTERNS"' EXIT
{
  echo 'github_pat_[A-Za-z0-9_]{20,}'
  echo 'ghp_[A-Za-z0-9]{20,}'
  echo 'gho_[A-Za-z0-9]{20,}'
  echo 'sk-[A-Za-z0-9]{20,}'
  echo 'BEGIN [A-Za-z ]*PRIVATE KEY'
  echo 'SMTP_PASS='
  echo 'DATABASE_URL='
} > "$PATTERNS"
# Live values (if readable) get exact-match patterns so a rotated-but-stale
# artifact is still caught:
if [ -f .env ]; then
  grep -E '^(SMTP_PASS|DATABASE_URL)=' .env | cut -d= -f2- | sed 's/[.[\*^$(){}?+|\/]/\\&/g; s/^/^/; s/$/$/' >> "$PATTERNS"
fi
TOKEN="$(git remote get-url origin 2>/dev/null | sed -n 's|https://[^:]*:\([^@]*\)@.*|\1|p')"
[ -n "${TOKEN:-}" ] && printf '%s\n' "$(printf '%s' "$TOKEN" | sed 's/[.[\*^$(){}?+|\/]/\\&/g')" >> "$PATTERNS"

HITS="$(tar -xOzf "$ART" 2>/dev/null | grep -a -o -E -f "$PATTERNS" | sort -u | head -10 || true)"
if [ -n "$HITS" ]; then
  FAIL=1
  echo "gate: CONTENT LEAK - matched secret pattern classes:" >&2
  printf '%s\n' "$HITS" | sed -E \
    -e 's/github_pat_.*/github_pat_<REDACTED - GitHub fine-grained PAT>/' \
    -e 's/ghp_.*/ghp_<REDACTED - GitHub classic PAT>/' \
    -e 's/gho_.*/gho_<REDACTED - GitHub OAuth token>/' \
    -e 's/sk-.*/sk-<REDACTED - API key>/' \
    -e 's/BEGIN.*/BEGIN PRIVATE KEY block/' \
    -e 's/^SMTP_PASS=.*/SMTP_PASS=<REDACTED - literal env assignment>/' \
    -e 's/^DATABASE_URL=.*/DATABASE_URL=<REDACTED - literal env assignment>/' \
    -e 's/^(re_[A-Za-z0-9]{4}).*/\1...<REDACTED - Resend-style key>/' \
    | sed 's/^/  /' >&2
fi

if [ "$FAIL" -ne 0 ]; then
  echo "gate: VERDICT = LEAK - publishing $ART is FORBIDDEN (Task 102 gate)" >&2
  exit 2
fi
echo "gate: VERDICT = CLEAN - $ART may be published ($(printf '%s\n' "$LIST" | wc -l) entries checked)"
exit 0
