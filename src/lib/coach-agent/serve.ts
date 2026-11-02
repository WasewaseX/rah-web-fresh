// THE canonical agent execution path. Audit 2026-11-03, P0-1: the repo carried
// three competing agent implementations (src/lib/skills/agent.ts behind
// /api/coach, src/lib/agent/run.ts behind /api/chat, and this loop behind
// /api/coach-agent) and the live tutor UI only reached one of them. Every
// chat surface now runs through THIS function - one loop, one history
// contract, one persistence contract. The duplicate stacks are deleted or
// reduced to explicitly deprecated aliases of this path.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildProfile, bumpDaily, touchStreak } from "@/lib/server";
import { getSessionUserWithRequest } from "@/lib/auth";
import { contentUserId } from "@/lib/scope";
import { awardXp } from "@/lib/arcade";
import { aiRateLimit } from "@/lib/rate-limit";
import { runAgent, type AgentEvent } from "./loop";
import { loadCoachHistory } from "./history";

export async function coachAgentPost(req: Request, opts: { deprecated?: boolean } = {}): Promise<Response> {
  // Abuse limit (audit P1-6): AI calls cost real money - 30/min per client IP.
  const rl = aiRateLimit(req);
  if (!rl.ok) return rl.response!;

  const user = await getSessionUserWithRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in to talk to your coach." }, { status: 401 });

  const { message, view, activity } = await req.json().catch(() => ({ message: "" }));
  const text = String(message ?? "").trim();
  if (!text) return NextResponse.json({ error: "message required" }, { status: 400 });

  // The learner's current screen (review question etc.) - sanity-capped so a
  // hostile or bloated client payload cannot blow up the prompt.
  let activitySafe: Record<string, unknown> | null = null;
  if (activity && typeof activity === "object" && !Array.isArray(activity)) {
    activitySafe = activity as Record<string, unknown>;
    try {
      if (JSON.stringify(activitySafe).length > 4000) activitySafe = null;
    } catch {
      activitySafe = null;
    }
  }

  const profile = await buildProfile();

  // History is loaded BEFORE the turn and the turn is persisted AFTER it - the
  // current message therefore enters the model exactly once (audit P0-2), and
  // coach envelopes are flattened to spoken text (audit P1) by loadCoachHistory.
  const flat = await loadCoachHistory(10);

  const encoder = new TextEncoder();
  // Task 111 (evidence hygiene): automated batteries MUST NOT pay coach
  // rewards or write chat history - a boot-regression run used to move the
  // learner ledger +8 xp / +1 streak silently (found 2026-11-01: xp 491->499
  // overnight, traced to this route's award block). Probes declare themselves
  // with the x-rah-probe header and get a full dry-run: real reply, zero
  // writes, zero rewards. Real learners are unaffected.
  const probe = req.headers.get("x-rah-probe") === "1";
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: AgentEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          // client gone; the loop still finishes and persists
        }
      };

      let turn: Awaited<ReturnType<typeof runAgent>>;
      try {
        // req.signal aborts when the learner hits Stop (client aborts the
        // fetch). The loop closes between steps and the stopped turn still
        // persists below, so history never loses what actually ran.
        turn = await runAgent(text, flat, profile, send, String(view ?? ""), activitySafe, req.signal);
      } catch (e) {
        send({ type: "error", label: "Agent crashed", detail: (e as Error).message });
        turn = {
          reply: `The agent hit an unexpected wall (${(e as Error).message}). One more try usually clears it.`,
          corrections: [],
          commands: [],
          steps: [],
          toolsUsed: [],
        };
      }

      // Persist the turn (user text + final agent answer) so the sidebar has memory.
      // Task 92-ter: STAMP the userId - this surface was the isolation-sweep
      // straggler (schema default 'me' while every other write resolved the
      // session user), which split the learner's history across two ids until
      // scripts/merge-legacy-user-rows.py re-unified it.
      if (!probe) {
        const chatUid = await contentUserId(req);
        await db.chatMsg.create({ data: { role: "user", content: text, userId: chatUid } });
        await db.chatMsg.create({
          data: {
            role: "coach",
            content: JSON.stringify({ skill: "agent", reply: turn.reply, corrections: turn.corrections, commands: turn.commands, toolsUsed: turn.toolsUsed }),
            userId: chatUid,
          },
        });

        // Same surface rewards as the old chat tab: talking to the coach counts.
        await bumpDaily("reviews");
        await awardXp(8, { chainHit: true });
        await touchStreak().catch(() => undefined);
      }

      send({ type: "done", stepsUsed: turn.steps.length });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Audit P0-1: /api/coach POST is an explicit deprecated alias.
      ...(opts.deprecated ? { "x-rah-deprecated": "canonical agent surface is /api/coach-agent (same loop)" } : {}),
    },
  });
}
