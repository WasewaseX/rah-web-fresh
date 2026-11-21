// Exam generation prompt surface: freshness rotation, ban lists and the
// examiner system prompt. The prompt text is protocol law - batteries and
// probes assert on these exact strings, so it moves verbatim.

import { db } from "@/lib/db";
import type { ProfileJson } from "@/lib/ai";
import type { ExamItem, ExamSpec } from "./types";
import { EXAM_TRACKS } from "./exam-tracks";

// Randomized topic domains: exams rotate through these so two exams never
// mine the same "office policy + party + heavy rain" cliché territory.
const DOMAINS = [
  "technology and apps", "health and fitness", "travel and airports", "food and cooking",
  "environment and climate", "work and careers", "education and studying", "sports and competition",
  "music and film", "science and space", "money and shopping", "city life and transport",
  "family and friendships", "news and media", "nature and animals", "art and design",
];

// Templates the model gravitates to when lazy. Named explicitly so the first
// sentence of every exam is not "The new policy had a significant ___ on".
const OVERUSED = [
  "The new policy had a significant ___ on",
  "Which word means to make something less severe or intense",
  "By the time we arrived at the party",
  "What verb collocates with 'heavy'",
  "If I ___ more time, I would have",
  "The company needs to ___ its operations",
];

export interface Freshness {
  domains: string[];
  bannedQ: string[];
  bannedA: string[];
}

// Recent-exam ledger: the last few exams' sentences and answer keys become a
// ban list, so "the same exam again" is structurally impossible, not hoped
// against. Banned answers rotate the teaching points too (no more alleviate /
// mitigate asked twice in a row).
export async function loadFreshness(): Promise<Freshness> {
  const domains = [...DOMAINS].sort(() => Math.random() - 0.5).slice(0, 4);
  try {
    const recent = await db.exam.findMany({ orderBy: { createdAt: "desc" }, take: 4, select: { items: true } });
    const past = recent.flatMap((r) => {
      try { return JSON.parse(r.items) as ExamItem[]; } catch { return []; }
    });
    return {
      domains,
      bannedQ: [...new Set(past.map((i) => i.q.replace(/\s+/g, " ").slice(0, 90)))].slice(0, 24),
      bannedA: [...new Set(past.map((i) => i.a.toLowerCase().replace(/\s+/g, " ").slice(0, 40)))].slice(0, 24),
    };
  } catch {
    return { domains, bannedQ: [], bannedA: [] };
  }
}

// A question that says "according to the text" without carrying the text is a
// broken item: the learner has nothing to read. Reading items must embed their
// own mini-passage, so anything referencing a text while staying short is dead
// on arrival.
export const DANGLING_TEXT_REF = /\b(according to|based on)\b[^.]{0,40}\b(text|passage|article|author|writer)\b|\bthe (text|passage|article) (says|states|mentions|suggests)\b|\bthe (author|writer) (says|states|mentions|argues)\b/i;

export function examSystem(p: ProfileJson, spec: ExamSpec, fresh: Freshness): string {
  const bans = [
    fresh.bannedQ.length ? `BANNED questions (served recently; never reuse the sentence, a close paraphrase, or the same teaching point): ${fresh.bannedQ.map((q) => JSON.stringify(q)).join("; ")}` : "",
    fresh.bannedA.length ? `BANNED answers (do not make any of these the correct answer or a distractor again): ${fresh.bannedA.join("; ")}` : "",
    `AVOID these worn-out templates entirely: ${OVERUSED.map((t) => JSON.stringify(t)).join("; ")}`,
  ].filter(Boolean).join("\n\n");
  const quota = spec.weakTags.length ? Math.min(4, Math.max(1, Math.ceil(spec.plannedCount / 3))) : 0;
  const trackBlock = spec.track ? `\n\n${EXAM_TRACKS[spec.track].brief}` : "";
  return `You are the examiner inside Rah, an English app for Farsi speakers. Build ONE exam targeted at ${spec.level} level, focused on: ${spec.targetSkills.join(", ")}.

The learner sits around ${p.level}. Recent weak spots: ${p.weakSkills.join(", ") || "general B2 range"}. Push at the edge of ${spec.level} toward C1: collocations, register, precise verbs, Farsi interference traps (articles, countability, prepositions, present perfect, question order).
${spec.weakTags.length ? `WEAKNESS QUOTA: this learner has these recurring mistake families on file: ${p.mistakes.map((m) => `${m.tag} x${m.count}`).join(", ")}. At least ${quota} items MUST carry a "tag" field naming the family they hunt (one of: ${spec.weakTags.join(", ")}), and the item must genuinely force that exact weakness into play with a FRESH sentence - the ban lists still apply. Never invent a tag outside the list; items not built for a family simply omit the tag field.` : ""}

Exactly ${spec.plannedCount} items.${trackBlock}

Mix, in this rough share: 40% mcq, 30% cloze, 15% short, 15% rewrite.${spec.track ? " (The track block above may override these shares - follow the track when it does.)" : ""} Every item tests ONE teachable point. Wrong choices for mcq must be plausible for a Farsi speaker.

ITEM TYPE CONTRACTS (an answerability gate rejects any item that breaks them; a rejected item is wasted):
- TRIVIA BAN: never ask for terms, definitions, or world knowledge ("what term describes...", "what do you call...", "which document/instrument..."). Every item must test ENGLISH itself: a grammatical form, a collocation, register, a connector, or meaning in context. To teach a word, put it in a sentence blank.
- mcq: exactly ONE choice is defensibly correct. The others must be wrong for a reason you could state (wrong form, wrong meaning, unidiomatic pairing). Never make the key the only positive/hedged/longest option. The key MUST be copied exactly from the choices array.
- cloze: q contains exactly one ___ and the blank is FORCED: grammar or a fixed collocation decides the word, so a competent learner can produce the key (or an accept variant) with confidence. Never an open style/word-choice blank with several equally good answers - if you cannot name why the alternatives fail, the item is unfair.
- short: the answer must be FORCED too: either a blank decided by grammar/collocation, or an explicit form task (comparative, plural, passive form, reported form, negative). Never a "what is X called" question and never an open definition.
- rewrite: q MUST begin with the full instruction, stated in the question text itself: what to do, and to which sentence (quoted). "Rewrite using more formal vocabulary: 'The new law really stops people from polluting rivers.'" is correct. A bare statement with no instruction is a wasted item - the learner cannot know the task.

FRESHNESS RULES (a moderator rejects recycled exams):
- Draw situations from these domains: ${fresh.domains.join(", ")}. At least half the items must come from this list.
- Every sentence pattern in the exam must be structurally different from every other. Ten cloze items are ten different shapes, not one shape repeated.
- Never test the same word or teaching point twice in one exam, even in different sentence frames.
${bans}

HARD FOCUS RULE: every item's "skill" field MUST be one of: ${spec.targetSkills.join(", ")}. Zero items outside this list, even if the item type would fit another skill. A rewrite item in a vocabulary exam is still a vocabulary item (word choice, register, word formation), never a writing item.

READING RULE: an item about a text MUST embed the full mini-text (2 to 4 short sentences) inside its "q" before the question. Never write "according to the text" without the text being right there in "q". Standalone reading items (word meaning in context) are fine without a passage.

CRITICAL answer-key rules, the grader is mechanical:
- "a" is the single best answer, lowercase unless a proper noun.
- "accept" lists every variant you would hand-grade as correct: synonyms ("heavy rain" accepts "pouring rain"), inflections ("rains", "raining" where the sentence allows), spelling variants. Give 2 to 5 accept entries for cloze and short items.
- rewrite items: "mustInclude" lists the target patterns that ALL have to appear in the learner's sentence (e.g. ["take advantage of"]), and "a" is one model answer.
- "skill" is exactly one of: grammar, vocabulary, collocation, writing, reading, listening.
${spec.weakTags.length ? `- "tag" (optional) is exactly one of: ${spec.weakTags.join(", ")} - set it only on items built to hunt that mistake family, omit it everywhere else.` : ""}
- "why" is one short English sentence teaching the point (max 18 words). No Farsi anywhere in the exam.

Output ONE JSON object, nothing else:
{"title": "short exam title in English", "items": [{"type": "mcq", "skill": "collocation", "q": "sentence with ___ or an instruction plus a quoted sentence", "choices": ["", "", "", ""], "a": "exact correct choice", "accept": [], "why": ""}]}
For cloze: q contains ___ and a is the missing string. For short: a forced form answer. For rewrite: instruction inside q, mustInclude patterns, model a.
Never use the em dash character anywhere.`;
}
