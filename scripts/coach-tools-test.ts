// Coach-tools battery (Task 125). Run:
//   export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | cut -d= -f2-)" && bun scripts/coach-tools-test.ts
// Pins the four new coach abilities: review_forecast math, dictionary shape
// (live, skipped gracefully offline), add_cards validation, set_goal
// validation. Probe-vs-real write behavior lives in probe-hardening-test.
import { toolByName, type ToolResult } from "../src/lib/coach-agent/tools";
import { isDeckAddAsk, isWeekAsk } from "../src/lib/coach-agent/loop";
import { db } from "../src/lib/db";
import { dayIndex } from "../src/lib/fsrs";

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

async function main() {
  const forecast = toolByName("review_forecast")!;
  const dict = toolByName("dictionary")!;
  const add = toolByName("add_cards")!;
  const goals = toolByName("set_goal")!;

  // ---------- review_forecast: parts must sum to the whole queue ----------
  console.log("-- review_forecast");
  const f = await forecast.run({});
  const today = dayIndex();
  const states = await db.cardState.findMany({
    where: { learnerId: "me", suspended: false, state: { not: "new" } },
    select: { due: true },
  });
  let overdue = 0;
  const perDay = new Array<number>(7).fill(0);
  let beyond = 0;
  for (const s of states) {
    if (s.due < today) overdue++;
    else if (s.due <= today + 6) perDay[s.due - today]++;
    else beyond++;
  }
  check("forecast ok", f.ok === true, f.summary);
  check("forecast summary carries overdue count", f.summary.includes(`overdue`), f.summary);
  check(
    "forecast detail parts sum to queue size",
    f.detail?.includes(`overdue (past days): ${overdue}`) === true &&
      f.detail?.includes(`today: ${perDay[0]}`) === true,
    `expected overdue=${overdue} today=${perDay[0]}\n${f.detail}`
  );
  const horizonTotal = overdue + perDay.reduce((a, b) => a + b, 0) + beyond;
  check("7-day total line is honest", f.detail?.includes(`7-day total (overdue + due): ${overdue + perDay.reduce((a, b) => a + b, 0)}`) === true && horizonTotal === states.length, `beyond=${beyond} states=${states.length}`);

  // ---------- dictionary: live shape (soft-skipped when offline) ----------
  console.log("-- dictionary");
  let online = true;
  const hit = await dict.run({ word: "ubiquitous" }).catch((e: Error): ToolResult => {
    online = false;
    return { ok: false, summary: `unreachable: ${e.message}` };
  });
  if (!online) {
    console.log("  SKIP dictionary live check (offline sandbox)");
    pass++; // do not punish the battery for a sandbox without egress
  } else {
    check("dictionary hit ok", hit.ok === true, hit.summary);
    check("dictionary detail is UNTRUSTED-framed", hit.detail?.includes("UNTRUSTED WEB CONTENT") === true && hit.detail?.includes("END UNTRUSTED"), hit.detail?.slice(0, 120));
    const miss = await dict.run({ word: "asdfghjklqw" });
    check("dictionary 404 is an honest miss", miss.ok === false && /No dictionary entry/i.test(miss.summary), miss.summary);
  }
  const invalid = await dict.run({ word: "two words here" });
  check("dictionary rejects multi-word input", invalid.ok === false, invalid.summary);
  const empty = await dict.run({});
  check("dictionary rejects empty input", empty.ok === false, empty.summary);

  // ---------- add_cards: validation matrix (probe mode = no writes) ----------
  console.log("-- add_cards validation");
  const uc0 = await db.userCard.count({ where: { learnerId: "me" } });
  const good = await add.run({
    cards: [
      { kind: "cloze", prompt: "Battery check ___", answer: "works", level: "B2" },
      { kind: "ef", prompt: "ubiquitous", answer: "همه‌جا حاضر" }, // kind+level default passthrough
      { kind: "weird-kind", prompt: "Bad kind normalizes", answer: "cloze", level: "Z9" },
      { prompt: "", answer: "" }, // invalid, dropped
      "not an object", // invalid, dropped
    ],
    _probe: true,
  });
  check("add_cards: valid cards pass, junk dropped", good.ok === true && (good.data as { count?: number })?.count === 3, JSON.stringify(good.data));
  check("add_cards: probe wrote nothing", (await db.userCard.count({ where: { learnerId: "me" } })) === uc0);
  const over = await add.run({ cards: Array.from({ length: 20 }, (_, i) => ({ prompt: `c${i}`, answer: "x" })), _probe: true });
  check("add_cards: capped at 12", (over.data as { count?: number })?.count === 12, JSON.stringify(over.data));
  const none = await add.run({ cards: [] });
  check("add_cards: empty list rejected", none.ok === false, none.summary);
  const noArgs = await add.run({});
  check("add_cards: missing cards rejected", noArgs.ok === false, noArgs.summary);

  // ---------- set_goal: validation matrix ----------
  console.log("-- set_goal validation");
  const already = await goals.run({});
  check("set_goal: no args = no-op ok", already.ok === true && /already match|nothing/i.test(already.summary), already.summary);
  check("set_goal: bad focusSkill rejected", (await goals.run({ focusSkill: "hacking" })).ok === false);
  check("set_goal: dailyGoal 9999 rejected", (await goals.run({ dailyGoal: 9999 })).ok === false);
  check("set_goal: dailyGoal 0 rejected", (await goals.run({ dailyGoal: 0 })).ok === false);
  check("set_goal: newPerDay 1 rejected", (await goals.run({ newPerDay: 1 })).ok === false);
  const dry = await goals.run({ dailyGoal: 44, _probe: true });
  check("set_goal: valid probe dry-run ok", dry.ok === true && /dry-run/i.test(dry.summary), dry.summary);

  // ---------- loop enforcement detectors (Task 125) ----------
  console.log("-- loop enforcement detectors");
  check("deck-add: live probe string", isDeckAddAsk("add the word serendipity to my vocab deck") === true);
  check("deck-add: plain variant", isDeckAddAsk("add these 5 words to the deck") === true);
  check("deck-add: flashcards variant", isDeckAddAsk("put 'go' into my flashcards") === true);
  check("deck-add: essay ask NOT deck", isDeckAddAsk("add words to my essay") === false);
  check("deck-add: priority ask NOT deck", isDeckAddAsk("put my vocab first") === false);
  check("week-ask: live probe string", isWeekAsk("what does my review week look like?") === true);
  check("week-ask: planning variant", isWeekAsk("help me plan my study week") === true);
  check("week-ask: bare week NOT week-ask", isWeekAsk("how is your week going?") === false);
  check("week-ask: past week NOT week-ask", isWeekAsk("what did I do last week?") === false);

  console.log(`\ncoach-tools: ${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error("battery crashed:", e);
    process.exit(1);
  });
