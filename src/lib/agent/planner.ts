// Routing: slash commands first (deterministic), trigger table second, and
// only when both miss does the LLM planner pick a skill. The planner sees the
// catalog and returns an id; anything invalid falls back to chat.

import { aiJson } from "@/lib/ai";
import type { SkillDef } from "./types";
import { REGISTRY, commandMap, getSkill, skillCatalog } from "./registry";
import { compressHistory } from "@/lib/coach-agent/context";

export interface RouteDecision {
  def: SkillDef;
  args: string;
  via: "slash" | "trigger" | "planner";
}

export function parseSlash(text: string): { cmd: string; args: string } | null {
  const m = text.match(/^\/([a-z][a-z0-9-]*)(?:\s+([\s\S]+))?$/i);
  if (!m) return null;
  return { cmd: m[1].toLowerCase(), args: (m[2] ?? "").trim() };
}

export function routeByCommand(cmd: string, args: string): RouteDecision | null {
  const def = commandMap().get(cmd);
  return def ? { def, args, via: "slash" } : null;
}

export function routeByTrigger(text: string): RouteDecision | null {
  const t = text.toLowerCase();
  for (const def of REGISTRY) {
    for (const re of def.triggers) {
      if (re.test(t)) {
        // Trigger captures the remainder as args when the skill wants them.
        return { def, args: text, via: "trigger" };
      }
    }
  }
  return null;
}

const PLANNER_SYSTEM = `You route messages inside an English-learning app. Pick the ONE best skill id for the message.

Skills:
${skillCatalog()}

Rules: "chat" is the default for conversation, questions, and anything no other skill covers. Prefer a specific skill when the message clearly asks for its capability. Greetings, thanks, farewells, one-word answers, and small talk ALWAYS get "chat". Route on THIS message only: never pick a teaching skill because earlier history discussed its topic. If two skills are equally plausible or you are not sure, pick "chat" and say so with a low confidence - chat clarifies before acting. Output ONE JSON object, nothing else: {"skill": "id", "args": "anything the skill should know, or empty string", "confidence": 0.0 to 1.0}. No em dashes.`;

export async function routeByPlanner(
  text: string,
  history: { role: string; content: string }[],
): Promise<RouteDecision> {
  try {
    // Audit P1: the planner used to see only 4 history turns truncated to 300
    // chars - enough to misread an ongoing conversation, not enough to route
    // it. It now draws from the SHARED bounded seam (8 turns x 400, 3600
    // total, oldest evicted first) - same window shape as the coach loop, one
    // implementation, no drift.
    const out = await aiJson<{ skill?: string; args?: string; confidence?: number }>(
      PLANNER_SYSTEM,
      [
        ...compressHistory(history),
        { role: "user", content: text },
      ],
      () => ({}),
      {
        // Audit P1 (typed output validation): a planner reply that is not a
        // well-shaped {skill, args?, confidence?} object must burn retry
        // budget, not silently route to getSkill("undefined") -> chat.
        validate: (o) => {
          if (!o || typeof o !== "object" || Array.isArray(o)) return "planner output must be a JSON object";
          const v = o as { skill?: unknown; args?: unknown; confidence?: unknown };
          if (typeof v.skill !== "string" || !v.skill.trim()) return "skill must be a non-empty string id";
          if (v.args !== undefined && v.args !== null && typeof v.args !== "string") return "args must be a string when present";
          if (v.confidence !== undefined && v.confidence !== null && typeof v.confidence !== "number") return "confidence must be a number when present";
          return null;
        },
      },
    );
    const id = String(out.skill ?? "").trim();
    const def = getSkill(id);
    // Confidence threshold (audit 4): an ambiguous plan must not confidently
    // launch the wrong lesson. Below 0.5 the turn goes to chat, which can
    // ask one short clarifying question before any lesson starts.
    const confidence = Number(out.confidence ?? 1);
    if (def && (confidence >= 0.5 || def.id === "chat")) {
      return { def, args: String(out.args ?? ""), via: "planner" };
    }
  } catch {
    // planner offline: chat always answers
  }
  return { def: getSkill("chat")!, args: "", via: "planner" };
}
