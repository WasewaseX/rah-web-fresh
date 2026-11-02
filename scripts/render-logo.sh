#!/usr/bin/env bash
# Task 117: render the Rah icon set from public/logo*.svg with headless
# Chrome (same binary the sweeps use). Transparent background for the
# rounded 192/512; square variants for maskable + apple-touch.
set -euo pipefail
cd "$(dirname "$0")/.."

CHROME="/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome"
OUT="public/icons"
PROF="$(mktemp -d)"

render() { # svg size out extra-args...
  local svg="$1" size="$2" out="$3"; shift 3
  timeout 60 "$CHROME" --headless=new --no-sandbox --disable-gpu \
    --user-data-dir="$PROF" --hide-scrollbars \
    --default-background-color=00000000 \
    --window-size="$size,$size" --screenshot="$out" \
    "file:///home/z/my-project/$svg" >/dev/null 2>&1
  echo "rendered $out ($(stat -c%s "$out") bytes)"
}

# Chrome paints small windows unreliably (Task 117: 192/180 came out blank
# twice). Render each variant once at 512 - proven stable - then downscale
# with Lanczos; the source is vector so this loses nothing.
render "public/logo.svg"        512 public/icons/icon-512.png
render "public/logo-square.svg" 512 public/icons/maskable-512.png

python3 - <<'PY'
from PIL import Image
for src, dst, size in [
    ("public/icons/icon-512.png", "public/icons/icon-192.png", 192),
    ("public/icons/maskable-512.png", "public/icons/apple-touch-icon.png", 180),
]:
    im = Image.open(src).convert("RGBA")
    im.resize((size, size), Image.LANCZOS).save(dst)
    print(f"resized {dst} ({size}x{size})")
PY

echo "icon set done"
