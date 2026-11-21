"""Cycle 6, batch C part 2: split the remaining four over-long script functions."""
import pathlib
import re

ROOT = pathlib.Path("/home/z/my-project")

def name_for(label):
    base = label.split(":")[0]
    base = re.sub(r"\(.*?\)", "", base).strip()
    name = "".join(w[:1].upper() + w[1:] for w in re.split(r"[\s_-]+", base) if w)
    return re.sub(r"[^A-Za-z0-9]", "", name)

def split_by_marker(rel, fn_name, marker_re, footer_re=None, args=""):
    p = ROOT / rel
    s = p.read_text()
    start = s.index(f"async function {fn_name}({args}) {{")
    head_open = s.index("{", start)
    depth = 0
    i = head_open
    while True:
        if s[i] == "{":
            depth += 1
        elif s[i] == "}":
            depth -= 1
            if depth == 0:
                break
        i += 1
    body = s[head_open + 1:i]
    lines = body.splitlines()
    idxs = [n for n, ln in enumerate(lines) if marker_re.match(ln)]
    assert idxs, f"{rel}: no markers"
    footer_start = len(lines)
    if footer_re:
        for n in range(len(lines) - 1, idxs[-1], -1):
            if re.search(footer_re, lines[n]):
                footer_start = n
            elif lines[n].strip() and n < footer_start:
                break
    sections = []
    for k, n in enumerate(idxs):
        end = idxs[k + 1] if k + 1 < len(idxs) else footer_start
        sections.append(lines[n:end])
    prelude = lines[:idxs[0]]
    footer = lines[footer_start:]
    calls = []
    helpers = []
    for sec in sections:
        m = marker_re.match(sec[0])
        fname = name_for(m.group(2))
        helpers.append(f"async function {fname}() {{\n" + "\n".join(sec) + "\n}\n")
        calls.append(fname)
    footer_txt = "\n".join(footer) + "\n" if footer else ""
    prelude_txt = "\n".join(prelude) + "\n" if prelude else ""
    new_main = f"async function {fn_name}({args}) {{\n" + prelude_txt + "".join(f"  await {c}();\n" for c in calls) + footer_txt + "}"
    p.write_text(s[:start] + "\n".join(helpers) + "\n" + new_main + s[i + 1:])
    print(f"{rel}: {len(sections)} sections -> {', '.join(calls)}")

# --- test-arcade2: sections start at console.log("\n=== X ===") ---------------
_arc = ROOT / "scripts/test-arcade2.ts"
if 'console.log("\\n=== HEAT TIERS (unit) ===");' in _arc.read_text():
    split_by_marker(
    "scripts/test-arcade2.ts", "drive",
    re.compile(r'^(\s*)console\.log\("\\n=== (.+?) ==="\);\s*$'),
    args="day: number",
)

# the dungeon section reads the drive() day argument - thread it through
p = ROOT / "scripts/test-arcade2.ts"
s = p.read_text()
old_sig = "async function checkDailyDungeonServergraded() {"
assert s.count(old_sig) == 1
s = s.replace(old_sig, "async function checkDailyDungeonServergraded(day: number) {")
s = s.replace("  await checkDailyDungeonServergraded();", "  await checkDailyDungeonServergraded(day);")
p.write_text(s)
print("arcade2: day threaded through dungeon helper")

# --- pg-validate: numbered `// ---- N. title ----` markers ---------------------
split_by_marker(
    "scripts/pg-validate.ts", "main",
    re.compile(r"^(\s*)// ---- (.+?) ----\s*$"),
    footer_re=r"console\.log\(\"\\n=== PG VALIDATION SUMMARY|console\.log\(\`\\\\nPG|await db\.\$disconnect|process\.exit",
)

print("part 2 marker splits done")
