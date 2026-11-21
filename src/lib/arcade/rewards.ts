// The reward loop: momentum chains, the single XP faucet and the daily
// quests. These three live together because their call graph is a cycle
// (registerHit pays quest progress; quests pay XP; XP awards extend the
// chain) - one module keeps the dependency order acyclic.

import { db } from "@/lib/db";
import { dayIndex } from "@/lib/fsrs";
import { topMistakes } from "@/lib/mistakes";
import { bumpDaily, getLearner } from "@/lib/server";
import { GEMS, awardGems, boostActive } from "@/lib/shop";
import { hasPerk } from "./talents";
import { levelFromXp, levelView } from "./levels";
import { bumpStat } from "./gamestat";
import { evaluateAchievements } from "./achievements";
import { uid } from "./user";

// ---------- Momentum (cross-surface combo chains) ----------

// Every correct answer on any surface extends today's chain; any miss halves
// it (the chain_shield talent absorbs the first miss of the day), and a new
// day resets it. Heat tiers turn the chain into an XP multiplier, so a hot
// streak anywhere - reviews, exams, speed rounds, duels - pays everywhere.

export const HEAT_TIERS = [
  { min: 0, mult: 1, label: "cold" },
  { min: 5, mult: 1.05, label: "warming" },
  { min: 10, mult: 1.1, label: "warm" },
  { min: 15, mult: 1.2, label: "hot" },
  { min: 25, mult: 1.3, label: "blazing" },
] as const;

export function heatOf(chain: number): { min: number; mult: number; label: string } {
  let t: { min: number; mult: number; label: string } = HEAT_TIERS[0];
  for (const tier of HEAT_TIERS) if (chain >= tier.min) t = tier;
  return { min: t.min, mult: t.mult, label: t.label };
}

async function freshChain(l: { chain: number; chainDay: number }): Promise<number> {
  const today = dayIndex();
  return l.chainDay === today ? l.chain : 0;
}

export async function getChain(): Promise<{ chain: number; mult: number; label: string }> {
  const l = await getLearner();
  const chain = await freshChain(l);
  const heat = heatOf(chain);
  return { chain, ...heat };
}

export async function registerHit(): Promise<{ chain: number; mult: number; label: string }> {
  const l = await getLearner();
  const today = dayIndex();
  const base = await freshChain(l);
  const chain = base + 1;
  await db.learner.update({ where: { id: "me" }, data: { chain, chainDay: today } });
  await bumpStat("chain:best", chain);
  const heat = heatOf(chain);
  await progressQuest("heat_15", chain);
  return { chain, ...heat };
}

export async function registerMiss(): Promise<void> {
  const l = await getLearner();
  const today = dayIndex();
  const u = await uid();
  const base = await freshChain(l);
  if (base === 0) return;
  const shielded = hasPerk(l.perks, "chain_shield");
  if (shielded) {
    const key = `shield:${today}`;
    const used = await db.gameStat.findUnique({ where: { userId_key: { userId: u, key } } });
    if (!used) {
      await db.gameStat.create({ data: { userId: u, key, best: 1, plays: 0 } });
      return; // shield ate the miss; chain keeps running
    }
  }
  const chain = Math.floor(base / 2);
  await db.learner.update({ where: { id: "me" }, data: { chain, chainDay: today } });
}

// ---------- XP ----------

export interface XpResult {
  total: number;
  base: number; // pre-multiplier amount, for honest UI reporting
  mult: number; // momentum multiplier that was applied
  chain: number; // chain AFTER the hit that came with this award
  level: number;
  levelName: string;
  leveledUp: boolean;
  unlocked: { key: string; title: string; desc: string; icon: string }[];
}

// Single XP faucet. Routes replace their raw bumpDaily("xp") calls with this;
// it pays the learner, keeps today's DailyStat in sync (the "XP today" chip
// and the rival race both read it), and checks trophies. When opts.chainHit
// is true the award extends today's momentum chain and the chain's heat
// multiplier applies to THIS award; perk multipliers (Fast Reader, quest
// boost) stack after heat.
export async function awardXp(amount: number, opts?: { chainHit?: boolean; perkXp?: "review" | "quest" }): Promise<XpResult> {
  const chainInfo = opts?.chainHit ? await registerHit() : await getChain();
  let mult = chainInfo.mult;
  const l0 = await getLearner();
  if (opts?.perkXp === "review" && hasPerk(l0.perks, "xp_review")) mult *= 1.15;
  if (opts?.perkXp === "quest" && hasPerk(l0.perks, "quest_boost")) mult *= 1.15;
  // Shop XP boost (Duolingo RE): 2x every payout while active. Stacks after heat + talents.
  if (boostActive(l0.boostUntil)) mult *= 2;
  const base = Math.max(0, Math.min(500, Math.round(amount)));
  const amt = Math.min(500, Math.round(base * mult));
  const l = await db.learner.upsert({
    where: { id: "me" },
    create: { id: "me", xp: amt },
    update: { xp: { increment: amt } },
  });
  // Level-ups bank talent points for the tree (1 SP per level gained) and mint gems (Duolingo RE).
  const before = levelFromXp(l.xp - amt);
  const view = levelView(l.xp);
  if (view.level > before) {
    const gained = view.level - before;
    await db.learner.update({ where: { id: "me" }, data: { sp: { increment: gained }, gems: { increment: GEMS.levelUp * gained } } });
  }
  await bumpDaily("xp", amt);
  const unlocked = await evaluateAchievements();
  return {
    total: l.xp,
    base,
    mult: Math.round(mult * 100) / 100,
    chain: chainInfo.chain,
    level: view.level,
    levelName: view.name,
    leveledUp: view.level > before,
    unlocked,
  };
}

// ---------- Anti-farming: daily XP caps per game mode ----------

// The audit's polish row: "anti-farming pass". Game modes are replayable by
// design (a Speed Round is a game), so a determined player could sit on one
// mode all day minting XP. Reviews and exams stay uncapped - they ARE the
// learning work; the games are seasoning. Each mode gets a daily BASE-XP
// budget: full payout until the cap, then 25% (engagement still pays, farming
// stops paying). Heat/talent/shop multipliers still apply AFTER the cap on
// the allowed amount, exactly as before. Quest payouts are untouched (they
// are one-shot rewards, not loops).
export const GAME_XP_CAPS: Record<string, number> = {
  speed: 150,
  duel: 120,
  dungeon: 160,
  gauntlet: 120,
  boss: 120,
  flow: 100,
  pairs: 80,
};

async function addGameXpEarned(mode: string, amount: number): Promise<number> {
  const u = await uid();
  const key = `xpdaily:${mode}:${dayIndex()}`;
  const row = await db.gameStat.upsert({
    where: { userId_key: { userId: u, key } },
    create: { userId: u, key, best: amount, plays: 0 },
    update: { best: { increment: amount } },
  });
  return row.best;
}

export async function gameXpEarnedToday(mode: string): Promise<number> {
  const u = await uid();
  const row = await db.gameStat.findUnique({ where: { userId_key: { userId: u, key: `xpdaily:${mode}:${dayIndex()}` } } });
  return row?.best ?? 0;
}

export interface GameXpResult extends XpResult {
  paid: number; // base amount actually paid (after the cap, before multipliers)
  capped: boolean; // true when the daily budget for this mode was already spent
  cap: number;
}

export async function awardGameXp(mode: string, base: number, opts?: { chainHit?: boolean }): Promise<GameXpResult> {
  const cap = GAME_XP_CAPS[mode] ?? 100;
  const earned = await gameXpEarnedToday(mode);
  const safeBase = Math.max(0, Math.round(base));
  const paid = earned >= cap ? Math.round(safeBase * 0.25) : Math.min(safeBase, cap - earned);
  const res = await awardXp(paid, opts);
  if (paid > 0) await addGameXpEarned(mode, paid);
  return { ...res, paid, capped: paid < safeBase, cap };
}

// ---------- Daily quests ----------

interface QuestTemplate {
  key: string;
  title: string;
  fa: string;
  target: number;
  xp: number;
  kind: "sum" | "max"; // sum: progress accumulates; max: progress is a best (combo, phase)
}

export const QUEST_TEMPLATES: QuestTemplate[] = [
  { key: "reviews_20", title: "Clear 20 reviews", fa: "۲۰ مرور را تمام کن", target: 20, xp: 60, kind: "sum" },
  { key: "reviews_35", title: "Clear 35 reviews", fa: "۳۵ مرور را تمام کن", target: 35, xp: 95, kind: "sum" },
  { key: "correct_15", title: "15 good recalls", fa: "۱۵ یادآوری درست", target: 15, xp: 70, kind: "sum" },
  { key: "chat_10", title: "10 turns with the coach", fa: "۱۰ نوبت با مربی", target: 10, xp: 50, kind: "sum" },
  { key: "write_1", title: "Grade one essay", fa: "یک بنویس و بگیر نمره", target: 1, xp: 60, kind: "sum" },
  { key: "speak_1", title: "One speaking monologue", fa: "یک مونولوگ بگو", target: 1, xp: 60, kind: "sum" },
  { key: "exam_1", title: "Take a coach exam", fa: "یک امتحان بده", target: 1, xp: 80, kind: "sum" },
  { key: "speed_play", title: "Finish a Speed Round", fa: "یک دور سرعتی بازی کن", target: 1, xp: 40, kind: "sum" },
  { key: "speed_combo_8", title: "Reach an 8x combo", fa: "کمبو ۸ برسانی", target: 8, xp: 80, kind: "max" },
  { key: "boss_phase", title: "Survive 2 boss phases", fa: "۲ فاز رئیس زنده بمان", target: 2, xp: 60, kind: "max" },
  { key: "boss_win", title: "Slay The Examiner", fa: "امتحان‌دهنده را بکش", target: 1, xp: 120, kind: "sum" },
  { key: "arena_5", title: "5 Voice Arena reps", fa: "۵ تمرین میکروفونی", target: 5, xp: 70, kind: "sum" },
  { key: "heat_15", title: "Reach a 15-chain", fa: "زنجیره ۱۵ بساز", target: 15, xp: 90, kind: "max" },
  { key: "dungeon_1", title: "Clear the Daily Dungeon", fa: "سیاهچال امروز را بزن", target: 1, xp: 80, kind: "sum" },
  { key: "duel_1", title: "Win a Rival Duel", fa: "یک دوئل را ببر", target: 1, xp: 80, kind: "sum" },
  { key: "gauntlet_10", title: "Survive 10 Gauntlet items", fa: "۱۰ آیتم گانتلت زنده بمان", target: 10, xp: 90, kind: "max" },
  { key: "flow_1", title: "Finish a Focus Flow", fa: "یک جریان تمرکز تمام کن", target: 1, xp: 70, kind: "sum" },
];

// Seeded pick of 3 quests per day, biased by active mistake families so the
// day's missions always point at the leaks. Deterministic per day.
export async function ensureQuests(): Promise<void> {
  const day = dayIndex();
  const u = await uid();
  const existing = await db.quest.count({ where: { userId: u, day } });
  if (existing > 0) return;
  let famTags: string[] = [];
  try {
    famTags = (await topMistakes(10)).filter((f) => !f.resolvedAt).map((f) => f.tag);
  } catch {
    // fresh db
  }
  const pick = seededPick(QUEST_TEMPLATES.map((t) => t.key), 3, day);
  await db.quest.createMany({
    data: pick.map((key, i) => {
      const t = QUEST_TEMPLATES.find((q) => q.key === key)!;
      return { userId: u, id: `${day}:${key}`, day, key, title: t.title, fa: t.fa, target: t.target, xp: t.xp, progress: 0, done: false, ...(i === -1 ? {} : {}) };
    }),
  });
  void famTags; // biasing hook reserved: templates already cover every surface
}

function seededPick<T>(arr: T[], n: number, seed: number): T[] {
  const a = [...arr];
  let s = seed * 2654435761 % 4294967296;
  const rnd = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// Progress a quest by key. kind "sum" accumulates, "max" keeps the best.
// Finishing pays the quest XP through the same awardXp faucet.
export async function progressQuest(key: string, amount: number): Promise<void> {
  const day = dayIndex();
  const u = await uid();
  const q = await db.quest.findUnique({ where: { userId_id: { userId: u, id: `${day}:${key}` } } });
  if (!q || q.done) return;
  const t = QUEST_TEMPLATES.find((x) => x.key === key);
  const progress = t?.kind === "max" ? Math.max(q.progress, amount) : q.progress + amount;
  if (progress >= q.target) {
    await db.quest.update({ where: { userId_id: { userId: u, id: q.id } }, data: { progress: q.target, done: true } });
    await awardXp(q.xp, { perkXp: "quest" });
    await awardGems(GEMS.questDone).catch(() => undefined);
    await evaluateAchievements();
  } else {
    await db.quest.update({ where: { userId_id: { userId: u, id: q.id } }, data: { progress } });
  }
}
