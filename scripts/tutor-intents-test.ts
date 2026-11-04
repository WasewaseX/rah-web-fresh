// Tutor-intent battery (Task 124). Run:
//   bun scripts/tutor-intents-test.ts
// Pins the deterministic tutor-chat intents against the EXACT holder
// transcripts that broke (2026-11-03 + 2026-11-05) plus the v2 guards that
// keep practice sentences from repainting the app. Pure unit battery: no DB,
// no server, no model calls.
import {
  matchThemeIntent,
  isThemeishMessage,
  claimsInventedLimit,
  claimsThemeInability,
  themeHelpReply,
  limitResetReply,
  themeTokensFor,
} from "../src/lib/tutor-intents";

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

const NO_EM_DASH = /—/;

// ---------- 1. historical transcripts must apply themes ----------
console.log("-- historical holder transcripts (2026-11-03 / 2026-11-05)");
const t1 = matchThemeIntent("make the Ui theme green");
check("turn 1 'make the Ui theme green' hits", !!t1 && t1.presetId === "forest", JSON.stringify(t1?.presetId));
check("turn 1 reply is the grounded Done line", !!t1 && t1.reply.startsWith("Done - the app now wears the Forest"), t1?.reply.slice(0, 60));
check("turn 1 reply carries tokens", !!t1 && !!t1.tokens && Object.keys(t1.tokens).length === 5);

const t2 = matchThemeIntent("make the Ui theme blue again");
check("turn 2 'make the Ui theme blue again' hits ocean", !!t2 && t2.presetId === "ocean", JSON.stringify(t2?.presetId));

const t2b = matchThemeIntent("make the ui theme blue again");
check("turn 2 lowercase variant hits", !!t2b && t2b.presetId === "ocean");

check("turn 3 'wat?' is NOT an intent (LLM path, honesty net covers it)", matchThemeIntent("wat?") === null);

// ---------- 2. v2 color-only paths ----------
console.log("-- v2 color-only / reset-direct paths");
const cases: [string, string, boolean][] = [
  ["make it blue again", "ocean", false],
  ["go green please", "forest", false],
  ["paint it violet instead", "violet", false],
  ["switch to ocean", "ocean", false],
  ["set forest", "forest", false],
  ["the app is too dark, make it green", "forest", false],
  ["make the screen purple now", "violet", false],
  ["reset the theme", "midnight", true],
  ["go back to normal", "midnight", true],
  ["change it back to the old look", "midnight", true],
  ["turn the whole app rose", "rose", false],
];
for (const [msg, preset, reset] of cases) {
  const r = matchThemeIntent(msg);
  check(
    `"${msg}" -> ${preset}${reset ? " (reset)" : ""}`,
    !!r && r.presetId === preset && r.reset === reset,
    `got ${JSON.stringify(r?.presetId)}/${JSON.stringify(r?.reset)}`
  );
}

// ---------- 3. false-positive guards ----------
console.log("-- guards: practice sentences must NOT repaint");
const guards = [
  "make the wall green",
  "The sea is blue.",
  "I painted the fence red yesterday.",
  "give me two examples with the color blue",
  "write a sentence with the word green",
  "wat?",
  "hello",
  "what does vivid mean?",
];
for (const g of guards) {
  check(`"${g}" -> null`, matchThemeIntent(g) === null, JSON.stringify(matchThemeIntent(g)?.presetId));
}

// ---------- 4. honesty-net detectors ----------
console.log("-- honesty net: fabricated limits and ability denials");
const budgetWall =
  "I apologize, but I've reached the limit for theme changes in this session. You'll need to try changing the theme again later when the budget resets. Is there anything else I can help you with regarding your language learning?";
check("historical budget wall detected", claimsInventedLimit(budgetWall));
check("'reached the limit for theme changes' detected", claimsInventedLimit("I've reached the limit for theme changes in this session."));
check("'my session budget is spent' detected", claimsInventedLimit("Sorry, my session budget for theme changes is spent."));
check("real English lesson about budgets passes", !claimsInventedLimit("The company budget resets every quarter, so spending stayed flat."));
check("real XP cap mention passes (arcade budgets are REAL)", !claimsInventedLimit("You have a daily quota of 50 arcade XP; it resets at midnight."));
check("streak echo is not a limit lie", !claimsInventedLimit("Your current streak is 3 days and you have 35 reviews due. Go to review"));

const inability =
  "I don't have the ability to change the app's UI theme directly - that's controlled through your app settings or preferences. You'll need to look for theme options in your account settings.";
check("historical inability wall detected", claimsThemeInability(inability));
check("settings-pointer detected", claimsThemeInability("The theme option lives in your account settings."));
check("capability confirmation passes", !claimsThemeInability("Sure, I'll change the theme to green for you right now."));
check("color vocabulary lesson passes", !claimsThemeInability("Blue is a calm color; the word comes from Old English blaw."));

// ---------- 5. isThemeishMessage gating ----------
console.log("-- theme-ish gate for the route");
check("'make it blue again' is theme-ish", isThemeishMessage("make it blue again"));
check("'make the Ui theme green' is theme-ish", isThemeishMessage("make the Ui theme green"));
check("'make the wall green' is theme-ish (net-gated, documented)", isThemeishMessage("make the wall green"));
check("'wat?' is not theme-ish", !isThemeishMessage("wat?"));
check("vocab question is not theme-ish", !isThemeishMessage("what does 'vivid' mean?"));

// ---------- 6. grounded recovery replies ----------
console.log("-- grounded recovery replies");
const help = themeHelpReply();
const lim = limitResetReply();
check("themeHelpReply non-empty, no em dash", help.reply.length > 60 && !NO_EM_DASH.test(help.reply));
check("limitResetReply owns the mistake", lim.reply.includes("no budgets, quotas, or session limits") && !NO_EM_DASH.test(lim.reply));
check("limitResetReply offers real presets", ["green", "blue", "sunset", "violet", "rose"].every((c) => lim.reply.includes(c)));

// ---------- 7. tokens are real ----------
console.log("-- token plumbing");
const intent = matchThemeIntent("make the Ui theme green")!;
const stored = themeTokensFor(intent);
let tokensOk = false;
try {
  const parsed = JSON.parse(stored ?? "");
  tokensOk =
    typeof parsed === "object" &&
    ["primary", "primaryDeep", "bg", "surface", "accent"].every((k) => typeof parsed[k] === "string" && /^#[0-9a-f]{6}$/.test(parsed[k]));
} catch {
  tokensOk = false;
}
check("themeTokensFor yields 5 valid hex tokens", tokensOk, stored ?? "null");

// ---------- 8. every deterministic reply is em-dash free ----------
console.log("-- output hygiene");
const allReplies = [
  ...(cases.map(([m]) => matchThemeIntent(m)?.reply ?? "") as string[]),
  help.reply,
  lim.reply,
];
check("no em dash in any deterministic reply", allReplies.every((r) => !NO_EM_DASH.test(r)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
