import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dayIndex } from "@/lib/fsrs";
import { cardById, DECK } from "@/lib/content";
import { diagnose } from "@/lib/server";
import { getSkillLevels } from "@/lib/agent/levels";
import { contentUserId } from "@/lib/scope";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = dayIndex();
  const u = await contentUserId().catch(() => "me");
  // Task 89 perf: this route used to await eight queries in sequence (~140ms
  // in dev). None of them depends on another's result, so they go out as one
  // parallel batch. diagnose() keeps its own internals.
  // Task 106: the recovered ProgressView (next/progress.tsx) needs the
  // per-review direction accuracy, strand minutes and weekly checkpoint
  // scores too - those join the same batch (four more parallel reads).
  const [stats, states, diag, writes, speaks, totalReviews, totalLapses, skillLevels, learner, gradedExams, strandRows, checkpointRows, dirAllRows, dirOkRows, retrDays] = await Promise.all([
    db.dailyStat.findMany({ where: { userId: u, day: { gte: today - 34 } } }),
    db.cardState.findMany({ where: { userId: u } }),
    diagnose(),
    db.writingSub.findMany({ where: { userId: u }, orderBy: { id: "desc" }, take: 6 }),
    db.speakSession.findMany({ where: { userId: u }, orderBy: { id: "desc" }, take: 6 }),
    db.reviewLog.count({ where: { userId: u } }),
    db.reviewLog.count({ where: { userId: u, grade: 1 } }),
    getSkillLevels(),
    db.learner.findUnique({ where: { id: "me" } }),
    db.exam.findMany({ where: { status: "graded" }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.sessionLog.groupBy({ by: ["strand"], where: { learnerId: u, day: { gte: today - 6 } }, _sum: { minutes: true } }),
    db.checkpoint.findMany({ where: { learnerId: u }, orderBy: { day: "desc" }, take: 12 }),
    db.reviewLog.groupBy({ by: ["dir"], where: { userId: u, dir: { not: "" } }, _count: { _all: true } }),
    db.reviewLog.groupBy({ by: ["dir"], where: { userId: u, dir: { not: "" }, grade: { gte: 2 } }, _count: { _all: true } }),
    // Task 111 (data honesty): the fortnight chart and the week stats used to
    // read DailyStat.reviews - a counter that also carries legacy-era items
    // (days 20749-20751 hold 22 "reviews" with ZERO ReviewLog rows), so the
    // chart said "46 retrievals across the fortnight" while the all-time stat
    // next to it said 18. Both now read the SAME source the all-time stat
    // always used: ReviewLog. DailyStat stays the source for accuracy and
    // calendar activity (broader signal, its own documented convention).
    db.reviewLog.groupBy({ by: ["day"], where: { userId: u, day: { gte: today - 34 } }, _count: { _all: true } }),
  ]);
  const statMap = new Map(stats.map((s) => [s.day, s]));
  const days = Array.from({ length: 35 }, (_, i) => {
    const d = today - 34 + i;
    const s = statMap.get(d);
    return { day: d, reviews: s?.reviews ?? 0, correct: s?.correct ?? 0, xp: s?.xp ?? 0 };
  });

  const byUnit: Record<string, { total: number; started: number; mature: number }> = {};
  for (const c of DECK) {
    byUnit[c.unit] ??= { total: 0, started: 0, mature: 0 };
    byUnit[c.unit].total += 1;
  }
  for (const st of states) {
    const c = cardById(st.cardId);
    if (!c || st.state === "new") continue;
    byUnit[c.unit].started += 1;
    if (st.s >= 21) byUnit[c.unit].mature += 1;
  }

  // Task 89 (the review's P1-4 ask): the weekly pilot needs WRITING, SPEAKING
  // and DICTATION volume, not just first attempts - the DailyStat ledger
  // already counts them, so the rollup costs zero extra queries. last7 is the
  // week-N report row; last28 is the trend the multi-week study reads.
  const sumVol = (from: number, to: number) => {
    let reviews = 0,
      written = 0,
      spoken = 0,
      listened = 0;
    for (const s of stats)
      if (s.day >= from && s.day <= to) {
        reviews += s.reviews;
        written += s.written;
        spoken += s.spoken;
        listened += s.listened;
      }
    return { reviews, written, spoken, listened };
  };
  const volume = { last7: sumVol(today - 6, today), last28: sumVol(today - 27, today) };

  const writeTrend = writes
    .map((w) => {
      try {
        const r = JSON.parse(w.result) as { scores: Record<string, number> };
        const avg = Math.round(((r.scores.task + r.scores.organization + r.scores.range + r.scores.accuracy) / 4) * 10) / 10;
        return { at: w.at, avg };
      } catch {
        return null;
      }
    })
    .filter((x): x is { at: Date; avg: number } => !!x)
    .reverse();

  const speakTrend = speaks
    .map((s) => {
      try {
        const r = JSON.parse(s.result) as { scores: Record<string, number> };
        const avg = Math.round(((r.scores.fluency + r.scores.range + r.scores.accuracy + r.scores.delivery) / 4) * 10) / 10;
        return { at: s.at, avg };
      } catch {
        return null;
      }
    })
    .filter((x): x is { at: Date; avg: number } => !!x)
    .reverse();

  // P5: the CEFR band map's evidence, computed from real rows only - the
  // engine decides what is proven, nothing here asks the AI. A band is
  // PROVEN when a measured skill sits at that level or a recent graded exam
  // targeted it; otherwise the band is honestly unproven.
  // (learner + gradedExams arrive in the parallel batch above.)
  const examByBand: Record<string, { graded: number; passed: number; bestPct: number }> = {};
  for (const e of gradedExams) {
    try {
      const spec = JSON.parse(e.spec) as { level?: string };
      const result = JSON.parse(e.result ?? "{}") as { pct?: number };
      const band = String(spec.level ?? "?").toUpperCase();
      if (!band) continue;
      examByBand[band] ??= { graded: 0, passed: 0, bestPct: 0 };
      examByBand[band].graded += 1;
      if ((result.pct ?? 0) >= 60) examByBand[band].passed += 1;
      examByBand[band].bestPct = Math.max(examByBand[band].bestPct, result.pct ?? 0);
    } catch {
      // malformed spec: skip that exam's band evidence
    }
  }
  const BANDS = ["A1", "A2", "B1", "B2", "C1"] as const;
  const bands = BANDS.map((band) => {
    const skills = skillLevels.filter((s) => s.level === band).map((s) => ({ skill: s.skill, score: s.score, samples: s.samples }));
    const exams = examByBand[band] ?? { graded: 0, passed: 0, bestPct: 0 };
    return { band, skills, exams, proven: skills.length > 0 || exams.graded > 0 };
  });

  // Task 106: the recovered ProgressView contract. Everything here is measured
  // from rows that already arrived in the batch above - accuracy uses the same
  // grade>=2 convention the grade route writes into DailyStat.correct.
  const week = days.slice(-7);
  const prevWeek = days.slice(-14, -7);
  const retrMap = new Map(retrDays.map((r) => [r.day, r._count._all]));
  const retrCount = (d: number) => retrMap.get(d) ?? 0;
  const reviewsThisWeek = week.reduce((a, x) => a + retrCount(x.day), 0);
  const reviewsPrevWeek = prevWeek.reduce((a, x) => a + retrCount(x.day), 0);
  // Accuracy keeps its own documented convention: DailyStat.correct over
  // DailyStat.reviews (numerator and denominator from the SAME source - the
  // grade route writes both). Mixing that numerator with the ReviewLog count
  // could push the percentage over 100 on legacy-overcount days.
  const dsThisWeek = week.reduce((a, x) => a + x.reviews, 0);
  const dsPrevWeek = prevWeek.reduce((a, x) => a + x.reviews, 0);
  const accNow = dsThisWeek ? Math.round((week.reduce((a, x) => a + x.correct, 0) / dsThisWeek) * 100) : 0;
  const accPrev = dsPrevWeek ? Math.round((prevWeek.reduce((a, x) => a + x.correct, 0) / dsPrevWeek) * 100) : 0;
  const byDay = days.slice(-14).map((x) => ({ day: x.day, count: retrCount(x.day) }));
  const strands: Record<string, number> = {};
  for (const r of strandRows) strands[r.strand] = r._sum.minutes ?? 0;
  const startedCount = states.filter((s) => s.state !== "new").length;
  const matureCount = states.filter((s) => s.state !== "new" && s.s >= 21).length;
  const mastery = {
    new: states.length - startedCount,
    young: startedCount - matureCount,
    mature: matureCount,
    lapses: states.filter((s) => s.lapses > 0).length,
  };
  const calendar = days.map((x) => ({ day: x.day, active: x.reviews > 0 }));
  const dirTotal = new Map(dirAllRows.map((r) => [r.dir, r._count._all]));
  const dirs: Record<string, number> = {};
  for (const r of dirOkRows) {
    const t = dirTotal.get(r.dir) ?? 0;
    if (t > 0) dirs[r.dir] = Math.round((r._count._all / t) * 100);
  }
  const checkpoints = checkpointRows
    .map((c) => ({ day: c.day, listeningPct: c.listeningPct, readingScore: c.readingScore }))
    .reverse();

  return NextResponse.json({
    days,
    byUnit: Object.entries(byUnit).map(([unit, u]) => ({ unit, ...u })),
    bySkill: diag.bySkill,
    advice: diag.advice,
    writeTrend,
    speakTrend,
    skillLevels,
    bands,
    volume,
    placementBand: learner?.level ?? "?",
    totals: {
      reviews: totalReviews,
      lapses: totalLapses,
      cards: DECK.length,
      started: startedCount,
    },
    // Task 106: recovered ProgressView contract (additive - the fields above
    // keep serving the Payloads/outcome views untouched).
    accuracy: accNow,
    delta: accNow - accPrev,
    reviewsThisWeek,
    reviewsPrevWeek,
    byDay,
    strands,
    mastery,
    calendar,
    dirs,
    checkpoints,
    totalReviews,
    deckTotal: DECK.length,
  });
}
