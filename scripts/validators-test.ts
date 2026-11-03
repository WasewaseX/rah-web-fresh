// Schema-validator battery. Run: bun scripts/validators-test.ts
// Pins every envelope validator in src/lib/ai-validators.ts: a known-good
// envelope passes (null), and each load-bearing violation is caught with a
// message the model can act on. Pure unit level - no network, no DB.
import {
  validateBrief, validateQuiz, validateListen, validateSpeak, validateWriting,
  validateAssess, validatePlan, validateScan, validateClinic, validatePlacementW,
  validateExamGen,
} from "../src/lib/ai-validators";

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

const goodBrief = { priority: "Clear the 12 due reviews", plan: ["Open Review and clear the due queue.", "Write one paragraph in Writing on register.", "Speak two minutes on any prompt."], pep: "Small steps, every day." };
const goodQuiz = { title: "Collocations", items: [
  { type: "mcq", q: "Pick the natural pair", choices: ["make a decision", "do a decision", "take a decide", "make a decide"], a: "make a decision", why: "collocation", fa: "توجه" },
  { type: "cloze", q: "She ___ a decision yesterday.", a: "made", why: "past", fa: "گذشته" },
  { type: "short", q: "one-phrase answer?", a: "yes", why: "w", fa: "f" },
  { type: "mcq", q: "Another", choices: ["strong tea", "powerful tea", "stark tea", "hard tea"], a: "strong tea", why: "collocation", fa: "نکته" },
]};
const goodListen = { title: "Coffee economics", text: "x".repeat(120), questions: [
  { q: "Why do cafes price slowly?", choices: ["A", "B"], a: "A", why: "inference" },
  { q: "What is the second point?", choices: ["A", "B"], a: "B", why: "literal" },
]};
const goodSpeak = { scores: { fluency: 7, range: 6, accuracy: 5, delivery: 8 }, errors: [{ bad: "I am knowing", good: "I know", fa: "استتیو" }], upgrades: [{ plain: "very good", better: "remarkable", fa: "تقویت" }], round2: { constraint: "retell without 'get'", same_prompt: true }, verdict: "Solid B2.", fa_note: "روی افعال کار کن" };
const goodWriting = { level: "B2+", scores: { task: 7, organization: 6, range: 7, accuracy: 8 }, verdict: "Clear organization.", errors: [{ bad: "advices", good: "advice", fa: "غیرقابل شمارش" }], upgrades: [{ plain: "a lot of", c1: "a great deal of", fa: "رسمی" }], next_focus: "countability" };
const goodAssess = { band: "B2", verdict: "Two sentences.", strengths: ["articles"], weaknesses: ["prepositions"], errors: [], prescription: ["Review lapsing cards"] };
const goodPlan = { goal: "Push prepositions.", days: Array.from({ length: 7 }, (_, i) => ({ day: i + 1, focus: `day ${i + 1}`, tasks: [{ text: "Clear due reviews", minutes: 15 }] })) };
const goodScan = { band: "B2+", verdict: "Honest read.", strengths: ["range"], weaknesses: [{ point: "articles seen 4x", fix: "daily article drill" }], actions: ["Do the article drill"], confidence: 0.7 };
const goodClinic = { title: "Prepositions drill", goal: "Beat dar overreach.", items: Array.from({ length: 5 }, (_, i) => ({ kind: "mcq", q: `Q${i}`, a: "on", fa: "حرف اضافه" })) };
const goodPlacement = { level: "B2", confidence: 0.8, reasons: "Clear paragraphs, rare errors." };
const goodExam = { title: "Mock", passage: "", items: Array.from({ length: 12 }, (_, i) => ({ type: "mcq", skill: "grammar", q: `Q${i}`, choices: ["a", "b", "c", "d"], a: "a", why: "w" })) };

function main() {
  // ---- brief ----
  check("brief: good", validateBrief(goodBrief) === null, String(validateBrief(goodBrief)));
  check("brief: plan wrong length", validateBrief({ ...goodBrief, plan: ["one"] }) !== null);
  check("brief: plan non-strings", validateBrief({ ...goodBrief, plan: ["a", 3, "c"] }) !== null);
  check("brief: empty priority", validateBrief({ ...goodBrief, priority: "  " }) !== null);
  check("brief: non-object", validateBrief("hello") !== null);

  // ---- quiz ----
  check("quiz: good", validateQuiz(goodQuiz) === null, String(validateQuiz(goodQuiz)));
  check("quiz: mcq answer not in choices", validateQuiz({ ...goodQuiz, items: goodQuiz.items.map((it, i) => (i === 0 ? { ...it, a: "nope" } : it)) }) !== null);
  check("quiz: mcq missing choices", validateQuiz({ ...goodQuiz, items: goodQuiz.items.map((it, i) => (i === 0 ? { ...it, choices: undefined } : it)) }) !== null);
  check("quiz: too few items", validateQuiz({ ...goodQuiz, items: goodQuiz.items.slice(0, 2) }) !== null);
  check("quiz: empty q", validateQuiz({ ...goodQuiz, items: goodQuiz.items.map((it, i) => (i === 2 ? { ...it, q: "" } : it)) }) !== null);

  // ---- listen ----
  check("listen: good", validateListen(goodListen) === null, String(validateListen(goodListen)));
  check("listen: short text", validateListen({ ...goodListen, text: "too short" }) !== null);
  check("listen: answer off-choices", validateListen({ ...goodListen, questions: [{ ...goodListen.questions[0], a: "Z" }, goodListen.questions[1]] }) !== null);
  check("listen: one question", validateListen({ ...goodListen, questions: [goodListen.questions[0]] }) !== null);

  // ---- speak ----
  check("speak: good", validateSpeak(goodSpeak) === null, String(validateSpeak(goodSpeak)));
  check("speak: score out of range", validateSpeak({ ...goodSpeak, scores: { ...goodSpeak.scores, fluency: 11 } }) !== null);
  check("speak: missing round2 constraint", validateSpeak({ ...goodSpeak, round2: { same_prompt: true } }) !== null);
  check("speak: errors not array", validateSpeak({ ...goodSpeak, errors: "none" }) !== null);

  // ---- writing ----
  check("writing: good", validateWriting(goodWriting) === null, String(validateWriting(goodWriting)));
  check("writing: bad level", validateWriting({ ...goodWriting, level: "C2" }) !== null);
  check("writing: score range", validateWriting({ ...goodWriting, scores: { ...goodWriting.scores, task: 0 } }) !== null);
  check("writing: error entry broken", validateWriting({ ...goodWriting, errors: [{ bad: "x" }] }) !== null);

  // ---- assess ----
  check("assess: good", validateAssess(goodAssess) === null, String(validateAssess(goodAssess)));
  check("assess: band off-list", validateAssess({ ...goodAssess, band: "A1" }) !== null);
  check("assess: strengths missing", validateAssess({ ...goodAssess, strengths: undefined }) !== null);
  check("assess: empty errors OK (rebuilt)", validateAssess({ ...goodAssess, errors: [] }) === null);

  // ---- plan ----
  check("plan: good", validatePlan(goodPlan) === null, String(validatePlan(goodPlan)));
  check("plan: 3 days only", validatePlan({ ...goodPlan, days: goodPlan.days.slice(0, 3) }) !== null);
  check("plan: task minutes out of band", validatePlan({ ...goodPlan, days: [{ ...goodPlan.days[0], tasks: [{ text: "x", minutes: 90 }] }, ...goodPlan.days.slice(1)] }) !== null);
  check("plan: empty task text", validatePlan({ ...goodPlan, days: [{ ...goodPlan.days[0], tasks: [{ text: "", minutes: 10 }] }, ...goodPlan.days.slice(1)] }) !== null);

  // ---- scan ----
  check("scan: good", validateScan(goodScan) === null, String(validateScan(goodScan)));
  check("scan: weakness missing fix", validateScan({ ...goodScan, weaknesses: [{ point: "p" }] }) !== null);
  check("scan: confidence out of range", validateScan({ ...goodScan, confidence: 1.5 }) !== null);
  check("scan: confidence absent OK", validateScan({ ...goodScan, confidence: undefined }) === null);

  // ---- clinic ----
  check("clinic: good", validateClinic(goodClinic) === null, String(validateClinic(goodClinic)));
  check("clinic: too few items", validateClinic({ ...goodClinic, items: goodClinic.items.slice(0, 2) }) !== null);
  check("clinic: item missing a", validateClinic({ ...goodClinic, items: goodClinic.items.map((it, i) => (i === 0 ? { ...it, a: "" } : it)) }) !== null);

  // ---- placement ----
  check("placement: good", validatePlacementW(goodPlacement) === null, String(validatePlacementW(goodPlacement)));
  check("placement: bad level", validatePlacementW({ ...goodPlacement, level: "C2" }) !== null);
  check("placement: confidence string", validatePlacementW({ ...goodPlacement, confidence: "0.8" }) !== null);

  // ---- exam gen ----
  check("exam: good", validateExamGen(goodExam) === null, String(validateExamGen(goodExam)));
  check("exam: no items", validateExamGen({ title: "t" }) !== null);
  check("exam: item missing a", validateExamGen({ ...goodExam, items: goodExam.items.map((it, i) => (i === 3 ? { ...it, a: "" } : it)) }) !== null);
  check("exam: thin 2 items", validateExamGen({ ...goodExam, items: goodExam.items.slice(0, 2) }) !== null);

  console.log(`\nvalidators: ${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
