// security-gate: the PR security bar (holder order: "Hold every pull request
// to this"). Every category below comes from the holder's findings lists
// (cycle 0 + cycle 1):
//
//   security/sql-injection                - template literal interpolated into a raw query
//   security/dangerously-set-innerhtml    - any dangerouslySetInnerHTML use
//   security/innerhtml                    - direct .innerHTML assignment (XSS)
//   security/shell-injection              - exec/spawn family called with a template literal
//   security/eval                         - eval() / new Function() use
//   ai-slop/swallowed-exception           - except: pass (even `pass # comment`),
//                                           or a catch body whose only action is
//                                           a print (any stream) - recording the
//                                           error into a counter/list + a summary
//                                           is handling, printing alone is not
//
// Run: bun scripts/security-gate.ts        (scan; exit 1 on any finding)
//      bun scripts/security-gate.ts --selftest   (rule fixtures battery)
//
// Scope: project code (src/, scripts/, next/ + root files). VENDORED code is
// excluded by path - third-party bundles live in .github/skills/, skills/,
// node_modules/, build output, and user upload/download/data dirs; findings
// there are upstream's problem, not a PR blocker.
//
// Escape hatch: a line may carry an inline marker
//   security-gate:allow <rule-id> - <reason why this is not a vulnerability>
// (on the finding line or the line above) for cases where the pattern is
// genuinely unavoidable and separately validated. Every allow MUST carry a
// reason; the marker is greppable so audits can enumerate them.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const RULES = {
  sqlTemplate: "security/sql-injection",
  dangerousHtml: "security/dangerously-set-innerhtml",
  innerHtml: "security/innerhtml",
  shellInjection: "security/shell-injection",
  evalUse: "security/eval",
  swallowPass: "ai-slop/swallowed-exception",
  swallowPrint: "ai-slop/swallowed-exception",
} as const;

const ALLOW_MARKER = "security-gate:allow";

const EXCLUDED_DIRS = new Set([
  ".git", "node_modules", ".next", ".next-teach", ".next-standalone",
  "upload", "download", "db", "skills", ".zcode", "tmp", "dist",
]);
// vendored third-party bundles inside otherwise-scannable dirs
const EXCLUDED_PATH_PARTS = [join(".github", "skills"), `${sep}vendor${sep}`];
const SCANNED_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".py", ".html"]);

interface Finding {
  rule: string;
  path: string;
  line: number;
  message: string;
}

function excluded(rel: string): boolean {
  const parts = rel.split(sep);
  if (parts.some((p) => EXCLUDED_DIRS.has(p))) return true;
  if (rel.includes(join(".github", "skills"))) return true;
  if (rel.includes(`${sep}vendor${sep}`)) return true;
  return false;
}

function listFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e);
    const rel = relative(process.cwd(), full);
    if (excluded(rel)) continue;
    const st = statSync(full, { throwIfNoEntry: false });
    if (!st) continue;
    if (st.isDirectory()) listFiles(full, out);
    else if (SCANNED_EXT.has(join(e, "").slice(0, 0) + e.slice(e.lastIndexOf(".")))) out.push(full);
  }
  return out;
}

function hasAllow(lines: string[], idx: number): boolean {
  return (lines[idx]?.includes(ALLOW_MARKER) ?? false) || (lines[idx - 1]?.includes(ALLOW_MARKER) ?? false);
}

function scanFile(path: string): Finding[] {
  const findings: Finding[] = [];
  const lines = readFileSync(path, "utf8").split("\n");
  const isPy = path.endsWith(".py");

  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];

    // security/sql-injection: raw query call with an interpolated template literal
    if (/\$(queryRaw|executeRaw)(Unsafe)?\(/.test(L) && /`[^`]*\$\{/.test(L) && !hasAllow(lines, i)) {
      findings.push({ rule: RULES.sqlTemplate, path, line: i + 1, message: "Possible SQL injection — template literal in query" });
    }

    // security/dangerously-set-innerhtml: any use of the dangerous API
    if (/dangerouslySetInnerHTML/.test(L) && !hasAllow(lines, i)) {
      findings.push({ rule: RULES.dangerousHtml, path, line: i + 1, message: "dangerouslySetInnerHTML can lead to XSS if not sanitized" });
    }

    // security/innerhtml: direct assignment (any language in scope)
    if (/\.innerHTML\s*=[^=]/.test(L) && !hasAllow(lines, i)) {
      findings.push({ rule: RULES.innerHtml, path, line: i + 1, message: "Direct innerHTML assignment can lead to XSS" });
    }

    // security/shell-injection: exec/spawn family with a template literal argument
    if (/\b(spawn|spawnSync|exec|execSync|execFile|execFileSync)\(/.test(L) && /`[^`]*\$\{/.test(L) && !hasAllow(lines, i)) {
      findings.push({ rule: RULES.shellInjection, path, line: i + 1, message: "Possible shell injection — user input in command execution" });
    }

    // security/eval
    if (/\beval\s*\(/.test(L) && !hasAllow(lines, i)) {
      // python method DEFINITIONS (def eval...) are not eval() calls
      if (!(isPy && /^\s*def\s+eval\s*\(/.test(L))) {
        findings.push({ rule: RULES.evalUse, path, line: i + 1, message: "Use of eval() is a security risk" });
      }
    }
    if (/\bnew\s+Function\s*\(/.test(L) && !hasAllow(lines, i)) {
      findings.push({ rule: RULES.evalUse, path, line: i + 1, message: "Use of new Function() is a security risk" });
    }
  }

  // ai-slop/swallowed-exception (python blocks: look at statement structure)
  if (isPy) {
    for (let i = 0; i < lines.length - 1; i++) {
      const L = lines[i];
      const m = /^(\s*)except\b.*:\s*$/.exec(L);
      if (!m) continue;
      const indent = m[1].length;
      // next non-empty, non-comment line
      let j = i + 1;
      while (j < lines.length && (lines[j].trim() === "" || lines[j].trim().startsWith("#"))) j++;
      const body = lines[j] ?? "";
      if (j >= lines.length || /^\s*(#|$)/.test(lines[i + 1] ?? "") && body.trim() === "") continue;
      if (hasAllow(lines, i) || hasAllow(lines, j)) continue;

      if (body.trim().startsWith("pass") && body.length - body.trimStart().length > indent) {
        findings.push({ rule: RULES.swallowPass, path, line: i + 1, message: "Bare except with pass swallows errors silently" });
        continue;
      }
      // single-statement print-only body that ends the block: printing to any
      // stream is NOT handling - record the error (counter/list/flag) or
      // re-raise/exit instead
      const nextLine = lines[j + 1] ?? "";
      const nextDedents = nextLine.trim() === "" || (nextLine.length - nextLine.trimStart().length) <= indent;
      const isPrint = /^print\(/.test(body.trim());
      if (isPrint && nextDedents && body.length - body.trimStart().length > indent) {
        findings.push({ rule: RULES.swallowPrint, path, line: i + 1, message: "Catch block only prints error without proper handling" });
      }
    }
  }

  return findings;
}

function scanRepo(): Finding[] {
  // The gate's own source is excluded from scanning: its rule definitions
  // and selftest fixtures necessarily CONTAIN every pattern it detects
  // (standard scanner self-exclusion, same as eslint's .eslintignore).
  const files = [
    ...listFiles("src"),
    ...listFiles("scripts"),
    ...listFiles("next"),
    ...listFiles("."),
    ...listFiles("public"),
  ];
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const f of files) {
    if (f.endsWith(join("scripts", "security-gate.ts"))) continue;
    if (seen.has(f) || !SCANNED_EXT.has(f.slice(f.lastIndexOf(".")))) continue;
    seen.add(f);
    out.push(...scanFile(f));
  }
  return out;
}

// ---------- selftest: each rule must fire on its fixture, and the allow
// marker must suppress it. Fixtures are written to a temp dir inside the
// excluded `tmp` path so a normal repo scan never sees them.
async function selftest(): Promise<number> {
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(join(tmpdir(), "secgate-"));
  let fail = 0;
  const t = (name: string, cond: boolean, extra = "") => {
    console.log(`  ${cond ? "ok" : "FAIL"}: ${name}${cond ? "" : ` ${extra}`}`);
    if (!cond) fail++;
  };

  const cases: Array<[string, string, string | 0, string]> = [
    ["sql.ts", "await db.$executeRawUnsafe(`TRUNCATE TABLE ${x}`);\n", RULES.sqlTemplate, "template in raw query"],
    ["dsh.tsx", "<style dangerouslySetInnerHTML={{ __html: css }} />\n", RULES.dangerousHtml, "dangerouslySetInnerHTML"],
    ["html.js", "el.innerHTML = data;\n", RULES.innerHtml, "innerHTML assign"],
    ["shell.mjs", "spawn('sh', [`ls ${dir}`]);\n", RULES.shellInjection, "spawn template"],
    ["eval.py", "eval(expr)\n", RULES.evalUse, "eval call"],
    ["pydef.py", "def eval(self):\n    pass\n", 0, "def eval is not a call"],
    ["pass.py", "try:\n    x()\nexcept Exception:\n    pass\n", RULES.swallowPass, "except pass"],
    ["passc.py", "try:\n    x()\nexcept sqlite3.Error:\n    pass  # table without userId\ny()\n", RULES.swallowPass, "except pass with inline comment"],
    ["print.py", "try:\n    x()\nexcept Exception as e:\n    print(e)\ny()\n", RULES.swallowPrint, "print-only catch"],
    ["stderr.py", "try:\n    x()\nexcept Exception as e:\n    print(e, file=sys.stderr)\ny()\n", RULES.swallowPrint, "stderr-only catch is still print-only"],
    ["record.py", "try:\n    x()\nexcept Exception as e:\n    failed.append(str(e))\nif failed:\n    print(failed, file=sys.stderr)\ny()\n", 0, "record + summary is handling"],
    ["allow.ts", "db.$executeRawUnsafe(`V ${p}`); // security-gate:allow sql-template - validated\n", 0, "allow marker suppresses"],
  ];
  for (const [name, body, expectedRule, label] of cases) {
    writeFileSync(join(dir, name), body);
    const f = scanFile(join(dir, name));
    if (expectedRule === 0) t(label, f.length === 0, JSON.stringify(f));
    else t(label, f.length === 1 && f[0]?.rule === expectedRule, JSON.stringify(f));
  }
  rmSync(dir, { recursive: true, force: true });
  console.log(`security-gate selftest: ${cases.length - fail}/${cases.length} pass`);
  return fail;
}

const isSelftest = process.argv.includes("--selftest");
if (isSelftest) {
  const fail = await selftest();
  process.exit(fail === 0 ? 0 : 1);
} else {
  const findings = scanRepo();
  if (findings.length === 0) {
    console.log("security-gate: CLEAN - 0 findings in project scope (vendored code excluded)");
    process.exit(0);
  }
  for (const f of findings) {
    console.log(`${f.rule} ${relative(process.cwd(), f.path)}:${f.line} · ${f.message}`);
  }
  console.log(`security-gate: FAIL - ${findings.length} finding(s)`);
  process.exit(1);
}
