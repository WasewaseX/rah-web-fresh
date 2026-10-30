#!/usr/bin/env bash
# Live drive for the authentic exam tracks (Task 61): same throwaway-stack
# pattern as test-isolated-battery.sh, but runs the live AI build drive.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT=3101
DB="file:/home/z/my-project/db/battery-live.db"
BASE="http://localhost:$PORT"
DIST=".next-battery"

cleanup() {
  pkill -f "next dev -p $PORT" 2>/dev/null || true
}
trap cleanup EXIT

export RAH_OPEN_REGISTRATION=1

rm -f db/battery-live.db
DATABASE_URL="$DB" bunx prisma migrate deploy > /dev/null 2>&1
rm -f db/battery-live.db-*
echo "== throwaway db migrated =="

NEXT_DIST_DIR="$DIST" DATABASE_URL="$DB" setsid nohup bunx next dev -p "$PORT" > /tmp/track-drive-server.log 2>&1 < /dev/null &

echo "== waiting for server =="
for i in $(seq 1 90); do
  if curl -sf "$BASE/api/version" > /dev/null 2>&1; then break; fi
  [ "$i" = "90" ] && { echo "server never came up"; tail -20 /tmp/track-drive-server.log; exit 1; }
  sleep 2
done
echo "== server up; driving live track builds =="

DRIVE_BASE="$BASE" bun scripts/live-track-drive.ts
EXIT=$?
cleanup
echo "== live track drive done (exit $EXIT); real db untouched =="
exit $EXIT
