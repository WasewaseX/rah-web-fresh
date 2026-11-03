// Updates the live case: operator dropped Triage as a blocker (2026-11-03),
// intel v2 sources now live. Run with the corrected env:
//   DATABASE_URL=$(grep -E '^DATABASE_URL=' .env | cut -d= -f2-) bun scripts/re-case-update.ts
import { toolByName } from "../src/lib/coach-agent/tools";

const rec = toolByName("re_case_record")!;

const r = await rec.run({
  action: "save",
  case_id: "sample-1124e79d",
  title: "Truncated-hash sample: VT empty, operator dropped Triage, MB needs key",
  data: {
    submitted_string: "1124e79d23f3ecdaceb348affad9d975231140146101e7cc",
    hash_issue:
      "48 hex chars - not md5(32)/sha1(40)/sha256(64). Truncated or corrupted on copy; no source can look it up. BLOCKER: need the full 64-char SHA-256 re-copied from the origin (abuse.ch page or the file itself).",
    sources: {
      virustotal: "operator reports no result (empty or never-seen - both are findings once we have the full hash)",
      yaraify: "no_results (inconclusive: hash was truncated)",
      malwarebazaar: "API requires a free key (register at bazaar.abuse.ch, set MB_AUTH_KEY in .env)",
      triage: "DROPPED per operator 2026-11-03 - not a blocker, not part of the workflow anymore",
      web_search: "zero indexed mentions of the string",
    },
    tooling_now_live: {
      re_intel_lookup_v2: "YARAify + MalwareBazaar(key) + URLhaus payload + ThreatFox for hashes; ThreatFox + URLhaus host + VT/urlscan links for IPs/domains/URLs",
      probe_hygiene: "re_case_record + re_sample_upload suppress DB writes under x-rah-probe",
    },
    next_steps: [
      "1. re-copy the FULL sha256 from abuse.ch -> re_intel_lookup (4 passive sources at once) + VT/MB browser links",
      "2. optional: free MB key -> MB_AUTH_KEY in .env",
      "3. when the file is available locally: re_runbook triage (DIE/HxD/strings) - VM checklist mandatory",
    ],
    red_lines: [
      "never execute the sample on the host - isolated VM only",
      "sample uploads to third parties require explicit approval (re_sample_upload); hash lookups stay passive",
    ],
  },
});

console.log(r.summary);
