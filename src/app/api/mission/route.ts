import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bumpDaily, getLearner, touchStreak } from "@/lib/server";
import { contentUserId } from "@/lib/scope";

export const dynamic = "force-dynamic";

// The Daily English Mission (roadmap §9, the holder assessment's #1
// recommendation): one connected four-step mission per day, built from the
// learner's REAL state - the FSRS due queue and today's actual activity.
// Two hard rules, straight from the assessment and the evidence-hygiene rule:
//   1. XP is awarded only when the learning action is measured as done.
//   2. The reward lands once per day. The claim is atomic: the Setting row's
//      primary key doubles as the claim ledger, so a double-submit cannot
//      double-pay (the create fails and the whole transaction rolls back).
//
// Scoping seam (Task 63 doctrine) - the two keys are NOT the same:
//   - cardState/listeningLog rows are learnerId-keyed (getLearner().id = "me";
//     /api/bootstrap and /api/track write/read them this way).
//   - reviewLog/speakSession/writingSub/mistakeFamily rows are userId-keyed
//     with the authenticated session user (contentUserId()); querying them
//     with "me" silently reads an empty table - that exact bug shipped in the
//     first mission build and made the due queue read as "clear" (fixed 118).
const REWARD = 50;
const REVIEW_TARGET = 8;

type MissionStep = { id: string; label: string; progress: string; done: boolean; view: string };

async function missionState(u: string, me: string) {
  const day = Math.floor(Date.now() / 86400000);
  const dayStart = new Date(day * 86400000); // UTC midnight of the epoch-day

  // One parallel batch - the same perf doctrine as /api/progress (Task 89).
  const [learner, states, reviewsDone, listened, spoken, written, claim, topMistake] = await Promise.all([
    getLearner(),
    db.cardState.findMany({ where: { learnerId: me }, select: { due: true, state: true, suspended: true } }),
    db.reviewLog.count({ where: { userId: u, day, source: "review" } }),
    db.listeningLog.count({ where: { learnerId: me, createdAt: { gte: dayStart } } }),
    db.speakSession.count({ where: { userId: u, at: { gte: dayStart } } }),
    db.writingSub.count({ where: { userId: u, at: { gte: dayStart } } }),
    db.setting.findUnique({ where: { key: `mission:${day}` } }),
    db.mistakeFamily.findFirst({
      where: { userId: u, resolvedAt: null },
      orderBy: [{ count: "desc" }, { lastSeen: "desc" }],
      select: { label: true },
    }),
  ]);

  // Due count uses the exact canonical filter from lib/server.ts:81 /
  // /api/bootstrap (toFsrs is identity on due+state) so the mission, the
  // sidebar badge and the review surface can never disagree about "due".
  const due = states.filter((s) => !s.suspended && s.state !== "new" && s.due <= day).length;
  const target = due === 0 ? 0 : Math.min(due, REVIEW_TARGET);

  const steps: MissionStep[] = [
    {
      id: "reviews",
      view: "review",
      label: due === 0 ? "Review queue is clear - nothing due today" : `Clear ${target} due expression${target === 1 ? "" : "s"} in the review loop`,
      progress: due === 0 ? "queue clear" : `${Math.min(reviewsDone, target)}/${target} graded`,
      done: due === 0 || reviewsDone >= target,
    },
    {
      id: "listening",
      view: "listening",
      label: "One listening round - train the ear before the eye",
      progress: `${Math.min(listened, 1)}/1 round`,
      done: listened >= 1,
    },
    {
      id: "speaking",
      view: "speaking",
      label: topMistake?.label
        ? `One speaking attempt - aim it at "${topMistake.label}"`
        : "One speaking attempt - two minutes of deliberate production",
      progress: `${Math.min(spoken, 1)}/1 attempt`,
      done: spoken >= 1,
    },
    {
      id: "writing",
      view: "writing",
      label: "One short writing - put today's expressions to work",
      progress: `${Math.min(written, 1)}/1 submission`,
      done: written >= 1,
    },
  ];

  return {
    day,
    due,
    xp: learner?.xp ?? 0,
    steps,
    allDone: steps.every((s) => s.done),
    claimed: !!claim,
    reward: REWARD,
  };
}

export async function GET() {
  const [u, me] = await Promise.all([contentUserId(), getLearner()]);
  const state = await missionState(u, me.id);
  const [recap, restart] = await Promise.all([weeklyRecap(u), restartPlan(u, me)]);
  return NextResponse.json({ ...state, recap, restart });
}

// ---------- §9 open items: weekly recap + missed-day restart ----------

// Weekly recap: what MEASURABLY improved — this week vs the previous one,
// from the same tables and the same conventions the Progress dashboard uses
// (DailyStat for reviews/correct/xp per its documented accuracy convention;
// per-strand activity from the content tables). Zero AI, zero pep talk: a
// line renders only when BOTH windows have data to compare.
export async function weeklyRecap(u: string) {
  const day = Math.floor(Date.now() / 86400000);
  const weekStart = day - 6;
  const prevStart = day - 13;

  const [ds, listenNow, listenPrev, speakNow, speakPrev, writeNow, writePrev] = await Promise.all([
    db.dailyStat.findMany({ where: { userId: u, day: { gte: prevStart, lte: day } } }),
    db.listeningLog.count({ where: { learnerId: "me", createdAt: { gte: new Date(weekStart * 86400000) } } }),
    db.listeningLog.count({ where: { learnerId: "me", createdAt: { gte: new Date(prevStart * 86400000), lt: new Date(weekStart * 86400000) } } }),
    db.speakSession.count({ where: { userId: u, at: { gte: new Date(weekStart * 86400000) } } }),
    db.speakSession.count({ where: { userId: u, at: { gte: new Date(prevStart * 86400000), lt: new Date(weekStart * 86400000) } } }),
    db.writingSub.count({ where: { userId: u, at: { gte: new Date(weekStart * 86400000) } } }),
    db.writingSub.count({ where: { userId: u, at: { gte: new Date(prevStart * 86400000), lt: new Date(weekStart * 86400000) } } }),
  ]);

  const sum = (rows: typeof ds, k: "reviews" | "correct" | "xp") => rows.reduce((a, x) => a + x[k], 0);
  const thisWeek = ds.filter((x) => x.day >= weekStart);
  const prevWeek = ds.filter((x) => x.day < weekStart);
  const pct = (rows: typeof ds) => {
    const r = sum(rows, "reviews");
    return r > 0 ? Math.round((sum(rows, "correct") / r) * 100) : null;
  };

  const items: { id: string; label: string; now: number; prev: number; delta: number; unit: string }[] = [];
  const push = (id: string, label: string, now: number, prev: number, unit = "") => {
    if (now === 0 && prev === 0) return; // no data both sides -> no line, no invention
    items.push({ id, label, now, prev, delta: now - prev, unit });
  };
  push("reviews", "Reviews graded", sum(thisWeek, "reviews"), sum(prevWeek, "reviews"));
  const accNow = pct(thisWeek);
  const accPrev = pct(prevWeek);
  if (accNow !== null && accPrev !== null) push("accuracy", "First-try accuracy", accNow, accPrev, "%");
  push("xp", "XP earned", sum(thisWeek, "xp"), sum(prevWeek, "xp"));
  push("listening", "Listening rounds", listenNow, listenPrev);
  push("speaking", "Speaking sessions", speakNow, speakPrev);
  push("writing", "Writing submissions", writeNow, writePrev);

  return { weekStart, items };
}

// Missed day -> supportive restart plan (no guilt, no fake streak). Fires
// when the last measured activity day is before YESTERDAY (yesterday empty
// AND the day before it too - one rest day is a rest day, not a lapse) and
// there is anything to come back to. The plan reuses the real mission steps
// at a reduced review target; nothing is claimed to be "recovered".
export async function restartPlan(u: string, me: { lastActiveDay: number; streak: number }) {
  const day = Math.floor(Date.now() / 86400000);
  const yesterday = day - 1;
  const beforeYesterday = day - 2;

  if (me.lastActiveDay >= yesterday) return { show: false };

  const [dsY, dsB, dueCount] = await Promise.all([
    db.dailyStat.findUnique({ where: { userId_day: { userId: u, day: yesterday } } }),
    db.dailyStat.findUnique({ where: { userId_day: { userId: u, day: beforeYesterday } } }),
    db.cardState.count({ where: { learnerId: "me", suspended: false, state: { not: "new" }, due: { lte: day } } }),
  ]);

  const quietDays = (dsY?.reviews ?? 0) + (dsY?.xp ?? 0) === 0 && (dsB?.reviews ?? 0) + (dsB?.xp ?? 0) === 0;
  const awayDays = day - Math.max(me.lastActiveDay, 0);
  if (!quietDays || awayDays < 2) return { show: false };

  return {
    show: true,
    awayDays,
    due: dueCount,
    message:
      awayDays <= 3
        ? "A few quiet days is what the schedule absorbs, not a failure. The queue held your place."
        : `You were away ${awayDays} days - the interval math already expected that. Nothing was lost; the queue just waited.`,
    steps: [
      `Start with ${Math.min(4, Math.max(dueCount, 0)) || 4} reviews - short, not heroic`,
      "One listening round to warm the ear back up",
      "Claim today's mission when the short list is done - it counts the same",
    ],
  };
}

export async function POST() {
  const [u, me] = await Promise.all([contentUserId(), getLearner()]);
  const state = await missionState(u, me.id);

  if (!state.allDone) {
    // Honest refusal: no reward without measured completion.
    return NextResponse.json({ error: "mission not complete", steps: state.steps }, { status: 400 });
  }

  const value = JSON.stringify({ claimedAt: new Date().toISOString(), xp: REWARD });
  try {
    // Atomic claim: mission:<day>'s primary key is the ledger. If it already
    // exists the create throws, the transaction rolls back, and no XP moves.
    await db.$transaction([
      db.setting.create({ data: { key: `mission:${state.day}`, value } }),
      db.learner.update({ where: { id: me.id }, data: { xp: { increment: REWARD } } }),
    ]);
  } catch {
    return NextResponse.json({ ok: true, already: true, reward: 0, xp: state.xp });
  }

  await bumpDaily("xp", REWARD, u);
  await touchStreak(me.id);

  return NextResponse.json({ ok: true, already: false, reward: REWARD, xp: state.xp + REWARD });
}
