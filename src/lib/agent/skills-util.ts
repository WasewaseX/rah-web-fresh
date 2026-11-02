// Shared machinery for conversational skills. Every teaching skill composes a
// focus brief on top of the Socratic base prompt and parses the same envelope.

import { aiJson } from "@/lib/ai";
import type { ProfileJson } from "@/lib/ai";
import type { CoachEnvelope, SkillContext, StepTrace, Correction } from "./types";

export interface TurnResult {
  reply: string;
  corrections: Correction[];
  fa_note: string;
  praised: boolean;
}

function cleanEmDash(s: string): string {
  return s.replace(/\s*[—–]\s*/g, ", ").replace(/[—–]/g, ",");
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

function extractTurn(raw: string): TurnResult {
  const cleaned = cleanEmDash(raw.trim());
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : cleaned;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1) throw new Error("no json");
  const candidate = end > start ? body.slice(start, end + 1) : body.slice(start);
  try {
    return JSON.parse(candidate) as TurnResult;
  } catch {
    return JSON.parse(repairJson(candidate)) as TurnResult;
  }
}

function rawFallback(raw: string): TurnResult {
  return { reply: cleanEmDash(raw.trim().slice(0, 600)), corrections: [], fa_note: "", praised: false };
}

// The base persona. Audit 2026-11-03, P0-3: this used to force Socratic
// questioning, an 80-word cap and an end-of-turn task on EVERY message -
// almost designed to make a tutor irritating ("What does notwithstanding
// mean?" got another question). Teaching behaviour now depends on intent:
// direct questions get direct answers, practice stays Socratic, frustration
// changes the approach. The 80-word figure is a default, not a rule.
export function basePersona(p: ProfileJson): string {
  return `You are Rah, the English coach inside a learning app. The learner's first language is Farsi (Persian) and they sit around ${p.level === "?" ? "B2" : p.level}, working toward C1.

## How you respond (fit the behaviour to the message)
1. Direct questions get direct answers. "What does X mean?", "Why is my answer wrong?", "Is this correct?" are answered plainly and completely, with an example. A short follow-up task may come AFTER the answer, but never instead of it. Never answer a question with only a question.
2. Practice turns are Socratic. When the learner is drilling or producing language, make them attempt it before you reveal the answer. Retrieval beats re-reading.
3. Frustration, "you already said that", "not what I asked": acknowledge it in one line, change your approach, move on. Never repeat the same explanation.
4. Length matches the ask. Default is 2 to 5 sentences. "Keep it short" means 1 or 2 lines. "Correct every mistake" or "explain fully" deserves a complete, structured answer.
5. Elaborated feedback. Every correction carries a Farsi explanation of WHY the wrong form happens for a Farsi speaker.
6. One focus per turn. Pick the highest value mistake and work it.
7. Push toward C1 markers: collocations over loose pairs, register awareness, hedging and discourse markers, precise verbs, idiomatic but natural phrasing.
8. Capability honesty: do not offer to create worksheets, PDFs, emails or files - the app around you already has review decks, writing feedback, and exams; point to those by name.
9. Greetings and small talk: warm, one or two lines, then at most one light question to start real practice.

## Farsi interference traps (tag with one when it applies)
articles, countability, plurals, copula, prepositions (dar covers in/at/on), statives, perfect, question_order, adjectives, that_omission, th_sounds, w_v, clusters, ng, stress.

## Output contract
ONE JSON object, nothing else:
{"reply": "English turn, compact by default, longer when the learner asked for detail", "corrections": [{"wrong": "their exact words", "right": "corrected", "fa": "explanation in Farsi", "trap": "one tag or none"}], "fa_note": "one short Farsi sentence about the correction, empty string if there were no corrections", "praised": false}
corrections: 0 to 3, most important first. fa_note MUST be an empty string when corrections is empty. Never use the em dash character. Never write Farsi inside the reply field, only inside fa and fa_note.`;
}

export function profileBlock(p: ProfileJson): string {
  return JSON.stringify(p);
}

// Run one coach turn for a skill: compose system, call the model, wrap steps.
export async function coachTurn(
  system: string,
  ctx: SkillContext,
  steps: StepTrace[],
  opts?: { thinkingGate?: (p: ProfileJson) => boolean },
): Promise<TurnResult> {
  const history = ctx.history
    .slice(-6)
    .map((h) => ({
      role: h.role === "user" ? ("user" as const) : ("assistant" as const),
      content: h.role === "user" ? h.content : h.content.slice(0, 900),
    }));
  const deep = opts?.thinkingGate ? opts.thinkingGate(ctx.profile) : false;
  const out = await aiJson<TurnResult>(
    `${system}\n\n## Learner profile (live)\n${profileBlock(ctx.profile)}`,
    [...history, { role: "user", content: ctx.text }],
    rawFallback,
    {
      deep,
      // Audit P1 (typed output validation): a parsed envelope that violates
      // the caller's contract is a failure and gets the retry budget, instead
      // of silently flowing downstream as a shapeless object.
      validate: (o) =>
        o && typeof o === "object" && typeof (o as { reply?: unknown }).reply === "string" && (o as { reply: string }).reply.trim().length > 0
          ? null
          : "reply must be a non-empty string",
    },
  );
  const turn: TurnResult = {
    reply: cleanEmDash(String(out.reply ?? "")).trim(),
    corrections: Array.isArray(out.corrections) ? out.corrections.slice(0, 3) : [],
    fa_note: String(out.fa_note ?? "").trim(),
    praised: Boolean(out.praised),
  };
  // Memory feeding happens once at the agent boundary (/api/chat), so every
  // skill's corrections feed the same families without double counting.
  return turn;
}

export function envelope(
  skill: CoachEnvelope["skill"],
  turn: TurnResult,
  steps: StepTrace[],
  extra?: Partial<CoachEnvelope>,
): CoachEnvelope {
  return {
    skill,
    reply: turn.reply,
    corrections: turn.corrections,
    // No corrections means no Farsi tail: the learner complained about
    // Persian plan lines stapled onto every message. Farsi appears only
    // when there is something to explain.
    fa_note: turn.corrections.length > 0 ? turn.fa_note : "",
    steps,
    praised: turn.praised,
    ...extra,
  };
}
