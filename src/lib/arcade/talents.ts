// ---------- Talents (perk tree) ----------

import { db } from "@/lib/db";
import { getLearner } from "@/lib/server";
import { levelFromXp } from "./levels";
import { uid } from "./user";

export interface PerkDef {
  key: string;
  branch: string; // SkillLevel skill the branch hangs from
  tier: number; // 1..4, bought in order, tier N requires SP N
  title: string;
  desc: string;
}

export const PERKS: PerkDef[] = [
  { key: "xp_review", branch: "reading", tier: 1, title: "Fast Reader", desc: "+15% XP from every review grade." },
  { key: "chain_shield", branch: "vocabulary", tier: 2, title: "Chain Shield", desc: "The first miss each day no longer halves your momentum chain." },
  { key: "duel_time", branch: "writing", tier: 1, title: "Cool Head", desc: "+10 seconds on every Rival Duel timer." },
  { key: "dungeon_heart", branch: "listening", tier: 2, title: "Iron Lungs", desc: "Enter the Daily Dungeon with 4 hearts instead of 3." },
  { key: "freeze_cap", branch: "speaking", tier: 3, title: "Deep Freezer", desc: "Streak freeze bank grows to 3 (from 2)." },
  { key: "quest_boost", branch: "grammar", tier: 2, title: "Overachiever", desc: "Quest payouts pay +15% XP." },
] as const;

export function hasPerk(perksJson: string, key: string): boolean {
  if (!perksJson) return false;
  try {
    return (JSON.parse(perksJson) as string[]).includes(key);
  } catch {
    return false;
  }
}

export async function learnerPerks(): Promise<string[]> {
  const l = await getLearner();
  if (!l.perks) return [];
  try {
    return JSON.parse(l.perks) as string[];
  } catch {
    return [];
  }
}

export interface PerksView {
  sp: number;
  owned: string[];
  perks: PerkDef[];
  skills: { skill: string; score: number }[];
  leveled: boolean;
}

export async function getPerksView(): Promise<PerksView> {
  const l = await getLearner();
  const u = await uid();
  // Retroactive catch-up: the tree arrives when the learner is already deep
  // in the ladder, so their earned SP is granted once on first open.
  const init = await db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "talents:init" } } });
  let sp = l.sp;
  let leveled = false;
  if (!init) {
    const level = levelFromXp(l.xp);
    sp += Math.max(0, level - 1);
    await db.learner.update({ where: { id: "me" }, data: { sp } });
    await db.gameStat.create({ data: { userId: u, key: "talents:init", best: level, plays: 0 } });
    leveled = true;
  }
  const skills = await db.skillLevel.findMany({ where: { userId: u } });
  return {
    sp,
    owned: learnerPerksFrom(l.perks),
    perks: PERKS,
    skills: skills.map((s) => ({ skill: s.skill, score: s.score })),
    leveled,
  };
}

function learnerPerksFrom(json: string): string[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as string[];
  } catch {
    return [];
  }
}

export async function buyPerk(key: string): Promise<{ ok: boolean; error?: string; sp: number; owned: string[] }> {
  const def = PERKS.find((p) => p.key === key);
  if (!def) return { ok: false, error: "Unknown perk", sp: 0, owned: [] };
  const l = await getLearner();
  const owned = learnerPerksFrom(l.perks);
  if (owned.includes(key)) return { ok: false, error: "Already unlocked", sp: l.sp, owned };
  // Tier N needs N-1 perks owned anywhere: every branch holds a single perk,
  // so the gate counts global progress, not same-branch purchases.
  if (owned.length < def.tier - 1) return { ok: false, error: `Unlock ${def.tier - 1} perk${def.tier - 1 === 1 ? "" : "s"} first`, sp: l.sp, owned };
  if (l.sp < def.tier) return { ok: false, error: `Needs ${def.tier} SP (you have ${l.sp})`, sp: l.sp, owned };
  const sp = l.sp - def.tier;
  const perks = JSON.stringify([...owned, key]);
  await db.learner.update({ where: { id: "me" }, data: { sp, perks } });
  return { ok: true, sp, owned: [...owned, key] };
}
