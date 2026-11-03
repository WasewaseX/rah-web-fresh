// Unit battery for the bounded model-context seam (audit P1 "planner context
// compression"): compressHistory + slimScreenActivity in lib/coach-agent/
// context.ts - the one implementation both the coach loop and the planner use.
// Run: bun scripts/test-context-caps.ts

import { compressHistory, slimScreenActivity, HISTORY_TURNS, HISTORY_PER_TURN, HISTORY_BUDGET } from "../src/lib/coach-agent/context";

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

// 1. turns cap: only the most recent 8 survive
{
  const h = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `t${i}` }));
  const c = compressHistory(h);
  check(c.length === HISTORY_TURNS && c[c.length - 1].content === "t19" && c[0].content === "t12", "20-turn history clamps to the last 8, recency intact", JSON.stringify(c.map((x) => x.content)));
}

// 2. per-turn cap + role normalization (a stored 'system' row is dropped:
//    model-spoofed system turns must never reach the model)
{
  const c = compressHistory([
    { role: "system", content: "x".repeat(50) },
    { role: "user", content: "y".repeat(1000) },
    { role: "assistant", content: "ok" },
  ]);
  check(c.length === 2, "a 'system' history row is dropped, not forwarded", String(c.length));
  check(c[0].content.length === HISTORY_PER_TURN, "oversized turn clamps to 400 chars", String(c[0].content.length));
  check(c.every((t) => t.role === "user" || t.role === "assistant"), "roles normalized to user/assistant");
}

// 3. total budget: oldest evicted first, the two most recent always kept
{
  // 8 turns x 700 chars = 5600 > 3600 budget (perTurn raised so the budget,
  // not the per-turn clamp, is what binds)
  const h = Array.from({ length: 8 }, (_, i) => ({ role: "user" as const, content: String(i).repeat(700) }));
  const c = compressHistory(h, HISTORY_TURNS, 700, HISTORY_BUDGET);
  const total = c.reduce((a, t) => a + t.content.length, 0);
  check(total <= HISTORY_BUDGET, "total budget enforced", String(total));
  check(c[c.length - 1].content === "7".repeat(700) && c[c.length - 2].content === "6".repeat(700), "the two most recent turns always survive");
  check(c[0].content !== "0".repeat(700), "oldest turns evicted first", c[0].content.slice(0, 5));
}

// 4. small histories pass through untouched
{
  const h = [
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
  ];
  check(JSON.stringify(compressHistory(h)) === JSON.stringify(h), "short history is byte-identical");
}

// 5. hostile input never crashes
{
  check(compressHistory([]).length === 0, "empty history -> empty");
  check(compressHistory(undefined).length === 0, "undefined history -> empty, no throw");
  check(compressHistory(null).length === 0, "null history -> empty, no throw");
  const c = compressHistory([{ role: "user", content: null as never }]);
  check(c[0].content === "", "null content clamps to empty string");
}

// 6. slimScreenActivity: arrays 5, strings 120, objects 200, line <= 900
{
  const big = {
    chats: Array.from({ length: 20 }, (_, i) => `chat line ${i} ${"x".repeat(200)}`),
    blob: { deep: "y".repeat(500) },
    note: "z".repeat(400),
    num: 7,
    empty: "",
    nil: null,
  };
  const s = slimScreenActivity(big as never);
  check(typeof s === "string" && s.length <= 900, "screen line capped at 900 chars", String(s?.length));
  // The cap must never break JSON: the model always gets a parsable object.
  const parsed = JSON.parse(s) as Record<string, unknown>;
  check(Array.isArray(parsed.chats) && (parsed.chats as unknown[]).length === 5, "arrays slim to 5 entries", String((parsed.chats as unknown[]).length));
  // Entries that DID survive carry their caps (any string value <= 300).
  check(
    Object.values(parsed).every((v) => typeof v !== "string" || v.length <= 300),
    "surviving string entries respect their caps",
  );
  // Overflow drops the LATER entries first, never the first one.
  check("chats" in parsed, "the first entry always survives overflow");
  check(parsed.num === 7 || !("num" in parsed), "numbers pass through or drop whole");
  check(!("empty" in parsed) && !("nil" in parsed), "empty/null entries dropped");
  check(slimScreenActivity(null) === "" && slimScreenActivity(undefined) === "" && slimScreenActivity({}) === "", "no activity -> empty string");
  // A single monstrous entry still yields valid JSON under the cap.
  const huge = slimScreenActivity({ wall: Array.from({ length: 5 }, () => ({ o: "q".repeat(200) })) } as never);
  check(huge.length <= 900 && (() => { try { JSON.parse(huge); return true; } catch { return false; } })(), "single oversized entry stays valid JSON under the cap", String(huge.length));
  // A small object passes through whole.
  check(slimScreenActivity({ view: "today", due: 3 } as never) === JSON.stringify({ view: "today", due: 3 }), "small activity is byte-exact");
}

console.log(`\ncontext-caps battery: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
