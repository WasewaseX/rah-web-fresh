#!/usr/bin/env bash
# Task 102 part 3 - ENV-DRIFT GUARD (closes the provisioning race recorded in
# the Task 102 ledger: after recycle #12's guard restored .env, the platform
# provisioning re-overwrote it with the SQLite default; app processes were
# unaffected, but the NEXT restart would have booted SQLite beside a PG-era
# data store - silent data divergence on the next boot).
#
# Boot-time checks alone cannot win this race (provisioning runs AFTER boot
# guards), so this guard is also called from the watchdog's 15-second tick:
#   bash scripts/env-guard.sh
# Cheap (one grep on a small file), idempotent, alerts only on state change.
cd /home/z/my-project || exit 1

ENV_BACKUP="upload/rah-backups/env-rah-latest"
STATE_FILE="db/.env-guard-state"

# Current classification: "pg" | "bad"
classify() {
  if [ -f .env ] && grep -q '^DATABASE_URL=postgresql://' .env 2>/dev/null; then
    echo pg
  else
    echo bad
  fi
}

STATE=$(classify)

if [ "$STATE" = "pg" ]; then
  # Healthy - clear any past alert state so a FUTURE drift re-alerts.
  [ -f "$STATE_FILE" ] && rm -f "$STATE_FILE"
  exit 0
fi

# Drift detected. Two repair branches, identical to the boot-time doctrine in
# ensure-server.sh (now delegated here so there is ONE implementation):
if [ -f "$ENV_BACKUP" ] && grep -q '^DATABASE_URL=postgresql://' "$ENV_BACKUP" 2>/dev/null; then
  cp "$ENV_BACKUP" .env && chmod 600 .env
  MSG=".env was reset by workspace provisioning (recycle signature) - restored the preserved PostgreSQL configuration (watchdog tick guard)"
else
  printf 'DATABASE_URL=postgresql://postgres@127.0.0.1:5433/rah\n' > .env && chmod 600 .env
  MSG=".env AND preserved copy both gone - reconstructed minimal PG configuration; SMTP key must be re-armed"
fi

# Alert on state change only (no flapping when provisioning fights back):
# alert fires when the guard enters a drift episode (state file absent),
# never again until a healthy tick has cleared it.
PREV=$(cat "$STATE_FILE" 2>/dev/null || echo "")
NOW="drift-fixed $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "$NOW" > "$STATE_FILE" 2>/dev/null || true
echo "$(date -Is) env-guard: $MSG"
if [ -z "$PREV" ]; then
  bash scripts/alert.sh WARN env-guard "$MSG" || true
fi
exit 0
