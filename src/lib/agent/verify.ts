// The verifier. Every envelope passes through here before the learner sees
// it. It kills the failure modes the learner actually hit: AI-sign phrases,
// refusal text where an exam should be, and count drift between announced
// and graded items.
//
// Audit 2026-11-03, P1: this file used to DELETE every sentence containing
// Persian script from the English reply - silently destroying legitimate
// mixed-language explanations, quoted learner text and examples. The fix
// preserves content: Persian sentences found in the reply are MOVED into the
// fa_note field (the dedicated Farsi channel) instead of deleted, and the
// English reply stays English. The verifier improves the answer; it never
// rewrites it into something incomplete.

import type { CoachEnvelope } from "./types";

const PERSIAN = /[\u0600-\u06FF\u0750-\u077F]/;

const BANNED: [RegExp, string][] = [
  [/as an ai\b[^.]*\.?/gi, ""],
  [/as a language model[^.]*\.?/gi, ""],
  [/i(?:'m| am) (?:an|just a) (?:ai|language model|bot)[^.]*\.?/gi, ""],
  [/i (?:cannot|can't|can not) (?:create|generate|make|build|produce) (?:exams?|tests?|quizzes?)[^.]*\.?/gi, ""],
  [/i (?:cannot|can't|can not) (?:do|make) that[^.]*\.?/gi, ""],
  [/i(?:'m| am) sorry,? (?:but )?i (?:cannot|can't)[^.]*\.?/gi, ""],
  [/certainly!?|of course!?/gi, ""],
  // Task 117: capability-lie offers. The coach cannot produce files; the
  // offer always sits at the end of a reply, so stripping leaves clean text.
  [/would you like me to (?:create|make|generate|prepare|write)[^.]*\.?/gi, ""],
  [/shall i (?:create|make|generate|prepare|write)[^.]*\.?/gi, ""],
  [/want me to (?:create|make|generate|prepare|write)[^.]*\.?/gi, ""],
];

// Returns the English-only reply PLUS any Persian it had to relocate. Nothing
// the model wrote is ever dropped on the floor.
export function sanitizeReply(s: string): { reply: string; movedFa: string } {
  let out = s;
  for (const [re, sub] of BANNED) out = out.replace(re, sub);
  let movedFa = "";
  if (PERSIAN.test(out)) {
    const english: string[] = [];
    const persian: string[] = [];
    for (const seg of out.split(/(?<=[.!?\u061F])\s+/)) {
      const t = seg.trim();
      if (!t) continue;
      (PERSIAN.test(t) ? persian : english).push(t);
    }
    out = english.join(" ");
    movedFa = persian.join(" ").trim();
  }
  out = out.replace(/\s{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return { reply: out, movedFa };
}

export function verifyEnvelope(env: CoachEnvelope): CoachEnvelope {
  const out: CoachEnvelope = { ...env };

  // Reply: English, no AI-sign leakage, sane length. Persian sentences move
  // to the Farsi channel instead of being deleted (audit P1).
  const { reply, movedFa } = sanitizeReply(String(out.reply ?? ""));
  out.reply = reply;
  if (movedFa) {
    const existing = String(out.fa_note ?? "").trim();
    out.fa_note = (existing ? `${existing} ${movedFa}` : movedFa).slice(0, 400);
  }
  if (out.reply.length > 1600) out.reply = out.reply.slice(0, 1570).replace(/\s\S*$/, "") + " ...";
  if (out.fa_note && out.fa_note.length > 400) out.fa_note = out.fa_note.slice(0, 397) + "...";

  // Farsi tail only when corrections exist (or the skill legitimately explains)
  // - but NEVER strip content the sanitizer just relocated there.
  const explainers = new Set(["correct", "translate", "chat", "explain", "minimal-pairs", "coach-report", "summarize", "daily-challenge", "socratic", "roleplay", "debate"]);
  if (!movedFa && (out.corrections?.length ?? 0) === 0 && !explainers.has(out.skill)) out.fa_note = "";

  // Exam consistency: announced count IS graded count, always.
  if (out.exam) out.exam.count = out.exam.items.length;

  // Steps: never empty, so the agent trace is always visible.
  if (!out.steps || out.steps.length === 0) out.steps = [{ label: "Coach turn" }];

  // Never hand back a bare envelope.
  if (!out.reply) out.reply = "Say that again? I lost the thread for a second.";
  return out;
}
