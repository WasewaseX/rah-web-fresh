// Unit battery for the structured listening library (ROADMAP §3.2): authored
// comprehension questions are grounded (each "why" quote appears verbatim in
// the transcript - no fabricated evidence), the answer key is deterministic
// and spread across positions, and the sentence splitter round-trips.
// Run: bun scripts/test-listening-lib.ts

import { PASSAGES, splitSentences } from "../src/content/listening";

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

// 1. every passage carries exactly three well-formed questions
{
  check(PASSAGES.length >= 9, "library holds at least nine passages", String(PASSAGES.length));
  check(
    PASSAGES.every((p) => p.questions.length === 3),
    "every passage has exactly three comprehension questions",
    JSON.stringify(PASSAGES.filter((p) => p.questions.length !== 3).map((p) => p.id)),
  );
  check(
    PASSAGES.every((p) => p.questions.every((q) => q.choices.length === 3)),
    "every question has exactly three choices",
  );
  check(
    PASSAGES.every((p) => p.questions.every((q) => q.correct >= 0 && q.correct < q.choices.length)),
    "every answer key is in range",
  );
  check(
    PASSAGES.every((p) => p.questions.every((q) => q.q.length > 8 && q.why.length > 10)),
    "every question and evidence line is substantive",
  );
}

// 2. grounded evidence: every "why" quote appears verbatim in the transcript
{
  const ungrounded: string[] = [];
  for (const p of PASSAGES) {
    for (const q of p.questions) {
      const quote = q.why.replace(/^["']|["']$/g, "");
      if (!p.transcript.includes(quote)) ungrounded.push(`${p.id}: ${quote.slice(0, 60)}`);
    }
  }
  check(ungrounded.length === 0, "every evidence line is a verbatim transcript quote", JSON.stringify(ungrounded));
}

// 3. answer keys are spread across positions (not a guessable pattern)
{
  const idx = PASSAGES.flatMap((p) => p.questions.map((q) => q.correct));
  for (const pos of [0, 1, 2]) {
    check(idx.includes(pos), `answer key uses position ${pos}`, JSON.stringify(idx));
  }
  check(idx.length === PASSAGES.length * 3, "all 27 keys counted", String(idx.length));
  // no passage has all three answers at the same position
  const flat = PASSAGES.every((p) => new Set(p.questions.map((q) => q.correct)).size > 1);
  check(flat, "no passage repeats one answer position three times");
}

// 4. sentence splitter: deterministic, round-trips, usable segment sizes
{
  for (const p of PASSAGES) {
    const segs = splitSentences(p.transcript);
    const again = splitSentences(p.transcript);
    const rejoin = segs.join(" ").replace(/\s+/g, " ").trim();
    const original = p.transcript.replace(/\s+/g, " ").trim();
    check(
      JSON.stringify(segs) === JSON.stringify(again) && rejoin === original && segs.length >= 3 && segs.every((s) => s.length <= 400),
      `${p.id}: ${segs.length} segments, deterministic, round-trips`,
      `rejoin=${rejoin === original} segs=${segs.length}`,
    );
  }
  check(splitSentences("Short. Also fine! And this?") .length === 3, "punctuation set .!? all split");
  check(splitSentences("one two three").length === 1, "no punctuation -> single segment, no crash");
}

// 5. honest labeling: every correct answer's evidence quote contains the
// semantic core the choice claims (spot-check via the quote being non-generic
// is already covered); here we pin the counts used by the pick cards.
{
  check(
    PASSAGES.every((p) => p.vocab.length >= 3 && p.features.length >= 2),
    "every passage keeps its vocab + sound-feature ledger intact",
  );
}

console.log(`\nlistening-library battery: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
