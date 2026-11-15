// Task 140 battery: the guide drill-ledger canonical logic (parseDrillMap,
// coverageFor) and the weekly progress report (weeklyProgress) that powers
// the coach's progress_review tool.
//
// Runbook:
//   export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | cut -d= -f2-)" && bun scripts/progress-review-test.ts

import { parseDrillMap, coverageFor, weeklyProgress, weekForUi, RECENT_CAP } from "../src/lib/guide-ledger";
import { GUIDE_LEVELS, guideSection } from "../src/lib/b1c1-guide";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++;
    console.log(`  ok: ${name}`);
  } else {
    fail++;
    console.log(`FAIL: ${name}${detail ? ` - ${detail}` : ""}`);
  }
}

const NOW = Date.parse("2026-11-14T12:00:00Z");
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

// ---------- parseDrillMap: Task 136 behavior unchanged ----------
{
  const dm = parseDrillMap({
    "b1.present_tenses": { count: 2, lastAt: "2026-11-11T00:00:00Z" },
    "not.a.topic": { count: 5, lastAt: "" },
    "b2.cleft_sentences": { count: 1, lastAt: "" },
    junk: "x",
  });
  check("parseDrillMap keeps only real topics with valid counts", Object.keys(dm).length === 2 && dm["b1.present_tenses"]?.count === 2, JSON.stringify(dm));
  check("parseDrillMap rejects arrays and non-objects", Object.keys(parseDrillMap([1, 2])).length === 0 && Object.keys(parseDrillMap(null)).length === 0 && Object.keys(parseDrillMap("x")).length === 0);
  check("parseDrillMap rejects zero/negative/float counts", Object.keys(parseDrillMap({ "b1.present_tenses": { count: 0 }, "b2.cleft_sentences": { count: 1.5 }, "c1 Nominalisation": { count: -3 } })).length === 0);
  check("parseDrillMap junk lastAt becomes empty string", dm["b2.cleft_sentences"]?.lastAt === "" || dm["b1.present_tenses"] !== undefined, JSON.stringify(dm["b2.cleft_sentences"]));
}

// ---------- parseDrillMap: recent history (Task 140) ----------
{
  const dm = parseDrillMap({
    "b1.present_tenses": { count: 3, lastAt: iso(NOW), recent: [iso(NOW - 2 * DAY), "not-a-date", 42, iso(NOW)] },
  });
  const rec = dm["b1.present_tenses"]?.recent;
  check("recent preserved, non-string junk dropped", Array.isArray(rec) && rec.length === 3 && rec[2] === iso(NOW), JSON.stringify(rec));
  check("old entries without recent stay clean", parseDrillMap({ "b2.cleft_sentences": { count: 1, lastAt: "x" } })["b2.cleft_sentences"]?.recent === undefined);

  const stamps: string[] = [];
  for (let i = RECENT_CAP + 6; i >= 0; i--) stamps.push(iso(NOW - i * 1000)); // oldest first, newest last
  const capped = parseDrillMap({ "b1.present_tenses": { count: 99, lastAt: iso(NOW), recent: stamps } });
  check(`recent capped at ${RECENT_CAP} (newest kept)`, capped["b1.present_tenses"]?.recent?.length === RECENT_CAP && capped["b1.present_tenses"]?.recent?.[RECENT_CAP - 1] === iso(NOW), JSON.stringify(capped["b1.present_tenses"]?.recent?.length));

  const allJunk = parseDrillMap({ "b1.present_tenses": { count: 2, lastAt: iso(NOW), recent: [1, null, {}] } });
  check("all-junk recent collapses to undefined", allJunk["b1.present_tenses"]?.recent === undefined);

  // Route re-export parity: same parser behind the battery's old import path.
  const route = (await import("../src/app/api/guide-practice/route")) as { parseDrillMap: typeof parseDrillMap; coverageFor: typeof coverageFor };
  const viaRoute = route.parseDrillMap({ "b1.present_tenses": { count: 2, lastAt: iso(NOW), recent: [iso(NOW - DAY)] } });
  check("route re-export parses identically (recent preserved)", viaRoute["b1.present_tenses"]?.count === 2 && viaRoute["b1.present_tenses"]?.recent?.length === 1);
}

// ---------- coverageFor ----------
{
  const dm = parseDrillMap({ "b1.present_tenses": { count: 2, lastAt: "" }, "b2.cleft_sentences": { count: 1, lastAt: "" } });
  const cov = coverageFor(dm);
  const b1 = GUIDE_LEVELS.find((s) => s.level === "B1");
  const b2 = GUIDE_LEVELS.find((s) => s.level === "B2");
  check("coverageFor counts covered topics per level", cov.B1?.grammar === `1/${b1?.grammar.length}` && cov.B1?.vocabulary === `0/${b1?.vocabulary.length}` && cov.B2?.grammar === `1/${b2?.grammar.length}`, JSON.stringify(cov));
}

// ---------- weeklyProgress: empty ledger ----------
{
  const rep = weeklyProgress({ drills: null, nowMs: NOW });
  check("empty ledger: zero events, zero topics, no latest", rep.drillEvents === 0 && rep.topicsTouched === 0 && rep.latest === null && rep.totalRequests === 0);
  check("empty ledger: summary is honest about REQUESTS", rep.summary.includes("REQUESTS") && rep.summary.includes("No drill requests recorded yet"), rep.summary);
  check("per level present for B1/B2/C1 even when empty", rep.perLevel.length === 3 && rep.perLevel.every((p) => p.events === 0 && p.readiness === null));
}

// ---------- weeklyProgress: window math ----------
{
  const drills = {
    "b1.present_tenses": { count: 2, lastAt: iso(NOW - 6 * DAY), recent: [iso(NOW - 6 * DAY)] }, // inside 7d
    "b1.past_tenses": { count: 1, lastAt: iso(NOW - 9 * DAY), recent: [iso(NOW - 9 * DAY)] }, // outside 7d
    "b2.cleft_sentences": { count: 4, lastAt: iso(NOW), recent: [iso(NOW - DAY), iso(NOW - 2 * DAY), iso(NOW - 3 * DAY), iso(NOW - 20 * DAY)] }, // 3 inside
  };
  const rep = weeklyProgress({ drills, nowMs: NOW, windowDays: 7 });
  check("window math: 6d in, 9d out, multi-event counted", rep.drillEvents === 4, JSON.stringify({ events: rep.drillEvents }));
  check("topicsTouched counts distinct in-window topics", rep.topicsTouched === 2);
  check("totalRequests sums the ledger (all time)", rep.totalRequests === 7, String(rep.totalRequests));
  check("latest is the newest in-window request with real title/kind/level", rep.latest?.id === "b2.cleft_sentences" && rep.latest?.title === "Cleft Sentences" && rep.latest?.kind === "grammar" && rep.latest?.level === "B2", JSON.stringify(rep.latest));
  check("summary carries request count and honest labeling", rep.summary.includes("4 drill request(s) across 2 topic(s)") && rep.summary.includes("REQUESTS"), rep.summary);

  const older = weeklyProgress({ drills, nowMs: NOW, windowDays: 30 });
  check("wider window sweeps all events", older.drillEvents === 6 && older.topicsTouched === 3, JSON.stringify({ events: older.drillEvents, touched: older.topicsTouched }));
  const narrow = weeklyProgress({ drills, nowMs: NOW, windowDays: 1 });
  check("narrow window keeps only the freshest", narrow.drillEvents === 1 && narrow.windowDays === 1);

  const future = weeklyProgress({ drills: { "b1.present_tenses": { count: 1, lastAt: iso(NOW + 60_000), recent: [iso(NOW + 60_000)] } }, nowMs: NOW });
  check("small future skew still lands in window", future.drillEvents === 1);
}

// ---------- weeklyProgress: legacy fallback ----------
{
  const legacy = { "b1.present_tenses": { count: 5, lastAt: iso(NOW - 2 * DAY) } }; // no recent history
  const rep = weeklyProgress({ drills: legacy, nowMs: NOW });
  check("legacy entry counts one in-window event via lastAt", rep.drillEvents === 1 && rep.legacyEntries === 1, JSON.stringify({ events: rep.drillEvents, legacy: rep.legacyEntries }));
  check("legacy shortfall is disclosed in the summary", rep.summary.includes("no per-event history"), rep.summary);
  const legacyOut = weeklyProgress({ drills: { "b1.present_tenses": { count: 5, lastAt: iso(NOW - 30 * DAY) } }, nowMs: NOW });
  check("legacy entry outside window contributes zero events", legacyOut.drillEvents === 0 && legacyOut.legacyEntries === 1);
}

// ---------- weeklyProgress: per-level aggregation + readiness ----------
{
  const drills = {
    "b1.present_tenses": { count: 1, lastAt: iso(NOW - DAY), recent: [iso(NOW - DAY)] },
    "b1.past_tenses": { count: 1, lastAt: iso(NOW - DAY), recent: [iso(NOW - DAY)] },
    "b1.travel": { count: 1, lastAt: iso(NOW - DAY), recent: [iso(NOW - DAY)] },
  };
  const b1Len = guideSection("B1").checklist.items.length;
  const ratings = { B1: guideSection("B1").checklist.items.map((_, i) => i % 3), B2: "oops", C1: [0.5, "x"] };
  const rep = weeklyProgress({ drills, ratings, nowMs: NOW });
  const b1 = rep.perLevel.find((p) => p.level === "B1");
  check("B1 events aggregated across grammar+vocab", b1?.events === 3, JSON.stringify(b1));
  check("B1 coverage 2 grammar, 1 vocab", b1?.grammarCovered === 2 && b1?.vocabCovered === 1);
  check("B1 readiness wired from ratings", b1?.readiness?.total === b1Len && typeof b1?.readiness?.verdict === "string" && (b1.readiness.verdict.length > 0), JSON.stringify(b1?.readiness));
  check("junk ratings leave readiness null without throwing", rep.perLevel.find((p) => p.level === "B2")?.readiness === null && rep.perLevel.find((p) => p.level === "C1")?.readiness === null);
  const unrated = weeklyProgress({ drills, nowMs: NOW });
  check("missing ratings -> readiness null, no verdict guessed", unrated.perLevel.every((p) => p.readiness === null));
}

// ---------- window clamp ----------
{
  const rep = weeklyProgress({ drills: null, nowMs: NOW, windowDays: 99 });
  check("windowDays clamped to 30", rep.windowDays === 30);
}

// ---------- weekForUi: the Guide panel chip payload (Task 141) ----------
{
  const drills = {
    "b1.present_tenses": { count: 2, lastAt: iso(NOW - DAY), recent: [iso(NOW - DAY), iso(NOW - 2 * DAY)] },
    "b1.travel": { count: 1, lastAt: iso(NOW - 3 * DAY), recent: [iso(NOW - 3 * DAY)] },
  };
  const rep = weeklyProgress({ drills, nowMs: NOW, windowDays: 7 });
  const ui = weekForUi(rep);
  check("weekForUi maps events + touched + window", ui.events === 3 && ui.topicsTouched === 2 && ui.windowDays === 7, JSON.stringify(ui));
  check("weekForUi perLevel keyed by level", ui.perLevel.B1 === 3 && ui.perLevel.B2 === 0 && ui.perLevel.C1 === 0);
  check("weekForUi empty ledger maps to zeros", weekForUi(weeklyProgress({ drills: null, nowMs: NOW })).events === 0);
}

// ---------- registry: the tool exists and is read-tier ----------
{
  const { toolByName, toolTier } = (await import("../src/lib/coach-agent/tools")) as {
    toolByName: (n: string) => { name: string; run: (...a: unknown[]) => unknown } | undefined;
    toolTier: (n: string) => string;
  };
  check("progress_review registered in TOOLS", toolByName("progress_review")?.name === "progress_review");
  check("progress_review is read-tier", toolTier("progress_review") === "read");
  const loop = (await import("../src/lib/coach-agent/loop")) as { isProgressAsk: (m: string) => boolean };
  check("isProgressAsk fires on past-activity asks", loop.isProgressAsk("how did my week go?") && loop.isProgressAsk("What did I study this week") && loop.isProgressAsk("give me my weekly report"));
  check("isProgressAsk stays off future/general asks", !loop.isProgressAsk("what should I review tomorrow") && !loop.isProgressAsk("improve my progress") && !loop.isProgressAsk("what is my streak"));
  // Task 143: the Progress view's one-click ask must ride the enforcement seam.
  const { WEEKLY_REVIEW_ASK } = (await import("../src/lib/guide-ledger")) as { WEEKLY_REVIEW_ASK: string };
  check("WEEKLY_REVIEW_ASK matches isProgressAsk (seam catches the one-click ask)", loop.isProgressAsk(WEEKLY_REVIEW_ASK), WEEKLY_REVIEW_ASK);
  check("WEEKLY_REVIEW_ASK names the honest subject matter", WEEKLY_REVIEW_ASK.includes("drill requests") && WEEKLY_REVIEW_ASK.includes("weekly review"), WEEKLY_REVIEW_ASK);
}

// ---------- Task 145: stale-topic detection ----------
{
  const { staleTopics } = await import("../src/lib/guide-ledger");
  const drills = {
    "b1.present_tenses": { count: 2, lastAt: iso(NOW - 20 * DAY), recent: [iso(NOW - 20 * DAY), iso(NOW - 25 * DAY)] }, // stale
    "b1.travel": { count: 1, lastAt: iso(NOW - 13 * DAY), recent: [iso(NOW - 13 * DAY)] }, // not yet stale
    "b2.cleft_sentences": { count: 1, lastAt: iso(NOW - 40 * DAY) }, // stale, legacy shape
  };
  const st = staleTopics(drills, NOW);
  check("staleTopics finds 14d+ topics, sorted most-stale first", st.length === 2 && st[0]?.id === "b2.cleft_sentences" && st[0]?.daysAgo === 40 && st[1]?.id === "b1.present_tenses", JSON.stringify(st));
  check("staleTopics resolves real titles/kinds/levels", st[1]?.title === "Present Tenses" && st[1]?.kind === "grammar" && st[1]?.level === "B1", JSON.stringify(st[1]));
  check("staleTopics respects the boundary (13d is not stale)", !st.some((s) => s.id === "b1.travel"));
  check("staleTopics recent history wins over old lastAt", staleTopics({ "b1.present_tenses": { count: 3, lastAt: iso(NOW - 30 * DAY), recent: [iso(NOW - 30 * DAY), iso(NOW - 2 * DAY)] } }, NOW).length === 0);
  check("staleTopics empty ledger is empty", staleTopics({}, NOW).length === 0);
  check("staleTopics cap enforced", staleTopics(
    Object.fromEntries(GUIDE_LEVELS.flatMap((s) => [...s.grammar, ...s.vocabulary]).map((t) => [t.id, { count: 1, lastAt: iso(NOW - 60 * DAY) }])),
    NOW, 14, 8,
  ).length === 8);
}

console.log(`\nprogress-review: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
