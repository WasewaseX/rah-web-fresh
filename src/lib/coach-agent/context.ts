// Bounded model context (audit P1 "planner context compression", closed).
//
// Both model-facing seams - the coach loop's history block and the planner's
// routing window - now draw from ONE compression seam instead of ad-hoc
// slices: per-turn caps, a turns cap, and a TOTAL char budget with
// oldest-first eviction. The model can never see an unbounded wall of
// history, and the two seams can never drift apart again.
//
// Pure and dependency-free: loop.ts and agent/planner.ts both import it; it
// imports neither, so no cycle.

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export const HISTORY_TURNS = 8;
export const HISTORY_PER_TURN = 400;
export const HISTORY_BUDGET = 3600;

export function compressHistory(
  history: { role: string; content: string }[] | null | undefined,
  turns = HISTORY_TURNS,
  perTurn = HISTORY_PER_TURN,
  budget = HISTORY_BUDGET,
): HistoryTurn[] {
  const src = Array.isArray(history) ? history : [];
  const capped = src
    .slice(-turns)
    // Model-spoofed rows (a stored 'system' turn) never reach the model as
    // system - anything that is not exactly 'user' is coach-side.
    .filter((h) => h.role === "user" || h.role === "assistant")
    .map((h) => ({
      role: (h.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: String(h.content ?? "").slice(0, perTurn),
    }));
  // Total budget: evict OLDEST turns first (recency is what routing and
  // reply coherence need), always keeping the two most recent turns.
  let total = capped.reduce((a, t) => a + t.content.length, 0);
  while (total > budget && capped.length > 2) {
    total -= capped[0].content.length;
    capped.shift();
  }
  return capped;
}

// The [current screen] JSON line cap: arrays slim to 5 entries with string
// items truncated, objects stringify to 200 chars, and the whole line can
// never exceed 900 chars. The loop composes this into buildLiveContext.
export function slimScreenActivity(activity: Record<string, unknown> | null | undefined): string {
  if (!activity || typeof activity !== "object") return "";
  const slim: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(activity)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      slim[k] = v.slice(0, 5).map((x) => {
        if (typeof x === "string") return x.slice(0, 120);
        if (x === null || x === undefined) return null;
        if (typeof x === "object") return JSON.stringify(x).slice(0, 200);
        return x;
      });
    } else if (typeof v === "string") {
      slim[k] = v.slice(0, 300);
    } else if (typeof v === "number" || typeof v === "boolean") {
      slim[k] = v;
    } else if (typeof v === "object") {
      slim[k] = JSON.stringify(v).slice(0, 200);
    }
  }
  const keys = Object.keys(slim);
  if (keys.length === 0) return "";
  // Line cap WITHOUT breaking JSON: drop whole entries (least recent first)
  // until the line fits; a single oversized entry gets its value stringified
  // and truncated so the model always parses a valid object.
  const LINE_CAP = 900;
  let keep = keys.length;
  let out = "";
  for (; keep >= 1; keep--) {
    const part: Record<string, unknown> = {};
    for (const k of keys.slice(0, keep)) part[k] = slim[k];
    out = JSON.stringify(part);
    if (out.length <= LINE_CAP) return out;
  }
  // One entry alone busts the cap: truncate its serialized value, shrinking
  // until the WRAPPED line fits (escaping can inflate the slice, so this is
  // iterative, never assumed).
  const k = keys[0];
  const raw = String(JSON.stringify(slim[k]));
  for (let size = raw.length; size > 20; size = Math.min(size - 100, Math.floor(size / 2))) {
    const attempt = JSON.stringify({ [k]: raw.slice(0, Math.max(20, size)) });
    if (attempt.length <= LINE_CAP) return attempt;
  }
  return JSON.stringify({ [k]: raw.slice(0, 20) });
}
