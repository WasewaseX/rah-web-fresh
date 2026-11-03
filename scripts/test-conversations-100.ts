// 100-case conversational regression (ROADMAP P2: "100-case regression +
// routing metrics"). Deterministic: drives the CANONICAL routing layers
// (slash commands, trigger table, state-question detection) plus the history
// flattening seam across 100 labeled utterances, and prints per-class routing
// metrics. The LLM planner's own picks stay covered by the live 6-case
// regression (agent-regression-120.sh) - this battery pins the deterministic
// contract that must hold underneath it.
// Run: bun scripts/test-conversations-100.ts

import { parseSlash, routeByCommand, routeByTrigger } from "../src/lib/agent/planner";
import { isStateQuestion } from "../src/lib/coach-agent/loop";
import { flattenCoach } from "../src/lib/coach-agent/history";

let pass = 0;
let fail = 0;
const byClass: Record<string, { ok: number; n: number }> = {};

function check(cls: string, name: string, ok: boolean, detail = "") {
  byClass[cls] ??= { ok: 0, n: 0 };
  byClass[cls].n += 1;
  if (ok) {
    pass++;
    byClass[cls].ok += 1;
  } else {
    fail++;
    console.log(`FAIL  [${cls}] ${name}${detail ? " - " + detail : ""}`);
  }
}

// ---------- class A: slash commands (20) ----------
// Expected: the exact skill's command resolves; unknown commands MISS the
// command map (they fall through to the trigger/planner layers).
const COMMAND_CASES: [string, string | null][] = [
  ["/test", "generate-exam"], ["/quiz-full", "generate-exam"], ["/correct fix my sentence", "correct"],
  ["/fix this", "correct"], ["/tr good morning", "translate"], ["/translate collocation", "translate"],
  ["/collocations", "collocation-drill"], ["/collocation make or do", "collocation-drill"],
  ["/vocab", "vocab-drill"], ["/vocabulary food words", "vocab-drill"], ["/phrasal", "phrasal-verbs"],
  ["/idioms", "idioms"], ["/grammar", "grammar-drill"], ["/pronunciation th", "pronunciation"],
  ["/pronounce water", "pronunciation"], ["/paraphrase this", "paraphrase"],
  ["/quiz", null], // the retired /quiz command must NOT route (Task 120 bug pin)
  ["/definitely-not-a-command", null], ["/UPPER", null], ["/", null],
];
COMMAND_CASES.forEach(([cmd, expected], i) => {
  const parsed = parseSlash(cmd);
  if (!parsed) {
    check("A-command", `case ${i + 1} (${cmd})`, expected === null, "no slash parse but a skill was expected");
    return;
  }
  const hit = routeByCommand(parsed.cmd, parsed.args);
  check("A-command", `case ${i + 1} (${cmd})`, (hit?.def.id ?? null) === expected, `got ${hit?.def.id ?? "miss"}`);
});

// ---------- class B: trigger routing (25) ----------
const TRIGGER_CASES: [string, string][] = [
  ["how do I say goodbye in a formal email", "translate"],
  ["translate: خوشحال شدم", "translate"],
  ["what is حافظه in english?", "translate"],
  ["is this correct: I have went", "correct"],
  ["correct this sentence please", "correct"],
  ["teach me collocations with make", "collocation-drill"],
  ["what are good word pairs for essays", "collocation-drill"],
  ["make or do exercise", "collocation-drill"],
  ["I need vocabulary for job interviews", "vocab-drill"],
  ["teach me a word a day", "vocab-drill"],
  ["explain phrasal verbs with up", "phrasal-verbs"],
  ["two-word verbs are confusing", "phrasal-verbs"],
  ["give me some idioms about time", "idioms"],
  ["grammar drill on articles", "grammar-drill"],
  ["pronunciation practice for th", "pronunciation"],
  ["paraphrase this paragraph for me", "paraphrase"],
  ["let's roleplay a cafe scene", "roleplay"],
  ["start a debate about remote work", "debate"],
  ["minimal pairs ship sheep", "minimal-pairs"],
  // "summarize the last chapter" is a GENERIC request - the summarize skill
  // grades the learner's own summaries, it does not write new ones; the
  // planner/chat layer owns generic asks (conversations-100 finding).
  ["summarize the last chapter", null],
  ["show me my mistakes", "mistakes"],
  ["build me a study plan", "study-plan"],
  ["what did I score on the last exam", "exam-history"],
  ["make the theme green", "theme-control"],
  ["assess my level", "assess-level"],
];
TRIGGER_CASES.forEach(([msg, expected], i) => {
  const hit = routeByTrigger(msg);
  check("B-trigger", `case ${i + 1} (${msg.slice(0, 40)})`, (hit?.def.id ?? null) === expected, `got ${hit?.def.id ?? "miss"}, want ${expected ?? "chat (no trigger)"}`);
});

// ---------- class C: small talk MUST stay in chat (25) ----------
// The small-talk gate: no deterministic trigger may fire on conversation.
const CHAT_CASES = [
  "hi", "hello!", "hey there", "good morning", "thanks a lot", "thank you!", "ok", "okay",
  "cool", "nice", "lol", "haha", "yes", "no", "sure", "maybe", "I see", "got it",
  "how are you today?", "what's up?", "just checking in", "that was fun", "see you tomorrow",
  "good night", "bye",
];
CHAT_CASES.forEach((msg, i) => {
  const hit = routeByTrigger(msg);
  check("C-chat", `case ${i + 1} ("${msg}")`, hit === null, `trigger fired: ${hit?.def.id}`);
});

// ---------- class D: state questions demand read_state (15) ----------
const STATE_CASES = [
  "what's my streak?", "how many reviews are due", "due count", "what's my level",
  "how much xp do I have", "show my gems", "do I have any reviews due today",
  "what are my mistakes", "how am I doing", "what should I practice", "my progress",
  "read_state", "what should I do next", "how many due cards remain", "my xp this week",
];
STATE_CASES.forEach((msg, i) => {
  check("D-state", `case ${i + 1} ("${msg.slice(0, 36)}")`, isStateQuestion(msg), "state gate missed a state question");
});

// state gate must NOT capture plain conversation (5 more)
const NOT_STATE = ["what is the capital of Turkey", "tell me about London", "correct my essay", "translate this", "make the theme blue"];
NOT_STATE.forEach((msg, i) => {
  check("D-state", `negative ${i + 1} ("${msg.slice(0, 36)}")`, !isStateQuestion(msg), "state gate captured a non-state message");
});

// ---------- class E: history flattening (10) ----------
// Raw envelopes in, spoken text out - never machinery JSON.
const FLATTEN_CASES: [string, string][] = [
  [JSON.stringify({ skill: "agent", reply: "Hello there" }), "Hello there"],
  [JSON.stringify({ skill: "vocab-drill", reply: "Let's drill" }), "Let's drill"],
  [JSON.stringify({ kind: "chat", reply: "Plain legacy row" }), "Plain legacy row"],
  ["just plain text already", "just plain text already"],
  [JSON.stringify({ skill: "agent", reply: "Truncated " + "x".repeat(2000) }), null], // 900 cap
];
FLATTEN_CASES.forEach(([raw, expected], i) => {
  const out = flattenCoach(raw);
  if (expected === null) {
    check("E-history", `case ${i + 1} (long reply)`, out.length === 900, `cap is ${out.length}`);
  } else {
    check("E-history", `case ${i + 1} (${expected.slice(0, 24)})`, out === expected, `got ${out.slice(0, 40)}`);
  }
});
// a corrupt envelope and machinery-only JSON flatten to something harmless
{
  const junk = flattenCoach("{not json at all");
  check("E-history", "corrupt envelope -> raw text passthrough", junk === "{not json at all");
  const empty = flattenCoach(JSON.stringify({ skill: "agent" }));
  check("E-history", "envelope without reply -> does not crash", typeof empty === "string");
  const arr = flattenCoach(JSON.stringify({ skill: "agent", reply: 42 }));
  check("E-history", "non-string reply -> falls back to raw content", typeof arr === "string");
  const nested = flattenCoach(JSON.stringify({ skill: "agent", reply: { deep: true } }));
  check("E-history", "object reply -> falls back to raw content, no throw", typeof nested === "string");
  check("E-history", "empty string row -> empty", flattenCoach("") === "");
}

// ---------- metrics ----------
console.log("\n--- routing metrics (per class) ---");
let rows = 0;
for (const [cls, s] of Object.entries(byClass)) {
  const pct = Math.round((s.ok / s.n) * 100);
  console.log(`${cls.padEnd(12)} ${String(s.ok).padStart(3)}/${String(s.n).padEnd(3)}  ${pct}%`);
  rows++;
}
const total = Object.values(byClass).reduce((a, s) => a + s.n, 0);
console.log(`${"-".repeat(34)}\ntotal cases:  ${total}  (target: 100)`);
check("Z-total", "battery really drives 100 cases", total === 100, String(total));
console.log(`\nconversations-100: ${pass} pass, ${fail} fail, ${rows} classes`);
process.exit(fail === 0 ? 0 : 1);
