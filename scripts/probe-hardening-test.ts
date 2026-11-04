// Probe-hardening battery. Run with the .env DATABASE_URL:
//   export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | cut -d= -f2-)" && bun scripts/probe-hardening-test.ts
// Pins the invariant "probes never write": every DB-writing tool surface in
// the coach registry must suppress its write when args._probe === true, while
// the same call WITHOUT the flag still persists (real-learner path intact).
import { toolByName } from "../src/lib/coach-agent/tools";
import { db } from "../src/lib/db";

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

const CASE_KEY = "re:case:probe-hardening-tmp";
const THEME_ID = "me";

async function caseCount(): Promise<number> {
  return db.setting.count({ where: { key: { startsWith: "re:case:" } } });
}
async function consentCount(): Promise<number> {
  return db.setting.count({ where: { key: { startsWith: "re:consent:" } } });
}

async function main() {
  const rec = toolByName("re_case_record")!;
  const up = toolByName("re_sample_upload")!;
  const theme = toolByName("set_theme")!;
  const flags = toolByName("triage_flags")!;

  // ---------- re_case_record: save / delete suppressed under probe ----------
  const c0 = await caseCount();
  const saveP = await rec.run({ action: "save", case_id: "probe-hardening-tmp", title: "probe", data: "x", _probe: true });
  check("case save probe: ok dry-run", saveP.ok === true && /dry-run/i.test(saveP.summary), saveP.summary);
  check("case save probe: nothing written", (await caseCount()) === c0, `count ${c0}->${await caseCount()}`);

  const delP = await rec.run({ action: "delete", case_id: "probe-hardening-tmp", _probe: true });
  check("case delete probe: dry-run summary", /dry-run/i.test(delP.summary), delP.summary);
  check("case delete probe: nothing written", (await caseCount()) === c0);

  // list/get stay READABLE under probe (batteries may inspect)
  const listP = await rec.run({ action: "list", _probe: true });
  check("case list probe: still readable", listP.ok === true, listP.summary);

  // ---------- re_case_record: real path still writes and cleans up ----------
  const saveR = await rec.run({ action: "save", case_id: "probe-hardening-tmp", title: "real", data: { hello: 1 } });
  check("case save real: writes", saveR.ok === true && (await caseCount()) === c0 + 1, saveR.summary);
  const getR = await rec.run({ action: "get", case_id: "probe-hardening-tmp" });
  check("case get real: roundtrip", getR.ok === true && Boolean(getR.detail?.includes("hello")), getR.summary);
  const delR = await rec.run({ action: "delete", case_id: "probe-hardening-tmp" });
  check("case delete real: removes", delR.ok === true && (await caseCount()) === c0, delR.summary);

  // ---------- re_sample_upload: consent record suppressed under probe ----------
  const k0 = await consentCount();
  const upP = await up.run({ target: "triage", confirm: true, note: "battery", _probe: true });
  check("upload probe+confirm: dry-run", upP.ok === true && /probe/i.test(upP.summary), upP.summary);
  check("upload probe+confirm: no consent row", (await consentCount()) === k0);
  const upNo = await up.run({ target: "triage", _probe: true });
  check("upload probe w/o confirm: still gated", /CONSENT GATE|dry-run/i.test(upNo.summary), upNo.summary);

  // ---------- set_theme: probe validates tokens but never persists ----------
  const learnerBefore = await db.learner.findUnique({ where: { id: THEME_ID } });
  const themeBefore = learnerBefore?.theme ?? null;
  const themeP = await theme.run({ theme: "green", _probe: true });
  check("theme probe: ok with tokens", themeP.ok === true && Boolean((themeP.data as { tokens?: unknown })?.tokens), themeP.summary);
  check("theme probe: marked dry-run", /probe|nothing persisted/i.test(themeP.summary), themeP.summary);
  const learnerAfter = await db.learner.findUnique({ where: { id: THEME_ID } });
  check("theme probe: Learner.theme untouched", (learnerAfter?.theme ?? null) === themeBefore, `before=${JSON.stringify(themeBefore)} after=${JSON.stringify(learnerAfter?.theme ?? null)}`);

  // ---------- triage_flags: resolve suppressed under probe ----------
  const flagP = await flags.run({ action: "resolve", id: 999999, status: "fixed", _probe: true });
  check("flags resolve probe: dry-run", /dry-run/i.test(flagP.summary), flagP.summary);
  const flagBad = await flags.run({ action: "resolve", id: -1, status: "fixed", _probe: true });
  check("flags resolve probe: bad id still rejected first", flagBad.ok === false, flagBad.summary);

  // ---------- add_cards (Task 125): probe validates, never writes ----------
  const cards = toolByName("add_cards")!;
  const uc0 = await db.userCard.count({ where: { learnerId: THEME_ID } });
  const addP = await cards.run({
    cards: [
      { kind: "cloze", prompt: "Probe gate check ___", answer: "passed", level: "B2" },
      { kind: "ef", prompt: "ubiquitous", answer: "همه‌جا حاضر" },
    ],
    _probe: true,
  });
  check("add_cards probe: ok dry-run", addP.ok === true && /dry-run/i.test(addP.summary), addP.summary);
  check("add_cards probe: no UserCard rows", (await db.userCard.count({ where: { learnerId: THEME_ID } })) === uc0, `count ${uc0}->${await db.userCard.count({ where: { learnerId: THEME_ID } })}`);
  const addBad = await cards.run({ cards: [{ prompt: "", answer: "" }], _probe: true });
  check("add_cards probe: empty card still rejected first", addBad.ok === false, addBad.summary);

  // ---------- add_cards real path: writes then cleans up ----------
  const addR = await cards.run({ cards: [{ kind: "cloze", prompt: "Probe real-path card ___", answer: "works" }] });
  check("add_cards real: writes rows", addR.ok === true && (await db.userCard.count({ where: { learnerId: THEME_ID } })) === uc0 + 1, addR.summary);
  await db.userCard.deleteMany({ where: { learnerId: THEME_ID, prompt: "Probe real-path card ___" } });
  check("add_cards real: cleanup done", (await db.userCard.count({ where: { learnerId: THEME_ID } })) === uc0);

  // ---------- set_goal (Task 125): probe dry-run, real path restored ----------
  const goals = toolByName("set_goal")!;
  const goalBefore = await db.learner.findUnique({ where: { id: THEME_ID }, select: { dailyGoal: true, newPerDay: true, focusSkill: true } });
  const goalP = await goals.run({ dailyGoal: 77, focusSkill: "listening", _probe: true });
  check("set_goal probe: ok dry-run", goalP.ok === true && /dry-run/i.test(goalP.summary), goalP.summary);
  const goalAfterProbe = await db.learner.findUnique({ where: { id: THEME_ID }, select: { dailyGoal: true, newPerDay: true, focusSkill: true } });
  check(
    "set_goal probe: Learner row untouched",
    goalAfterProbe?.dailyGoal === goalBefore?.dailyGoal && goalAfterProbe?.focusSkill === goalBefore?.focusSkill,
    `before=${goalBefore?.dailyGoal}/${goalBefore?.focusSkill} after=${goalAfterProbe?.dailyGoal}/${goalAfterProbe?.focusSkill}`
  );
  const goalBad = await goals.run({ dailyGoal: 9999, _probe: true });
  check("set_goal probe: out-of-range rejected before dry-run", goalBad.ok === false, goalBad.summary);
  const goalReal = await goals.run({ dailyGoal: 33 });
  check("set_goal real: writes", goalReal.ok === true && /33/.test(goalReal.summary), goalReal.summary);
  if (goalBefore) {
    await db.learner.update({ where: { id: THEME_ID }, data: { dailyGoal: goalBefore.dailyGoal, newPerDay: goalBefore.newPerDay, focusSkill: goalBefore.focusSkill } });
  }
  const goalRestored = await db.learner.findUnique({ where: { id: THEME_ID }, select: { dailyGoal: true } });
  check("set_goal real: restored", goalRestored?.dailyGoal === goalBefore?.dailyGoal, `${goalRestored?.dailyGoal} vs ${goalBefore?.dailyGoal}`);

  console.log(`\nprobe-hardening: ${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error("battery crashed:", e);
    process.exit(1);
  });
