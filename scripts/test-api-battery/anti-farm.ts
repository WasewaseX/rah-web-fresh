// ANTI-FARMING: daily game-XP caps (Task 72), pinned as invariants computed
// from the pre-state rather than absolute numbers.
import { check, type Ctx } from "./harness";

// ================= 6i. ANTI-FARMING: daily game-XP caps (Task 72) =================
export async function antiFarm(c: Ctx) {
  console.log("\n--- anti-farming: game XP caps ---");
  const api = c.api;
  const UID = c.uid;
  {
    // The boss base is 120 + hearts*20 = 180 on a flawless win; the mode cap
    // is 120/day. Earlier battery sections may already have spent part of the
    // budget, so the pins are INVARIANTS computed from the pre-state rather
    // than absolute numbers: full-pays-until-cap, then the 25% floor, and the
    // ledger accumulates exactly what was paid.
    const { PrismaClient: PCX } = await import("@prisma/client");
    const prX = new PCX();
    const dayX = Math.floor(Date.now() / 86400000);
    const pre = (await prX.gameStat.findUnique({ where: { userId_key: { userId: UID, key: `xpdaily:boss:${dayX}` } } }))?.best ?? 0;
    const w1 = await api("/api/arcade/boss", { method: "POST", body: JSON.stringify({ won: true, phaseReached: 3, heartsLeft: 3, total: 24, correct: 24 }) });
    const w2 = await api("/api/arcade/boss", { method: "POST", body: JSON.stringify({ won: true, phaseReached: 3, heartsLeft: 3, total: 24, correct: 24 }) });
    const w3 = await api("/api/arcade/boss", { method: "POST", body: JSON.stringify({ won: true, phaseReached: 3, heartsLeft: 3, total: 24, correct: 24 }) });
    const expW1 = pre >= 120 ? 45 : Math.min(180, 120 - pre);
    check(w1.body?.xpGain === expW1, "anti-farm: first win pays exactly the remaining budget (full until the cap)", `pre=${pre} paid=${w1.body?.xpGain} want=${expW1}`);
    const earned1 = pre + expW1;
    const expW2 = earned1 >= 120 ? 45 : Math.min(180, 120 - earned1);
    check(w2.body?.xpGain === expW2 && w2.body?.capped === (expW2 < 180), "anti-farm: the cap transitions to the 25% floor exactly when the budget runs out", `paid=${w2.body?.xpGain} want=${expW2}`);
    check(w3.body?.xpGain === 45 || w3.body?.xpGain === expW2, "anti-farm: the engagement floor never exceeds 25% of the base", `paid=${w3.body?.xpGain}`);
    const after = (await prX.gameStat.findUnique({ where: { userId_key: { userId: UID, key: `xpdaily:boss:${dayX}` } } }))?.best ?? 0;
    check(after === pre + w1.body?.xpGain + w2.body?.xpGain + w3.body?.xpGain, "anti-farm: the daily ledger accumulates exactly what was paid", `after=${after}`);
    await prX.$disconnect();
  }
}
