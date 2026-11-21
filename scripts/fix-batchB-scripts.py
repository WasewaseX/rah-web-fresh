"""Cycle 6 bulk fix, batch B: scripts (unused, empty catches, requires, dups)."""
import pathlib

ROOT = pathlib.Path("/home/z/my-project")

def patch(rel, old, new, count=1):
    p = ROOT / rel
    s = p.read_text()
    n = s.count(old)
    if n == 0 and new in s:
        print(f"skip  {rel}: already applied")
        return
    assert n == count, f"{rel}: expected {count}, found {n}: {old[:70]!r}"
    p.write_text(s.replace(old, new))
    print(f"ok    {rel}: {old.splitlines()[0].strip()[:56]!r}")

# --- unused imports ----------------------------------------------------------
patch("scripts/azure-pron-validate.ts",
      'import { readdirSync, readFileSync, statSync } from "fs";',
      'import { readdirSync, readFileSync } from "fs";')
patch("scripts/paint-probe.mjs",
      'import fs from "node:fs";\n',
      "")
patch("scripts/test-fsrs-parity.ts",
      'import { fsrs, generatorParameters, createEmptyCard, Rating, type Card, type Grade } from "ts-fsrs";',
      'import { fsrs, generatorParameters, createEmptyCard, type Card, type Grade } from "ts-fsrs";')
patch("scripts/test-router.ts",
      'import { parseSlash, routeByCommand, routeByTrigger } from "../src/lib/agent/planner";\nimport { getSkill } from "../src/lib/agent/registry";',
      'import { parseSlash, routeByCommand, routeByTrigger } from "../src/lib/agent/planner";')

# --- dead locals --------------------------------------------------------------
patch("scripts/e2e-task44-review.mjs",
      '    // MCQ pick first option\n    const mcq = page.locator("main button").filter({ hasText: /./ });\n    log.push("stuck: no actionable control found");',
      '    // MCQ pick first option\n    log.push("stuck: no actionable control found");')
patch("scripts/load-metrics.mjs",
      '      new Promise((resolve) => {\n        const nav = performance.getEntriesByType("navigation")[0];\n        const paint = performance.getEntriesByType("paint").find((p) => p.name === "first-contentful-paint");\n        const res = performance.getEntriesByType("resource");\n        const js = res.filter((r) => r.name.endsWith(".js") || r.name.includes("/_next/static/chunks"));\n        const done = () => {',
      '      new Promise((resolve) => {\n        // metrics are re-read in done() so the numbers cover the full load\n        const done = () => {')
patch("scripts/probe-hardening-test.ts",
      'const CASE_KEY = "re:case:probe-hardening-tmp";\n',
      "")
patch("scripts/security-gate.ts",
      '// vendored third-party bundles inside otherwise-scannable dirs\nconst EXCLUDED_PATH_PARTS = [join(".github", "skills"), `${sep}vendor${sep}`];\n',
      "")
patch("scripts/test-admin-db-route.ts",
      'const DB = `${DIR}/custom.db`;\n',
      "")
patch("scripts/test-api-battery.ts",
      '      const { mkdtemp, writeFile, readFile, rm } = await import("node:fs/promises");',
      '      const { mkdtemp, readFile, rm } = await import("node:fs/promises");')
patch("scripts/test-coach-agent-auth.ts",
      '  const l0 = await prisma.learner.findUnique({ where: { id: "me" } });\n',
      "")
patch("scripts/test-dictation.ts",
      'const logsBeforeCount = await prisma.reviewLog.count();\n',
      "")
patch("scripts/test-duolingo-hlr.ts",
      '  const eCore = stat("HLR core", corePreds);',
      '  const _eCore = stat("HLR core", corePreds); // printed by stat(); not compared')

# --- require() -> ESM imports ---------------------------------------------------
patch("scripts/codemod-rate-limit.js",
      'const fs = require("fs");',
      'import fs from "fs";')
patch("scripts/overflow-cdp-119.js",
      '// Usage: node scripts/overflow-cdp-119.js <ws-port> <session-token>\nconst fs = require("fs");\nconst http = require("http");',
      '// Usage: bun scripts/overflow-cdp-119.js <ws-port> <session-token>\nimport fs from "fs";\nimport http from "http";')
patch("scripts/repair-exam-119.js",
      'const fs = require("fs");\nconst url = (fs.readFileSync(".env", "utf8").match(/DATABASE_URL="?([^"\\n]+)"?/) || [])[1];\nconst { PrismaClient } = require("@prisma/client");\nconst p = new PrismaClient({ datasources: { db: { url } } });',
      'import fs from "fs";\nimport { PrismaClient } from "@prisma/client";\n\nconst url = (fs.readFileSync(".env", "utf8").match(/DATABASE_URL="?([^"\\n]+)"?/) || [])[1];\nconst p = new PrismaClient({ datasources: { db: { url } } });')

# --- bare expression statement ---------------------------------------------------
patch("scripts/overflow-cdp-119.js",
      '        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);',
      '        if (m.error) rej(new Error(JSON.stringify(m.error)));\n        else res(m.result);')

# --- duplicate imports ------------------------------------------------------------
patch("scripts/test-exam-gate.ts",
      'import { itemAnswerable, itemFairlyAsked } from "../src/lib/agent/exam-gate";',
      'import { evidenceItem, itemAnswerable, itemFairlyAsked } from "../src/lib/agent/exam-gate";')
patch("scripts/test-exam-gate.ts",
      '// Evidence items: deterministic quota enforcement built from family evidence.\n// The blanked token must be the CORRECTION, not a bystander word.\nimport { evidenceItem } from "../src/lib/agent/exam-gate";\n',
      '// Evidence items: deterministic quota enforcement built from family evidence.\n// The blanked token must be the CORRECTION, not a bystander word.\n')

# --- new Array ----------------------------------------------------------------------
patch("scripts/coach-tools-test.ts",
      '  const perDay = new Array<number>(7).fill(0);',
      '  const perDay = Array.from({ length: 7 }, () => 0);')

# --- empty catches get documented ----------------------------------------------------
patch("scripts/cleanup-leaked-agent-turns.ts",
      '    } catch {}\n  }\n  parsed.reply = replacement;',
      '    } catch {\n      // quoted marker was not valid JSON - keep the computed replacement\n    }\n  }\n  parsed.reply = replacement;')
patch("scripts/e2e-task94-teach.mjs",
      '      if (r.ok) return;\n    } catch {}\n    await new Promise((r) => setTimeout(r, 2000));',
      '      if (r.ok) return;\n    } catch {\n      // server not up yet - back off and poll again\n    }\n    await new Promise((r) => setTimeout(r, 2000));')
patch("scripts/e2e-task94-teach.mjs",
      '    try { process.kill(-stack.pid, "SIGTERM"); } catch {}',
      '    try { process.kill(-stack.pid, "SIGTERM"); } catch {\n      // stack already exited - nothing to tear down\n    }')
patch("scripts/pilot-metrics.mjs",
      '    if (score !== null) speakScores.push(score);\n  } catch {}\n}',
      '    if (score !== null) speakScores.push(score);\n  } catch {\n    // malformed stored result - skip that session\n  }\n}')
patch("scripts/test-api-battery.ts",
      '    bundle = JSON.parse(exText);\n  } catch {}\n  check(ex.status === 200',
      '    bundle = JSON.parse(exText);\n  } catch {\n    // a non-JSON export must fail the check below, not the harness\n  }\n  check(ex.status === 200')
patch("scripts/test-exam-grade.ts",
      '    if (ev.type === "final" && ev.envelope?.kind === "exam") exam = ev.envelope.exam;\n  } catch {}\n}',
      '    if (ev.type === "final" && ev.envelope?.kind === "exam") exam = ev.envelope.exam;\n  } catch {\n    // malformed coach line - exam stays unset and the check below reports it\n  }\n}')

print("batch B complete")
