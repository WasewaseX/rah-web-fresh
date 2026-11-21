// The real-traces loader: their 300k-row public learning-traces sample
// (built from traces.csv.gz on first run) parsed into typed rows.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { GZ, SAMPLE, SAMPLE_LINES } from "./harness";

export interface Row {
  pRecall: number;
  delta: number;
  user: string;
  lexeme: string;
  lang: string;
  historySeen: number;
  historyCorrect: number;
  sessionSeen: number;
  sessionCorrect: number;
  ts: number;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

export function loadSample(): Row[] {
  if (!existsSync(SAMPLE)) {
    if (!existsSync(GZ)) throw new Error("dataset missing");
    console.log("  building sample.csv (first 300k lines) ...");
    // The pipeline needs a shell (zcat | head > file). All three values are
    // module constants, never user input; the charset guard makes that
    // provable, so the quoting cannot be abused even in principle.
    for (const v of [GZ, SAMPLE]) {
      if (!/^[\w.\-/]+$/.test(v)) throw new Error("refusing unsafe dataset path for shell pipeline");
    }
    const z = spawnSync("bash", ["-c", `zcat '${GZ}' | head -n ${SAMPLE_LINES} > '${SAMPLE}'`], { timeout: 300000 }); // security-gate:allow shell-constant-pipeline - paths validated above, module constants only, no user input
    if (z.status !== 0) throw new Error("zcat failed");
  }
  const text = readFileSync(SAMPLE, "utf8");
  const lines = text.split("\n");
  const header = splitCsvLine(lines[0].trim());
  const idx = (n: string) => header.indexOf(n);
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const f = splitCsvLine(line);
    const pRecall = parseFloat(f[idx("p_recall")]);
    const delta = parseFloat(f[idx("delta")]);
    const historySeen = parseInt(f[idx("history_seen")], 10);
    const historyCorrect = parseInt(f[idx("history_correct")], 10);
    const sessionSeen = parseInt(f[idx("session_seen")], 10);
    const sessionCorrect = parseInt(f[idx("session_correct")], 10);
    const ts = parseInt(f[idx("timestamp")], 10);
    // NaN guard: a truncated stream or quoted-field surprise must poison
    // NOTHING - one bad row is skipped, not multiplied through every metric.
    if (![pRecall, delta, historySeen, historyCorrect, sessionSeen, sessionCorrect, ts].every(Number.isFinite)) continue;
    if (historySeen < 0 || historyCorrect < 0 || historyCorrect > historySeen) continue;
    rows.push({
      pRecall,
      delta,
      user: f[idx("user_id")],
      lexeme: f[idx("lexeme_id")],
      lang: f[idx("learning_language")],
      historySeen,
      historyCorrect,
      sessionSeen,
      sessionCorrect,
      ts,
    });
  }
  return rows;
}
