"""Cycle 6, batch C: split marker-delimited battery mains into section helpers.

Works on batteries whose main() is a sequence of
    // ---------- label ----------
blocks. Each block becomes `async function check<Name>()`; main awaits them in
order. Const prelude lines are lifted to module scope so helpers keep access;
a trailing footer (summary + process.exit) stays in main.
"""
import pathlib
import re

ROOT = pathlib.Path("/home/z/my-project")

def split_main(rel, fn_name, footer_re, print_guard=True):
    p = ROOT / rel
    s = p.read_text()
    start = s.index(f"async function {fn_name}() {{") if f"async function {fn_name}() {{" in s else s.index(f"function {fn_name}() {{")
    head_open = s.index("{", start)
    # matching close brace by depth
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

    marker_re = re.compile(r"^(\s*)// ---------- (.+?) ----------\s*$")
    idxs = [n for n, ln in enumerate(lines) if marker_re.match(ln)]
    assert idxs, f"{rel}: no section markers found"

    # footer: trailing lines matching footer_re through end of body
    footer_start = len(lines)
    for n in range(len(lines) - 1, -1, -1):
        if re.search(footer_re, lines[n]):
            footer_start = n
        elif lines[n].strip() and n < footer_start:
            break
    # sections run from first marker to footer_start
    sections = []
    for k, n in enumerate(idxs):
        end = idxs[k + 1] if k + 1 < len(idxs) else footer_start
        sections.append(lines[n:end])

    prelude = lines[:idxs[0]]
    footer = lines[footer_start:]

    def name_for(label):
        base = label.split(":")[0]
        base = re.sub(r"\(.*?\)", "", base).strip()
        words = re.split(r"[\s_]+", base)
        name = "".join(w[:1].upper() + w[1:] for w in words if w)
        return re.sub(r"[^A-Za-z0-9]", "", name)

    helpers = []
    calls = []
    for sec in sections:
        m = marker_re.match(sec[0])
        label = m.group(2)
        fname = name_for(label)
        assert fname not in calls, f"duplicate section name {fname}"
        helpers.append(f"async function {fname}() {{\n" + "\n".join(sec) + "\n}\n")
        calls.append(fname)

    # lift const prelude lines to module scope
    lift = [ln for ln in prelude if re.match(r"^\s*const \w", ln)]
    keep = [ln for ln in prelude if ln not in lift]

    new_main = f"async function {fn_name}() {{\n" + "\n".join(keep) + "\n" + "".join(f"  await {c}();\n" for c in calls) + "\n".join(footer) + "\n}"
    module_helpers = "\n".join(helpers)
    lifted = ("\n".join(lift) + "\n\n") if lift else ""

    new = s[:start] + lifted + module_helpers + "\n" + new_main + s[i + 1:]
    p.write_text(new)
    print(f"{rel}: {len(sections)} sections -> {', '.join(calls)}")

split_main("scripts/b1c1-guide-test.ts", "main", r"console\.log\(`\\\\nb1c1-guide|console\.log\(`\\nb1c1-guide")
split_main("scripts/coach-tools-test.ts", "main", r"process\.exit\(fail === 0")
