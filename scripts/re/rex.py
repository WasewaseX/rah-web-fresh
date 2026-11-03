#!/usr/bin/env python3
"""rex - RE Lab CLI: browser-first binary reverse-engineering triage.

Commands
  id <file>          magic-based identification + hashes      [measured]
  entropy <file>     entropy profile + packing verdict        [heuristic]
  pe <file>          pure-Python PE structure dump            [measured]
  strings <file>     ASCII/UTF-16 string extraction           [measured]
  iocs <file>        URL/IP/registry/API/base64 IOC sweep     [measured]
  triage <file>      id + entropy + pe + iocs in one pass
  links <file|sha>   browser deep links to online platforms   [browser-first]
  lookup <file|sha>  keyless page lookup + keyed API lookups  [external]
  report <file>      full markdown report -> download/re-lab/reports/
  upload <file>      CONSENT-GATED upload (--to vt|mb --confirm UPLOAD:<sha12>)
  ledger [n]         show audit ledger (lookups + uploads + refusals)
  selftest           build benign synthetic PE + assert core paths

SAFETY: no command executes the sample. Analysis is read-only.
Dynamic analysis belongs to online sandboxes (ANY.RUN / Triage) or the
user's isolated VM - never to this host. Uploads require the exact
consent token printed by the gate.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import re_core as core          # noqa: E402
import re_intel as intel        # noqa: E402

REPORTS_DIR = Path("/home/z/my-project/download/re-lab/reports")


def _sha_of_arg(arg: str) -> str:
    """Accept a file path or a raw hex digest."""
    if re.fullmatch(r"[0-9a-fA-F]{32}|[0-9a-fA-F]{40}|[0-9a-fA-F]{64}", arg):
        return arg.lower()
    p = Path(arg)
    if not p.exists():
        print(f"target not found: {arg}")
        sys.exit(1)
    return intel.file_sha256(arg)


def _print(obj: dict, as_json: bool):
    if as_json:
        print(json.dumps(obj, indent=2, default=str))
    else:
        print(json.dumps(obj, indent=2, default=str))  # human mode = pretty json too


def cmd_id(args):
    out = {"file": args.file, **core.identify(args.file), "hashes": core.file_hashes(args.file)}
    _print(out, args.json)


def cmd_entropy(args):
    _print(core.entropy_profile(args.file), args.json)


def cmd_pe(args):
    try:
        _print(core.parse_pe(args.file), args.json)
    except core.PEError as exc:
        print(f"PE parse failed: {exc}")
        sys.exit(1)


def cmd_strings(args):
    out = core.extract_strings(args.file, min_len=args.min_len)
    if not args.json:
        for s in out["strings"][:400]:
            print(s)
        print(f"... ({out['count_raw']} total, showing <=400)", file=sys.stderr)
    else:
        _print(out, True)


def cmd_iocs(args):
    _print(core.extract_iocs(args.file), args.json)


def cmd_triage(args):
    idn = core.identify(args.file)
    hashes = core.file_hashes(args.file)
    ent = core.entropy_profile(args.file)
    try:
        pe = core.parse_pe(args.file)
    except core.PEError as exc:
        pe = {"error": str(exc)}
    iocs = core.extract_iocs(args.file)
    _print({"file": args.file, "id": idn, "hashes": hashes,
            "entropy": ent, "pe": pe, "iocs": iocs}, args.json)


def cmd_links(args):
    sha = _sha_of_arg(args.target)
    for link in intel.deep_links(sha):
        print(f"{link['platform']}: {link['url']}")
        print(f"    {link['note']}")
    print("NOTE: opening these in a browser performs NO upload of your sample;"
          " they search the platform's existing corpus.")


def cmd_lookup(args):
    sha = _sha_of_arg(args.target)
    print(f"sha256: {sha}")
    results = intel.lookup_all(sha)
    _print(results, args.json)


def cmd_report(args):
    path = Path(args.file)
    idn = core.identify(args.file)
    hashes = core.file_hashes(args.file)
    sha = hashes["sha256"]
    ent = core.entropy_profile(args.file)
    try:
        pe = core.parse_pe(args.file)
        pe_err = None
    except core.PEError as exc:
        pe, pe_err = None, str(exc)
    iocs = core.extract_iocs(args.file)
    ext = intel.lookup_all(sha)
    links = intel.deep_links(sha)

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    out = REPORTS_DIR / f"{sha[:16]}.md"
    lines = []
    a = lines.append
    a(f"# RE Lab triage report - `{path.name}`")
    a("")
    a(f"*Generated {time.strftime('%Y-%m-%d %H:%M:%S %Z')} by rex (read-only static triage; "
      "sample NOT executed; nothing uploaded without consent).*")
    a("")
    a("## Identification")
    a("")
    a(f"| Field | Value | Class |")
    a(f"|---|---|---|")
    a(f"| file type | {idn['kind']} | measured |")
    a(f"| size | {idn['size_human']} ({idn['size']} bytes) | measured |")
    a(f"| magic | `{idn['magic_prefix']}` | measured |")
    a(f"| md5 | `{hashes['md5']}` | measured |")
    a(f"| sha1 | `{hashes['sha1']}` | measured |")
    a(f"| sha256 | `{sha}` | measured |")
    a("")
    a("## Entropy & packing")
    a("")
    a(f"| Metric | Value | Class |")
    a(f"|---|---|---|")
    a(f"| overall entropy | {ent['overall_entropy']} bits/byte | measured |")
    a(f"| max block entropy | {ent['max_block_entropy']} | measured |")
    a(f"| high-entropy block ratio | {ent['high_entropy_block_ratio']} | measured |")
    a(f"| UPX magic | {ent['upx_magic']} | measured |")
    a(f"| packing verdict | {ent['verdict']} | heuristic |")
    a("")
    if pe:
        a("## PE structure")
        a("")
        a(f"* machine: {pe['machine']} | subsystem: {pe['subsystem']} | .NET: {pe['dotnet']}")
        a(f"* entry point: {pe['entry_point']}")
        a(f"* overlay after sections: {pe['overlay_bytes']} bytes")
        if pe["imphash_best_effort"]:
            a(f"* imphash (best-effort, re-core): `{pe['imphash_best_effort']}`")
        a("")
        a("| Section | VA | VSize | RawSize | Entropy | Exec | Writable |")
        a("|---|---|---|---|---|---|---|")
        for s in pe["sections"]:
            a(f"| {s['name']} | 0x{s['virtual_address']:x} | 0x{s['virtual_size']:x} | "
              f"0x{s['raw_size']:x} | {s['entropy']} | {s['executable']} | {s['writable']} |")
        a("")
        a("### Imports")
        a("")
        for imp in pe["imports"][:40]:
            funcs = ", ".join(imp["functions"][:20]) or "-"
            more = f" (+{len(imp['functions']) - 20} more)" if len(imp["functions"]) > 20 else ""
            a(f"* `{imp['dll']}`: {funcs}{more}")
        a("")
        if pe["flags"]:
            a("### Heuristic flags")
            a("")
            for f in pe["flags"]:
                a(f"* {f} (heuristic)")
            a("")
    else:
        a(f"## PE structure")
        a("")
        a(f"* not parsed: {pe_err}")
        a("")
    a("## Indicators (extracted strings)")
    a("")
    for cat in ("urls", "ips", "shell_commands", "registry", "suspicious_apis",
                "base64_candidates", "mutex_strings"):
        items = iocs.get(cat) or []
        if items:
            a(f"* **{cat}**: " + "; ".join(f"`{i}`" for i in items[:15]) +
              (f" (+{len(items) - 15})" if len(items) > 15 else ""))
    if not any(iocs.get(c) for c in ("urls", "ips", "shell_commands", "registry",
                                     "suspicious_apis", "base64_candidates", "mutex_strings")):
        a("* no notable IOCs extracted")
    a("")
    a("## External intelligence (hash lookups, no upload)")
    a("")
    a("| Platform | Mode | Status | Summary |")
    a("|---|---|---|---|")
    for r in ext:
        s = r["summary"]
        s = json.dumps(s, ensure_ascii=True) if isinstance(s, dict) else str(s)
        a(f"| {r['platform']} | {r['mode']} | {r['status']} | {s[:180]} |")
    a("")
    a("### Browser-first next steps")
    a("")
    for link in links:
        a(f"* [{link['platform']}]({link['url']}) - {link['note']}")
    a("")
    a("## Limitations")
    a("")
    a("* Static, read-only analysis only. No dynamic claims are made about behaviour;")
    a("  any execution claim requires an online sandbox report or a user-run VM")
    a("  (Procmon/Wireshark/Volatility artifacts), referenced here afterwards.")
    a("* imphash is a best-effort reimplementation, not pefile-identical.")
    a("* Entropy verdicts are heuristics, not proof of maliciousness.")
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"report written: {out}")
    intel.log_event("report", sha256=sha, report=str(out))


def cmd_upload(args):
    if not Path(args.file).exists():
        print("file not found")
        sys.exit(1)
    sha = intel.file_sha256(args.file)
    need = intel.consent_token(sha)
    if args.confirm != need:
        intel.log_event("upload_refused", platform=args.to, sha256=sha, reason="cli_gate")
        print("CONSENT GATE - upload REFUSED.")
        print(f"  target   : {args.to}")
        print(f"  sha256   : {sha}")
        print(f"  required : --confirm \"{need}\"")
        print("Uploading a sample to a third-party service requires explicit")
        print("user approval, then the exact token above. Nothing was sent.")
        sys.exit(2)
    if args.to == "vt":
        result = intel.upload_virustotal(args.file, __import__("os").environ.get("VT_API_KEY", ""), args.confirm)
    elif args.to == "mb":
        result = intel.upload_malwarebazaar(args.file, __import__("os").environ.get("MB_AUTH_KEY", ""), args.confirm)
    else:
        print(f"unknown target {args.to} (supported: vt, mb)")
        sys.exit(1)
    _print(result, args.json)


def cmd_ledger(args):
    events = intel.read_ledger(args.limit)
    if not events:
        print("ledger empty (no lookups/uploads recorded yet)")
    for e in events:
        extra = {k: v for k, v in e.items() if k not in ("ts", "kind")}
        print(f"{e['ts']}  {e['kind']:<16} {json.dumps(extra, default=str)[:200]}")


def cmd_selftest(_args):
    import tempfile
    ok = []

    def check(name, cond):
        ok.append(cond)
        print(f"  [{'PASS' if cond else 'FAIL'}] {name}")

    print("selftest: benign synthetic PE")
    pe_bytes = core.build_benign_pe()
    with tempfile.NamedTemporaryFile(suffix=".exe", delete=False) as tf:
        tf.write(pe_bytes)
        tmp = tf.name
    try:
        idn = core.identify(tmp)
        check("identify: PE executable", idn["kind"].startswith("PE executable"))
        pe = core.parse_pe(tmp)
        check("machine x86-64", "0x8664" in pe["machine"])
        check("two sections", len(pe["sections"]) == 2)
        check(".text entropy sane", 0.0 <= pe["sections"][0]["entropy"] < 8.0)
        check("imports: kernel32.dll", pe["imports"] and pe["imports"][0]["dll"] == "kernel32.dll")
        funcs = pe["imports"][0]["functions"] if pe["imports"] else []
        check("import ExitProcess by name", "ExitProcess" in funcs)
        check("import ord7 by ordinal", "ord7" in funcs)
        check("imphash stable", pe["imphash_best_effort"] == core.parse_pe(tmp)["imphash_best_effort"])
        strs = core.extract_strings(tmp, min_len=8)["strings"]
        check("planted URL recovered", any("example.invalid/beacon" in s for s in strs))
        iocs = core.extract_iocs(tmp)
        check("IOC sweep finds URL", any("example.invalid" in u for u in iocs["urls"]))
        print("selftest: entropy discrimination")
        with tempfile.NamedTemporaryFile(delete=False) as tf:
            import os as _os
            tf.write(_os.urandom(65536))
            rnd = tf.name
        ent_rnd = core.entropy_profile(rnd)["overall_entropy"]
        check("random file entropy > 7.9", ent_rnd > 7.9)
        check("random file flagged packed-suspect",
              core.entropy_profile(rnd)["class"] == "packed-suspect")
        with tempfile.NamedTemporaryFile(delete=False) as tf:
            tf.write(b"\x00" * 65536)
            zeros = tf.name
        check("zeros entropy < 0.1", core.entropy_profile(zeros)["overall_entropy"] < 0.1)
        print("selftest: consent gate refusal (subprocess)")
        proc = subprocess.run(
            [sys.executable, __file__, "upload", tmp, "--to", "vt"],
            capture_output=True, text=True, timeout=60)
        check("ungated upload exits non-zero", proc.returncode == 2)
        check("refusal message printed", "CONSENT GATE" in proc.stdout and "REFUSED" in proc.stdout)
        check("ledger recorded refusal",
              any(e.get("kind") == "upload_refused" for e in intel.read_ledger(10)))
    finally:
        import os as _os
        _os.unlink(tmp)
        for extra in ("rnd", "zeros"):
            try:
                _os.unlink(locals()[extra])
            except OSError:
                pass
    if all(ok):
        print(f"SELFTEST PASS ({len(ok)}/{len(ok)})")
    else:
        print(f"SELFTEST FAIL ({sum(ok)}/{len(ok)})")
        sys.exit(1)


def main():
    ap = argparse.ArgumentParser(prog="rex", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    def add(name, fn, **kw):
        p = sub.add_parser(name, **kw)
        p.add_argument("file")
        p.add_argument("--json", action="store_true")
        p.set_defaults(fn=fn)
        return p

    add("id", cmd_id)
    add("entropy", cmd_entropy)
    add("pe", cmd_pe)
    p = add("strings", cmd_strings)
    p.add_argument("--min-len", type=int, default=6)
    add("iocs", cmd_iocs)
    add("triage", cmd_triage)
    p = sub.add_parser("links")
    p.add_argument("target")
    p.add_argument("--json", action="store_true")
    p.set_defaults(fn=cmd_links)
    p = sub.add_parser("lookup")
    p.add_argument("target")
    p.add_argument("--json", action="store_true")
    p.set_defaults(fn=cmd_lookup)
    add("report", cmd_report)
    p = sub.add_parser("upload")
    p.add_argument("file")
    p.add_argument("--to", choices=["vt", "mb"], required=True)
    p.add_argument("--confirm", default="")
    p.add_argument("--json", action="store_true")
    p.set_defaults(fn=cmd_upload)
    p = sub.add_parser("ledger")
    p.add_argument("limit", nargs="?", type=int, default=25)
    p.set_defaults(fn=cmd_ledger)
    sub.add_parser("selftest").set_defaults(fn=cmd_selftest)

    args = ap.parse_args()
    if getattr(args, "file", None) and args.cmd not in ("links", "lookup", "ledger", "selftest"):
        if not Path(args.file).exists():
            print(f"file not found: {args.file}")
            sys.exit(1)
    args.fn(args)


if __name__ == "__main__":
    main()
