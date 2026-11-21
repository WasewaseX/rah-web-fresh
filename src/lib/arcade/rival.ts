// ---------- Rival ----------
// The rubber-band rival: a ghost opponent whose weekly XP grows
// deterministically day by day, tuned to keep the race tense but fair.

import { db } from "@/lib/db";
import { dayIndex } from "@/lib/fsrs";
import { uid } from "./user";

export const RIVAL_NAMES = [
  "Vahid the Verbose", "Sahar Silver-tongue", "Arman Atrox", "Parham the Pitiless",
  "Neda Nine-lives", "Kian Kill-switch", "Roya Razor-tongue", "Behnam Blackout",
] as const;

const RIVAL_TAUNTS = [
  "I graded three essays before breakfast. Did you?",
  "My streak is architectural at this point.",
  "The Examiner and I play cards on Sundays. You weren't invited.",
  "I review at 5 a.m. Because standards.",
  "Your XP graph looks like a flatline, friend.",
  "Catch up. I will wait. Briefly.",
] as const;

export function weekOf(day: number): number {
  return Math.floor(day / 7);
}

export function seededUnit(day: number): number {
  // Deterministic 0..1 jitter per calendar day.
  let s = (day * 2654435761) % 4294967296;
  s = (s * 1103515245 + 12345) % 2147483648;
  return s / 2147483648;
}

export interface RivalView {
  name: string;
  weekXp: number;
  you: number;
  lastWeekYou: number;
  lastWeekRival: number;
  wins: number;
  losses: number;
  taunt: string;
  dailyTarget: number;
}

// Lazily advances the rival to the current week. rivalWeekXp grows
// deterministically day by day from a rubber-banded daily target (80% of the
// learner's trailing 7-day average, clamped), so the race is tense but fair.
export async function getRivalView(): Promise<RivalView> {
  const day = dayIndex();
  const wk = weekOf(day);
  const u = await uid();
  let rival = await db.rival.findUnique({ where: { userId_id: { userId: u, id: "me" } } });
  if (!rival) {
    const seedName = RIVAL_NAMES[seededUnit(wk) === 0 ? 0 : Math.floor(seededUnit(wk + 7) * RIVAL_NAMES.length)];
    rival = await db.rival.create({ data: { userId: u, id: "me", name: seedName, weekKey: wk, taunt: RIVAL_TAUNTS[Math.floor(seededUnit(wk + 3) * RIVAL_TAUNTS.length)] } });
  }

  // Trailing 7-day learner XP average (yesterday backwards).
  const recent = await db.dailyStat.findMany({ where: { userId: u, day: { gte: day - 7, lt: day } } });
  const weekSum = recent.reduce((s, r) => s + r.xp, 0);
  const avg = weekSum / 7;
  const dailyTarget = Math.max(70, Math.round(avg * 0.8));

  if (rival.weekKey !== wk) {
    // Rollover: settle last week's race, then reset.
    const lastWk = weekOf(day - 1);
    const lastWkDays = Array.from({ length: 7 }, (_, i) => lastWk * 7 + i);
    const youLast = await db.dailyStat.findMany({ where: { userId: u, day: { in: lastWkDays } } });
    const youXp = youLast.reduce((s, r) => s + r.xp, 0);
    const wins = rival.wins + (youXp >= rival.weekXp ? 1 : 0);
    const losses = rival.losses + (youXp < rival.weekXp ? 1 : 0);
    rival = await db.rival.update({
      where: { userId_id: { userId: u, id: "me" } },
      data: {
        lastWeekXp: rival.weekXp,
        weekXp: 0,
        weekKey: wk,
        wins,
        losses,
        name: RIVAL_NAMES[Math.floor(seededUnit(wk + 11) * RIVAL_NAMES.length)],
        taunt: RIVAL_TAUNTS[Math.floor(seededUnit(wk + 5) * RIVAL_TAUNTS.length)],
      },
    });
  }

  // Bring the rival's week up to its deterministic schedule for today.
  const dayOfWeek = day - wk * 7; // 0..6
  let expected = 0;
  for (let d = 0; d <= dayOfWeek; d++) {
    const jitter = 0.75 + seededUnit(wk * 7 + d) * 0.55;
    expected += Math.round(dailyTarget * jitter);
  }
  if (rival.weekXp < expected) {
    rival = await db.rival.update({ where: { userId_id: { userId: u, id: "me" } }, data: { weekXp: expected } });
  }

  const thisWkDays = Array.from({ length: 7 }, (_, i) => wk * 7 + i);
  const youThis = await db.dailyStat.findMany({ where: { userId: u, day: { in: thisWkDays } } });
  const youWeek = youThis.reduce((s, r) => s + r.xp, 0);

  return {
    name: rival.name,
    weekXp: rival.weekXp,
    you: youWeek,
    lastWeekYou: 0, // filled at rollover comparison time; shown via wins/losses
    lastWeekRival: rival.lastWeekXp,
    wins: rival.wins,
    losses: rival.losses,
    taunt: rival.taunt,
    dailyTarget,
  };
}
