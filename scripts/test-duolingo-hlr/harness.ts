// Shared state for the DUOLINGO-RE gate: the on-disk reference constants and
// the check ledger. The entry (scripts/test-duolingo-hlr.ts) owns the header,
// the part order and the final gate verdict.
import path from "node:path";

export const REF_DIR = path.join(process.cwd(), "scripts", "duolingo-reference");
export const SAMPLE = path.join(REF_DIR, "sample.csv");
export const GZ = path.join(REF_DIR, "traces.csv.gz");
export const SAMPLE_LINES = 300001; // header + 300k traces

let failures = 0;
export function check(name: string, ok: boolean, detail = ""): void {
  if (ok) console.log(`  PASS ${name}${detail ? ` - ${detail}` : ""}`);
  else {
    failures++;
    console.error(`  FAIL ${name}${detail ? ` - ${detail}` : ""}`);
  }
}

export function failuresCount(): number {
  return failures;
}

export function hasFailures(): boolean {
  return failures > 0;
}
