// Unit battery for the C-7 decline-over-time seam (lib/mistake-trend.ts).
// Honest-arithmetic pins: the trend describes CURRENT state (recurrence,
// quiet period, heal progress) and never invents a history curve.
// Run: bun scripts/test-mistake-trend.ts

import { mistakeTrend } from "../src/lib/mistake-trend";

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

const NOW = Date.parse("2026-11-03T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

// 1. healed: resolved wins over everything, heal bar full
{
  const t = mistakeTrend({ count: 5, lastSeen: daysAgo(1), streakClean: 2, resolvedAt: daysAgo(0) }, NOW);
  check(t.state === "healed" && t.healPct === 100, "resolved family reads healed at 100%", JSON.stringify(t));
  check(/retired/.test(t.note) && /two clean exam hits/.test(t.note), "healed note explains the retirement bar", t.note);
}

// 2. worsening: fresh recurrence on a recurring family
{
  const t = mistakeTrend({ count: 4, lastSeen: daysAgo(1), streakClean: 0, resolvedAt: null }, NOW);
  check(t.state === "worsening", "error yesterday + 4 sightings = worsening", t.state);
  check(t.daysQuiet === 1 && /4×/.test(t.note), "note carries count and quiet days", t.note);
  const today = mistakeTrend({ count: 3, lastSeen: daysAgo(0), streakClean: 0, resolvedAt: null }, NOW);
  check(/today/.test(today.note), "same-day recurrence says 'today', never '0d ago'", today.note);
}

// 3. active: recent but not fresh
{
  const t = mistakeTrend({ count: 2, lastSeen: daysAgo(4), streakClean: 0, resolvedAt: null }, NOW);
  check(t.state === "active" && t.daysQuiet === 4, "4 days quiet = active", JSON.stringify(t));
}

// 4. cooling: long quiet, partial heal progress shown honestly
{
  const t = mistakeTrend({ count: 3, lastSeen: daysAgo(20), streakClean: 1, resolvedAt: null }, NOW);
  check(t.state === "cooling", "20 days quiet = cooling", t.state);
  check(t.healPct === 50, "1/2 clean hits = 50% heal bar", String(t.healPct));
  check(/2 clean exam hits retire/.test(t.note), "cooling note names the retirement bar", t.note);
}

// 5. one sighting is never "worsening" (a single error is not a trend)
{
  const t = mistakeTrend({ count: 1, lastSeen: daysAgo(0), streakClean: 0, resolvedAt: null }, NOW);
  check(t.state === "active", "single fresh error stays 'active', no overclaim", t.state);
}

// 6. heal bar clamps: a stray 3rd clean hit cannot exceed 100
{
  const t = mistakeTrend({ count: 2, lastSeen: daysAgo(9), streakClean: 5, resolvedAt: null }, NOW);
  check(t.healPct === 100, "heal bar clamps at 100%", String(t.healPct));
}

// 7. determinism
{
  const a = mistakeTrend({ count: 2, lastSeen: daysAgo(4), streakClean: 0, resolvedAt: null }, NOW);
  const b = mistakeTrend({ count: 2, lastSeen: daysAgo(4), streakClean: 0, resolvedAt: null }, NOW);
  check(JSON.stringify(a) === JSON.stringify(b), "same input -> identical trend");
}

console.log(`\nmistake-trend battery: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
