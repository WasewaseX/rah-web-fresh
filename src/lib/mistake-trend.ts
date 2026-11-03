// C-7 (assessment section 4): per-error decline-over-time, surfaced to the
// learner. Pure and client-safe (no db import - the Progress view calls it
// directly, the battery pins the arithmetic).
//
// Honesty boundaries: MistakeFamily stores count + lastSeen + the exam-side
// heal streak, NOT a per-day history. The trend therefore describes the
// family's CURRENT state in plain words - recurrence, quiet period, heal
// progress - and never invents a history curve it does not have.

import type { MistakeFamilyView } from "./mistakes";

export type MistakeTrendState = "worsening" | "active" | "cooling" | "healed";

export interface MistakeTrend {
  state: MistakeTrendState;
  daysQuiet: number;
  healPct: number; // 0..100 - clean exam hits toward the 2-hit retirement bar
  note: string;
}

const DAY = 86_400_000;

export function mistakeTrend(
  v: Pick<MistakeFamilyView, "count" | "lastSeen" | "streakClean" | "resolvedAt">,
  now = Date.now(),
): MistakeTrend {
  const daysQuiet = Math.max(0, Math.floor((now - new Date(v.lastSeen).getTime()) / DAY));
  const healPct = Math.min(100, Math.round((v.streakClean / 2) * 100));

  if (v.resolvedAt) {
    return {
      state: "healed",
      daysQuiet,
      healPct: 100,
      note: "retired - two clean exam hits under pressure proved the fix holds",
    };
  }
  if (daysQuiet < 3 && v.count >= 2) {
    return {
      state: "worsening",
      daysQuiet,
      healPct,
      note: `seen ${v.count}\u00d7, the last one ${daysQuiet === 0 ? "today" : "yesterday"} - still active, the coach keeps hunting it`,
    };
  }
  if (daysQuiet < 7) {
    return {
      state: "active",
      daysQuiet,
      healPct,
      note: `seen ${v.count}\u00d7, last ${daysQuiet === 0 ? "today" : `${daysQuiet}d ago`} - live in every exam and drill target`,
    };
  }
  return {
    state: "cooling",
    daysQuiet,
    healPct,
    note: `quiet for ${daysQuiet} days after ${v.count}\u00d7 - fading; ${v.streakClean}/2 clean exam hits retire it for good`,
  };
}
