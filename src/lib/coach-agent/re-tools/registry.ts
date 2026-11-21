// ---------- registry ----------

import type { ToolDef } from "../tools";
import { reIocNormalize } from "./ioc";
import { reIntelLookup } from "./intel";
import { reRunbook } from "./runbooks";
import { reSampleUpload } from "./consent";
import { reCaseRecord } from "./case-record";

export const RE_TOOL_TIERS: Record<string, string> = {
  re_ioc_normalize: "read",
  re_runbook: "read",
  re_intel_lookup: "network",
  re_sample_upload: "network",
  re_case_record: "state",
};

export const RE_TOOLS: ToolDef[] = [
  {
    name: "re_ioc_normalize",
    desc: "Extract and classify IOCs from any pasted text: hashes (flags TRUNCATED/nonstandard lengths - the #1 data-quality trap), IPs (public vs private), domains, URLs (auto-refangs hxxp:// and [.]), emails, registry keys. Use FIRST on every analysis request before looking anything up.",
    args: '{"text": "abuse.ch 1124e79d... 45.33.32.156 hxxp://evil[.]example.com/a.bin"}',
    run: reIocNormalize,
  },
  {
    name: "re_intel_lookup",
    desc: "Passive IOC lookup - NO upload, NO approval needed. Hashes (YARAify, MalwareBazaar when MB_AUTH_KEY is set, URLhaus payloads, ThreatFox) AND IPs/domains/URLs (ThreatFox, URLhaus hosts). Auto-detects the IOC type; refuses truncated/nonstandard hashes instead of guessing; returns direct browser deep links for VirusTotal/urlscan/Triage.",
    args: '{"hash": "<full sha256/md5/sha1>"}  or  {"ioc": "45.33.32.156" | "evil.example.top" | "https://..."}',
    run: reIntelLookup,
  },
  {
    name: "re_runbook",
    desc: "Curated analyst runbooks with the isolation checklist: triage (DIE/HxD/strings/browser-first lookups), static PE (Ghidra/IDA decompile-to-pseudo-C), static ELF, dynamic Windows (x64dbg/OllyDbg, API breakpoints, unpacking), dynamic Linux (GDB/strace), forensics (Procmon/Wireshark/Volatility), report (IOC/MITRE/YARA). Use whenever guiding an analysis.",
    args: '{"phase": "triage|static|dynamic|dynamic_linux|forensics|report", "platform": "windows|linux"}',
    run: reRunbook,
  },
  {
    name: "re_sample_upload",
    desc: "CONSENT-GATED upload workflow for Triage / ANY.RUN / VirusTotal / MalwareBazaar / YARAify. Calling it without confirm=true only returns the consent question (nothing happens). With confirm=true it LOGS the learner's approval and returns the exact browser upload steps. The sample file is never transmitted by this tool - the learner uploads it themselves.",
    args: '{"target": "triage|anyrun|virustotal|malwarebazaar|yaraify", "confirm": false, "note": "why"}',
    run: reSampleUpload,
  },
  {
    name: "re_case_record",
    desc: "Persist reverse-engineering cases in the database so they survive the session: save intel findings, IOCs, runbook progress and open questions under a case_id; get/list/delete to manage. Use at the end of every analysis turn and whenever new intel arrives.",
    args: '{"action": "save|get|list|delete", "case_id": "sample-1124e79d", "title": "...", "data": {"hash": "...", "findings": "..."}}',
    run: reCaseRecord,
  },
];
