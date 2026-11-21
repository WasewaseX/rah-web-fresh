// ---------- Arcade state view (what /api/state embeds) ----------

import { db } from "@/lib/db";
import { levelView, type LevelView } from "./levels";
import { ACHIEVEMENTS, type AchievementDef } from "./achievements";
import { uid } from "./user";

export interface GameView {
  level: LevelView;
  unlocked: string[];
  all: AchievementDef[];
  recent: { key: string; title: string; desc: string; icon: string }[]; // unlocked in the last 90s, for toasts
  stats: { key: string; best: number; plays: number }[];
  freezes: number;
}

export async function getGameView(): Promise<GameView> {
  const l = await db.learner.findUnique({ where: { id: "me" } });
  const u = await uid();
  const xp = l?.xp ?? 0;
  const [ach, stats] = await Promise.all([
    db.achievement.findMany({ where: { userId: u }, orderBy: { at: "desc" } }),
    db.gameStat.findMany({ where: { userId: u } }),
  ]);
  const cutoff = new Date(Date.now() - 90_000);
  const recent = ach
    .filter((a) => a.at >= cutoff)
    .map((a) => {
      const d = ACHIEVEMENTS.find((x) => x.key === a.key);
      return d ? { key: a.key, title: d.title, desc: d.desc, icon: d.icon } : null;
    })
    .filter((x): x is { key: string; title: string; desc: string; icon: string } => x !== null);
  return {
    level: levelView(xp),
    unlocked: ach.map((a) => a.key),
    all: ACHIEVEMENTS,
    recent,
    stats: stats.map((s) => ({ key: s.key, best: s.best, plays: s.plays })),
    freezes: l?.freezes ?? 0,
  };
}
