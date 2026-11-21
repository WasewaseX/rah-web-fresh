// ---------- Achievements ----------
// The trophy cabinet: one deterministic context build over the user's rows,
// a pure unlock predicate, and an idempotent createMany that is safe under
// concurrent graders.

import { db } from "@/lib/db";
import { dayIndex } from "@/lib/fsrs";
import { topMistakes } from "@/lib/mistakes";
import { levelFromXp } from "./levels";
import { uid } from "./user";

export interface AchievementDef {
  key: string;
  title: string;
  desc: string;
  icon: string; // lucide name rendered client-side
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: "first_words", title: "First Words", desc: "Grade your very first review.", icon: "Sparkles" },
  { key: "century", title: "Century", desc: "100 lifetime reviews.", icon: "Hash" },
  { key: "millennium", title: "Millennium", desc: "1000 lifetime reviews.", icon: "Hash" },
  { key: "week_warrior", title: "Week Warrior", desc: "Hold a 7-day streak.", icon: "Flame" },
  { key: "month_monk", title: "Month Monk", desc: "Hold a 30-day streak.", icon: "Flame" },
  { key: "speed_demon", title: "Speed Demon", desc: "Score 300+ in a Speed Round.", icon: "Zap" },
  { key: "combo_10", title: "Tenfold", desc: "Hit a 10x combo in a Speed Round.", icon: "Zap" },
  { key: "boss_slayer", title: "Boss Slayer", desc: "Defeat The Examiner.", icon: "Swords" },
  { key: "boss_flawless", title: "Untouchable", desc: "Defeat The Examiner without losing a heart.", icon: "ShieldCheck" },
  { key: "quest_master", title: "Quest Master", desc: "Clear all three quests in one day.", icon: "Target" },
  { key: "essayist", title: "Essayist", desc: "Five graded essays.", icon: "PenLine" },
  { key: "orator", title: "Orator", desc: "Five diagnosed monologues.", icon: "Mic" },
  { key: "healer", title: "Healer", desc: "Heal your first mistake family.", icon: "HeartPulse" },
  { key: "healer_5", title: "Wound Closer", desc: "Heal five mistake families.", icon: "HeartPulse" },
  { key: "rival_slayer", title: "Rival Slayer", desc: "Out-gain your rival for a full week.", icon: "Trophy" },
  { key: "level_10", title: "Double Digits", desc: "Reach level 10.", icon: "Star" },
  { key: "level_20", title: "Gladiator", desc: "Reach level 20.", icon: "Star" },
  { key: "chain_25", title: "Blaze", desc: "Hold a 25-answer momentum chain.", icon: "Flame" },
  { key: "league_gold", title: "Promoted", desc: "Win promotion in a League season.", icon: "Medal" },
  { key: "dungeon_perfect", title: "Dungeon Master", desc: "Clear the Daily Dungeon without losing a heart.", icon: "Castle" },
  { key: "duel_win", title: "Duelist", desc: "Beat your rival in a Duel.", icon: "Swords" },
  { key: "gauntlet_25", title: "Deathless", desc: "Survive 25 Gauntlet items in one run.", icon: "Skull" },
  { key: "flow_5", title: "In the Zone", desc: "Finish Focus Flows 5 days in a row.", icon: "Timer" },
  { key: "anthology", title: "Anthology", desc: "Bank three graded essays in the Portfolio.", icon: "Library" },
];

interface AchCtx {
  reviews: number;
  streak: number;
  writes: number;
  speaks: number;
  healed: number;
  level: number;
  speedBest: number;
  speedCombo: number;
  bossWins: number;
  bossFlawless: number;
  questsDoneToday: number;
  rivalWins: number;
  chainBest: number;
  leaguePromotions: number;
  dungeonBest: number;
  dungeonPerfect: number;
  duelWins: number;
  gauntletBest: number;
  flowStreak: number;
}

async function achCtx(): Promise<AchCtx> {
  const u = await uid();
  const [reviews, writes, speaks, learner, speedBest, speedCombo, bossWins, bossFlaw, doneToday, rival, chainBest, leagueProm, dungeonBest, dungeonPerfect, duelWins, gauntletBest, flowStreak] = await Promise.all([
    db.reviewLog.count({ where: { userId: u } }),
    db.writingSub.count({ where: { userId: u } }),
    db.speakSession.count({ where: { userId: u } }),
    db.learner.findUnique({ where: { id: "me" } }),
    db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "speed:best" } } }),
    db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "speed:combo" } } }),
    db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "boss:wins" } } }),
    db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "boss:flawless" } } }),
    db.quest.count({ where: { userId: u, day: dayIndex(), done: true } }),
    db.rival.findUnique({ where: { userId_id: { userId: u, id: "me" } } }),
    db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "chain:best" } } }),
    db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "league:promotions" } } }),
    db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "dungeon:best" } } }),
    db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "dungeon:perfect" } } }),
    db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "duel:wins" } } }),
    db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "gauntlet:best" } } }),
    db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "flow:streak" } } }),
  ]);
  const fams = await topMistakes(200).catch(() => []);
  return {
    reviews,
    writes,
    speaks,
    healed: fams.filter((f) => f.resolvedAt).length,
    level: levelFromXp(learner?.xp ?? 0),
    streak: learner?.streak ?? 0,
    speedBest: speedBest?.best ?? 0,
    speedCombo: speedCombo?.best ?? 0,
    bossWins: bossWins?.best ?? 0,
    bossFlawless: bossFlaw?.best ?? 0,
    questsDoneToday: doneToday,
    rivalWins: rival?.wins ?? 0,
    chainBest: chainBest?.best ?? 0,
    leaguePromotions: leagueProm?.best ?? 0,
    dungeonBest: dungeonBest?.best ?? 0,
    dungeonPerfect: dungeonPerfect?.best ?? 0,
    duelWins: duelWins?.best ?? 0,
    gauntletBest: gauntletBest?.best ?? 0,
    flowStreak: flowStreak?.best ?? 0,
  };
}

function ctxUnlocks(c: AchCtx): string[] {
  const out: string[] = [];
  if (c.reviews >= 1) out.push("first_words");
  if (c.reviews >= 100) out.push("century");
  if (c.reviews >= 1000) out.push("millennium");
  if (c.streak >= 7) out.push("week_warrior");
  if (c.streak >= 30) out.push("month_monk");
  if (c.speedBest >= 300) out.push("speed_demon");
  if (c.speedCombo >= 10) out.push("combo_10");
  if (c.bossWins >= 1) out.push("boss_slayer");
  if (c.bossFlawless >= 1) out.push("boss_flawless");
  if (c.questsDoneToday >= 3) out.push("quest_master");
  if (c.writes >= 5) out.push("essayist");
  if (c.speaks >= 5) out.push("orator");
  if (c.healed >= 1) out.push("healer");
  if (c.healed >= 5) out.push("healer_5");
  if (c.rivalWins >= 1) out.push("rival_slayer");
  if (c.level >= 10) out.push("level_10");
  if (c.level >= 20) out.push("level_20");
  if (c.chainBest >= 25) out.push("chain_25");
  if (c.leaguePromotions >= 1) out.push("league_gold");
  if (c.dungeonPerfect >= 1) out.push("dungeon_perfect");
  if (c.duelWins >= 1) out.push("duel_win");
  if (c.gauntletBest >= 25) out.push("gauntlet_25");
  if (c.flowStreak >= 5) out.push("flow_5");
  if (c.writes >= 3) out.push("anthology");
  return out;
}

// Unlock anything newly satisfied. Returns the fresh rows (already earned
// ones are untouched). Safe to call as often as wanted.
//
// 2026-10-21 hardening: two concurrent graders can both pass the have/fresh
// check and race the createMany. key is @id, so the loser used to throw
// P2002 and 500 a legit grade route. A unique violation now means "another
// request already awarded it" - swallowed; any other error still throws.
export async function evaluateAchievements(): Promise<{ key: string; title: string; desc: string; icon: string }[]> {
  const ctx = await achCtx();
  const should = new Set(ctxUnlocks(ctx));
  const u = await uid();
  const have = await db.achievement.findMany({ where: { userId: u, key: { in: [...should] } } });
  const haveKeys = new Set(have.map((a) => a.key));
  const fresh = [...should].filter((k) => !haveKeys.has(k));
  if (fresh.length === 0) return [];
  try {
    await db.achievement.createMany({ data: fresh.map((key) => ({ userId: u, key })) });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code !== "P2002") throw e;
    return [];
  }
  return fresh.map((key) => {
    const d = ACHIEVEMENTS.find((a) => a.key === key)!;
    return { key, title: d.title, desc: d.desc, icon: d.icon };
  });
}
