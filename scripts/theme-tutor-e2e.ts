// Task 124 tutor-surface e2e: replay the EXACT holder transcript through the
// real /api/ai tutor route (dev server, real DB) and verify:
//   turn 1 "make the Ui theme green"  -> deterministic Forest + theme tokens
//   turn 2 "make the Ui theme blue again" -> deterministic Ocean + tokens
//   turn 3 "wat?" -> grounded reply, NO invented budget/limit language
// Writes Learner.theme (the real user path) - snapshots before, restores after.
//   export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | cut -d= -f2-)" && bun scripts/theme-tutor-e2e.ts
import { db } from "../src/lib/db";

const BASE = "http://127.0.0.1:3000";
let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name} ${extra}`);
  }
}

async function tutor(history: { role: string; content?: string; reply?: string }[]) {
  const res = await fetch(`${BASE}/api/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `rah_session=${process.env.RAH_SESSION ?? ""}` },
    body: JSON.stringify({ action: "tutor", history }),
  });
  return (await res.json()) as { ok: boolean; turn?: { reply?: string; theme?: unknown; fa_note?: string }; error?: string };
}

const history: { role: string; content?: string; reply?: string }[] = [];

console.log("-- turn 1: make the Ui theme green");
history.push({ role: "user", content: "make the Ui theme green" });
let r = await tutor(history);
check("turn 1 ok", r.ok === true, r.error ?? "");
check("turn 1 deterministic Done reply", (r.turn?.reply ?? "").startsWith("Done - the app now wears the Forest"), r.turn?.reply?.slice(0, 80));
check("turn 1 carries theme tokens", !!r.turn?.theme && typeof r.turn.theme === "object");
history.push({ role: "assistant", reply: r.turn?.reply ?? "" });

console.log("-- turn 2: make the Ui theme blue again");
history.push({ role: "user", content: "make the Ui theme blue again" });
r = await tutor(history);
check("turn 2 ok", r.ok === true, r.error ?? "");
check("turn 2 deterministic Done reply (Ocean)", (r.turn?.reply ?? "").startsWith("Done - the app now wears the Ocean"), r.turn?.reply?.slice(0, 80));
check("turn 2 carries theme tokens", !!r.turn?.theme && typeof r.turn.theme === "object");
history.push({ role: "assistant", reply: r.turn?.reply ?? "" });

console.log("-- turn 3: wat? (the confabulation turn)");
history.push({ role: "user", content: "wat?" });
r = await tutor(history);
check("turn 3 ok", r.ok === true, r.error ?? "");
const reply3 = r.turn?.reply ?? "";
console.log(`  reply: ${reply3.slice(0, 220)}`);
check(
  "turn 3 contains NO invented budget/limit language",
  !/budget|quota|reached (a|the) limit|session (limit|cap)/i.test(reply3),
  reply3.slice(0, 120)
);
check("turn 3 is not empty and not a stats echo", reply3.length > 0 && !reply3.startsWith("Your current streak"));

// restore whatever the learner had before the battery
const before = process.env.THEME_SNAPSHOT ?? "";
await db.learner.update({ where: { id: "me" }, data: { theme: before } });
console.log(`-- Learner.theme restored (${before === "" ? "empty/default" : "snapshot"})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
