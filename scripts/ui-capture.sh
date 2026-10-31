#!/usr/bin/env bash
# Task 109 - Impeccable GUI audit capture: every surface at 3 viewports.
# Output: db/evidence/ui/<viewport>/<surface>.png  (audit archive + contact sheets)
set -u
cd /home/z/my-project
BASE="${1:-http://127.0.0.1:3000}"
DIR=db/evidence/ui
mkdir -p "$DIR"

SURFACES=(home review write speak listen read tutor grammar sound placement arcade progress checkpoint settings)

capture_viewport() {
  local W=$1 H=$2 NAME=$3
  mkdir -p "$DIR/$NAME"
  agent-browser set viewport "$W" "$H" >/dev/null 2>&1
  for s in "${SURFACES[@]}"; do
    agent-browser open "$BASE/#$s" >/dev/null 2>&1
    agent-browser wait --load networkidle >/dev/null 2>&1
    sleep 1.1
    agent-browser screenshot "$DIR/$NAME/$s.png" >/dev/null 2>&1
    echo "  $NAME/$s"
  done
}

capture_viewport 1440 900 desktop
capture_viewport 768 1024 tablet
capture_viewport 390 844 mobile
echo "captured $(find $DIR -name '*.png' | wc -l) screenshots"
