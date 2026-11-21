// REVIEW QUEUE: one source of truth, ahead mode, skill interleave.
import { check, type Ctx } from "./harness";

// ================= 6g. REVIEW QUEUE: one source of truth, ahead mode, skill mix =================
// The badge lied: /api/state counted the new budget WITHOUT subtracting
// today's introductions while the queue subtracted them, so Home advertised
// "Review 10 due" over an empty batch (the exact complaint that spawned
// this section). These pins hold badge == queue promise, the forecast
// fields, the ahead (extra practice) contract, and the skill interleave.
export async function reviewQueue(c: Ctx) {
  console.log("\n--- review queue: counts consistency, ahead mode, skill interleave ---");
  const api = c.api;
  const { PrismaClient: PCg } = await import("@prisma/client");
  const prismaG = new PCg();
  await prismaG.cardState.deleteMany();
  await prismaG.reviewLog.deleteMany();
  const qFresh = await api("/api/review/queue");
  check(qFresh.status === 200 && qFresh.body?.mode === "normal", "fresh queue is normal mode", JSON.stringify(qFresh.body?.counts));
  const fc = qFresh.body?.counts ?? {};
  check(
    typeof fc.newPerDay === "number" && typeof fc.seen === "number" && typeof fc.unseen === "number" && fc.nextDue === null && fc.dueTomorrow === 0,
    "counts carry the forecast fields (nextDue/dueTomorrow/seen/unseen/newPerDay)",
    JSON.stringify(fc),
  );
  const mix: Record<string, number> = {};
  for (const e of qFresh.body?.batch ?? []) mix[e.card.skill] = (mix[e.card.skill] ?? 0) + 1;
  const b = fc.newPerDay ?? 10;
  const expected: Record<string, number> = { vocabulary: 0, collocation: 0, grammar: 0 };
  const cycle = ["vocabulary", "collocation", "vocabulary", "grammar"];
  for (let k = 0; k < b; k++) expected[cycle[k % 4]] += 1;
  check(
    Object.keys(mix).length >= 2 && Object.entries(expected).every(([s, cnt]) => (mix[s] ?? 0) === cnt),
    "new-card intros mix skills 2 vocab : 1 colloc : 1 grammar (was file-order collocation-only)",
    JSON.stringify({ mix, expected }),
  );
  const stateBadge = await api("/api/state");
  check(
    stateBadge.body?.due === fc.due + fc.newLeft,
    "badge due == queue promise (the dead-end lie is dead)",
    `state=${stateBadge.body?.due} counts=${JSON.stringify(fc)}`,
  );
  const firstId = qFresh.body.batch[0].card.id;
  c.firstId = firstId;
  await api("/api/review/grade", { method: "POST", body: JSON.stringify({ cardId: firstId, grade: 3, dir: "cloze" }) });

  const qAfter = await api("/api/review/queue");
  check(
    qAfter.body?.counts?.newLeft === b - 1 && qAfter.body?.counts?.reviewedToday === 1,
    "budget subtracts today's introductions",
    JSON.stringify(qAfter.body?.counts),
  );
  const aheadRes = await api("/api/review/queue?ahead=1");
  check(aheadRes.status === 200 && aheadRes.body?.mode === "ahead", "ahead mode responds", JSON.stringify(aheadRes.body?.counts).slice(0, 100));
  const aheadBatch = aheadRes.body?.batch ?? [];
  const todayG = Math.floor(Date.now() / 86400000);
  check(
    aheadBatch.length > 0 && aheadBatch.every((e: { ahead: boolean }) => e.ahead === true),
    "ahead entries are tagged for the Extra practice chip",
    JSON.stringify(aheadBatch.slice(0, 1)),
  );
  check(
    aheadBatch.every((e: { state: { due: number; state: string } }) => e.state.due > todayG && e.state.state !== "new"),
    "ahead serves only scheduled future cards, never new ones",
    JSON.stringify(aheadBatch.slice(0, 2).map((e: { state: { due: number } }) => e.state.due)),
  );
  await prismaG.$disconnect();
  console.log("queue seeds removed (full restore happens in section 7)");
}
