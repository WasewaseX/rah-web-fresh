#!/usr/bin/env python3
"""re_intel.py - online platform integration for the RE Lab capability.

Browser-first doctrine:
  * Deep links to GUI platforms are ALWAYS produced (no keys, no downloads).
  * Keyless page lookups (MalwareBazaar public browse page) are attempted
    before any keyed API call.
  * Keyed API lookups run only when keys exist in the environment:
      VT_API_KEY, TRIAGE_API_KEY, MB_AUTH_KEY, HA_API_KEY
  * UPLOADS are consent-gated TWICE: the CLI requires --confirm
    "UPLOAD:<sha256[:12]>" AND this module re-checks the token before
    sending anything. Every attempt (including refusals) is written to the
    audit ledger.

Evidence rules: results carry platform + status + summary exactly as
returned. Nothing is invented. Failures are reported as failures.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

LEDGER_PATH = Path("/home/z/my-project/download/re-lab/ledger.jsonl")
UA = "rex-re-lab/1.0 (defensive static triage; no sample execution)"
TIMEOUT = 20

VT_API = "https://www.virustotal.com/api/v3"
TRIAGE_API = "https://tria.ge/api/v0"
MB_API = "https://mb-api.abuse.ch/api/v1/"
HA_API = "https://www.hybrid-analysis.com/api/v2"


# ---------------------------------------------------------------------------
# Audit ledger
# ---------------------------------------------------------------------------

def log_event(kind: str, **fields) -> dict:
    LEDGER_PATH.parent.mkdir(parents=True, exist_ok=True)
    event = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "kind": kind, **fields}
    with open(LEDGER_PATH, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(event, ensure_ascii=True) + "\n")
    return event


def read_ledger(limit: int = 50) -> list:
    if not LEDGER_PATH.exists():
        return []
    lines = LEDGER_PATH.read_text(encoding="utf-8").strip().splitlines()
    return [json.loads(l) for l in lines[-limit:]]


# ---------------------------------------------------------------------------
# Browser deep links (always available, no keys)
# ---------------------------------------------------------------------------

def deep_links(digest: str) -> list:
    d = digest.lower()
    return [
        {"platform": "VirusTotal GUI",
         "url": f"https://www.virustotal.com/gui/file/{d}",
         "note": "70+ AV verdicts, behaviour sandbox reports, relations"},
        {"platform": "MalwareBazaar (abuse.ch)",
         "url": f"https://bazaar.abuse.ch/browse.php?search=sha256%3A{d}",
         "note": "sample exchange: family, tags, signatures, YARA"},
        {"platform": "Triage (Recorded Future)",
         "url": f"https://tria.ge/search?q=sha256%3A{d}",
         "note": "public sandbox reports (login required for search UI)"},
        {"platform": "Hybrid Analysis",
         "url": f"https://www.hybrid-analysis.com/search?query={d}",
         "note": "community sandbox reports, K/YARA indicators"},
        {"platform": "ANY.RUN",
         "url": "https://app.any.run/submissions/",
         "note": "interactive detonation; hash search needs free TI account"},
        {"platform": "FileScan.io",
         "url": "https://filescan.io/",
         "note": "emulation-based analysis; upload/search via web UI"},
    ]


# ---------------------------------------------------------------------------
# Small HTTP helpers
# ---------------------------------------------------------------------------

def _get(url: str, headers: dict) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA, **headers})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return {"status": resp.status, "body": resp.read()}


def _post_form(url: str, data: dict, headers: dict) -> dict:
    body = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(url, data=body, method="POST",
                                 headers={"User-Agent": UA, **headers})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return {"status": resp.status, "body": resp.read()}


def _post_json(url: str, payload: dict, headers: dict) -> dict:
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, method="POST",
                                 headers={"User-Agent": UA,
                                          "Content-Type": "application/json", **headers})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return {"status": resp.status, "body": resp.read()}


# ---------------------------------------------------------------------------
# Keyless browser-first lookup: MalwareBazaar public browse page
# ---------------------------------------------------------------------------

def lookup_mb_browse_page(sha256: str) -> dict:
    """Try the public browse page like a browser would. No key, no upload.

    Research note (verified live): bazaar.abuse.ch redirects scripted fetches
    (even with a browser User-Agent) to a /verify-ua/ JS challenge, so this
    keyless path usually reports browser_required. That is BY DESIGN
    browser-first: hand the URL to the user's browser, or register a free
    Auth-Key (auth.abuse.ch) for the API path.
    """
    url = f"https://bazaar.abuse.ch/browse.php?search=sha256%3A{sha256}"
    try:
        r = _get(url, {"Accept": "text/html"})
        page = r["body"].decode("utf-8", "replace")
        if "/sample/" in page:
            return {"platform": "MalwareBazaar browse", "mode": "keyless-page",
                    "status": "found", "found": True, "url": url,
                    "summary": "sample page exists on MalwareBazaar (open URL for family/tags)"}
        if "verify-ua" in page or "Checking your browser" in page:
            return {"platform": "MalwareBazaar browse", "mode": "keyless-page",
                    "status": "browser_required", "found": None, "url": url,
                    "summary": ("platform bot-gates scripts (JS challenge); open the URL "
                                "in a real browser, or set MB_AUTH_KEY for the API")}
        if "not found" in page.lower() or "no results" in page.lower() or "didn't return" in page.lower():
            return {"platform": "MalwareBazaar browse", "mode": "keyless-page",
                    "status": "not_found", "found": False, "url": url,
                    "summary": "hash not present in MalwareBazaar (public page)"}
        return {"platform": "MalwareBazaar browse", "mode": "keyless-page",
                "status": "unclear", "found": None, "url": url,
                "summary": "page fetched but marker unclear; open URL in browser"}
    except Exception as exc:
        return {"platform": "MalwareBazaar browse", "mode": "keyless-page",
                "status": "offline", "found": None, "url": url,
                "summary": f"fetch failed: {type(exc).__name__}"}


# ---------------------------------------------------------------------------
# Keyed API lookups
# ---------------------------------------------------------------------------

def lookup_virustotal(sha256: str, key: str) -> dict:
    url = f"{VT_API}/files/{sha256}"
    try:
        r = _get(url, {"x-apikey": key})
        obj = json.loads(r["body"])["data"]
        stats = obj.get("attributes", {}).get("last_analysis_stats", {})
        name = (obj.get("attributes", {}).get("popular_threat_classification", {})
                .get("suggested_threat_label", ""))
        names = obj.get("attributes", {}).get("names", [])[:3]
        return {"platform": "VirusTotal API v3", "mode": "api", "status": "found",
                "found": True, "url": f"https://www.virustotal.com/gui/file/{sha256}",
                "summary": {"verdicts": stats, "threat_label": name, "names": names}}
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return {"platform": "VirusTotal API v3", "mode": "api", "status": "not_found",
                    "found": False, "url": None, "summary": "unknown to VT (may need upload)"}
        if exc.code in (401, 403):
            return {"platform": "VirusTotal API v3", "mode": "api", "status": "bad_key",
                    "found": None, "url": None, "summary": f"auth failed (HTTP {exc.code})"}
        if exc.code == 429:
            return {"platform": "VirusTotal API v3", "mode": "api", "status": "rate_limited",
                    "found": None, "url": None, "summary": "quota exceeded (free: 4/min, 500/day)"}
        return {"platform": "VirusTotal API v3", "mode": "api", "status": "error",
                "found": None, "url": None, "summary": f"HTTP {exc.code}"}
    except Exception as exc:
        return {"platform": "VirusTotal API v3", "mode": "api", "status": "offline",
                "found": None, "url": None, "summary": f"{type(exc).__name__}"}


def lookup_malwarebazaar(sha256: str, key: str) -> dict:
    try:
        r = _post_form(MB_API, {"query": "info", "sha256": sha256},
                       {"Auth-Key": key})
        obj = json.loads(r["body"])
        data = obj.get("data")
        if not data:
            return {"platform": "MalwareBazaar API", "mode": "api", "status": "not_found",
                    "found": False, "url": None, "summary": "hash not in MB database"}
        first = data[0] if isinstance(data, list) else data
        summary = {k: first.get(k) for k in
                   ("file_type", "signature", "tags", "imphash", "first_seen",
                    "last_seen", "reporter") if first.get(k)}
        return {"platform": "MalwareBazaar API", "mode": "api", "status": "found",
                "found": True,
                "url": f"https://bazaar.abuse.ch/sample/{sha256}/",
                "summary": summary}
    except urllib.error.HTTPError as exc:
        return {"platform": "MalwareBazaar API", "mode": "api", "status": "error",
                "found": None, "url": None, "summary": f"HTTP {exc.code} (Auth-Key valid?)"}
    except Exception as exc:
        return {"platform": "MalwareBazaar API", "mode": "api", "status": "offline",
                "found": None, "url": None, "summary": f"{type(exc).__name__}"}


def lookup_triage(sha256: str, key: str) -> dict:
    try:
        r = _get(f"{TRIAGE_API}/search?query=sha256:{sha256}",
                 {"Authorization": f"Bearer {key}"})
        items = json.loads(r["body"])
        if not items:
            return {"platform": "Triage API v0", "mode": "api", "status": "not_found",
                    "found": False, "url": None, "summary": "no public Triage reports"}
        fams = sorted({s.get("family", "") or "" for s in items if isinstance(s, dict)})
        return {"platform": "Triage API v0", "mode": "api", "status": "found",
                "found": True,
                "url": f"https://tria.ge/search?q=sha256%3A{sha256}",
                "summary": {"tasks": len(items), "families": [f for f in fams if f]}}
    except urllib.error.HTTPError as exc:
        return {"platform": "Triage API v0", "mode": "api", "status": "error",
                "found": None, "url": None, "summary": f"HTTP {exc.code}"}
    except Exception as exc:
        return {"platform": "Triage API v0", "mode": "api", "status": "offline",
                "found": None, "url": None, "summary": f"{type(exc).__name__}"}


def lookup_hybrid(sha256: str, key: str) -> dict:
    try:
        body = urllib.parse.urlencode({"hashes[]": sha256}).encode()
        req = urllib.request.Request(
            f"{HA_API}/search/hash", data=body, method="POST",
            headers={"User-Agent": UA, "api-key": key,
                     "Accept": "application/json",
                     "Content-Type": "application/x-www-form-urlencoded"})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            items = json.loads(resp.read())
        if not items:
            return {"platform": "Hybrid Analysis API v2", "mode": "api",
                    "status": "not_found", "found": False, "url": None,
                    "summary": "no HA reports for this hash"}
        first = items[0]
        return {"platform": "Hybrid Analysis API v2", "mode": "api", "status": "found",
                "found": True,
                "url": f"https://www.hybrid-analysis.com/search?query={sha256}",
                "summary": {"verdict": first.get("verdict"),
                            "threat_score": first.get("threat_score"),
                            "family": first.get("vx_family"),
                            "submitted": first.get("submitdate")}}
    except urllib.error.HTTPError as exc:
        return {"platform": "Hybrid Analysis API v2", "mode": "api", "status": "error",
                "found": None, "url": None, "summary": f"HTTP {exc.code}"}
    except Exception as exc:
        return {"platform": "Hybrid Analysis API v2", "mode": "api", "status": "offline",
                "found": None, "url": None, "summary": f"{type(exc).__name__}"}


def lookup_all(sha256: str) -> list:
    """Keyless-first, then keyed APIs available in env. Ledger-logged."""
    results = [lookup_mb_browse_page(sha256)]
    keys = {
        "virustotal": os.environ.get("VT_API_KEY", ""),
        "malwarebazaar": os.environ.get("MB_AUTH_KEY", ""),
        "triage": os.environ.get("TRIAGE_API_KEY", ""),
        "hybrid": os.environ.get("HA_API_KEY", ""),
    }
    if keys["virustotal"]:
        results.append(lookup_virustotal(sha256, keys["virustotal"]))
    if keys["malwarebazaar"]:
        results.append(lookup_malwarebazaar(sha256, keys["malwarebazaar"]))
    if keys["triage"]:
        results.append(lookup_triage(sha256, keys["triage"]))
    if keys["hybrid"]:
        results.append(lookup_hybrid(sha256, keys["hybrid"]))
    missing = [k for k, v in keys.items() if not v]
    results.append({"platform": "env-status", "mode": "info", "status": "ok",
                    "found": None, "url": None,
                    "summary": ("no key for: " + ", ".join(missing)) if missing
                    else "all keys present"})
    log_event("lookup", sha256=sha256,
              platforms=[r["platform"] for r in results])
    return results


# ---------------------------------------------------------------------------
# Consent-gated uploads (DOUBLE gate: CLI token + module token)
# ---------------------------------------------------------------------------

def consent_token(sha256: str) -> str:
    return f"UPLOAD:{sha256[:12]}"


def _multipart(fields: dict, file_field: str, filename: str, data: bytes) -> tuple:
    boundary = "----rexlabsboundary7d1a2c"
    lines = []
    for k, v in fields.items():
        lines.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n")
    lines.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{file_field}\"; "
                 f"filename=\"{filename}\"\r\nContent-Type: application/octet-stream\r\n\r\n")
    body = "".join(lines).encode("latin-1") + data + f"\r\n--{boundary}--\r\n".encode()
    ctype = f"multipart/form-data; boundary={boundary}"
    return body, ctype


def upload_virustotal(path: str, key: str, confirmed_token: str) -> dict:
    sha = file_sha256(path)
    if confirmed_token != consent_token(sha):
        log_event("upload_refused", platform="virustotal", sha256=sha, reason="token_mismatch")
        return {"ok": False, "error": "consent gate: token mismatch - upload NOT performed",
                "retryable": False}
    if not key:
        log_event("upload_refused", platform="virustotal", sha256=sha, reason="no_api_key")
        return {"ok": False, "error": "VT_API_KEY not set", "retryable": False}
    data = Path(path).read_bytes()
    body, ctype = _multipart({}, "file", os.path.basename(path), data)
    req = urllib.request.Request(f"{VT_API}/files", data=body, method="POST",
                                 headers={"User-Agent": UA, "x-apikey": key,
                                          "Content-Type": ctype})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            out = json.loads(resp.read())
        log_event("upload", platform="virustotal", sha256=sha, result="accepted",
                  consent_token=confirmed_token)
        return {"ok": True, "result": out}
    except Exception as exc:
        log_event("upload", platform="virustotal", sha256=sha, result=f"failed:{type(exc).__name__}",
                  consent_token=confirmed_token)
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}", "retryable": True}


def upload_malwarebazaar(path: str, key: str, confirmed_token: str) -> dict:
    sha = file_sha256(path)
    if confirmed_token != consent_token(sha):
        log_event("upload_refused", platform="malwarebazaar", sha256=sha, reason="token_mismatch")
        return {"ok": False, "error": "consent gate: token mismatch - upload NOT performed",
                "retryable": False}
    if not key:
        log_event("upload_refused", platform="malwarebazaar", sha256=sha, reason="no_api_key")
        return {"ok": False, "error": "MB_AUTH_KEY not set (free at auth.abuse.ch)",
                "retryable": False}
    data = Path(path).read_bytes()
    fields = {"query": "uploadfile", "anonymous": "0"}
    body, ctype = _multipart(fields, "file", os.path.basename(path), data)
    req = urllib.request.Request(MB_API, data=body, method="POST",
                                 headers={"User-Agent": UA, "Auth-Key": key,
                                          "Content-Type": ctype})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            out = json.loads(resp.read())
        log_event("upload", platform="malwarebazaar", sha256=sha, result=str(out.get("status")),
                  consent_token=confirmed_token)
        return {"ok": True, "result": out}
    except Exception as exc:
        log_event("upload", platform="malwarebazaar", sha256=sha,
                  result=f"failed:{type(exc).__name__}", consent_token=confirmed_token)
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}", "retryable": True}


def file_sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()
