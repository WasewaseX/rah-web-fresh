// Turn-object parsing and repair. The model's #1 failure mode is a broken
// turn object, so everything here is defensive salvage - a tool call must
// NEVER leak raw JSON to the learner.

import type { AgentCommand } from "./loop-types";

export interface TurnDecision {
  thought?: string;
  tool?: string;
  args?: Record<string, unknown>;
  final?: boolean;
  reply?: string;
  corrections?: { wrong: string; right: string; trap?: string }[];
  commands?: AgentCommand[];
}

function tryParse(s: string): TurnDecision | null {
  try {
    const v = JSON.parse(s) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as TurnDecision) : null;
  } catch {
    return null;
  }
}

// String-aware scanner: finds the first COMPLETE top-level object, or repairs
// trailing-unbalanced braces by closing the open stack. Handles quotes/escapes.
function salvageObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start === -1) return null;
  let inStr = false;
  let esc = false;
  const stack: string[] = [];
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" || c === "]") {
      const open = stack.pop();
      if (!open || (open === "{" && c !== "}") || (open === "[" && c !== "]")) return null; // mismatched: unrepairable
      if (stack.length === 0) return s.slice(start, i + 1); // first complete object
    }
  }
  if (inStr) return null; // dangling string: unrepairable
  if (stack.length && stack[0] !== "{") return null;
  let out = s.slice(start);
  while (stack.length) out += stack.pop() === "{" ? "}" : "]"; // close what the model left open
  return out;
}

// Balanced-scan salvage for "args": { ... } even when the envelope is mangled.
function salvageArgs(s: string): Record<string, unknown> | null {
  const m = s.match(/"args"\s*:\s*/);
  if (!m || m.index === undefined) return null;
  const obj = salvageObject(s.slice(m.index + m[0].length));
  if (!obj) return null;
  const parsed = tryParse(obj);
  return (parsed?.args as Record<string, unknown>) ?? null;
}

function salvageString(s: string, key: string): string | null {
  const m = s.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "s"));
  if (!m) return null;
  try {
    return JSON.parse(`"${m[1]}"`) as string;
  } catch {
    return m[1];
  }
}

const looksLikeJson = (s: string) => /^\s*\{[\s\S]*"(thought|tool|final|reply|args)"[\s\S]*\}?\s*$/.test(s);

// Exported for the drive battery: the repair logic is exactly what used to
// leak raw JSON into the learner's chat, so the battery pins it.
export function extractTurn(raw: string): { turn: TurnDecision; kind: "json" | "prose" | "junk" } {
  const cleaned = raw.trim().replace(/```(?:json)?/g, "").trim();
  if (!cleaned) return { turn: {}, kind: "junk" };

  const start = cleaned.indexOf("{");
  if (start === -1) {
    // Prose without any braces: an acceptable final answer.
    return { turn: { final: true, reply: cleaned.slice(0, 2000), corrections: [], commands: [] }, kind: "prose" };
  }

  const body = cleaned.slice(start);
  let turn = tryParse(body) ?? tryParse(salvageObject(body) ?? "");
  if (turn) return { turn, kind: "json" };

  // Mangled JSON: salvage the pieces. A tool call must NEVER leak to the learner.
  const toolM = body.match(/"tool"\s*:\s*"([a-zA-Z_]+)"/);
  if (toolM) {
    const args = salvageArgs(body) ?? {};
    return { turn: { thought: salvageString(body, "thought") ?? "", tool: toolM[1], args }, kind: "json" };
  }
  const reply = salvageString(body, "reply");
  if (reply) {
    return { turn: { final: true, reply, corrections: [], commands: [] }, kind: "json" };
  }
  // JSON-shaped garbage (e.g. just a thought): junk - the loop nudges the model
  // instead of showing the learner a wall of braces.
  return { turn: {}, kind: looksLikeJson(body) ? "junk" : "prose" };
}

// Last line of defense: a final reply must never BE a turn object.
export function sanitizeReply(reply: string, fallback: string): string {
  const r = reply.trim();
  if (!r) return fallback;
  if (r.startsWith("{") && /"(thought|tool|final|args|reply)"/.test(r)) {
    const inner = extractTurn(r);
    const unwrapped = inner.turn.reply?.trim();
    return unwrapped && !unwrapped.startsWith("{") ? unwrapped : fallback;
  }
  return r.slice(0, 4000);
}
