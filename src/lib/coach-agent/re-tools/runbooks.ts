// ---------- runbooks (static curated content, no network) ----------

import type { ToolArgs, ToolResult } from "../tools";

const ISOLATION = `ISOLATION CHECKLIST (non-negotiable)
[ ] dedicated analysis VM; snapshot taken immediately before the run
[ ] network: host-only or internal; shared folders OFF; clipboard/drag-drop OFF
[ ] the sample NEVER touches the host OS - not double-clicked, not "just opened to look"
[ ] uploading the sample anywhere = explicit approval first (re_sample_upload)
[ ] every report claim traces to a captured artifact (Procmon row, pcap frame, Volatility output), never to memory`;

const RUNBOOKS: Record<string, string> = {
  triage: `PHASE 1 - TRIAGE (nothing executes; you work from hashes and bytes only)
1. Fingerprints: sha256sum sample.bin (or PowerShell Get-FileHash -Algorithm SHA256). Note size + magic bytes in HxD: "MZ" = PE, "7F 45 4C 46" = ELF.
2. Packer/compiler: Detect It Easy (DIE). Reports compiler, packer (UPX/VMProtect/Themida), per-section entropy. Code-section entropy > 7.2 = packed or encrypted payload.
3. Byte-level look: HxD - strings near the overlay, XOR-encoded blobs, appended data after the PE sections.
4. Strings: strings -n 8 sample.bin | less (Sysinternals strings.exe on Windows); FLOSS for stack-built strings. Hunt: URLs, IPs, mutexes, registry paths, user-agents, crypto constants (AES s-box, base64 tables).
5. Browser-first intel - PASSIVE hash lookups, no upload, no approval needed:
   re_intel_lookup (this agent) runs YARAify now + MalwareBazaar if MB_AUTH_KEY is set.
   Then in the browser: VirusTotal GUI (0/70 or "never seen" are both findings - note which), Triage public search (someone may have detonated it already), MalwareBazaar browse.
6. Public intel empty? Then the sample is worth an UPLOAD (remote detonation on Triage/ANY.RUN) - that is an upload, get approval via re_sample_upload first.
${ISOLATION}`,

  static_windows: `PHASE 2 - STATIC (Windows PE) with Ghidra / IDA Pro. The file still NEVER runs.
Ghidra (free):
1. File > Import File > sample.exe > open CodeBrowser > Auto-Analyze (tick "Decompiler Parameter ID").
2. Entry point: Symbol Tree > Exports > entry. Read the prologue; follow the first calls in the decompiler (pseudo-C, right pane).
3. Strings: Search > For Strings...; double-click a hit, then Ctrl+Shift+E for references TO it. Fastest route to config, C2 URLs, anti-analysis messages.
4. Imports to flag: WinINet/WinHTTP (network), RegSetValueEx (persistence), CreateProcess/WinExec (droppers), VirtualAllocEx + WriteProcessMemory + CreateRemoteThread (injection), IsDebuggerPresent/CheckRemoteDebuggerPresent (anti-debug), CryptEncrypt (ransom behavior).
5. Headless batch: analyzeHeadless . ReProject -import sample.exe -postScript ListFunctions.java
IDA Pro: same flow - F5 = Hex-Rays pseudo-C, Shift+F12 = strings, X = xrefs.
UPX unpack (creates a NEW file, still never runs it): upx -d -o unpacked.exe sample.exe
Export the decompiled functions of interest with addresses - they are your map for x64dbg.`,
  static_linux: `PHASE 2 - STATIC (Linux ELF) with Ghidra / IDA. The file still NEVER runs.
1. readelf -a, objdump -d -M intel for quick triage; check PT_INTERP, DT_NEEDED, section entropy (readelf -S).
2. Ghidra import ELF, Auto-Analyze, decompiler gives pseudo-C as usual. Stripped binaries: start from entry + strings xrefs.
3. Statically-linked? Expect huge function count; anchor on syscall wrappers and strings.
4. UPX: upx -d -o unpacked sample. Custom packers: Ghidra "Find unusual entry prologues" + memory-protection analysis.
5. Anchor artifacts (strings, constants) feed re_ioc_normalize for the case record.`,

  dynamic_windows: `PHASE 3 - DYNAMIC (Windows) with x64dbg. VM MANDATORY - revert to clean snapshot first.
0. Procmon recording STARTED BEFORE launch (filters: Process Name is sample.exe; watch RegSetValue under ...\\CurrentVersion\\Run, File Writes to %APPDATA%/%TEMP%, Process Create children, Thread Start in foreign processes).
1. x64dbg: open sample, F9 = system breakpoint, F9 again = entry. TLS callbacks execute BEFORE entry: Options > Preferences > Events > tick TLS callbacks to break on them.
2. API breakpoints (bp): CreateFileW (drops), RegSetValueExW (persistence), WinHttpConnect / InternetConnectA (C2), WS2_32!connect + send (raw sockets), VirtualAllocEx + WriteProcessMemory (injection), CreateProcessW (child process), WinExec.
3. When breakpoint hits: check the stack (args), dump buffers with right-click > Follow in Dump, log the values into the case.
4. Packed sample - standard unpack: find the tail-jump (jmp/call crossing the allocation boundary), hardware bp on stack (the ESP trick after pushad), run until it hits, then dump with Scylla (Plugins > Scylla) and fix the IAT.
5. OllyDbg: legacy 32-bit only - x64dbg supersedes it; keep Olly for old shellcode exercises.
6. Extracted C2 domains/IPs: verify passively only (DNS, ThreatFox). Never "check" a C2 from the host browser.
${ISOLATION}`,

  dynamic_linux: `PHASE 3 - DYNAMIC (Linux ELF) with GDB. VM MANDATORY - snapshot + host-only network.
1. Behavioral trace first: strace -f -e trace=network,file,process ./sample 2> strace.log; ltrace -f ./sample for libc calls.
2. gdb ./sample - starti (stop at the loader's first instruction); info proc mappings; catch syscall connect execve sendto mprotect.
3. At each syscall stop: x/s $rdi (path/hostname), x/s $rsi, x/32gx $rsp; layout asm + layout regs for context. GEF or pwndbg add syscall context and heap views for free.
4. finish to leave a call, si to step into; break *addr to pin the addresses you found in Ghidra.
5. Packed ELF: UPX -d; custom: watch mprotect with PROT_EXEC followed by a jump - that landing address is the OEP.
${ISOLATION}`,

  forensics: `PHASE 4 - FORENSICS (Procmon + Wireshark + Volatility)
Procmon (Windows): capture BEFORE the run, stop after 2-5 min. Process Tree first (children of the sample), then filters: Operation is RegSetValue / Process Create / WriteFile; "Backing Files" reveals content of files deleted during the run. Save .PML and export CSV.
Wireshark: capture on the VM's host-only adapter (never the host NIC). Filters: dns / http.request / tls.handshake.type==1 / ip.addr==<suspect>. Follow stream (right-click) for the full C2 conversation; File > Export Objects > HTTP for dropped payloads; Statistics > Conversations - regular intervals with jitter = beaconing.
Volatility 3 (memory is ground truth - it does not depend on disk artifacts the malware may have wiped): acquire from the VM (suspend, then copy the .vmem; or MemProcFS). Commands: windows.pslist, windows.cmdline, windows.handles --pid <pid>, windows.malfind (injected code), windows.dlllist, windows.netscan (C2 endpoints even on a wiped disk). Linux profiles: linux.pslist, linux.bash, linux.sockstat.
Join everything on TIME: one timeline across Procmon + pcap + memory.`,
  report: `PHASE 5 - REPORT
1. Executive summary: family (or "unattributed"), 3-sentence behavior story, severity.
2. IOCs: paste everything you collected through re_ioc_normalize - full-length hashes, refanged URLs (hxxp://, [.]), public IPs only.
3. TTPs to MITRE ATT&CK: T1547.001 Run-key persistence, T1055 process injection, T1071 application-layer C2, T1027 obfuscation, ...
4. Detections: YARA from 2+ unique strings/constants; Sigma from Procmon artifacts; Suricata from pcap streams.
5. Record it: re_case_record (this agent) with the intel, IOCs and open questions, so the case survives the session.
6. Honesty rule: mark every unverified hypothesis as HYPOTHESIS. Empty intel is reported as empty.`,
};

async function reRunbook(args: ToolArgs): Promise<ToolResult> {
  const phase = String(args.phase ?? "triage").trim().toLowerCase();
  const aliases: Record<string, string> = {
    triage: "triage",
    static: "static_windows",
    static_pe: "static_windows",
    ghidra: "static_windows",
    ida: "static_windows",
    static_elf: "static_linux",
    dynamic: "dynamic_windows",
    x64dbg: "dynamic_windows",
    ollydbg: "dynamic_windows",
    gdb: "dynamic_linux",
    dynamic_linux: "dynamic_linux",
    forensics: "forensics",
    procmon: "forensics",
    wireshark: "forensics",
    volatility: "forensics",
    memory: "forensics",
    network: "forensics",
    report: "report",
  };
  const key = aliases[phase];
  if (!key) {
    return {
      ok: false,
      summary: `Unknown runbook phase "${phase}"`,
      detail: `Available phases: triage, static (windows PE: Ghidra/IDA), static_elf (linux: GDB toolchain), dynamic (x64dbg/OllyDbg), dynamic_linux (GDB), forensics (Procmon/Wireshark/Volatility), report.`,
    };
  }
  const platform = String(args.platform ?? "").toLowerCase();
  let body = RUNBOOKS[key];
  if ((key === "static_windows" && platform === "linux") || (key === "static_linux" && platform === "windows")) {
    const swap = platform === "linux" ? "static_linux" : "static_windows";
    body = RUNBOOKS[swap];
  }
  return {
    ok: true,
    summary: `Runbook: ${key} (${body.split("\n")[0].split(" with ")[1] ?? "workflow"} - ${body.split("\n").length} lines)`,
    detail: body.slice(0, 3800),
  };
}

export { reRunbook };
