// /api/guide-practice - the B1-C1 guide map's drill-request ledger (Task 136).
//
// Task 133 made every one of the book's 68 topics one click away from a live
// coach drill. This endpoint records those clicks so the loop closes:
//   checklist rating -> drill request -> coverage the coach can see.
//
// HONEST LABELING: a click is a REQUEST for a drill, not proof a drill
// session was completed. Everything that surfaces this data (the Guide
// panel's "drilled N times" chips, read_state's coverage line) says
// "requested" / "drill requests", never "mastered" or "completed".
//
// GET  -> { ok, drills: { [topicId]: { count, lastAt } }, coverage: { level: { grammar, vocabulary } } }
// POST { topicId } -> validates the id against the real guide map, upserts
//                     the counter (Setting key guide:practice, one JSON map).
// Probe doctrine (Task 111/122 class): x-rah-probe: 1 validates and reports
// what WOULD be written but persists NOTHING (dry-run, x-rah-probe-dry: 1).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLearner } from "@/lib/server";
import { GUIDE_LEVELS, guideAllTopics } from "@/lib/b1c1-guide";

export const dynamic = "force-dynamic";

const KEY = "guide:practice";

interface DrillEntry {
  count: number;
  lastAt: string;
}
type DrillMap = Record<string, DrillEntry>;

const KNOWN_IDS = new Set(guideAllTopics().map((t) => t.id));

// Exported for batteries: the ledger parser drops ids the guide no longer
// has and anything without a positive integer count.
export function parseDrillMap(raw: unknown): DrillMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: DrillMap = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!KNOWN_IDS.has(id)) continue; // silently drop ids the guide no longer has
    if (!v || typeof v !== "object") continue;
    const e = v as Record<string, unknown>;
    const count = typeof e.count === "number" && Number.isInteger(e.count) && e.count > 0 ? e.count : null;
    if (count === null) continue;
    out[id] = { count, lastAt: typeof e.lastAt === "string" ? e.lastAt.slice(0, 30) : "" };
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

export async function GET() {
  await getLearner();
  const row = await db.setting.findUnique({ where: { key: KEY } });
  let drills: DrillMap = {};
  if (row) {
    try {
      drills = parseDrillMap(JSON.parse(row.value));
    } catch {}
  }
  return NextResponse.json({ ok: true, drills, coverage: coverageFor(drills) });
}

export async function POST(req: Request) {
  const probe = req.headers.get("x-rah-probe") === "1";
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const topicId = String(body.topicId ?? "").trim();
  if (!KNOWN_IDS.has(topicId)) {
    return NextResponse.json({ error: "unknown topicId - must be an id from the embedded guide map" }, { status: 400 });
  }
  const row = probe ? null : await db.setting.findUnique({ where: { key: KEY } });
  let drills: DrillMap = {};
  if (row) {
    try {
      drills = parseDrillMap(JSON.parse(row.value));
    } catch {}
  }
  const prev = drills[topicId]?.count ?? 0;
  const nextCount = prev + 1;
  if (probe) {
    return NextResponse.json(
      { ok: true, dry: true, topicId, wouldWrite: { count: nextCount } },
      { headers: { "x-rah-probe-dry": "1" } },
    );
  }
  await getLearner();
  drills[topicId] = { count: nextCount, lastAt: new Date().toISOString() };
  await db.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(drills) },
    update: { value: JSON.stringify(drills) },
  });
  return NextResponse.json({ ok: true, topicId, count: nextCount, coverage: coverageFor(drills) });
}
