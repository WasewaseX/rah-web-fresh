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

# PE engine lives in re_pe.py (scanner file budget); names are re-exported
# so `import re_core as core` keeps working unchanged.
from re_pe import (  # noqa: F401 - re-exported for rex.py
    READ_CAP,
    MACHINE_NAMES,
    PACKER_SECTION_NAMES,
    PEError,
    SUBSYSTEM_NAMES,
    _cstring,
    parse_pe,
    shannon,
)

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
