// Read-only check: every exported name of the ORIGINAL entry files (git HEAD)
// must still be exported by the NEW entry files. Handles `export type {A,B}`,
// `export {A, B} from`, declarations, and interface/type declarations.
import { execSync } from "child_process";

const entries = [
  "src/lib/agent/skills-power.ts",
  "src/lib/coach-agent/tools.ts",
  "src/lib/arcade.ts",
  "src/lib/skills.ts",
  "src/lib/coach-agent/re-tools.ts",
];

function namesOf(src) {
  const names = new Set();
  // bracketed re-export lists: export { A, B } [from "..."] / export type { A, B } [from "..."]
  for (const m of src.matchAll(/export type \{([^}]*)\}|export \{([^}]*)\}(?!\s*from)/g)) {
    for (const part of (m[1] ?? m[2] ?? "").split(",")) {
      const n = part.trim().split(/\s+as\s+/).pop().trim();
      if (n) names.add(n);
    }
  }
  // re-exports with source: export { A, B } from "..."
  for (const m of src.matchAll(/export (?:type )?\{([^}]*)\}\s*from/g)) {
    for (const part of m[1].split(",")) {
      const n = part.trim().split(/\s+as\s+/).pop().trim();
      if (n) names.add(n);
    }
  }
  // declarations
  for (const m of src.matchAll(/^export (?:default )?(?:declare )?(?:async )?(?:function|const|let|var|interface|type|enum|class|abstract class)\s+([A-Za-z0-9_]+)/gm)) {
    names.add(m[1]);
  }
  return names;
}

let bad = 0;
for (const f of entries) {
  const oldSrc = execSync(`git show HEAD:${f}`, { cwd: "/home/z/my-project" }).toString();
  const newSrc = execSync(`cat ${f}`, { cwd: "/home/z/my-project" }).toString();
  const oldN = namesOf(oldSrc);
  const newN = namesOf(newSrc);
  const missing = [...oldN].filter((n) => !newN.has(n));
  const added = [...newN].filter((n) => !oldN.has(n));
  if (missing.length) {
    bad++;
    console.log(`${f}: MISSING ${missing.join(", ")}`);
  } else {
    console.log(`${f}: all ${oldN.size} original exports preserved${added.length ? ` (+${added.length} new: ${added.join(", ")})` : ""}`);
  }
}
process.exit(bad ? 1 : 0);
