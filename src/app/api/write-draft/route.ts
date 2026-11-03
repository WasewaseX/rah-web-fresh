import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentUserId } from "@/lib/scope";

export const dynamic = "force-dynamic";

// Cross-device writing drafts (ROADMAP §3.3): the Task 94 autosave only ever
// lived in one browser's localStorage - a second device, or a wiped browser,
// started from nothing. This route is the SERVER half of the same honest
// contract: the draft is a DRAFT cache, never a submission ledger. The client
// resolves local-vs-server with last-write-wins on `at` (pure seam in
// lib/write-draft.ts, battery-pinned); this route just stores and returns.
//
// Storage: one Setting row per learner (`write-draft:<userId>`), the same
// minimal KV the feature layer already uses - no new table, no migration.
//
// Probe doctrine (Task 111/122 class): x-rah-probe: 1 reads fine, writes are
// refused (204 no-op) so batteries never touch the learner's draft.

const KEY = (userId: string) => `write-draft:${userId}`;
const MAX_TEXT = 12_000; // same ceiling as /api/writing

interface DraftBody {
  text: string;
  goalSel: string;
  revisingId: number | null;
  at: number;
}

function sanitize(raw: unknown): DraftBody | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<DraftBody>;
  if (typeof d.text !== "string" || !d.text.trim()) return null;
  return {
    text: d.text.slice(0, MAX_TEXT),
    goalSel: typeof d.goalSel === "string" ? d.goalSel.slice(0, 40) : "",
    revisingId: typeof d.revisingId === "number" && Number.isFinite(d.revisingId) && d.revisingId >= 0 ? d.revisingId : null,
    at: typeof d.at === "number" && Number.isFinite(d.at) && d.at > 0 ? d.at : 0,
  };
}

export async function GET(req: Request) {
  const userId = await contentUserId(req);
  const row = await db.setting.findUnique({ where: { key: KEY(userId) } });
  if (!row) return NextResponse.json({ draft: null });
  try {
    return NextResponse.json({ draft: sanitize(JSON.parse(row.value)) });
  } catch {
    return NextResponse.json({ draft: null });
  }
}

export async function PUT(req: Request) {
  if (req.headers.get("x-rah-probe") === "1") {
    return new NextResponse(null, { status: 204, headers: { "x-rah-probe-dry": "1" } });
  }
  const userId = await contentUserId(req);
  const body = await req.json().catch(() => null);
  const draft = sanitize(body);
  if (!draft) return NextResponse.json({ ok: false, error: "invalid draft" }, { status: 400 });
  await db.setting.upsert({
    where: { key: KEY(userId) },
    create: { key: KEY(userId), value: JSON.stringify(draft) },
    update: { value: JSON.stringify(draft) },
  });
  return NextResponse.json({ ok: true, at: draft.at });
}

export async function DELETE(req: Request) {
  if (req.headers.get("x-rah-probe") === "1") {
    return new NextResponse(null, { status: 204, headers: { "x-rah-probe-dry": "1" } });
  }
  const userId = await contentUserId(req);
  await db.setting.deleteMany({ where: { key: KEY(userId) } });
  return NextResponse.json({ ok: true });
}
