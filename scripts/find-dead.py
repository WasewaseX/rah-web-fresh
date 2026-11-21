"""Find which of the lint-flagged files are unreachable from the app entries.

Walks static imports (`from "..."`) and dynamic imports (`import("...")`)
starting from src/app entry points, then reports flagged files that nothing
reaches - deletion candidates rather than fix candidates.
"""
import os
import re
import json

ROOT = "/home/z/my-project/src"
RESOLVE_DIRS = ["", "next", "games", "coach"]

# extensions tried when a specifier has none
EXTS = ["", ".ts", ".tsx", ".js", ".jsx"]

flags = [f["filePath"] for f in json.load(open("/tmp/full-lint.json")) if f["messages"]]
flag_set = set(flags)

import_re = re.compile(r'(?:from\s*|import\s*\(\s*|require\(\s*)["\']([^"\']+)["\']')

def resolve(spec, from_path):
    if not spec.startswith("."):
        return None  # node_modules / @ alias handled separately
    base = os.path.dirname(from_path)
    # try direct, and each candidate subdir insert
    target_base = os.path.normpath(os.path.join(base, spec))
    cands = []
    for d in RESOLVE_DIRS:
        alt = os.path.normpath(os.path.join(base, d, os.path.basename(spec))) if False else None
    # direct resolution
    for e in EXTS:
        p = target_base + e
        if os.path.isfile(p):
            return p
        if os.path.isdir(p) and os.path.isfile(os.path.join(p, "index.ts")):
            return os.path.join(p, "index.ts")
        if os.path.isdir(p) and os.path.isfile(os.path.join(p, "index.tsx")):
            return os.path.join(p, "index.tsx")
    return None

def resolve_alias(spec):
    if spec.startswith("@/"):
        p = os.path.join(ROOT, spec[2:])
        for e in EXTS:
            if os.path.isfile(p + e):
                return p + e
        if os.path.isfile(p):
            return p
    return None

seen = set()
stack = []
for dirpath, _, files in os.walk(os.path.join(ROOT, "app")):
    for fn in files:
        if fn.endswith((".ts", ".tsx")):
            stack.append(os.path.join(dirpath, fn))

while stack:
    f = stack.pop()
    if f in seen or not os.path.isfile(f):
        continue
    seen.add(f)
    text = open(f, encoding="utf-8", errors="replace").read()
    for spec in import_re.findall(text):
        target = None
        if spec.startswith("."):
            target = resolve(spec, f)
        elif spec.startswith("@/"):
            target = resolve_alias(spec)
        if target and target not in seen:
            stack.append(target)

unreachable = sorted(fl for fl in flag_set if fl not in seen)
reachable = sorted(fl for fl in flag_set if fl in seen)
print(f"REACHABLE flagged files: {len(reachable)}")
for f in reachable:
    print("  KEEP", f.replace("/home/z/my-project/", ""))
print(f"UNREACHABLE flagged files: {len(unreachable)}")
for f in unreachable:
    print("  DEAD", f.replace("/home/z/my-project/", ""))
