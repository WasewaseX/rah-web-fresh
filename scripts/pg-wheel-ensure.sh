#!/usr/bin/env bash
# Task 101: recycle #11 proof - the pgserver WHEEL dies with /home/z/rah-pg on
# every recycle (pgdata AND pgvenv). pg-survival.sh then has no initdb/psql to
# run, ensure exits non-fatally, and the app boots against a dead engine -
# the login "Network hiccup" class again. This guard makes the wheel as
# self-healing as the data: if the expected psql binary is missing, rebuild
# the venv and install the wheel (~20 s, pure wheel, no compile - the
# standing lightweight rule is respected: nothing resident, nothing heavy).
#
# Resolution order for the installer: uv (present on the platform image,
# fastest) -> python3 -m venv + pip. Never touches a working install.
set -u
cd /home/z/my-project || exit 1

PGBIN="${PGBIN:-/home/z/rah-pg/pgvenv/lib/python3.12/site-packages/pgserver/pginstall/bin}"
if [ -x "$PGBIN/psql" ]; then
  exit 0
fi

echo "$(date -Is) pgserver wheel missing - reinstalling (recycle recovery)"
mkdir -p /home/z/rah-pg
if command -v uv >/dev/null 2>&1; then
  uv venv /home/z/rah-pg/pgvenv --python 3.12 >/dev/null 2>&1 \
    && uv pip install --python /home/z/rah-pg/pgvenv/bin/python pgserver >/dev/null 2>&1
else
  python3 -m venv /home/z/rah-pg/pgvenv >/dev/null 2>&1 \
    && /home/z/rah-pg/pgvenv/bin/pip install -q pgserver >/dev/null 2>&1
fi

if [ -x "$PGBIN/psql" ]; then
  echo "$(date -Is) pgserver wheel restored -> $PGBIN"
else
  echo "$(date -Is) WARNING: pgserver wheel restore FAILED - PG unreachable until manual install"
  bash scripts/alert.sh CRITICAL pg-wheel-ensure "pgserver wheel reinstall failed - PG will be unreachable" || true
  exit 1
fi
