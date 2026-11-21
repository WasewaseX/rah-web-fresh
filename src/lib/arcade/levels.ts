// ---------- Levels ----------

// Cumulative XP needed to reach level L: 50 * (L-1)^1.45. L2=50, L3=146,
// L5=390, L10=1120, L20=3100, L40=8550. Slow start, long runway.
export function xpToReach(level: number): number {
  if (level <= 1) return 0;
  return Math.round(50 * Math.pow(level - 1, 1.45));
}

export function levelFromXp(xp: number): number {
  let lvl = 1;
  while (lvl < 40 && xp >= xpToReach(lvl + 1)) lvl++;
  return lvl;
}

const LEVEL_NAMES = [
  "Rookie", "Apprentice", "Wordsmith", "Sharpshooter", "Gladiator",
  "Duelist", "Sage", "Mythic", "Legend",
] as const;

export function levelName(level: number): string {
  return LEVEL_NAMES[Math.min(LEVEL_NAMES.length - 1, Math.floor((level - 1) / 5))];
}

export interface LevelView {
  level: number;
  name: string;
  xp: number;
  intoLevel: number;
  levelSpan: number;
  nextAt: number | null;
  pct: number;
}

export function levelView(xp: number): LevelView {
  const level = levelFromXp(xp);
  const base = xpToReach(level);
  const nextAt = level >= 40 ? null : xpToReach(level + 1);
  const span = nextAt === null ? 1 : nextAt - base;
  const into = xp - base;
  return {
    level,
    name: levelName(level),
    xp,
    intoLevel: into,
    levelSpan: span,
    nextAt,
    pct: nextAt === null ? 100 : Math.min(100, Math.round((into / span) * 100)),
  };
}
