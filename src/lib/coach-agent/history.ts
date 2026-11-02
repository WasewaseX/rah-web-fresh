// Shared coach-history loading. Every agent surface reads the SAME normalized
// history: user rows as-is, coach rows flattened from their stored envelope
// JSON down to the spoken text.
//
// Audit 2026-11-03 (P1): raw serialized coach envelopes used to be fed back
// into the model's context as assistant history - the model saw machinery
// JSON ("skill":"agent", corrections arrays, commands) instead of what the
// learner actually read, and imitated it. Flattening happens here, once.
//
// Current-message duplication (the other audit finding) is structurally
// impossible for every caller of loadCoachHistory: they all load history
// BEFORE persisting the new turn, and append the current message exactly once
// inside the agent loop.

import { db } from "@/lib/db";

// Stored coach envelopes -> readable conversational text. Handles the live
// agent envelope ({skill:"agent", reply}), the runCoach registry envelopes
// ({skill:..., reply}), the legacy kind-envelopes ({kind:"chat", reply}), and
// plain text rows. Never throws.
export function flattenCoach(content: string): string {
  try {
    const p = JSON.parse(content) as { reply?: unknown };
    if (typeof p.reply === "string" && p.reply.trim()) return p.reply.slice(0, 900);
  } catch {
    // plain text row: use as-is below
  }
  return content.slice(0, 900);
}

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export async function loadCoachHistory(
  take = 12,
  where?: Record<string, unknown>,
): Promise<HistoryTurn[]> {
  const rows = await db.chatMsg.findMany({
    where: where as never,
    orderBy: { id: "desc" },
    take,
  });
  return rows
    .reverse()
    .map((h) => ({
      role: (h.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: h.role === "user" ? h.content : flattenCoach(h.content),
    }));
}
