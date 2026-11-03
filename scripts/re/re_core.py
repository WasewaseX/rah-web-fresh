#!/usr/bin/env python3
"""re_core.py - read-only static triage core for the RE Lab capability.

HARD RULES
  * Every function in this module only READS sample bytes (open(path, 'rb')).
  * Samples are NEVER executed, emulated or detonated on the host machine.
  * All findings are returned as data; the caller decides what is [measured]
    vs [heuristic].

Python 3.8+ standard library only (no pip installs by design).
"""
from __future__ import annotations

import hashlib
import math
import os
import re
import struct
from pathlib import Path

READ_CAP = 64 * 1024 * 1024          # never buffer more than 64 MiB
STRINGS_CAP = 32 * 1024 * 1024       # strings extraction cap
MAX_STRINGS = 20000                  # keep IOC extraction bounded

# ---------------------------------------------------------------------------
# Identification
# ---------------------------------------------------------------------------

MAGIC_TABLE = [
    (b"MZ", "PE executable (Windows)"),
    (b"\x7fELF", "ELF executable (Linux/Unix)"),
    (b"\xfe\xed\xfa\xce", "Mach-O (32-bit, big-endian)"),
    (b"\xfe\xed\xfa\xcf", "Mach-O (64-bit, big-endian)"),
    (b"\xce\xfa\xed\xfe", "Mach-O (32-bit, little-endian)"),
    (b"\xcf\xfa\xed\xfe", "Mach-O (64-bit, little-endian)"),
    (b"%PDF", "PDF document"),
    (b"PK\x03\x04", "ZIP archive / OOXML / APK container"),
    (b"\x89PNG", "PNG image"),
    (b"Rar!", "RAR archive"),
    (b"7z\xbc\xaf\x27\x1c", "7-Zip archive"),
    (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", "OLE2 compound file (MSI/DOC/XLS)"),
    (b"\x1f\x8b", "GZIP stream"),
    (b"BZh", "BZIP2 stream"),
    (b"\xfd7zXZ", "XZ stream"),
    (b"#!", "Script (shebang)"),
    (b"OggS", "Ogg container"),
    (b"ID3", "MP3 audio"),
    (b"\x4c\x00\x00\x00\x01\x14\x02\x00", "Windows shortcut (.lnk)"),
]

PACKER_SECTION_NAMES = {
    "upx0": "UPX", "upx1": "UPX", "upx2": "UPX", "upx!": "UPX",
    "mpress1": "MPRESS", "mpress2": "MPRESS",
    ".aspack": "ASPack", ".adata": "ASPack", "aspack": "ASPack",
    ".petite": "Petite", ".nsp0": "NsPack", ".nsp1": "NsPack",
    ".nsp2": "NsPack", ".themida": "Themida", ".vmp0": "VMProtect",
    ".vmp1": "VMProtect", ".enigma1": "Enigma", ".enigma2": "Enigma",
    "pec1": "PECompact", "pec2": "PECompact", ".y0da": "Yoda",
}

SUSPICIOUS_APIS = [
    # injection / process manipulation
    "CreateRemoteThread", "CreateRemoteThreadEx", "WriteProcessMemory",
    "VirtualAllocEx", "NtUnmapViewOfSection", "QueueUserAPC",
    "SetThreadContext", "NtCreateThreadEx", "RtlCreateUserThread",
    # hooks / input capture
    "SetWindowsHookEx", "GetAsyncKeyState", "GetKeyState",
    # anti-analysis
    "IsDebuggerPresent", "CheckRemoteDebuggerPresent", "OutputDebugString",
    "NtQueryInformationProcess", "NtSetInformationThread",
    # execution / evasion
    "WinExec", "ShellExecuteA", "ShellExecuteW", "CreateProcessA",
    "CreateProcessW", "System", "LoadLibraryA", "LoadLibraryW",
    "GetProcAddress", "LdrLoadDll",
    # network retrieval
    "URLDownloadToFileA", "URLDownloadToFileW", "InternetOpenA",
    "InternetOpenUrlA", "HttpSendRequestA", "WinHttpOpen",
    "WinHttpConnect", "WinHttpSendRequest",
    # crypto / ransom behaviour
    "CryptEncrypt", "CryptDecrypt", "CryptCreateHash", "BCryptEncrypt",
    # persistence
    "RegSetValueExA", "RegSetValueExW", "RegCreateKeyExA",
    "SetServiceStatus", "CreateServiceA", "CreateServiceW",
    # file / discovery
    "FindFirstFileA", "GetLogicalDrives", "GetDriveTypeA",
    "DeleteFileA", "MoveFileExA",
]

REGEX_URL = re.compile(rb"https?://[^\s\"'<>\\]{4,256}")
REGEX_IPV4 = re.compile(rb"\b(?:\d{1,3}\.){3}\d{1,3}\b")
REGEX_EMAIL = re.compile(rb"[\w.+-]+@[\w-]+\.[\w.-]{2,}")
REGEX_REGPATH = re.compile(rb"(?:HKEY_[A-Z_]+|\\Registry\\[A-Za-z0-9\\ .]+)")
REGEX_WINPATH = re.compile(rb"[A-Za-z]:\\(?:[^\s\"'\\/:*?<>|]+\\?)+")
REGEX_ENVVAR = re.compile(rb"%[A-Z0-9_]+%")
REGEX_CMD = re.compile(rb"(?:cmd\.exe|powershell(?:\.exe)?|wscript|cscript|rundll32|regsvr32|mshta|certutil|bitsadmin)\b[^\n]{0,120}")
REGEX_B64 = re.compile(rb"[A-Za-z0-9+/]{24,}={0,2}")


def file_hashes(path: str) -> dict:
    """MD5/SHA-1/SHA-256/SHA-512 + size + ssdeep-free fingerprint set."""
    h = {n: hashlib.new(n) for n in ("md5", "sha1", "sha256", "sha512")}
    size = 0
    with open(path, "rb") as fh:
        while True:
            chunk = fh.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            for algo in h.values():
                algo.update(chunk)
    out = {name: algo.hexdigest() for name, algo in h.items()}
    out["size"] = size
    return out


def shannon(data: bytes) -> float:
    """Shannon entropy in bits/byte (0.0 - 8.0)."""
    if not data:
        return 0.0
    counts = [0] * 256
    for b in data:
        counts[b] += 1
    ent = 0.0
    n = len(data)
    for c in counts:
        if c:
            p = c / n
            ent -= p * math.log2(p)
    return ent


def entropy_profile(path: str) -> dict:
    """Overall entropy + block profile -> packing verdict [heuristic]."""
    size = os.path.getsize(path)
    with open(path, "rb") as fh:
        data = fh.read(min(size, READ_CAP))
    overall = shannon(data)
    block = 4096
    hi_blocks = 0
    total_blocks = 0
    max_block = 0.0
    for i in range(0, len(data), block):
        chunk = data[i:i + block]
        if len(chunk) < 256:
            continue
        e = shannon(chunk)
        total_blocks += 1
        max_block = max(max_block, e)
        if e > 7.2:
            hi_blocks += 1
    b64 = open(path, "rb").read(16)
    upx_magic = b"UPX!" in data[:READ_CAP] if len(data) < READ_CAP else b"UPX!" in data
    profile = {
        "overall_entropy": round(overall, 3),
        "max_block_entropy": round(max_block, 3),
        "high_entropy_block_ratio": round(hi_blocks / total_blocks, 3) if total_blocks else 0.0,
        "upx_magic": upx_magic,
        "bytes_sampled": len(data),
    }
    verdicts = []
    if upx_magic:
        verdicts.append("UPX signature found -> packed with UPX")
    if overall > 7.9:
        verdicts.append("overall entropy > 7.9 -> almost certainly packed/encrypted")
    elif overall > 7.0:
        verdicts.append("overall entropy > 7.0 -> likely packed/encrypted")
    profile["verdict"] = "; ".join(verdicts) if verdicts else "no strong packing signal"
    profile["class"] = "packed-suspect" if verdicts else "clean"
    return profile


def identify(path: str) -> dict:
    """Magic-based identification [measured]."""
    with open(path, "rb") as fh:
        head = fh.read(4096)
    kind = "unknown"
    for magic, label in MAGIC_TABLE:
        if head.startswith(magic):
            kind = label
            break
    else:
        if head[:2] == b"MZ":
            kind = "PE executable (Windows)"
        elif b"<html" in head[:1024].lower() or b"<script" in head[:1024].lower():
            kind = "HTML/script document"
    return {
        "kind": kind,
        "size": os.path.getsize(path),
        "size_human": human_size(os.path.getsize(path)),
        "magic_prefix": head[:16].hex(),
    }


def human_size(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n / 1:.1f} {unit}"
        n /= 1024.0
    return f"{n:.1f} GB"


# ---------------------------------------------------------------------------
# Pure-Python PE parser
# ---------------------------------------------------------------------------

MACHINE_NAMES = {0x14C: "i386", 0x8664: "x86-64", 0x1C0: "ARM",
                 0xAA64: "ARM64", 0x1C4: "ARMNT"}
SUBSYSTEM_NAMES = {1: "native", 2: "windows-gui", 3: "console",
                   5: "os2", 7: "posix", 9: "windows-ce",
                   10: "efi-application", 14: "efi-boot"}


def _cstring(buf: bytes, off: int, cap: int = 512) -> str:
    end = buf.find(b"\x00", off, off + cap)
    if end == -1:
        end = min(off + cap, len(buf))
    return buf[off:end].decode("latin-1", "replace")


class PEError(Exception):
    pass


def parse_pe(path: str) -> dict:
    """Parse PE headers/sections/imports [measured]. Raises PEError if not PE."""
    size = os.path.getsize(path)
    with open(path, "rb") as fh:
        buf = fh.read(min(size, READ_CAP))
    if len(buf) < 0x40 or buf[:2] != b"MZ":
        raise PEError("not an MZ image")
    e_lfanew = struct.unpack_from("<I", buf, 0x3C)[0]
    if e_lfanew + 24 > len(buf) or buf[e_lfanew:e_lfanew + 4] != b"PE\x00\x00":
        raise PEError("PE signature not found (corrupt or MZ-only dropper)")

    coff = e_lfanew + 4
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
    sect_align = struct.unpack_from("<I", buf, opt + 32)[0]
    file_align = struct.unpack_from("<I", buf, opt + 36)[0]
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

    sec_tab = opt + size_opt
    sections = []
    for i in range(nsec):
        base = sec_tab + i * 40
        if base + 40 > len(buf):
            raise PEError("section table truncated")
        raw_name = buf[base:base + 8].rstrip(b"\x00")
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

    def rva_to_off(rva: int):
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

    # imports
    imports = []
    imp_dir = data_dirs[1] if len(data_dirs) > 1 else {"rva": 0, "size": 0}
    if imp_dir["rva"]:
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

    # overlay
    end_of_sections = 0
    for s in sections:
        end_of_sections = max(end_of_sections, s["raw_ptr"] + s["raw_size"])
    end_of_sections = max(end_of_sections, size_of_headers)
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

    # packer / anomaly flags [heuristic]
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
    dotnet = len(data_dirs) > 14 and data_dirs[14]["rva"] != 0

    return {
        "machine": f"0x{machine:04x}" + (f" ({MACHINE_NAMES.get(machine, '?')})" if machine in MACHINE_NAMES else ""),
        "timestamp": tstamp,
        "timestamp_note": "see flags" if flags else "",
        "characteristics": f"0x{chars:04x}",
        "entry_point": f"0x{entry:x} (RVA), VA 0x{image_base + entry:x}",
        "image_base": f"0x{image_base:x}",
        "subsystem": SUBSYSTEM_NAMES.get(subsystem, f"0x{subsystem:x}"),
        "dotnet": dotnet,
        "size_of_image": f"0x{size_of_image:x}",
        "sections": sections,
        "data_dirs": data_dirs,
        "imports": imports,
        "imphash_best_effort": imphash,
        "overlay_bytes": overlay,
        "flags": flags,
        "pe32plus": pe32plus,
    }


# ---------------------------------------------------------------------------
# Strings + IOC extraction
# ---------------------------------------------------------------------------

def extract_strings(path: str, min_len: int = 6) -> dict:
    size = os.path.getsize(path)
    with open(path, "rb") as fh:
        data = fh.read(min(size, STRINGS_CAP))
    ascii_strings = [m.group().decode("latin-1") for m in
                     re.finditer(rb"[\x20-\x7e]{%d,}" % max(4, min_len), data)]
    utf16 = [m.group().decode("utf-16-le", "replace") for m in
             re.finditer(rb"(?:[\x20-\x7e]\x00){%d,}" % max(4, min_len), data)]
    all_strings = (ascii_strings + utf16)[:MAX_STRINGS]
    return {"count_raw": len(ascii_strings) + len(utf16),
            "kept": len(all_strings), "strings": all_strings}


def extract_iocs(path: str) -> dict:
    strings = extract_strings(path, min_len=5)["strings"]
    blob = "\n".join(strings).encode("latin-1", "replace")

    def uniq(items, cap=60):
        seen, out = set(), []
        for it in items:
            it = it.strip().rstrip(b".")
            if it and it not in seen:
                seen.add(it)
                out.append(it.decode("latin-1", "replace"))
                if len(out) >= cap:
                    break
        return out

    urls = uniq(REGEX_URL.findall(blob))
    ips = uniq([ip for ip in REGEX_IPV4.findall(blob)
                if all(0 <= int(o) <= 255 for o in ip.split(b".")) and
                not ip.endswith(b".0.0") or ip == b"127.0.0.1"], cap=30)
    emails = uniq(REGEX_EMAIL.findall(blob), cap=20)
    registry = uniq(REGEX_REGPATH.findall(blob), cap=30)
    winpaths = uniq(REGEX_WINPATH.findall(blob), cap=30)
    envvars = uniq(REGEX_ENVVAR.findall(blob), cap=20)
    cmds = uniq([c[:160] for c in REGEX_CMD.findall(blob)], cap=20)

    apis = []
    upper_blob = blob.upper()
    for api in SUSPICIOUS_APIS:
        if api.upper().encode() in upper_blob:
            apis.append(api)
    b64_hits = []
    for m in REGEX_B64.finditer(blob):
        tok = m.group()
        if len(tok) % 4:
            continue
        try:
            import base64
            decoded = base64.b64decode(tok, validate=True)
            if len(decoded) >= 8 and sum(32 <= b < 127 for b in decoded[:16]) / min(16, len(decoded)) > 0.8:
                b64_hits.append(tok.decode()[:64])
        except Exception:
            continue
        if len(b64_hits) >= 10:
            break
    mutexes = [s for s in strings if "Mutex" in s or "mutex" in s][:10]

    return {
        "urls": urls, "ips": ips, "emails": emails,
        "registry": registry, "win_paths": winpaths, "env_vars": envvars,
        "shell_commands": cmds, "suspicious_apis": apis,
        "base64_candidates": b64_hits, "mutex_strings": mutexes,
    }


# ---------------------------------------------------------------------------
# Benign synthetic PE builder (SELF-TEST ONLY - never for real samples)
# ---------------------------------------------------------------------------

def build_benign_pe() -> bytes:
    """Build a tiny deterministic PE32+ with one import DLL (for selftest)."""
    dos = b"MZ" + b"\x00" * 0x3A + struct.pack("<I", 0x80) + b"\x00" * 0x40
    coff = struct.pack("<HHIIIHH", 0x8664, 2, 0x5A000000, 0, 0, 240, 0x0022)
    text_rva, rdata_rva = 0x1000, 0x2000
    ep = text_rva
    dd = [(0, 0)] * 16
    dd[1] = (rdata_rva + 0x80, 0x28)  # import directory
    opt = struct.pack(
        "<HBBIIIIIQIIHHHHHHIIIIHHQQQQII" + "II" * 16,
        0x20B, 1, 0,          # magic, linker
        0x200, 0x200, 0,      # code, init, uninit
        ep, text_rva,         # entry, base of code
        0x400000,             # image base
        0x1000, 0x200,        # section/file alignment
        6, 0, 6, 0, 6, 0, 0,  # versions
        0x3000, 0x400, 0,     # sizeof image/headers, checksum
        3, 0,                 # subsystem console, dllchar
        0x100000, 0x1000, 0x100000, 0x1000,  # stacks/heaps
        0, 16,                # loader flags, numrva
        *[v for pair in dd for v in pair],
    )
    assert len(opt) == 240, len(opt)
    sh_text = struct.pack("<8sIIIIIIHHI", b".text", 0x200, text_rva, 0x200, 0x400, 0, 0, 0, 0, 0x60000020)
    sh_rdata = struct.pack("<8sIIIIIIHHI", b".rdata", 0x200, rdata_rva, 0x200, 0x600, 0, 0, 0, 0, 0x40000040)
    headers = dos + b"PE\x00\x00" + coff + opt + sh_text + sh_rdata
    headers += b"\x00" * (0x400 - len(headers))

    text = bytearray(b"\x90" * 0x200)
    plant = b"selftest marker https://example.invalid/beacon"
    text[0x10:0x10 + len(plant)] = plant

    rdata = bytearray(0x200)
    rdata[0x00:0x0D] = b"kernel32.dll\x00"
    rdata[0x10:0x10 + 2 + 12] = struct.pack("<H", 0) + b"ExitProcess\x00"
    oft = struct.pack("<QQQ", rdata_rva + 0x10, (1 << 63) | 7, 0)
    rdata[0x40:0x58] = oft          # OFT (hint/name RVA, ordinal 7, terminator)
    rdata[0x60:0x78] = oft          # IAT mirror
    idt = struct.pack("<IIIII", rdata_rva + 0x40, 0, 0, rdata_rva, rdata_rva + 0x60)
    rdata[0x80:0x94] = idt
    body = bytes(text) + bytes(rdata)
    return headers + body
