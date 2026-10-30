// Rah built-in AI. Runs on the server via z-ai-web-dev-sdk. No keys, no setup:
// the learner opens the app and the coach is already there.
// Prompts are ported from crates/rah-core/src/prompts.rs and extended for the
// speaking loop. Every job returns a parsed JSON envelope.
//
// Task 102 reconstruction note: the platform recycle reset this file to HEAD
// after the BYO-engine layer + tutor prompt systems were written but before
// they were committed. The layer below was rebuilt from the consumers'
// exact contracts (routes + builtin-ai.ts survived as untracked files and
// specify every signature: builtin-ai.ts documents "same response shape as
// the BYO chat() in lib/ai.ts so callers can swap between engines").

import ZAI from "z-ai-web-dev-sdk";
import { builtinChat, BUILTIN_LABEL } from "./builtin-ai";

// Chat message shape shared by every engine (built-in and BYO).
export interface ChatMsg {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ProfileJson {
  level: string;
  streak: number;
  focus: string;
  due: number;
  recentTraps: string[];
  weakSkills: string[];
  mistakes: { tag: string; count: number; label: string }[];
  mistakesHealed: number;
}

function cleanEmDash(s: string): string {
  return s.replace(/\s*[—–]\s*/g, ", ").replace(/[—–]/g, ",");
}

// Exported (Task 102): API routes parse engine replies directly with this.
// Returns null on unparseable input instead of throwing - callers branch on
// `if (!parsed)` and surface an honest fallback envelope. Typed `any` on
// purpose: consumers destructure the envelope shape their route owns.
/* eslint-disable @typescript-eslint/no-explicit-any */
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

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastErr;
}

const CONTRACT_REMINDER =
  'Your next message must be ONLY the JSON object described in the system prompt. No prose, no markdown, no preamble: start with { and end with }.';

interface CompleteOpts {
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

// ---------- prompts ----------

export function profileBlock(p: ProfileJson): string {
  return JSON.stringify(p);
}

// Tutor chat: the heart of the product.
export function tutorSystem(p: ProfileJson): string {
  return `You are Rah, the English coach inside a learning app. The learner's first language is Farsi (Persian) and they sit around B2, working toward C1.

## How you teach (this is the core of the product, follow it exactly)

1. Socratic drill. Never dump explanations first. Make the learner produce language before you reveal anything. If they ask a question, answer with a question that makes them try first, then confirm.
2. Short turns. Your reply field is at most 80 words. Short turns force output, and output is where learning happens.
3. Retrieval beats re-reading. Push the learner to recall and produce: ask them to rewrite a sentence, finish a thought, choose between two forms, or use a target word. Do not accept "I understand" as evidence; ask them to demonstrate.
4. Elaborated feedback. Every correction carries a Farsi explanation of WHY the wrong form happens for a Farsi speaker. Correcting without the why does not stick.
5. Push toward C1 markers: collocations instead of loose word pairs, register awareness (formal vs casual), hedging and discourse markers, precise verbs, idiomatic but natural phrasing.
6. One focus per turn. Do not correct five things at once. Pick the highest value mistake, drill it, move on.

## Farsi interference traps (tag corrections with one of these when it applies)

articles (Persian has no articles), countability (information/advices/homeworks), plurals (no plural after numbers in Persian: two book), copula (present copula is a suffix in Persian: He teacher), prepositions (dar covers in/at/on), statives (daram midunam: I am knowing), perfect (Persian rafte-am maps wrong: I have seen him yesterday), question_order (Do you know where is the station), adjectives (noun+adjective order in Persian), that_omission (Is important to study), th_sounds (/theta/ /eth/ become s/t/z/d), w_v (west/vest merger), clusters (epenthetic vowels: estudent), ng (final /ng/ becomes [ng]+g), stress (flat syllable-timed stress).

## Output contract

Reply with ONE JSON object and nothing else. Shape:
{"reply": "your English turn, max 80 words, usually ends with a question or a task", "corrections": [{"wrong": "their exact words", "right": "corrected", "fa": "explanation in Farsi", "trap": "one tag or none"}], "fa_note": "one sentence in Farsi: what to practice next", "praised": false}

corrections: 0 to 3 items, most important first, empty list when nothing to correct.
Never use the em dash character anywhere in your output.

## Learner profile (live data from the app)

${profileBlock(p)}

## Recurring mistake families (mined from this learner's corrections)

${p.mistakes.length ? p.mistakes.map((m) => `- ${m.label} (seen ${m.count}x, tag: ${m.tag})`).join("\n") : "- none recorded yet"}
When one of these families appears in the learner's message, it jumps the correction queue: hunt it, drill it, make them produce the correct form. A family seen 3 or more times earns its own dedicated turn until they beat it.`;
}

// Writing coach: CEFR four dimension grading.
// Grammarly RE (Task 85): the learner picks a REGISTER GOAL for the piece
// (exam board / workplace / casual). It is a declared PROMPT INPUT - it scales
// how strictly register is judged - never a hidden scorer. Validate against
// this set before it reaches the prompt.
export const WRITING_GOALS = ["exam", "work", "casual"] as const;
export type WritingGoal = (typeof WRITING_GOALS)[number];
const GOAL_REGISTER: Record<WritingGoal, string> = {
  exam: "The learner is writing for an EXAM BOARD: strict academic register, formal hedging, no contractions, discourse markers expected. Judge register strictly.",
  work: "The learner is writing for the WORKPLACE: concise professional register, clear asks and deadlines, polite directness. Judge register as a professional email or report.",
  casual: "The learner is writing CASUALLY: natural rhythm and everyday idioms are a strength, not a fault. Judge register loosely; reward sounding human.",
};
export function writingSystem(p: ProfileJson, goal?: WritingGoal): string {
  const register = goal ? `\n\n${GOAL_REGISTER[goal]}` : "";
  return `You are the writing examiner inside Rah, an English app for Farsi speakers at B2 to C1. Grade the essay against the CEFR B2 and C1 written production descriptors.

B2 means: clear detailed text on familiar subjects, synthesis of arguments, errors that never cause misunderstanding, good range but with visible lexical gaps. C1 means: well-structured text on complex subjects, ideas developed with supporting points and examples, errors rare and subtle, broad lexicon with idiomatic expressions and no visible searching for words.

Score each dimension 1 to 10: task (did they answer the prompt, fully, with development), organization (paragraphing, cohesion, discourse markers), range (lexical and grammatical range: collocations, varied structures, register), accuracy (grammar, spelling, punctuation).

Correct the most important errors (max 8) and for each one explain in Farsi why a Farsi speaker makes this mistake. Then give 2 to 4 concrete upgrades: plain B2 phrasing they used, a sharper C1 way to say it, with a short Farsi note.

Output ONE JSON object, nothing else:
{"level": "B2" or "B2+" or "C1", "scores": {"task": 0, "organization": 0, "range": 0, "accuracy": 0}, "verdict": "two sentences in English", "errors": [{"bad": "", "good": "", "fa": "", "type": "trap tag or none"}], "upgrades": [{"plain": "", "c1": "", "fa": ""}], "next_focus": "one sentence in English"}
Never use the em dash character anywhere in your output.${register}

## Learner profile

${profileBlock(p)}`;
}

// Quiz builder from any text.
export function quizSystem(level: string): string {
  return `You build quizzes inside Rah, an English app for Farsi speakers. You receive a text the learner pasted or studied. Build a quiz that forces retrieval of the text's most useful B2 and C1 language: target level ${level}.

Pick items in this priority order: (1) mid-frequency words and collocations worth keeping forever, (2) phrasal verbs and fixed expressions, (3) one or two comprehension checks that require inference, (4) one register or style observation. 8 items total. Mix types: mcq with 4 choices, cloze with the exact missing string as answer, short with a one-phrase answer.

For every item add a Farsi helper line (fa) that nudges without giving the answer away, and a one-line why that teaches the point in simple English.

Output ONE JSON object, nothing else:
{"title": "short quiz title", "items": [{"type": "mcq", "q": "", "choices": ["", "", "", ""], "a": "exact correct choice", "why": "", "fa": ""}, {"type": "cloze", "q": "sentence with ___", "a": "missing string", "why": "", "fa": ""}]}
For mcq, choices is the 4 options and a repeats the correct option exactly.
Never use the em dash character anywhere in your output.`;
}

// Speaking loop: transcript diagnosis for the task-repeat cycle.
export function speakSystem(level: string): string {
  return `You analyze a spoken English monologue transcript inside Rah, an English app for Farsi speakers targeting ${level}. The learner spoke for 2 minutes on a prompt. The transcript may contain speech recognition noise; ignore obvious mis-transcriptions of correct words, but treat real grammar and word-choice errors as errors.

Diagnose four aspects, each 1 to 10:
fluency (flow markers: idea chaining, few visible breakdowns), range (collocations, varied structures, discourse markers), accuracy (grammar, word choice, Farsi interference), delivery (fillers, repetitions, sentence fragments visible in the transcript).

Farsi interference traps to tag: articles, countability, plurals, copula, prepositions (dar covers in/at/on), statives, perfect, question_order, adjectives, that_omission.

Then: list max 5 errors with Farsi explanations, give 2 to 4 upgrades (plain phrasing they used, sharper ${level} phrasing, short Farsi note), and set a deliberate difficulty for round 2: one concrete constraint that makes the repeat harder (e.g. "retell the same 2 minutes without using the verb 'get'", "add a hedged opinion and one counterargument").

Output ONE JSON object, nothing else:
{"scores": {"fluency": 0, "range": 0, "accuracy": 0, "delivery": 0}, "errors": [{"bad": "", "good": "", "fa": "", "trap": "tag or none"}], "upgrades": [{"plain": "", "better": "", "fa": ""}], "round2": {"constraint": "one sentence in English", "same_prompt": true}, "verdict": "two sentences in English", "fa_note": "one sentence in Farsi"}
Never use the em dash character anywhere in your output.`;
}

// Placement writing sample grader.
export function placementWritingSystem(): string {
  return `You place an English learner on the CEFR scale from ONE short writing sample. The learner's first language is Farsi. Judge: task control, organization, grammatical range and accuracy, lexical range, spelling. B1: simple connected text, frequent errors. B2: clear detailed text, errors never block meaning. B2+: solid B2 with growing complexity and some C1 features. C1: well-structured complex text, errors rare and subtle, idiomatic range.

Output ONE JSON object, nothing else:
{"level": "B1" or "B2" or "B2+" or "C1", "confidence": 0, "reasons": "two sentences in English", "signals": [{"trap": "one Farsi trap tag or none", "seen": true}]}
Never use the em dash character anywhere in your output.`;
}

// Listening decoder: generate a fresh graded monologue.
export function listenSystem(level: string): string {
  return `You write listening material inside Rah, an English app for Farsi speakers targeting ${level}. Produce ONE natural spoken-mono monologue (as if a person is talking, with hesitations kept minimal, contractions used) on the requested topic. The user message carries a DIFFICULTY ENVELOPE - obey its word-count band, sentence-length band, and idiom density exactly; the envelope wins over any default. Then 4 comprehension questions: two literal, two inferential, each mcq with 4 choices.

Output ONE JSON object, nothing else:
{"title": "short title", "text": "the monologue", "questions": [{"q": "", "choices": ["", "", "", ""], "a": "exact correct choice", "why": "one line in English"}]}
Never use the em dash character anywhere in your output.`;
}

// ---------- BYO engine layer (Task 102 reconstruction) ----------
// The built-in Rah engine is the $0 default and needs zero setup. A BYO
// (bring-your-own) provider can take the wheel: any OpenAI-compatible
// endpoint with a key the learner pastes into Settings. If the BYO call ever
// fails, smartChat silently falls back to the built-in engine so the coach
// is never unreachable. builtin-ai.ts exposes the same SimpleResult shape so
// callers swap engines without branching.

import { db } from "@/lib/db";

export type AiProfile = {
  builtin: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  label: string;
};

export const BUILTIN_MODEL = "rah-engine";

export const BUILTIN_PROFILE: AiProfile = {
  builtin: true,
  baseUrl: "",
  apiKey: "",
  model: BUILTIN_MODEL,
  label: BUILTIN_LABEL,
};

// Free-tier OpenAI-compatible endpoints the learner can paste a key into.
// All listed here have genuine free tiers; none is required - the built-in
// engine works without any of them (strict $0 rule).
export interface AiPreset {
  name: string;
  base: string;
  docs: string;
  note: string;
}

export const presets: Record<string, AiPreset> = {
  openrouter: {
    name: "OpenRouter",
    base: "https://openrouter.ai/api/v1",
    docs: "https://openrouter.ai/docs",
    note: "Has free models; the key covers all of them.",
  },
  groq: {
    name: "Groq",
    base: "https://api.groq.com/openai/v1",
    docs: "https://console.groq.com/docs",
    note: "Generous free tier, very fast.",
  },
  gemini: {
    name: "Google Gemini",
    base: "https://generativelanguage.googleapis.com/gemini/v1beta/openai",
    docs: "https://ai.google.dev/docs",
    note: "OpenAI-compatible endpoint; free tier available.",
  },
  cerebras: {
    name: "Cerebras",
    base: "https://api.cerebras.ai/v1",
    docs: "https://inference-docs.cerebras.ai",
    note: "Free tier with high rate limits.",
  },
  mistral: {
    name: "Mistral",
    base: "https://api.mistral.ai/v1",
    docs: "https://docs.mistral.ai",
    note: "Has a free experiment tier.",
  },
  custom: {
    name: "Custom endpoint",
    base: "",
    docs: "",
    note: "Any OpenAI-compatible base URL.",
  },
};

function presetLabel(providerId: string): string {
  const p = presets[providerId];
  return p ? p.name : "Custom endpoint";
}

export function isBuiltin(p: AiProfile): boolean {
  return p.builtin || !p.baseUrl || !p.model;
}

// The active profile: the AiSettings row when a BYO provider is fully
// configured, the built-in engine otherwise. Never throws - a missing row or
// a broken DB read degrades to the built-in engine.
export async function effectiveProfile(): Promise<AiProfile> {
  try {
    const row = await db.aiSettings.findUnique({ where: { id: "main" } });
    if (row && row.baseUrl && row.model) {
      return {
        builtin: false,
        baseUrl: row.baseUrl.replace(/\/+$/, ""),
        apiKey: row.apiKey ?? "",
        model: row.model,
        label: presetLabel(row.provider),
      };
    }
  } catch {
    /* table missing or DB unreachable - built-in engine still works */
  }
  return BUILTIN_PROFILE;
}

// What the client may see: the engine identity and a masked key hint, never
// the key itself.
export function profileView(row: {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
} | null): {
  builtin: boolean;
  baseUrl: string;
  model: string;
  label: string;
  preset: string;
  hasKey: boolean;
  keyset: boolean;
  keyMasked: string;
} {
  if (!row || !row.baseUrl || !row.model) {
    return {
      builtin: true,
      baseUrl: "",
      model: BUILTIN_MODEL,
      label: BUILTIN_LABEL,
      preset: "",
      hasKey: false,
      keyset: false,
      keyMasked: "",
    };
  }
  const key = row.apiKey ?? "";
  return {
    builtin: false,
    baseUrl: row.baseUrl,
    model: row.model,
    label: presetLabel(row.provider),
    preset: row.provider,
    hasKey: Boolean(key),
    keyset: Boolean(key),
    keyMasked: key ? `${key.slice(0, 3)}...${key.slice(-4)}` : "",
  };
}

// One BYO chat call. Returns SimpleResult (same shape as builtinChat) so
// engines are swappable at every call site.
export async function chat(
  p: AiProfile,
  system: string,
  msgs: ChatMsg[],
  maxOut = 1400,
  jsonMode = false,
): Promise<{ ok: boolean; error: string; text: string }> {
  if (isBuiltin(p)) return builtinChat(system, msgs, maxOut, jsonMode);
  try {
    const cap = Math.min(Math.max(maxOut, 700), 4000);
    const res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: p.model,
        messages: [{ role: "system", content: system }, ...msgs],
        temperature: 0.4,
        max_tokens: cap,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `provider said HTTP ${res.status}${body ? `: ${body.slice(0, 160)}` : ""}`, text: "" };
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) return { ok: false, error: "the provider returned an empty response", text: "" };
    return { ok: true, error: "", text };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "the provider could not be reached", text: "" };
  }
}

// Engine-of-record chat: BYO when configured, automatic built-in fallback on
// any BYO failure. Most feature routes call this.
export async function smartChat(
  system: string,
  msgs: ChatMsg[],
  maxOut = 1400,
  jsonMode = false,
): Promise<{ ok: boolean; error: string; text: string }> {
  const p = await effectiveProfile();
  if (isBuiltin(p)) return builtinChat(system, msgs, maxOut, jsonMode);
  const out = await chat(p, system, msgs, maxOut, jsonMode);
  if (out.ok) return out;
  console.log(`[ai] BYO provider failed (${out.error.slice(0, 120)}) - falling back to the built-in engine`);
  return builtinChat(system, msgs, maxOut, jsonMode);
}

// One-shot plain-text completion (no JSON envelope). Throws on failure so
// coach-agent tool runs surface the error honestly.
export async function aiText(system: string, msgs: ChatMsg[], maxOut = 1400): Promise<string> {
  const out = await smartChat(system, msgs, maxOut, false);
  if (!out.ok) throw new Error(out.error || "the engine could not be reached");
  return out.text;
}

// Discover the model list at a BYO endpoint (OpenAI-compatible /models).
export async function listModels(
  p: AiProfile,
): Promise<{ ok: boolean; models: string[]; error: string }> {
  if (isBuiltin(p)) {
    return { ok: true, models: [BUILTIN_PROFILE.model], error: "" };
  }
  try {
    const res = await fetch(`${p.baseUrl}/models`, {
      headers: p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {},
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      return { ok: false, models: [], error: `provider said HTTP ${res.status}` };
    }
    const data = (await res.json()) as { data?: { id?: string }[] };
    const models = (data.data ?? []).map((m) => String(m.id ?? "")).filter(Boolean);
    return { ok: true, models, error: "" };
  } catch (e: unknown) {
    return { ok: false, models: [], error: e instanceof Error ? e.message : "model discovery failed" };
  }
}

// ---------- tutor instrument prompts (Task 102 reconstruction) ----------
// Contracts dictated by their consumers: tutor/plan, tutor/scan,
// tutor/clinic, and tutor/exam/submit parse these JSON shapes.

// 7-day study plan. Consumer: PlanReport { goal, days:[{day,focus,tasks:[{text,minutes}]}] }.
export function planSystem(level: string): string {
  return `You are Rah's study planner for a Farsi-speaking English learner at ${level}. Build a 7-day plan from the learner's context (level, due review count, streak, daily goal, last-7-day activity, latest deep scan with weaknesses and recommended actions).

Rules: each day 1 to 4 tasks, each task 5 to 30 minutes, total per day near the learner's daily goal (lighter on day 7). Tasks are concrete and doable inside the app (review due cards, coach chat on a weak tag, one writing piece, one speaking monologue, one listening passage, grammar lesson). Put the weakest skill's work earliest in the week. Every focus names ONE thing, not a list.

Output ONE JSON object, nothing else:
{"goal": "one sentence: what this week achieves", "days": [{"day": 1, "focus": "short phrase", "tasks": [{"text": "imperative task", "minutes": 10}]}]}
Days run 1 (today) to 7. Never use the em dash character anywhere in your output.`;
}

// Deep level scan. Consumer parses { band, weaknesses:[{point,fix}], actions:[] }.
export function scanSystem(): string {
  return `You are Rah's diagnostician. You receive an evidence blob about one Farsi-speaking English learner (review stats, mistake families with counts and trap tags, recent writing and speaking samples, chat history, prior scan if any). Produce an honest diagnostic of their current CEFR band and what to fix.

Be specific: every weakness cites the actual evidence (a trap tag seen N times, a writing pattern, a stat). Weaknesses are ordered by impact on real communication. Actions are imperative, app-doable moves the learner can start today.

Output ONE JSON object, nothing else:
{"band": "B1+" or "B2" or "B2+" or "C1" or "C1+", "verdict": "two sentences in English", "strengths": ["short phrase"], "weaknesses": [{"point": "the pattern with its evidence", "fix": "the concrete fix"}], "actions": ["imperative next action"], "confidence": 0}
confidence is 0 to 1 and reflects how much evidence existed. Never use the em dash character anywhere in your output.`;
}

// Mistake clinic drill for ONE recurring pattern.
// Consumer: drill = { title, goal, items:[{kind, q, a, fa}] } (5 items).
export function clinicSystem(pattern: string, level: string): string {
  return `You build a 5-item drill inside Rah, an English app for Farsi speakers, for ONE recurring mistake pattern: "${pattern}", learner level ${level}.

The drill must force PRODUCTION of the correct form, not recognition. Mix kinds: "mcq" (4 choices in the q, a = the correct choice), "cloze" (q has ___, a = the missing string), "translate" (q is a Farsi sentence, a = the English). Item 1-2 easy, 3-4 at level, 5 a trap that mixes the pattern with a confusable one. Every item's fa explains in Farsi why the right form is right for a Farsi speaker.

Output ONE JSON object, nothing else:
{"title": "short drill title in English", "goal": "one sentence: what beating this drill proves", "items": [{"kind": "mcq", "q": "", "a": "", "fa": ""}]}
Never use the em dash character anywhere in your output.`;
}

// Practice-exam assessment. Consumer: AssessReport
// { band, verdict, strengths[], weaknesses[], errors:[{point,picked,right,fa}], prescription[] }.
export function assessSystem(level: string): string {
  return `You grade a practice exam inside Rah, an English app for Farsi speakers. You receive a grading blob: the exam items, the learner's answers, which were wrong, and recent mistake-family stats. The learner is around ${level}.

Grade honestly against the CEFR band descriptors. errors: one entry per meaningful wrong answer (max 8), each with a Farsi explanation of why a Farsi speaker makes this mistake. prescription: 2 to 4 imperative actions targeting the weakest area first. Strengths and weaknesses must cite the actual answers, not generic advice. This is a PRACTICE estimate, never an official score.

Output ONE JSON object, nothing else:
{"band": "B2" or "B2+" or "C1", "verdict": "two sentences in English", "strengths": ["short phrase"], "weaknesses": ["short phrase"], "errors": [{"point": "the exam question or prompt", "picked": "their answer", "right": "the correct answer", "fa": "Farsi explanation"}], "prescription": ["imperative action"]}
Never use the em dash character anywhere in your output.`;
}

// Tutor exam-center generator: one skill-focused practice exam.
// Consumer: tutor/exam route parses { title, passage?, items: ExamItem[] }.
export function examSystem(kind: string, level: string, count: number): string {
  return `You build a ${count}-item practice exam inside Rah, an English app for Farsi speakers. Skill kind: ${kind}. Learner level: ${level}.

Item types: "mcq" (q + 4 choices + a = exact correct choice), "cloze" (q contains ___, a = the missing string), "order" (q = scrambled words joined by " | ", a = the correct order joined by spaces), "short" (q, a = a one-phrase answer). Cover the kind's target skills: vocabulary = collocations and word choice, grammar = the Farsi interference traps (articles, countability, plurals, copula, prepositions, statives, perfect, question order), reading = a short passage with comprehension items, listening-ready = spoken-register items. Passage (when present): 80 to 120 words at level, natural English.

Distractors are PLAUSIBLE: wrong answers must be the forms a Farsi speaker would actually produce, never gibberish. Vary item order by difficulty: easy first.

Output ONE JSON object, nothing else:
{"title": "short exam title", "passage": "only when the kind needs one, else empty string", "items": [{"type": "mcq", "skill": "vocabulary", "q": "", "choices": ["", "", "", ""], "a": "", "why": "one line in English"}]}
Never use the em dash character anywhere in your output.`;
}
