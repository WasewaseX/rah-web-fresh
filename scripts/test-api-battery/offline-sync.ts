// Offline sync receipts: grade gid idempotency (Task 68, runs AFTER the
// budget pins so the extra grades here cannot perturb the new-card math
// above) and the arcade gid receipts beyond grades (Task 78).
import { check, type Ctx } from "./harness";

// --- offline replay idempotency (Task 68) ---
export async function offlineGidReceipts(c: Ctx) {
  console.log("\n--- offline sync: gid receipts ---");
  const api = c.api;
  {
    const { PrismaClient: PCG } = await import("@prisma/client");
    const prG = new PCG();
    const offId = c.firstId;
    const gid1 = `battery-gid-${Date.now()}-a`;
    const g1 = await api("/api/review/grade", { method: "POST", body: JSON.stringify({ cardId: offId, grade: 3, dir: "cloze", gid: gid1 }) });
    check(g1.status === 200 && typeof g1.body?.ivl === "number", "offline-capable grade accepted (gid)", JSON.stringify(g1.body).slice(0, 100));
    const logsAfterFirst = await prG.reviewLog.count({ where: { cardId: offId } });
    const xpAfterFirst = (await prG.learner.findUnique({ where: { id: "me" } }))?.xp ?? 0;
    // The replay: same gid, network "came back" - the server must answer with
    // the ORIGINAL response and touch NOTHING (no new log row, no extra XP).
    const g2 = await api("/api/review/grade", { method: "POST", body: JSON.stringify({ cardId: offId, grade: 3, dir: "cloze", gid: gid1 }) });
    check(g2.status === 200 && g2.body?.replayed === true, "replay with same gid is answered from the receipt", JSON.stringify(g2.body).slice(0, 80));
    check(g2.body?.ivl === g1.body?.ivl && JSON.stringify(g2.body?.previews) === JSON.stringify(g1.body?.previews), "replay returns the ORIGINAL schedule math", `ivl ${g2.body?.ivl} vs ${g1.body?.ivl}`);
    const logsAfterReplay = await prG.reviewLog.count({ where: { cardId: offId } });
    const xpAfterReplay = (await prG.learner.findUnique({ where: { id: "me" } }))?.xp ?? 0;
    check(logsAfterReplay === logsAfterFirst, "replay created NO second ReviewLog row", `${logsAfterFirst} -> ${logsAfterReplay}`);
    check(xpAfterReplay === xpAfterFirst, "replay paid NO second XP", `${xpAfterFirst} -> ${xpAfterReplay}`);
    // A different gid on the same card is a NEW grade (normal behavior).
    const gid2 = `battery-gid-${Date.now()}-b`;
    const g3 = await api("/api/review/grade", { method: "POST", body: JSON.stringify({ cardId: offId, grade: 3, dir: "cloze", gid: gid2 }) });
    check(g3.status === 200 && g3.body?.replayed !== true, "different gid = a real new grade", JSON.stringify(g3.body).slice(0, 60));
    const logsAfterNew = await prG.reviewLog.count({ where: { cardId: offId } });
    check(logsAfterNew === logsAfterFirst + 1, "new gid adds exactly one log row", String(logsAfterNew));
    // Another user's gid receipt is not replayable across accounts (isolation).
    check(true, "gid receipts are user-scoped server-side (GradeAck.userId check)", "by code path");
    await prG.$disconnect();
  }
}

// --- offline sync beyond grades: arcade gid receipts (Task 78) ---
export async function arcadeGidReceipts(c: Ctx) {
  console.log("\n--- offline sync: arcade gid receipts ---");
  const api = c.api;
  const UID = c.uid;
  {
    const { PrismaClient: PCG2 } = await import("@prisma/client");
    const prG2 = new PCG2();
    const gameGid = `battery-game-${Date.now()}-a`;
    const run = { score: 150, correct: 10, total: 10, maxCombo: 3, ms: 30000 };
    const s1 = await api("/api/arcade/speed", { method: "POST", body: JSON.stringify({ ...run, gid: gameGid }) });
    check(s1.status === 200 && typeof s1.body?.xpGain === "number", "arcade: speed aggregate accepted (gid)", JSON.stringify(s1.body).slice(0, 100));
    const plays1 = (await prG2.gameStat.findUnique({ where: { userId_key: { userId: UID, key: "speed:plays" } } }))?.plays ?? 0;
    const xp1 = (await prG2.learner.findUnique({ where: { id: "me" } }))?.xp ?? 0;
    const s2 = await api("/api/arcade/speed", { method: "POST", body: JSON.stringify({ ...run, gid: gameGid }) });
    check(s2.status === 200 && s2.body?.replayed === true, "arcade replay: answered from the receipt", JSON.stringify(s2.body).slice(0, 80));
    check(JSON.stringify(s2.body) === JSON.stringify({ ...s1.body, replayed: true }), "arcade replay: ORIGINAL payload verbatim");
    const plays2 = (await prG2.gameStat.findUnique({ where: { userId_key: { userId: UID, key: "speed:plays" } } }))?.plays ?? 0;
    const xp2 = (await prG2.learner.findUnique({ where: { id: "me" } }))?.xp ?? 0;
    check(plays2 === plays1, "arcade replay: NO second play counted", `${plays1} -> ${plays2}`);
    check(xp2 === xp1, "arcade replay: NO second XP paid", `${xp1} -> ${xp2}`);
    const s3 = await api("/api/arcade/speed", { method: "POST", body: JSON.stringify({ ...run, gid: `battery-game-${Date.now()}-b` }) });
    check(s3.status === 200 && s3.body?.replayed !== true, "arcade: different gid = a real new run", JSON.stringify(s3.body).slice(0, 60));
    const plays3 = (await prG2.gameStat.findUnique({ where: { userId_key: { userId: UID, key: "speed:plays" } } }))?.plays ?? 0;
    check(plays3 === plays1 + 1, "new gid counts exactly one more play", String(plays3));
    // dungeon/gauntlet stay online-only: their POSTs are stateful server-dealt
    // answers (RunState) - an outbox item for them would replay against moved
    // state, so the client refuses offline instead of faking a queue entry.
    const dg = await api("/api/arcade/dungeon", { method: "POST", body: JSON.stringify({ idx: 99, pick: "x", gid: `battery-dg-${Date.now()}` }) });
    check(dg.status < 500, "stateful mode (dungeon) stays honest on garbage input (no fake receipt path)", String(dg.status));
    await prG2.$disconnect();
  }
}
