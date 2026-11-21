"""Round 8 small fixes: escapes, self-assign, empty exports, startsWith,
React type imports for type-position references."""
import pathlib

ROOT = pathlib.Path("/home/z/my-project")

def patch(rel, old, new, count=1):
    p = ROOT / rel
    s = p.read_text()
    n = s.count(old)
    if n == 0 and new in s:
        print(f"skip  {rel}: already applied")
        return
    assert n == count, f"{rel}: expected {count}, found {n}: {old[:70]!r}"
    p.write_text(s.replace(old, new))
    print(f"ok    {rel}: {old.splitlines()[0].strip()[:56]!r}")

# --- unnecessary escapes ------------------------------------------------------
patch("scripts/test-import-raw.ts",
      '  const s = t.replace(/\\`\\`\\`json/g, "\\`\\`\\`").replace(/\\`\\`\\`/g, "").trim();',
      '  const s = t.replace(/```json/g, "```").replace(/```/g, "").trim();')
patch("scripts/test-jsonmode.ts",
      """        { role: "assistant", content: 'Reply with ONE JSON object: {"a": "say \\"quoted\\" inside"}' },""",
      """        { role: "assistant", content: 'Reply with ONE JSON object: {"a": "say "quoted" inside"}' },""")

# --- empty exports --------------------------------------------------------------
patch("scripts/test-admin-db-route.ts",
      'export {}; // module marker: top-level await needs it (tsc TS1375)\n\nimport fs from "fs";',
      'import fs from "fs";')
patch("scripts/test-exam-quality.ts", "\nexport {}\n", "")

# --- self-assign ------------------------------------------------------------------
patch("scripts/test-coach-agent-auth.ts",
      '  cookie = cookie; // session still live\n',
      '  // session still live (the cookie from the login step is reused as-is)\n')

# --- prefer-string-starts-ends-with -------------------------------------------------
patch("scripts/input-latency-probe.mjs",
      '    const target = btns.find((b) => /^GOOD/.test((b.textContent || "").trim()));',
      '    const target = btns.find((b) => (b.textContent || "").trim().startsWith("GOOD"));')
patch("src/lib/coach-agent/pdf.ts",
      "      if (/^```/.test(line.trim())) {",
      '      if (line.trim().startsWith("```")) {')
patch("src/lib/coach-agent/pdf.ts",
      "    if (/^```/.test(t)) {",
      '    if (t.startsWith("```")) {')

# --- React type-position references (no-undef) --------------------------------------
REACT_TYPE_IMPORT = 'import type * as React from "react";\n'
no_import = ["src/app/layout.tsx", "src/components/ui/aspect-ratio.tsx",
             "src/components/ui/collapsible.tsx", "src/components/ui/skeleton.tsx",
             "src/components/ui/sonner.tsx"]
with_import = ["src/components/rah/bits.tsx", "src/components/rah/next/bits.tsx",
               "src/components/rah/next/coach/Blocks.tsx", "src/components/rah/next/review.tsx",
               "src/components/rah/next/tutor.tsx"]

for rel in no_import:
    p = ROOT / rel
    s = p.read_text()
    if REACT_TYPE_IMPORT in s:
        print(f"skip  {rel}: react type import present")
        continue
    lines = s.splitlines(keepends=True)
    # insert after the leading comment block / first import
    insert_at = 0
    for i, ln in enumerate(lines):
        if ln.startswith("import") or ln.startswith('"use client"') or ln.startswith("'use client'"):
            insert_at = i + 1
            break
    lines.insert(insert_at, REACT_TYPE_IMPORT)
    p.write_text("".join(lines))
    print(f"ok    {rel}: type import inserted at line {insert_at + 1}")

for rel in with_import:
    p = ROOT / rel
    s = p.read_text()
    if REACT_TYPE_IMPORT in s:
        print(f"skip  {rel}: react type import present")
        continue
    import re as _re
    m = _re.search(r'^import [^\n]*from "react";$', s, _re.M)
    assert m, f"{rel}: no react import found"
    s = s[:m.start()] + REACT_TYPE_IMPORT + s[m.start():]
    p.write_text(s)
    print(f"ok    {rel}: type import added before existing react import")

print("small fixes complete")
