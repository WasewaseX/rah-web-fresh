"""Round 8 py splits: selftest.py main (189), rex.py cmd_report (114),
restore-cred-record.py main (117). Bodies are moved VERBATIM (sliced, then
de-indented) into phase/section helpers - no retyping, no behavior change."""
import pathlib
import textwrap

ROOT = pathlib.Path("/home/z/my-project")

def slice_between(s, a, b):
    i = s.index(a)
    j = s.index(b)
    assert i < j
    return s[i:j]

# ============ selftest.py ======================================================
p = ROOT / "scripts/selftest.py"
s = p.read_text()
start = s.index("async def main():")
end = s.index('    print("--- page errors ---")')
body = s[start:end]

A_FRESH = "        # fresh session: onboarding placement flow"
A_REVIEW = "        # review flow"
A_CHAT = "        # chat flow"
A_QUIZ = "        # quiz"
A_READINGS = "        # readings"
A_CLOSE = "        await close_ctx(ctx, browser)"

placement_body = slice_between(body, A_FRESH, A_CLOSE)  # through close_ctx(ctx1)
review_body = slice_between(body, A_REVIEW, A_CHAT)
chat_body = slice_between(body, A_CHAT, A_QUIZ)
quiz_body = slice_between(body, A_QUIZ, A_READINGS)
browse_body = body[body.index(A_READINGS):body.rindex(A_CLOSE)]  # LAST close_ctx
setup2 = slice_between(body, A_CLOSE, A_REVIEW)  # ctx2 + page + clear + dashboard
tail_close = body[body.index(A_CLOSE):body.index(A_CLOSE) + body[body.index(A_CLOSE):].index("\n") + 1]

def dedent8(txt):
    out = []
    for ln in txt.splitlines(keepends=True):
        out.append("    " + ln[8:] if ln.strip() else ln)
    return "".join(out)

new_main = '''async def phase_placement(ctx):
    """Fresh context: onboarding placement flow (shots 01-03)."""
''' + dedent8(placement_body) + '''

async def phase_review(page):
    """Review flow: type / MCQ / gap answers (shots 11-13)."""
''' + dedent8(review_body) + '''

async def phase_chat_writing(page):
    """Chat corrections + writing feedback (shots 14-15)."""
''' + dedent8(chat_body) + '''

async def phase_quiz(page):
    """Quiz flow (shots 16-17)."""
''' + dedent8(quiz_body) + '''

async def phase_browse(page):
    """Readings, deck, stats, settings browse shots (18-22)."""
''' + dedent8(browse_body) + '''

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
        await phase_placement(ctx)

''' + dedent8(setup2) + '''        await phase_review(page)
        await phase_chat_writing(page)
        await phase_quiz(page)
        await phase_browse(page)
''' + tail_close + '''
'''
s2 = s[:start] + new_main + s[end:]
p.write_text(s2)
print("selftest.py rewritten via verbatim slices")
import ast
ast.parse(pathlib.Path("scripts/selftest.py").read_text())
print("selftest.py parses OK")
# ============ rex.py cmd_report ================================================
p = ROOT / "scripts/re/rex.py"
s = p.read_text()
start = s.index("def cmd_report(args):")
end = s.index('    out.write_text("\\n".join(lines) + "\\n", encoding="utf-8")')
body = s[start:end]

A_PE = "    if pe:\n"
A_IOCS = '    a("## Indicators (extracted strings)")'
A_INTEL = '    a("## External intelligence (hash lookups, no upload)")'
A_LIM = '    a("## Limitations")'

pe_body = slice_between(body, A_PE, A_IOCS)
iocs_body = slice_between(body, A_IOCS, A_INTEL)
intel_body = slice_between(body, A_INTEL, A_LIM)
gather_end = body.index(A_PE)

new = '''def _report_pe_section(a, pe, pe_err):
    """PE structure, imports and heuristic flags."""
''' + pe_body + '''

def _report_iocs_section(a, iocs):
    """Extracted indicator strings, grouped by category."""
''' + iocs_body + '''

def _report_intel_section(a, ext, links):
    """External hash lookups + browser-first next steps."""
''' + intel_body + '''

def cmd_report(args):
''' + body[body.index("    path = Path(args.file)"):gather_end] + '''    _report_pe_section(a, pe, pe_err)
    _report_iocs_section(a, iocs)
    _report_intel_section(a, ext, links)
''' + body[body.index(A_LIM):]
s = s[:start] + new + s[end:]
p.write_text(s)
ast.parse(s)
print(f"rex.py: cmd_report -> 3 section helpers, parses OK ({len(s.splitlines())} lines)")

# ============ restore-cred-record.py ===========================================
p = ROOT / "scripts/restore-cred-record.py"
s = p.read_text()
start = s.index("def main() -> int:")
end = s.index('if __name__ == "__main__":')
body = s[start:end]

A_S1 = "    # 1. Ensure directory"
A_S2 = "    # 2. Fetch the durable copy"
A_BODY = "    body = open(REC).read()"
A_S3 = "    # 3. Extract the OLD token"
A_S4 = "    # 4. Normalize structure"
A_S5 = "    # 5. Self-verification"

s1 = slice_between(body, A_S1, A_S2)
s2 = slice_between(body, A_S2, A_BODY)
s3 = slice_between(body, A_S3, A_S4)
s4 = slice_between(body, A_S4, "    if changed:\n")
s5 = body[body.index(A_S5):]

new = '''def ensure_dir_guarded() -> int:
    """Section 1: directory + gitignore coverage BEFORE any secret touches disk."""
''' + s1 + '''    return 0


def fetch_from_vault(force: bool) -> None:
    """Section 2: restore the durable copy from the private vault when needed."""
    if force or not os.path.exists(REC) or os.path.getsize(REC) == 0:
''' + s2[s2.index("        sh([\"git\", \"fetch\""):].rstrip() + '''


def extract_tokens(body: str) -> tuple:
    """Section 3: extract the OLD token (never printed) + read the new one."""
''' + s3[s3.index("    # Prefer the token inside"):] + '''

def normalize_structure(body: str, old_tok, new_tok) -> tuple:
    """Section 4: normalize the record structure (idempotent); returns (body, changed)."""
    changed = False
''' + s4[s4.index("    if ACTIVE_HEADING not in body"):] + '''

def self_verify(new_tok, old_tok) -> int:
    """Section 5: self-verification (counts only, no values)."""
''' + s5 + '''

def main() -> int:
    force = "--from-remote" in sys.argv
    rc = ensure_dir_guarded()
    if rc:
        return rc
    fetch_from_vault(force)
    body = open(REC).read()
    old_tok, new_tok = extract_tokens(body)
    body, changed = normalize_structure(body, old_tok, new_tok)
    if changed:
        with open(REC, "w") as f:
            f.write(body)
    os.chmod(REC, 0o600)
    return self_verify(new_tok, old_tok)


'''
s = s[:start] + new + s[end:]
p.write_text(s)
ast.parse(s)
print(f"restore-cred-record.py: 5 phase helpers, parses OK ({len(s.splitlines())} lines)")
