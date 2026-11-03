// Persists the operator's live analysis case (2026-11-03): truncated-hash
// sample, VT empty, Triage approval pending. Run with the corrected env:
//   DATABASE_URL=$(grep -E '^DATABASE_URL=' .env | cut -d= -f2-) bun scripts/re-case-1124.ts
import { toolByName } from "../src/lib/coach-agent/tools";

const rec = toolByName("re_case_record")!;

const r = await rec.run({
  action: "save",
  case_id: "sample-1124e79d",
  title: "Truncated-hash sample: VT empty, Triage pending, MB needs key",
  data: {
    submitted_string: "1124e79d23f3ecdaceb348affad9d975231140146101e7cc",
    hash_issue:
      "48 hex chars - not md5(32)/sha1(40)/sha256(64). Truncated or corrupted on copy; no source can look it up. BLOCKER: need the full 64-char SHA-256 re-copied from the origin (abuse.ch page or file hash).",
    sources: {
      virustotal: "operator reports no result (empty or never-seen - both are findings once we have the full hash)",
      yaraify: "query_status=no_results (inconclusive: hash was truncated)",
      malwarebazaar: "API requires a free Auth-Key (register at bazaar.abuse.ch, set MB_AUTH_KEY in .env)",
      triage: "submission pending approval - do NOT block on it",
      web_search: "zero indexed mentions of the string",
    },
    next_steps: [
      "1. re-copy the FULL sha256 from abuse.ch and run re_intel_lookup + manual VT/Triage/MB browse links",
      "2. register free MB account -> MB_AUTH_KEY in .env -> lookup covers MalwareBazaar automatically",
      "3. when Triage approves: paste the report URL + key findings here -> folded into this case",
      "4. if local static phase starts: re_runbook phase=triage then static (Ghidra/IDA); VM checklist mandatory",
    ],
    red_lines: [
      "never execute the sample on the host - isolated VM only",
      "sample uploads to third parties require explicit approval (re_sample_upload)",
      "hash lookups are passive and need no approval",
    ],
  },
});

console.log(JSON.stringify(r, null, 1));
const list = await rec.run({ action: "list" });
console.log(list.summary);
