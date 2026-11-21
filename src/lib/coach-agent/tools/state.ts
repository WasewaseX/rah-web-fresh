// ---------- read_state: the app's full truth ----------

import type { ToolResult } from "./types";

async function readState(): Promise<ToolResult> {
  const { buildProfile } = await import("@/lib/server");
  const { getMasteryView } = await import("@/lib/mastery");
  const { topMistakes } = await import("@/lib/mistakes");
  const { nextBestActions } = await import("@/lib/next-best");
  const { dayIndex } = await import("@/lib/fsrs");
  const { db } = await import("@/lib/db");

  const profile = await buildProfile();
  const mastery = await getMasteryView();
  const mistakes = await topMistakes(8);
  const nextBest = await nextBestActions();
  const today = dayIndex();
  const { contentUserId } = await import("@/lib/scope");
  const stats = await db.dailyStat.findMany({ where: { userId: await contentUserId().catch(() => "me") }, orderBy: { day: "desc" }, take: 7 });
  const l = await db.learner.findUnique({ where: { id: "me" } });
  // Review feature #17: the learner's content flags are part of the truth.
  const openFlags = await db.contentFlag.count({ where: { status: "open" } });
  const recentFlags = await db.contentFlag.findMany({ where: { status: "open" }, orderBy: { id: "desc" }, take: 5 });
  const guideSelfRatings = await guideSelfRatingsLine();

  // Task 136: drill-request line from the guide's practice ledger. HONEST
  // LABELING: these are drill REQUESTS (panel clicks), not completed sessions
  // - the coach must say "requested", never "mastered".
  // Task 144/148: the line carries all-time coverage, the 7-day week and the
  // stale list, all built by the battery-pinned guideStateLine().
  let guideDrills: string | null = null;
  try {
    const drillRow = await db.setting.findUnique({ where: { key: "guide:practice" } });
    if (drillRow) {
      const { guideStateLine } = await import("@/lib/guide-ledger");
      guideDrills = guideStateLine(JSON.parse(drillRow.value));
    }
  } catch {
    // practice ledger unavailable or malformed - omit the drill-request line
  }

  const payload = {
    learner: l
      ? {
          level: l.level, streak: l.streak, xp: l.xp, gems: l.gems, freezes: l.freezes,
          chain: l.chain, focusSkill: l.focusSkill, placementPhase: l.placementPhase,
          persona: l.persona, sp: l.sp, boostUntil: l.boostUntil, newPerDay: l.newPerDay,
        }
      : null,
    profile,
    masterySummary: mastery?.summary,
    masteryTop: mastery?.tags?.slice(0, 8),
    mistakes,
    nextBest,
    stats: stats.map((r) => ({ day: r.day, reviews: r.reviews, correct: r.correct, xp: r.xp })),
    today,
    contentFlags: {
      open: openFlags,
      recent: recentFlags.map((f) => ({ cardId: f.cardId, kind: f.kind, note: f.note.slice(0, 80) })),
    },
    guideSelfRatings,
    guideDrills,
  };
  return {
    ok: true,
    summary: `App state: level ${profile.level}, streak ${profile.streak}, ${profile.due} due, ${mistakes.length} active mistake families${openFlags ? `, ${openFlags} open content flag(s)` : ""}`,
    detail: JSON.stringify(payload, null, 1).slice(0, 5000),
  };
}

// Task 131: the learner's B1-C1 guide self-ratings (the book's checklist
// method) are part of the truth - level advice uses the real signal.
async function guideSelfRatingsLine(): Promise<string | null> {
  const { db } = await import("@/lib/db");
  let guideSelfRatings: string | null = null;
  try {
    const ratingRows = await db.setting.findMany({ where: { key: { startsWith: "guide:checklist:" } } });
    if (ratingRows.length > 0) {
      const { checklistReadiness, GUIDE_LEVELS } = await import("@/lib/b1c1-guide");
      const parts: string[] = [];
      for (const s of GUIDE_LEVELS) {
        const row = ratingRows.find((r) => r.key === `guide:checklist:${s.level}`);
        if (!row) continue;
        try {
          const parsed: unknown = JSON.parse(row.value);
          if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
            const r = checklistReadiness(s.level, parsed as number[]);
            parts.push(`${s.level}: ${r.easy}/${r.total} easy, ${r.mid} some difficulty, ${r.hard} difficult - ${r.verdict}`);
          }
        } catch {
          // malformed checklist row - skip that level, the rest still report
        }
      }
      if (parts.length > 0) guideSelfRatings = parts.join("; ");
    }
  } catch {
    // guide state unavailable - the briefing just omits the self-ratings line
  }
  return guideSelfRatings;
}

export { readState };
