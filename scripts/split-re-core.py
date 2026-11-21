"""Round 8 py refactor: split re_core.py into re_pe.py (PE parsing module).

The file was 505 physical lines (scanner file-too-large limit 441) and
parse_pe alone was 169. re_pe.py owns the byte-level PE engine (shannon,
_cstring, PEError, name tables, parse_pe phase helpers); re_core.py keeps the
higher-level analysis API and re-exports the PE names so `import re_core as
core` in rex.py keeps working unchanged.
"""
import pathlib
import re as _re

ROOT = pathlib.Path("/home/z/my-project")
core = ROOT / "scripts/re/re_core.py"
s = core.read_text()
lines = s.splitlines(keepends=True)

def block(start_pat, end_pat=None):
    """extract a contiguous source block by anchor regexes"""
    i = next(n for n, l in enumerate(lines) if _re.search(start_pat, l))
    j = len(lines) if end_pat is None else next(n for n, l in enumerate(lines[i:], i) if _re.search(end_pat, l))
    return "".join(lines[i:j]), i, j

# --- pull out the pieces that move to re_pe.py --------------------------------
shannon_b, shannon_i, shannon_j = block(r"^def shannon\(", r"^def entropy_profile")
cstring_b, cstring_i, cstring_j = block(r"^def _cstring\(", r"^class PEError")
peerror_b, peerror_i, peerror_j = block(r"^class PEError", r"^def parse_pe")
packer_b, packer_i, packer_j = block(r"^PACKER_SECTION_NAMES", r"^SUSPICIOUS_APIS")
machine_b, machine_i, machine_j = block(r"^MACHINE_NAMES", r"^def parse_pe")
parsepe_b, parsepe_i, parsepe_j = block(r"^def parse_pe\(", r"^def extract_strings")

# READ_CAP constant line
readcap_b, readcap_i, readcap_j = block(r"^READ_CAP = ", r"^STRINGS_CAP")

# --- build re_pe.py -------------------------------------------------------------
pe_header = '''"""Byte-level PE engine for the `re` toolkit.

Split out of re_core.py (scanner file-too-large limit) so each module stays
under the budget; re_core re-exports the public names and `rex.py` is
unchanged. Parse phases are separate helpers: headers, sections, imports,
flags - parse_pe orchestrates them.
"""
from __future__ import annotations

import hashlib
import math
import os
import struct

READ_CAP = 64 * 1024 * 1024          # never buffer more than 64 MiB

'''

parse_pe_new = '''def _pe_headers(buf: bytes, e_lfanew: int, coff: int) -> dict:
    """COFF + optional header + data directory directory."""
    (machine, nsec, tstamp, _sym_ptr, _nsyms,
     size_opt, chars) = struct.unpack_from("<HHIIIHH", buf, coff)
    opt = coff + 20
    if len(buf) < opt + 2:
        raise PEError("optional header truncated")
    magic = struct.unpack_from("<H", buf, opt)[0]
    if magic == 0x20B:
        pe32plus, numdd_off = True, opt + 108
    elif magic == 0x10B:
        pe32plus, numdd_off = False, opt + 92
    else:
        raise PEError(f"unknown optional header magic 0x{magic:04x}")
    entry = struct.unpack_from("<I", buf, opt + 16)[0]
    image_base = struct.unpack_from("<Q" if pe32plus else "<I", buf, opt + 24)[0]
    size_of_image = struct.unpack_from("<I", buf, opt + 56)[0]
    size_of_headers = struct.unpack_from("<I", buf, opt + 60)[0]
    subsystem = struct.unpack_from("<H", buf, opt + 68)[0]
    num_dd = struct.unpack_from("<I", buf, numdd_off)[0]
    dd_off = numdd_off + 4
    num_dd = min(num_dd, 16)
    data_dirs = []
    for i in range(num_dd):
        rva, dsz = struct.unpack_from("<II", buf, dd_off + i * 8)
        data_dirs.append({"index": i, "rva": rva, "size": dsz})
    return {
        "machine": machine, "nsec": nsec, "tstamp": tstamp, "chars": chars,
        "pe32plus": pe32plus, "size_opt": size_opt, "entry": entry,
        "image_base": image_base, "size_of_image": size_of_image,
        "size_of_headers": size_of_headers, "subsystem": subsystem,
        "data_dirs": data_dirs,
    }


def _pe_sections(buf: bytes, sec_tab: int, nsec: int) -> list:
    """Section table with per-section Shannon entropy."""
    sections = []
    for i in range(nsec):
        base = sec_tab + i * 40
        if base + 40 > len(buf):
            raise PEError("section table truncated")
        raw_name = buf[base:base + 8].rstrip(b"\\x00")
        name = raw_name.decode("latin-1", "replace")
        vsize, vaddr, rawsize, rawptr = struct.unpack_from("<IIII", buf, base + 8)
        schars = struct.unpack_from("<I", buf, base + 36)[0]
        sdata = buf[rawptr:rawptr + min(rawsize, 4 * 1024 * 1024)] if rawsize else b""
        sections.append({
            "name": name,
            "virtual_size": vsize,
            "virtual_address": vaddr,
            "raw_size": rawsize,
            "raw_ptr": rawptr,
            "entropy": round(shannon(sdata), 3) if sdata else 0.0,
            "executable": bool(schars & 0x20000000),
            "writable": bool(schars & 0x80000000),
        })
    return sections


def _rva_to_off(rva: int, sections: list, buf: bytes, size_of_headers: int):
    """Translate an RVA to a file offset through the section table."""
    if rva == 0:
        return None
    for s in sections:
        span = max(s["virtual_size"], s["raw_size"])
        if s["virtual_address"] <= rva < s["virtual_address"] + span:
            delta = rva - s["virtual_address"]
            off = s["raw_ptr"] + delta
            if 0 <= off < len(buf):
                return off
            return None
    if rva < max(size_of_headers, 0x400):
        return rva if rva < len(buf) else None
    return None


def _pe_imports(buf: bytes, data_dirs: list, sections: list, pe32plus: bool,
                size_of_headers: int) -> list:
    """Walk the import directory: DLL name + function list per descriptor."""
    imports = []
    imp_dir = data_dirs[1] if len(data_dirs) > 1 else {"rva": 0, "size": 0}
    if not imp_dir["rva"]:
        return imports

    def rva_to_off(rva: int):
        return _rva_to_off(rva, sections, buf, size_of_headers)

    off = rva_to_off(imp_dir["rva"])
    thunk_size = 8 if pe32plus else 4
    ord_flag = 1 << (63 if pe32plus else 31)
    while off is not None and off + 20 <= len(buf):
        oft, _tds, _fc, name_rva, ft = struct.unpack_from("<IIIII", buf, off)
        if oft == 0 and name_rva == 0 and ft == 0:
            break
        dll_off = rva_to_off(name_rva)
        dll = _cstring(buf, dll_off) if dll_off is not None else "?"
        funcs = []
        walk_rva = oft or ft
        t_off = rva_to_off(walk_rva)
        steps = 0
        while t_off is not None and t_off + thunk_size <= len(buf) and steps < 4096:
            thunk = struct.unpack_from("<Q" if pe32plus else "<I", buf, t_off)[0]
            if thunk == 0:
                break
            if thunk & ord_flag:
                funcs.append(f"ord{thunk & 0xFFFF}")
            else:
                hn = rva_to_off(thunk & 0x7FFFFFFF)
                if hn is not None and hn + 2 < len(buf):
                    funcs.append(_cstring(buf, hn + 2))
            t_off += thunk_size
            steps += 1
        imports.append({"dll": dll, "functions": funcs})
        off += 20
    return imports


def _pe_flags(sections: list, nsec: int, tstamp: int, data_dirs: list) -> list:
    """Packer / anomaly heuristics over the parsed structures."""
    flags = []
    for s in sections:
        key = s["name"].lower()
        if key in PACKER_SECTION_NAMES:
            flags.append(f"packer section '{s['name']}' -> {PACKER_SECTION_NAMES[key]}")
        if s["executable"] and s["entropy"] > 7.2 and s["raw_size"] > 2048:
            flags.append(f"executable section '{s['name']}' entropy {s['entropy']} -> packed/encrypted code")
        if s["writable"] and s["executable"]:
            flags.append(f"section '{s['name']}' is writable+executable (self-modifying pattern)")
    if not sections and nsec == 0:
        flags.append("zero sections declared")
    ts_year = 1970 + (tstamp // 31556952) if tstamp else 0
    if tstamp == 0:
        flags.append("zero compile timestamp (commonly faked or reproducible build)")
    elif ts_year > 2027:
        flags.append(f"compile timestamp year ~{ts_year} is in the future -> faked")
    return flags


def parse_pe(path: str) -> dict:
    """Parse PE headers/sections/imports [measured]. Raises PEError if not PE."""
    size = os.path.getsize(path)
    with open(path, "rb") as fh:
        buf = fh.read(min(size, READ_CAP))
    if len(buf) < 0x40 or buf[:2] != b"MZ":
        raise PEError("not an MZ image")
    e_lfanew = struct.unpack_from("<I", buf, 0x3C)[0]
    if e_lfanew + 24 > len(buf) or buf[e_lfanew:e_lfanew + 4] != b"PE\\x00\\x00":
        raise PEError("PE signature not found (corrupt or MZ-only dropper)")

    coff = e_lfanew + 4
    h = _pe_headers(buf, e_lfanew, coff)
    sections = _pe_sections(buf, coff + 20 + h["size_opt"], h["nsec"])
    imports = _pe_imports(buf, h["data_dirs"], sections, h["pe32plus"], h["size_of_headers"])

    # overlay
    end_of_sections = 0
    for s in sections:
        end_of_sections = max(end_of_sections, s["raw_ptr"] + s["raw_size"])
    end_of_sections = max(end_of_sections, h["size_of_headers"])
    overlay = max(0, len(buf) - end_of_sections)

    # imphash (best-effort pefile-style)
    imphash = None
    entries = []
    for imp in imports:
        dll = imp["dll"].lower()
        for f in imp["functions"]:
            fname = f.lower() if not f.startswith("ord") else f
            entries.append(f"{dll}.{fname}")
    if entries:
        imphash = hashlib.md5(",".join(entries).encode()).hexdigest()

    flags = _pe_flags(sections, h["nsec"], h["tstamp"], h["data_dirs"])
    dotnet = len(h["data_dirs"]) > 14 and h["data_dirs"][14]["rva"] != 0
    machine = h["machine"]

    return {
        "machine": f"0x{machine:04x}" + (f" ({MACHINE_NAMES.get(machine, '?')})" if machine in MACHINE_NAMES else ""),
        "timestamp": h["tstamp"],
        "timestamp_note": "see flags" if flags else "",
        "characteristics": f"0x{h['chars']:04x}",
        "entry_point": f"0x{h['entry']:x} (RVA), VA 0x{h['image_base'] + h['entry']:x}",
        "image_base": f"0x{h['image_base']:x}",
        "subsystem": SUBSYSTEM_NAMES.get(h["subsystem"], f"0x{h['subsystem']:x}"),
        "dotnet": dotnet,
        "size_of_image": f"0x{h['size_of_image']:x}",
        "sections": sections,
        "data_dirs": h["data_dirs"],
        "imports": imports,
        "imphash_best_effort": imphash,
        "overlay_bytes": overlay,
        "flags": flags,
        "pe32plus": h["pe32plus"],
    }
'''

re_pe = (
    pe_header
    + shannon_b.rstrip() + "\n\n\n"
    + cstring_b.rstrip() + "\n\n\n"
    + peerror_b.rstrip() + "\n\n\n"
    + packer_b.rstrip() + "\n\n\n"
    + machine_b.rstrip() + "\n\n"
    + parse_pe_new
)
(ROOT / "scripts/re/re_pe.py").write_text(re_pe)
print(f"re_pe.py written ({len(re_pe.splitlines())} lines)")

# --- trim re_core.py ------------------------------------------------------------
# remove moved blocks in ONE pass (overlapping ranges shift indices otherwise)
pairs = [(parsepe_i, parsepe_j), (machine_i, machine_j), (packer_i, packer_j),
         (peerror_i, peerror_j), (cstring_i, cstring_j), (shannon_i, shannon_j),
         (readcap_i, readcap_j)]
remove = set()
for i, j in pairs:
    remove.update(range(i, j))
lines2 = [l for n, l in enumerate(lines) if n not in remove]
s2 = "".join(lines2)
# imports: struct no longer needed? build_benign_pe uses struct - check usage
import_count = s2.count("struct.")
print(f"re_core still uses struct x{import_count}")
# add the re-export import after the stdlib imports
anchor = "from pathlib import Path\n"
assert anchor in s2
s2 = s2.replace(anchor, anchor + "\n# PE engine lives in re_pe.py (scanner file budget); names are re-exported\n# so `import re_core as core` keeps working unchanged.\nfrom re_pe import (  # noqa: F401 - re-exported for rex.py\n    READ_CAP,\n    MACHINE_NAMES,\n    PACKER_SECTION_NAMES,\n    PEError,\n    SUBSYSTEM_NAMES,\n    _cstring,\n    parse_pe,\n    shannon,\n)\n", 1)
core.write_text(s2)
print(f"re_core.py trimmed ({len(s2.splitlines())} lines)")
