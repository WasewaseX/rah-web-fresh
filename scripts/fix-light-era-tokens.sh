#!/usr/bin/env bash
# Task 109 Group A - re-home the light-era literal surfaces in next/ onto the
# Midnight tokens defined in globals.css (.rah-next scope).
cd /home/z/my-project/src/components/rah/next || exit 1
for f in *.tsx; do
  sed -i \
    -e 's/background: "#fff"/background: "var(--rah-field)"/g' \
    -e 's/background: "#f4f3ec"/background: "var(--rah-callout)"/g' \
    -e 's/background: "#efeee7"/background: "var(--rah-track)"/g' \
    -e 's/: "#e6e4dc"/: "var(--rah-dot)"/g' \
    -e 's/hover:bg-\[#f4f3ec\]/hover:bg-white\/[0.07]/g' \
    "$f"
done
echo "remaining literals:"
grep -c '#efeee7\|#f4f3ec\|#e6e4dc\|background: "#fff"' *.tsx | grep -v ':0' || echo "  none"
