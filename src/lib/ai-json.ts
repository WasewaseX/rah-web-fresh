// The JSON envelope machinery: parse engine replies into objects and retry
// model calls until one returns a complete, parseable envelope.

import ZAI from "z-ai-web-dev-sdk";

function cleanEmDash(s: string): string {
  return s.replace(/\s*[—–]\s*/g, ", ").replace(/[—–]/g, ",");
}

// Exported (Task 102): API routes parse engine replies directly with this.
// Returns null on unparseable input instead of throwing - callers branch on
// `if (!parsed)` and surface an honest fallback envelope. Typed `any` on
// purpose: consumers destructure the envelope shape their route owns.
export function extractJson(raw: string): any {
  try {
    const cleaned = cleanEmDash(raw.trim());
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    const body = fence ? fence[1] : cleaned;
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start === -1) return null;
    const candidate = end > start ? body.slice(start, end + 1) : body.slice(start);
    try {
      return JSON.parse(candidate);
    } catch {
      // Truncated output: close open strings and brackets so partial replies survive.
      return JSON.parse(repairJson(candidate));
    }
  } catch {
    return null;
  }
}

function repairJson(body: string): string {
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (const ch of body) {
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") stack.pop();
  }
  let out = body;
  if (inStr) out += '"';
  out = out.replace(/,\s*$/, "").replace(/:\s*$/, ': ""').replace(/,\s*(?=[}\]])/g, "");
  while (stack.length) {
    const open = stack.pop();
    out += open === "{" ? "}" : "]";
  }
  return out;
}

const CONTRACT_REMINDER =
  'Your next message must be ONLY the JSON object described in the system prompt. No prose, no markdown, no preamble: start with { and end with }.';

export interface CompleteOpts {
  deep?: boolean;
  temperature?: number;
  // Extended reasoning for jobs that earn it (deep scans, exam building).
  // Both spellings accepted: the tutor libs pass `thinking`, skills pass `think`.
  thinking?: boolean;
  think?: boolean;
  // Retry budget override (default 3); exam generation uses 4.
  attempts?: number;
  // Degraded-result honesty (audit P1-7): called when the AI output could not
  // be parsed after all retries and the FALLBACK envelope was served instead.
  // Assessment callers (exams, grading, placement) MUST use this to stamp the
  // result as degraded - a fallback result is never presented as equivalent
  // to a fully successful AI assessment.
  degraded?: (reason: string) => void;
  // Audit 2026-11-03 P1 (schema validation per output type): when set, a
  // parsed object that violates the caller's contract is treated as a parse
  // failure - the retry budget re-runs with the contract reminder, and only a
  // valid object (or the explicit fallback) reaches the caller. Return null
  // when valid, an error string when not.
  validate?: (out: unknown) => string | null;
}

async function completeRaw(
  system: string,
  history: { role: "user" | "assistant"; content: string }[],
  escalate = 0,
  opts: CompleteOpts = {},
): Promise<string> {
  const zai = await ZAI.create();
  const deep = opts.deep || opts.thinking || opts.think || false;
  const msgs: { role: "user" | "assistant"; content: string }[] = [
    { role: "assistant", content: system },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];
  if (escalate > 0) {
    // Re-assert the output contract right before generation, then re-serve the
    // latest user turn so the model answers the learner, not the reminder.
    msgs.push({
      role: "assistant",
      content:
        escalate > 1
          ? CONTRACT_REMINDER + " Any reply that is not the JSON object is a failure."
          : CONTRACT_REMINDER,
    });
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    if (lastUser) msgs.push({ role: "user", content: lastUser.content });
  }
  const completion = await zai.chat.completions.create({
    messages: msgs,
    thinking: { type: deep ? "enabled" : "disabled" },
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
  });
  const out = completion.choices[0]?.message?.content;
  if (!out || out.trim().length === 0) throw new Error("empty ai reply");
  return out;
}

// One call = one complete, parseable envelope. Retries escalate: attempt 2 and
// 3 re-assert the JSON contract next to the latest user turn. If every attempt
// still yields no JSON, the last raw reply is wrapped into a minimal envelope
// so the coach is never unreachable. `deep` enables extended reasoning for
// jobs that earn it (exam building, level analysis) at the cost of seconds.
export async function aiJson<T>(
  system: string,
  history: { role: "user" | "assistant"; content: string }[],
  fallback?: (raw: string) => T,
  opts: CompleteOpts = {},
): Promise<T> {
  const budget = Math.max(1, Math.min(6, opts.attempts ?? 3));
  let lastRaw = "";
  let lastErr: unknown;
  for (let attempt = 0; attempt < budget; attempt++) {
    try {
      const raw = await completeRaw(system, history, attempt, opts);
      lastRaw = raw;
      const parsed = extractJson(raw);
      if (parsed === null) throw new Error("no json in ai reply");
      const invalid = opts.validate?.(parsed);
      if (invalid) throw new Error(`contract violation: ${invalid}`);
      return parsed as T;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  if (fallback && lastRaw.trim().length > 0) {
    opts.degraded?.(`unparseable AI output after ${budget} attempts (${lastErr instanceof Error ? lastErr.message.slice(0, 120) : "unknown"}) - fallback envelope served`);
    return fallback(lastRaw);
  }
  throw lastErr;
}
