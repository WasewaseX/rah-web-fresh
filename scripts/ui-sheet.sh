#!/usr/bin/env bash
# Task 109 - build 2x2 contact sheets from screenshots (ffmpeg xstack).
# Usage: bash scripts/ui-sheet.sh <viewport> <out.png> <img1> <img2> <img3> <img4>
set -eu
VP=$1; OUT=$2; shift 2
IMGS=("$@")
[ ${#IMGS[@]} -eq 4 ] || { echo "need 4 images"; exit 1; }
D=db/evidence/ui
# scale each to 720px wide (half of 1440 sheet), then xstack 2x2
FILT=""
INPUTS=()
for i in 0 1 2 3; do
  INPUTS+=("-i" "${IMGS[$i]}")
  FILT+="[$i:v]scale=720:-1,drawtext=text='${IMGS[$i]##*/}':x=8:y=8:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=6[v$i];"
done
FILT="${FILT}[v0][v1][v2][v3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0"
ffmpeg -y -loglevel error "${INPUTS[@]}" -filter_complex "$FILT" "$D/sheets/$OUT"
echo "sheet: $D/sheets/$OUT"
