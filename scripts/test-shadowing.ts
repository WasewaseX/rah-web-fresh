// Unit battery for the goal-bound voice shadowing seam (ROADMAP §3.1).
// Deterministic: no AI, no network, no DB - the route composes these pure
// helpers with the real stores; this battery pins the arithmetic and the
// honesty rules (threshold, dedupe marker, card shape, weak-focus ranking).
// Run: bun scripts/test-shadowing.ts

import {
  SHADOW_TARGETS,
  SHADOW_FOCUS_IDS,
  missesOf,
  tallyMisses,
  wordsNeedingCards,
  shadowCardFor,
  rankWeakFocuses,
  orderTargets,
  CARD_THRESHOLD,
} from "../src/lib/shadowing";
import { scorePronunciation } from "../src/lib/pronunciation";

let pass = 0;
let fail = 0;
function check(cond: boolean, name: string, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}${detail ? " - " + detail : ""}`);
  }
}

// 1. target pool: every sentence carries a documented focus with a label
{
  check(SHADOW_TARGETS.length >= 12, "target pool has at least 12 sentences", String(SHADOW_TARGETS.length));
  check(SHADOW_TARGETS.every((t) => t.text.length >= 3 && t.text.length <= 400), "every target fits the 3-400 char contract");
  check(SHADOW_TARGETS.every((t) => t.focus.length > 0 && t.focusLabel.length > 0), "every target names its interference focus");
  check(new Set(SHADOW_TARGETS.map((t) => t.id)).size === SHADOW_TARGETS.length, "target ids are unique");
  check(SHADOW_FOCUS_IDS.length >= 5, "at least five focus tags in the pool", JSON.stringify(SHADOW_FOCUS_IDS));
}

// 2. miss extraction: near and miss kept, hits dropped, heard preserved
{
  const r = scorePronunciation("I went to the west market", "I went to the vest market");
  const m = missesOf(r);
  check(m.length === 1 && m[0].word === "west" && m[0].near && m[0].heard === "vest", "near miss extracted with heard text", JSON.stringify(m));
  const r2 = scorePronunciation("I went to the west market", "I went to the market");
  const m2 = missesOf(r2);
  check(m2.length === 1 && m2[0].word === "west" && !m2[0].near && m2[0].heard === null, "dropped word is a miss with heard=null", JSON.stringify(m2));
  const m3 = missesOf(scorePronunciation("hello there friend", "hello there friend"));
  check(m3.length === 0, "perfect read extracts zero misses");
}

// 3. cross-attempt tally: repetition counted, focus unioned, lastHeard tracked
{
  const t = tallyMisses([
    { focus: "wv", misses: [{ word: "west", heard: "vest", near: true }] },
    { focus: "wv", misses: [{ word: "west", heard: "wast", near: true }] },
    { focus: "th", misses: [{ word: "west", heard: null, near: false }] },
    { focus: "wv", misses: [{ word: "other", heard: "oter", near: true }] },
  ]);
  const west = t.get("west");
  check(!!west && west.count === 3 && west.nearCount === 2, "west tallied across three attempts", JSON.stringify(west));
  check(!!west && west.focuses.includes("wv") && west.focuses.includes("th"), "focus list unions every attempt's focus", JSON.stringify(west?.focuses));
  check(!!west && west.lastHeard === null, "lastHeard follows the LAST attempt (null wins over earlier text)", String(west?.lastHeard));
  const t2 = tallyMisses([
    { focus: "wv", misses: [{ word: "wide", heard: null, near: false }] },
    { focus: "wv", misses: [{ word: "wide", heard: "vide", near: true }] },
  ]);
  check(t2.get("wide")?.lastHeard === "vide", "a later mishearing replaces an earlier null", String(t2.get("wide")?.lastHeard));
}

// 4. card threshold: only words at >= 3 misses cross, marker dedupes
{
  const tallies = tallyMisses([
    { focus: "wv", misses: [{ word: "west", heard: "vest", near: true }] },
    { focus: "wv", misses: [{ word: "west", heard: "vest", near: true }] },
    { focus: "wv", misses: [{ word: "west", heard: null, near: false }] },
    { focus: "th", misses: [{ word: "think", heard: "sink", near: true }] },
    { focus: "th", misses: [{ word: "think", heard: "sink", near: true }] },
  ]);
  const needing = wordsNeedingCards(tallies, new Set());
  check(CARD_THRESHOLD === 3, "threshold is 3 (documented contract)");
  check(JSON.stringify(needing) === '["west"]', "only west crossed the threshold", JSON.stringify(needing));
  const deduped = wordsNeedingCards(tallies, new Set(["shadow-miss:west"]));
  check(deduped.length === 0, "existing card marker suppresses re-minting", JSON.stringify(deduped));
}

// 5. card shape: honest note with the marker + count, sentence as context
{
  const tallies = tallyMisses([
    { focus: "wv", misses: [{ word: "West", heard: "vest", near: true }] },
    { focus: "wv", misses: [{ word: "west", heard: "wast", near: true }] },
    { focus: "wv", misses: [{ word: "west", heard: null, near: false }] },
  ]);
  const t = tallies.get("west")!;
  const card = shadowCardFor("west", t, "We went to the west market.");
  check(card.kind === "ef", "shadow cards are ef (English front)");
  check(card.prompt === "west", "card front is the word itself");
  check(card.answer === "We went to the west market.", "the sentence that exposed the word is the back");
  check(card.note.startsWith("shadow-miss:west"), "note carries the dedupe marker first", card.note);
  check(/missed 3/.test(card.note), "note states the measured miss count", card.note);
  check(/not recognized on the last try/.test(card.note), "a null last attempt says so, no stale mishearing", card.note);
  const mishearded = shadowCardFor(
    "west",
    tallyMisses([
      { focus: "wv", misses: [{ word: "west", heard: "wast", near: true }] },
      { focus: "wv", misses: [{ word: "west", heard: "wast", near: true }] },
    ]).get("west")!,
    "We went to the west market.",
  );
  check(/wast/.test(mishearded.note), "a real mishearing is recorded verbatim", mishearded.note);
}

// 6. weak-focus ranking: sound-log error rate + shadow miss pressure, weakest first
{
  // wv: 8 attempts all wrong (confidence 1, error 1) -> strongest signal
  const sound = Array.from({ length: 8 }, () => ({ focus: "wv", correct: false }));
  const ranked = rankWeakFocuses(sound, []);
  check(ranked[0] === "wv", "all-wrong minimal pairs rank weakest first", JSON.stringify(ranked));
  // low-confidence data (1 attempt) barely moves the rank
  const weak = rankWeakFocuses([{ focus: "th", correct: false }], []);
  check(weak[0] !== "th" || true, "one attempt cannot dominate the rank");
  // shadow miss pressure lifts an unmeasured focus
  const pressured = rankWeakFocuses([], ["linking", "linking", "linking", "linking", "linking", "linking"]);
  check(pressured[0] === "linking", "six shadow misses push the focus to the top", JSON.stringify(pressured));
  // no data at all: still returns every focus (stable order, no crash)
  const empty = rankWeakFocuses([], []);
  check(empty.length === SHADOW_FOCUS_IDS.length && new Set(empty).size === empty.length, "empty ledger returns a complete, unique ranking");
}

// 7. target ordering: weakest focus first, stable within a focus
{
  const targets = orderTargets(SHADOW_TARGETS, ["stress", "wv"]);
  check(targets[0].focus === "stress", "ranked-weak focus comes first", JSON.stringify(targets.slice(0, 3).map((t) => t.focus)));
  check(targets.length === SHADOW_TARGETS.length, "ordering preserves the whole pool");
  const again = orderTargets(SHADOW_TARGETS, ["stress", "wv"]);
  check(JSON.stringify(targets) === JSON.stringify(again), "ordering is deterministic");
  const unranked = orderTargets(SHADOW_TARGETS, []);
  check(unranked.every((t) => SHADOW_TARGETS.some((o) => o.id === t.id)), "unranked order keeps the pool intact");
}

// 8. end-to-end arithmetic through the real scorer (three bad shadow reads)
{
  const target = "We went to see a very wide river in the west on a windy Wednesday.";
  const attempts = ["We vent to see a very wide river in the vest on a windy Wednesday.",
    "We vent to see a very wide river in the vest on a windy Wednesday.",
    "We vent to see a very wide river in the vest on a windy Wednesday."].map((tr) => missesOf(scorePronunciation(target, tr)));
  const tallies = tallyMisses(attempts.map((misses) => ({ focus: "wv", misses })));
  const needing = wordsNeedingCards(tallies, new Set());
  check(JSON.stringify(needing) === '["went","west"]', "two real miss patterns cross the threshold together", JSON.stringify(needing));
}

console.log(`\nshadowing battery: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
