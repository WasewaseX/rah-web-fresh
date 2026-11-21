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
// GET  -> { ok, drills: { [topicId]: { count, lastAt, recent? } }, coverage: { level: { grammar, vocabulary } }, week: { windowDays, events, topicsTouched, perLevel } }
// POST { topicId } -> validates the id against the real guide map, upserts
//                     the counter (Setting key guide:practice, one JSON map).
// Probe doctrine (Task 111/122 class): x-rah-probe: 1 validates and reports
// what WOULD be written but persists NOTHING (dry-run, x-rah-probe-dry: 1).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLearner } from "@/lib/server";
import {
  parseDrillMap,
  coverageFor,
  weekForUi,
  KNOWN_IDS,
  RECENT_CAP,
  weeklyProgress,
  type DrillMap,
} from "@/lib/guide-ledger";

// Task 140: the ledger's canonical parser/coverage live in @/lib/guide-ledger
// (shared with the coach's progress_review tool). Re-exported so the existing
// battery imports from this route keep working.
export { parseDrillMap, coverageFor };

export const dynamic = "force-dynamic";

const KEY = "guide:practice";

export async function GET() {
  await getLearner();
  const row = await db.setting.findUnique({ where: { key: KEY } });
  let drills: DrillMap = {};
  if (row) {
    try {
      drills = parseDrillMap(JSON.parse(row.value));
    } catch {
      // stored drills were not valid JSON - start from an empty map
    }
  }
  // Task 141: the panel's "this week" chip rides the same response (7-day
  // window, drill REQUESTS only).
  const week = weekForUi(weeklyProgress({ drills, nowMs: Date.now(), windowDays: 7 }));
  return NextResponse.json({ ok: true, drills, coverage: coverageFor(drills), week });
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
    } catch {
      // stored drills were not valid JSON - treat as no history for this topic
    }
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
  // Task 140: keep per-event history (recent) so the coach's progress_review
  // can count in-window drill REQUESTS. parseDrillMap already sanitized the
  // previous entries; the cap keeps the row bounded.
  const ts = new Date().toISOString();
  const prevRecent = drills[topicId]?.recent ?? [];
  drills[topicId] = {
    count: nextCount,
    lastAt: ts,
    recent: [...prevRecent, ts].slice(-RECENT_CAP),
  };
  await db.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(drills) },
    update: { value: JSON.stringify(drills) },
  });
  const week = weekForUi(weeklyProgress({ drills, nowMs: Date.now(), windowDays: 7 }));
  return NextResponse.json({ ok: true, topicId, count: nextCount, coverage: coverageFor(drills), week });
}
