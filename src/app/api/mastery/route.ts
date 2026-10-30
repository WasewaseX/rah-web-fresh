import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeTag, masteryWeakTags } from "@/lib/mastery";

export const dynamic = "force-dynamic";

// Polish #7: the learner's word about their own weakness tags.
//
//   stance "notmine" - "this is not my weakness": the tag stops steering
//     exams and the coach. The measured rows stay on record (the graded
//     events happened) - only the STEERING obeys the learner.
//   stance "mine"    - "this IS my weakness": self-declared, pinned ahead of
//     measured danger tags. Always labeled as the learner's own claim, never
//     presented as measured evidence.
//   stance "clear"   - withdraw the override; the measured ledger steers again.
//
// Overriding a tag that has no ledger row yet is allowed: "mine" on a fresh
// tag is a self-declaration the stats have not caught up with.

const STANCES = new Set(["notmine", "mine", "clear"]);

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const stance = String((body as { stance?: unknown })?.stance ?? "");
  if (!STANCES.has(stance)) {
    return NextResponse.json({ error: "stance must be one of: notmine, mine, clear" }, { status: 400 });
  }
  const tag = normalizeTag(String((body as { tag?: unknown })?.tag ?? ""));
  if (!tag) {
    return NextResponse.json({ error: "a real tag is required" }, { status: 400 });
  }

  if (stance === "clear") {
    await db.tagOverride.deleteMany({ where: { tag } });
  } else {
    await db.tagOverride.upsert({
      where: { tag },
      create: { tag, stance },
      update: { stance },
    });
  }
  return NextResponse.json({ ok: true, tag, stance, weakTags: await masteryWeakTags() });
}
