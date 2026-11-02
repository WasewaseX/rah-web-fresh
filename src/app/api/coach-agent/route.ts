// The agent endpoint. POST { message } -> an SSE stream of agent events:
// thought / tool / observe / final - the sidebar renders them live as they happen.
// History persists in the same ChatMsg table the coach always used, so the
// sidebar remembers across reloads. Auth required.
//
// The execution logic lives in coach-agent/serve.ts - the ONE canonical agent
// path (audit 2026-11-03 P0-1). This file is just the URL.

import { coachAgentPost } from "@/lib/coach-agent/serve";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(req: Request) {
  return coachAgentPost(req);
}
