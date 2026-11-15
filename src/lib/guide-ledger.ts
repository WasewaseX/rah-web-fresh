// Task 140: the B1-C1 guide drill-request ledger's canonical logic.
//
// The ledger itself lives in one Setting row (key "guide:practice"), written
// by /api/guide-practice. This module owns its shape so the route, the coach
// tool and the batteries all parse it identically - the route re-exports
// parseDrillMap/coverageFor from here for its existing battery imports.
//
// HONEST LABELING (Task 136 doctrine): a ledger entry is a drill REQUEST
// (a Guide-panel click / coach handoff), never proof of a completed session.
// Everything built on this data must say "requested", never "mastered" or
// "completed".

import { GUIDE_LEVELS, checklistReadiness, type GuideLevelId } from "@/lib/b1c1-guide";

export interface DrillEntry {
  count: number;
  lastAt: string;
  /** Task 140: recent drill-request timestamps (ISO strings, newest last, capped). */
  recent?: string[];
}
export type DrillMap = Record<string, DrillEntry>;

export const KNOWN_IDS = new Set(
  GUIDE_LEVELS.flatMap((s) => [...s.grammar, ...s.vocabulary]).map((t) => t.id),
);
interface TopicRef { title: string; kind: string; level: string }
const TOPIC_BY_ID = new Map<string, TopicRef>(
  GUIDE_LEVELS.flatMap((s) => [
    ...s.grammar.map((t): [string, TopicRef] => [t.id, { title: t.title, kind: "grammar", level: s.level }]),
    ...s.vocabulary.map((t): [string, TopicRef] => [t.id, { title: t.title, kind: "vocabulary", level: s.level }]),
  ]),
);
export const RECENT_CAP = 20;
const TS_MAX_CHARS = 30;

function cleanRecent(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    .map((x) => x.slice(0, TS_MAX_CHARS));
  return out.length > 0 ? out.slice(-RECENT_CAP) : undefined;
}

// Exported for batteries: the ledger parser drops ids the guide no longer
// has and anything without a positive integer count. Behavior for the
// Task 136 fields (count/lastAt) is unchanged; `recent` is preserved when
// present and valid, absent otherwise.
export function parseDrillMap(raw: unknown): DrillMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: DrillMap = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!KNOWN_IDS.has(id)) continue; // silently drop ids the guide no longer has
    if (!v || typeof v !== "object") continue;
    const e = v as Record<string, unknown>;
    const count = typeof e.count === "number" && Number.isInteger(e.count) && e.count > 0 ? e.count : null;
    if (count === null) continue;
    const entry: DrillEntry = { count, lastAt: typeof e.lastAt === "string" ? e.lastAt.slice(0, TS_MAX_CHARS) : "" };
    const recent = cleanRecent(e.recent);
    if (recent) entry.recent = recent;
    out[id] = entry;
  }
  return out;
}

// Coverage per level: how many of the level's real grammar/vocabulary topics
// have at least one drill request. Exported for batteries.
export function coverageFor(drills: DrillMap): Record<string, { grammar: string; vocabulary: string }> {
  const out: Record<string, { grammar: string; vocabulary: string }> = {};
  for (const s of GUIDE_LEVELS) {
    const g = s.grammar.filter((t) => (drills[t.id]?.count ?? 0) > 0).length;
    const v = s.vocabulary.filter((t) => (drills[t.id]?.count ?? 0) > 0).length;
    out[s.level] = { grammar: `${g}/${s.grammar.length}`, vocabulary: `${v}/${s.vocabulary.length}` };
  }
  return out;
}

// ---------- UI summary for the Guide panel (Task 141) ----------

export interface WeekUi {
  windowDays: number;
  events: number;
  topicsTouched: number;
  perLevel: Record<string, number>;
}

// Compact per-level week view for /api/guide-practice's GET/POST payloads and
// the Guide panel chip. Labeling stays at the endpoint/UI layer ("requests").
export function weekForUi(rep: ProgressReport): WeekUi {
  const perLevel: Record<string, number> = {};
  for (const p of rep.perLevel) perLevel[p.level] = p.events;
  return { windowDays: rep.windowDays, events: rep.drillEvents, topicsTouched: rep.topicsTouched, perLevel };
}

// ---------- Task 143: the one-click weekly review ask ----------
// The Progress view hands the coach this exact ask. It MUST keep matching the
// loop's isProgressAsk detector (pinned in the battery) so the enforcement
// seam fires if the coach ever tries to answer it without progress_review.
export const WEEKLY_REVIEW_ASK =
  "How did my week go? Give me an honest weekly review: my drill requests, checklist readiness and review stats.";

const DAY_MS = 86_400_000;
// Small future slack so a just-written timestamp on a clock slightly ahead of
// the caller's `nowMs` still lands inside its own window.
const FUTURE_SLACK_MS = 5 * 60_000;

// ---------- Task 145: stale-topic detection ----------
// A drilled topic whose LAST request is older than minAgeDays is "rusty":
// the ledger records requests, not mastery, so staleness is an honest hint
// to re-drill, never a verdict that the topic was learned and lost.

export interface StaleTopic {
  id: string;
  title: string;
  kind: string;
  level: string;
  daysAgo: number;
}

function lastRequestMs(entry: DrillEntry): number | null {
  const stamps = entry.recent && entry.recent.length > 0 ? entry.recent : entry.lastAt ? [entry.lastAt] : [];
  let newest: number | null = null;
  for (const s of stamps) {
    const ms = Date.parse(s);
    if (Number.isFinite(ms) && (newest === null || ms > newest)) newest = ms;
  }
  return newest;
}

export function staleTopics(
  drills: DrillMap,
  nowMs: number,
  minAgeDays = 14,
  cap = 8,
): StaleTopic[] {
  const minAgeMs = minAgeDays * DAY_MS;
  const out: StaleTopic[] = [];
  for (const [id, entry] of Object.entries(drills)) {
    const last = lastRequestMs(entry);
    if (last === null) continue;
    const age = nowMs - last;
    if (age >= minAgeMs) {
      const t = TOPIC_BY_ID.get(id);
      out.push({
        id,
        title: t?.title ?? id,
        kind: t?.kind ?? "unknown",
        level: t?.level ?? "unknown",
        daysAgo: Math.floor(age / DAY_MS),
      });
    }
  }
  return out.sort((a, b) => b.daysAgo - a.daysAgo).slice(0, cap);
}

export interface ProgressInput {
  drills: unknown; // raw JSON from the Setting row - run through parseDrillMap
  ratings?: Record<string, unknown>; // level -> number[] (raw JSON ok)
  nowMs?: number;
  windowDays?: number; // default 7, clamped 1..30
}

export interface LevelProgress {
  level: string;
  grammarCovered: number;
  grammarTotal: number;
  vocabCovered: number;
  vocabTotal: number;
  events: number; // drill-request events inside the window
  readiness: { rated: number; total: number; easy: number; mid: number; hard: number; verdict: string } | null;
}

export interface ProgressReport {
  windowDays: number;
  drillEvents: number; // total in-window drill REQUEST events
  topicsTouched: number; // distinct topics with in-window events
  totalRequests: number; // ledger-wide sum of counts (all time)
  legacyEntries: number; // entries without per-event history (counted via lastAt fallback)
  latest: { id: string; title: string; kind: string; level: string; at: string } | null;
  perLevel: LevelProgress[];
  summary: string;
}

function parseTs(s: string): number | null {
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

// In-window event extraction. Entries WITH `recent` history count each stored
// timestamp; entries WITHOUT it (written before Task 140) fall back to one
// event at lastAt - honestly flagged in the report, since such an entry may
// represent more requests than we can see.
function inWindowEvents(entry: DrillEntry, startMs: number, endMs: number): { events: number; legacy: boolean } {
  const stamps = entry.recent && entry.recent.length > 0 ? entry.recent : entry.lastAt ? [entry.lastAt] : [];
  const legacy = !(entry.recent && entry.recent.length > 0) && stamps.length > 0;
  let events = 0;
  for (const s of stamps) {
    const ms = parseTs(s);
    if (ms !== null && ms >= startMs && ms <= endMs) events += 1;
  }
  return { events, legacy };
}

export function weeklyProgress(input: ProgressInput): ProgressReport {
  const windowDays = Math.max(1, Math.min(30, Math.round(input.windowDays ?? 7)));
  const nowMs = typeof input.nowMs === "number" && Number.isFinite(input.nowMs) ? input.nowMs : Date.now();
  const startMs = nowMs - windowDays * DAY_MS;
  const endMs = nowMs + FUTURE_SLACK_MS;

  const drills = parseDrillMap(input.drills);

  let drillEvents = 0;
  let legacyEntries = 0;
  let totalRequests = 0;
  const touchedIds = new Set<string>();
  let latest: ProgressReport["latest"] = null;
  let latestMs = -1;

  for (const [id, entry] of Object.entries(drills)) {
    totalRequests += entry.count;
    const { events, legacy } = inWindowEvents(entry, startMs, endMs);
    if (legacy) legacyEntries += 1;
    if (events > 0) {
      drillEvents += events;
      touchedIds.add(id);
    }
    const stamps = entry.recent && entry.recent.length > 0 ? entry.recent : entry.lastAt ? [entry.lastAt] : [];
    for (const s of stamps) {
      const ms = parseTs(s);
      if (ms !== null && ms > latestMs && ms <= endMs) {
        latestMs = ms;
        const t = TOPIC_BY_ID.get(id);
        latest = t
          ? { id, title: t.title, kind: t.kind, level: t.level, at: s }
          : { id, title: id, kind: "unknown", level: "unknown", at: s };
      }
    }
  }

  const perLevel: LevelProgress[] = [];
  for (const s of GUIDE_LEVELS) {
    const g = s.grammar.filter((t) => (drills[t.id]?.count ?? 0) > 0).length;
    const v = s.vocabulary.filter((t) => (drills[t.id]?.count ?? 0) > 0).length;
    let events = 0;
    for (const t of [...s.grammar, ...s.vocabulary]) {
      const entry = drills[t.id];
      if (entry) events += inWindowEvents(entry, startMs, endMs).events;
    }
    let readiness: LevelProgress["readiness"] = null;
    const rawRatings = input.ratings?.[s.level];
    const arr = Array.isArray(rawRatings) ? rawRatings : null;
    if (arr && arr.every((n) => typeof n === "number")) {
      try {
        readiness = checklistReadiness(s.level as GuideLevelId, arr as number[]);
      } catch {
        readiness = null;
      }
    }
    perLevel.push({
      level: s.level,
      grammarCovered: g,
      grammarTotal: s.grammar.length,
      vocabCovered: v,
      vocabTotal: s.vocabulary.length,
      events,
      readiness,
    });
  }

  const levelLine = perLevel
    .map((p) => `${p.level} ${p.events} request(s), coverage ${p.grammarCovered}/${p.grammarTotal}g ${p.vocabCovered}/${p.vocabTotal}v`)
    .join("; ");
  const latestLine = latest ? ` Latest request: "${latest.title}" (${latest.level} ${latest.kind}) at ${latest.at}.` : " No drill requests recorded yet.";
  const legacyLine = legacyEntries > 0 ? ` ${legacyEntries} older ledger entr${legacyEntries === 1 ? "y has" : "ies have"} no per-event history (pre-Task 140), so their in-window count uses the last-request date only.` : "";
  const summary =
    `Past ${windowDays} day(s): ${drillEvents} drill request(s) across ${touchedIds.size} topic(s). ${levelLine}.${latestLine}${legacyLine} ` +
    `These are REQUESTS (guide-panel clicks), not completed sessions.`;

  return {
    windowDays,
    drillEvents,
    topicsTouched: touchedIds.size,
    totalRequests,
    legacyEntries,
    latest,
    perLevel,
    summary,
  };
}
