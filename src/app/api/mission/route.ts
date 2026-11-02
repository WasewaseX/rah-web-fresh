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
  return NextResponse.json(state);
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
