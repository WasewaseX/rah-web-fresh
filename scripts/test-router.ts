// Router + agent-machinery unit battery. Task 120: the old version tested
// routeIntent() from the retired duplicate stack (src/lib/skills/agent.ts,
// deleted after the 2026-11-03 audit); it now pins the CANONICAL machinery:
// slash/trigger routing, the small-talk gate, turn extraction, state-question
// detection, live-context assembly, history flattening, and theme parsing.
// Run: bun scripts/test-router.ts
import { parseSlash, routeByCommand, routeByTrigger } from "../src/lib/agent/planner";
import { getSkill } from "../src/lib/agent/registry";
import { extractTurn, isStateQuestion, buildLiveContext, sanitizeReply } from "../src/lib/coach-agent/loop";
import { flattenCoach } from "../src/lib/coach-agent/history";
import { sanitizeReply as verifyReply } from "../src/lib/agent/verify";
import { parseThemeRequest, presetById } from "../src/lib/agent/theme";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`PASS ${name}`);
  } else {
    fail++;
    console.log(`FAIL ${name}${detail ? ` - ${detail}` : ""}`);
  }
}

// --- routing: slash commands hit the registry
check("slash /test routes", routeByCommand("test", "present perfect")?.def.id === "generate-exam");
check("slash /theme routes", routeByCommand("theme", "ocean")?.def.id === "theme-control");
check("slash parse", parseSlash("/theme ocean")?.cmd === "theme");
check("slash unknown", routeByCommand("nosuchcmd", "") === null);

// --- routing: deterministic triggers
const quizHit = routeByTrigger("quiz me on present perfect");
check("trigger quiz", quizHit !== null);
const themeHit = routeByTrigger("change the colors of the app");
check("trigger theme", themeHit !== null && themeHit.def.id === "theme-control");

// --- small-talk style messages must NOT be hijacked by triggers
check("greeting has no trigger", routeByTrigger("hi") === null);
check("thanks has no trigger", routeByTrigger("thanks") === null);

// --- loop machinery
check("state question detected", isStateQuestion("what's my streak?"));
check("non-state question ignored", !isStateQuestion("what does notwithstanding mean?"));

const prose = extractTurn("Just a plain answer with no braces.");
check("prose final", prose.kind === "prose" && prose.turn.final === true);

const mangled = extractTurn('{"thought":"go","tool":"read_state","args":{}');
check("mangled tool salvaged", mangled.turn.tool === "read_state");

const ctx = buildLiveContext({ level: "B2", streak: 3, due: 7, focus: "vocabulary", recentTraps: ["articles"] }, "review");
check("live context carries state", ctx.includes("streak=3") && ctx.includes("due=7") && ctx.includes("current_view=review"));

// --- history flattening (audit P1: envelopes -> spoken text)
check("flatten agent envelope", flattenCoach('{"skill":"agent","reply":"Hello there","commands":[]}') === "Hello there");
check("flatten legacy envelope", flattenCoach('{"kind":"chat","reply":"Nice work"}') === "Nice work");
check("flatten plain text", flattenCoach("plain answer") === "plain answer");

// --- reply sanitizers
check("loop sanitize unwraps json reply", sanitizeReply('{"thought":"x","reply":"real answer"}', "fb") === "real answer");
const vr = verifyReply("Good try. یک مثال بزن. Next time use the article.");
check("verify moves persian, keeps english", !/[\u0600-\u06FF]/.test(vr.reply) && vr.reply.includes("Next time use the article.") && vr.movedFa.includes("یک مثال بزن"));

// --- theme parsing (the restored app-control ability)
check("theme green -> forest", parseThemeRequest("make it green").preset === "forest");
check("theme preset id", parseThemeRequest("ocean").preset === "ocean");
check("theme hex tokens", (parseThemeRequest("#34d399 #047857 #0d1512 #14201b #6ee7b7").tokens?.primary ?? "") === "#34d399");
check("theme reset", parseThemeRequest("back to normal").preset === "midnight");
check("forest preset exists", presetById("forest")?.tokens.primary === "#34d399");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
