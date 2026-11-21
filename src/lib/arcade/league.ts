// ---------- League (weekly divisions with ghost standings) ----------

import { db } from "@/lib/db";
import { dayIndex } from "@/lib/fsrs";
import { contentUserId } from "@/lib/scope";
import { getLearner } from "@/lib/server";
import { levelFromXp } from "./levels";
import { bumpStat } from "./gamestat";
import { awardXp } from "./rewards";
import { RIVAL_NAMES, seededUnit, weekOf } from "./rival";

export const DIVISIONS = ["Wood", "Bronze", "Silver", "Gold", "Platinum", "Rahiator"] as const;
const LEAGUE_SIZE = 8; // you + 7 ghosts
const PROMOTE_PLACES = 3; // top 3 climb
const DEMOTE_PLACES = 3; // bottom 3 drop

export interface LeagueStanding {
  name: string;
  xp: number;
  you: boolean;
}

export interface LeagueView {
  division: number;
  divisionName: string;
  standings: LeagueStanding[];
  place: number;
  daysLeft: number;
  promoteCut: number; // xp of the last promoted slot
  demoteCut: number; // xp above the demotion zone
  history: { week: number; division: number; place: number; promoted: boolean; demoted: boolean }[];
}

function ghostXp(week: number, slot: number, dailyTarget: number, dayOfWeek: number): number {
  // Deterministic ghost accumulation, slot 0..6, mirrors the rival's rubber
  // band so every league feels alive but beatable.
  let sum = 0;
  for (let d = 0; d <= dayOfWeek; d++) {
    const jitter = 0.55 + seededUnit(week * 977 + slot * 61 + d) * 0.95;
    sum += Math.round(dailyTarget * jitter);
  }
  return sum;
}

export async function getLeagueView(): Promise<LeagueView> {
  const day = dayIndex();
  const wk = weekOf(day);
  const dayOfWeek = day - wk * 7;
  const u = await contentUserId().catch(() => "me");
  const recent = await db.dailyStat.findMany({ where: { userId: u, day: { gte: day - 7, lt: day } } });
  const avg = recent.reduce((s, r) => s + r.xp, 0) / 7;
  const dailyTarget = Math.max(70, Math.round(avg * 0.8));

  let row = await db.league.findUnique({ where: { userId_id: { userId: u, id: "me" } } });
  if (!row) {
    const l = await getLearner();
    const lvl = levelFromXp(l.xp);
    const startDivision = lvl >= 25 ? 3 : lvl >= 15 ? 2 : lvl >= 8 ? 1 : 0;
    row = await db.league.create({ data: { userId: u, id: "me", weekKey: wk, division: startDivision } });
  }

  if (row.weekKey !== wk) {
    // Settle last week: compute final place, apply promotion/demotion.
    const settled = row;
    const lastDow = 6;
    const thisWkDays = Array.from({ length: 7 }, (_, i) => settled.weekKey * 7 + i);
    const youRows = await db.dailyStat.findMany({ where: { userId: u, day: { in: thisWkDays } } });
    const youXp = youRows.reduce((s, r) => s + r.xp, 0);
    const lastAvg = Math.max(70, Math.round(avg * 0.8));
    const ghosts = Array.from({ length: LEAGUE_SIZE - 1 }, (_, i) => ghostXp(settled.weekKey, i, lastAvg, lastDow));
    const place = 1 + ghosts.filter((g) => g > youXp).length;
    const promoted = place <= PROMOTE_PLACES && settled.division < DIVISIONS.length - 1;
    const demoted = place > LEAGUE_SIZE - DEMOTE_PLACES && settled.division > 0;
    const division = Math.max(0, Math.min(DIVISIONS.length - 1, settled.division + (promoted ? 1 : demoted ? -1 : 0)));
    const history = JSON.parse(settled.history || "[]") as LeagueView["history"];
    history.push({ week: settled.weekKey, division: settled.division, place, promoted, demoted });
    if (promoted) {
      const prev = (await db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "league:promotions" } } }))?.best ?? 0;
      await bumpStat("league:promotions", prev + 1);
      await awardXp(150);
    }
    row = await db.league.update({ where: { userId_id: { userId: u, id: "me" } }, data: { weekKey: wk, division, history: JSON.stringify(history.slice(-12)) } });
  }

  const thisWkDays = Array.from({ length: 7 }, (_, i) => wk * 7 + i);
  const youRows = await db.dailyStat.findMany({ where: { userId: u, day: { in: thisWkDays } } });
  const youXp = youRows.reduce((s, r) => s + r.xp, 0);
  const standings: LeagueStanding[] = [
    { name: "You", xp: youXp, you: true },
    ...Array.from({ length: LEAGUE_SIZE - 1 }, (_, i) => ({
      name: RIVAL_NAMES[(wk * 13 + i * 5) % RIVAL_NAMES.length],
      xp: ghostXp(wk, i, dailyTarget, dayOfWeek),
      you: false,
    })),
  ].sort((a, b) => b.xp - a.xp);
  const place = 1 + standings.findIndex((s) => s.you);
  const promoteCut = standings[PROMOTE_PLACES - 1]?.xp ?? 0;
  const demoteCut = standings[LEAGUE_SIZE - DEMOTE_PLACES]?.xp ?? 0;
  return {
    division: row.division,
    divisionName: DIVISIONS[row.division],
    standings,
    place,
    daysLeft: 6 - dayOfWeek,
    promoteCut,
    demoteCut,
    history: JSON.parse(row.history || "[]") as LeagueView["history"],
  };
}
