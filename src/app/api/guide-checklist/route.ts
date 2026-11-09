// /api/guide-checklist - the B1-C1 guide map's self-rating checklist (Task 131).
//
// The book's own method: rate every checklist item with the 3-box scale
// (easy / some difficulty / difficult) to "work out your current level".
// Ratings persist as Setting rows (keys guide:checklist:B1|B2|C1, one JSON
// array of 0|1|2 aligned with the level's checklist items) and surface in:
//   - the Guide panel (interactive rating + readiness verdict)
//   - read_state (the coach sees the real readiness signal)
//
// GET  -> { ok, levels: { B1: { ratings, readiness }, B2: ..., C1: ... } }
// POST { level, ratings: number[10] } -> upsert + readiness
// Probe doctrine (Task 111/122 class): x-rah-probe: 1 validates and computes
// readiness but writes NOTHING (dry-run, x-rah-probe-dry: 1) and needs no
// session - probes never persist state.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLearner } from "@/lib/server";
import { GUIDE_LEVELS, guideSection, checklistReadiness, type ChecklistReadiness } from "@/lib/b1c1-guide";

export const dynamic = "force-dynamic";

type Rating = number | null;

const LEVEL_IDS = GUIDE_LEVELS.map((s) => s.level);
const keyFor = (level: string) => `guide:checklist:${level}`;

function parseRatings(raw: unknown, length: number): Rating[] | null {
  if (!Array.isArray(raw) || raw.length !== length) return null;
  return raw.map((n) => (typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 2 ? n : null));
}

export async function GET() {
  await getLearner();
  const rows = await db.setting.findMany({ where: { key: { startsWith: "guide:checklist:" } } });
  const levels: Record<string, { ratings: Rating[] | null; readiness: ChecklistReadiness | null }> = {};
  for (const level of LEVEL_IDS) {
    const items = guideSection(level).checklist.items;
    const row = rows.find((r) => r.key === keyFor(level));
    let ratings: Rating[] | null = null;
    if (row) {
      try {
        const parsed: unknown = JSON.parse(row.value);
        if (Array.isArray(parsed) && parsed.length === items.length) {
          ratings = parseRatings(parsed, items.length);
        }
      } catch {}
    }
    const complete = ratings !== null && ratings.every((r) => r !== null);
    levels[level] = { ratings, readiness: complete ? checklistReadiness(level, ratings as number[]) : null };
  }
  return NextResponse.json({ ok: true, levels });
}

export async function POST(req: Request) {
  const probe = req.headers.get("x-rah-probe") === "1";
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const level = String(body.level ?? "").trim().toUpperCase();
  if (!LEVEL_IDS.includes(level as never)) {
    return NextResponse.json({ error: "level must be B1, B2 or C1" }, { status: 400 });
  }
  const items = guideSection(level as "B1" | "B2" | "C1").checklist.items;
  const ratings = parseRatings(body.ratings, items.length);
  if (ratings === null || ratings.some((r) => r === null)) {
    return NextResponse.json({ error: `ratings must be ${items.length} integers, each 0 (easy), 1 (some difficulty) or 2 (difficult)` }, { status: 400 });
  }
  const readiness = checklistReadiness(level as "B1" | "B2" | "C1", ratings as number[]);
  if (probe) {
    return NextResponse.json({ ok: true, dry: true, level, readiness }, { headers: { "x-rah-probe-dry": "1" } });
  }
  await getLearner();
  await db.setting.upsert({
    where: { key: keyFor(level) },
    create: { key: keyFor(level), value: JSON.stringify(ratings) },
    update: { value: JSON.stringify(ratings) },
  });
  return NextResponse.json({ ok: true, level, ratings, readiness });
}
