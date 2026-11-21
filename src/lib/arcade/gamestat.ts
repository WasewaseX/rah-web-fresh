// ---------- GameStat ----------
// Per-user keyed stat rows: best values and play counters behind every
// game, trophy and streak record in the arcade.

import { db } from "@/lib/db";
import { uid } from "./user";

export async function bumpStat(key: string, best?: number): Promise<{ best: number; isNew: boolean }> {
  const u = await uid();
  const row = await db.gameStat.findUnique({ where: { userId_key: { userId: u, key } } });
  if (!row) {
    await db.gameStat.create({ data: { userId: u, key, best: best ?? 0, plays: key.includes(":") && !best ? 1 : 0 } });
    if (best !== undefined) return { best, isNew: best > 0 };
    return { best: 0, isNew: false };
  }
  if (best !== undefined && best > row.best) {
    await db.gameStat.update({ where: { userId_key: { userId: u, key } }, data: { best, plays: { increment: 1 } } });
    return { best, isNew: true };
  }
  if (best === undefined) {
    await db.gameStat.update({ where: { userId_key: { userId: u, key } }, data: { plays: { increment: 1 } } });
  }
  return { best: row.best, isNew: false };
}
