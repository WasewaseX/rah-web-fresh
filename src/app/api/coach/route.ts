import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { coachAgentPost } from "@/lib/coach-agent/serve";
import { contentUserId } from "@/lib/scope";
import { isLegacyChat, type Envelope } from "@/lib/skills/types";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

// AUDIT 2026-11-03, P0-1 - resolved. This endpoint used to run a SECOND,
// competing agent implementation (src/lib/skills/agent.ts: regex router +
// duplicated history + envelopes-in-history). That stack is deleted. POST now
// executes the ONE canonical loop (coach-agent/serve.ts) - byte-for-byte the
// same agent /api/coach-agent serves - and announces its deprecated status in
// a response header. No client in the app calls this URL any more; it exists
// so external bookmarks and probes keep working against the real agent.

// History: every row normalized so the UI renders one shape. Scoped to the
// session user (audit P0 isolation sweep straggler - GET/DELETE used to be
// unscoped while /api/chat scoped both).
export async function GET(req: Request) {
  const uid = await contentUserId(req).catch(() => "me");
  const rows = await db.chatMsg.findMany({ where: { userId: uid }, orderBy: { id: "asc" }, take: 200 });
  const messages = rows.map((r) => {
    if (r.role === "user") return { id: r.id, role: "user", at: r.at, text: r.content };
    let env: Envelope | null = null;
    try {
      const j = JSON.parse(r.content) as unknown;
      env = isLegacyChat(j)
        ? { kind: "chat", reply: j.reply, corrections: j.corrections ?? [], fa_note: j.fa_note ?? "", praised: false }
        : (j as Envelope);
    } catch {
      env = { kind: "chat", reply: r.content.slice(0, 600), corrections: [], fa_note: "", praised: false };
    }
    return { id: r.id, role: "coach", at: r.at, envelope: env };
  });
  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  return coachAgentPost(req, { deprecated: true });
}

export async function DELETE(req: Request) {
  const uid = await contentUserId(req).catch(() => "me");
  await db.chatMsg.deleteMany({ where: { userId: uid } });
  return NextResponse.json({ ok: true });
}
