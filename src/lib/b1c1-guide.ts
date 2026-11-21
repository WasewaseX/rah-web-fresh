// The B1-C1 guide map (Task 130): the complete structure of "The Ultimate
// Guide to B1 B2 C1 Grammar & Vocabulary" (English with Lucy, Lucy Bella
// Simkins, (c) 2023, 92 pages), embedded in the app and in the AI's memory.
//
// Provenance, stated honestly:
// - Titles and page numbers below are harvested VERBATIM from the book's
//   printed table of contents (public extracts of the document).
// - The B2 and C1 checklist items are VERBATIM quotes from the book (public
//   mirror). The B1 checklist item LIST in the book was not in any public
//   extract, so those items are DERIVED from the B1 grammar/vocabulary topic
//   map and labeled "derived".
// - Topic hints are the app's own teaching notes for that topic (standard
//   CEFR grammar), not quotes from the book.
// - The intro quote and the method description come from the book/author page.
//
// The verbatim types, metadata and level sections live in ./b1c1-guide-data;
// this file owns the API over that data and re-exports every public name so
// importers keep importing from "@/lib/b1c1-guide".

import { GUIDE_LEVELS, type GuideLevelId, type GuideLevelSection, type GuideTopic } from "./b1c1-guide-data";

export { GUIDE_META, CHECKLIST_LEGEND, GUIDE_LEVELS, GUIDE_CEFR } from "./b1c1-guide-data";
export type { GuideLevelId, GuideSectionId, GuideTopic, GuideChecklist, GuideLevelSection } from "./b1c1-guide-data";

// ---------- API ----------

const BY_LEVEL = new Map(GUIDE_LEVELS.map((s) => [s.level, s]));

export function guideSection(level: GuideLevelId): GuideLevelSection {
  const s = BY_LEVEL.get(level);
  if (!s) throw new Error(`unknown guide level ${level}`);
  return s;
}

export function guideAllTopics(): GuideTopic[] {
  return GUIDE_LEVELS.flatMap((s) => [...s.grammar, ...s.vocabulary]);
}

// Curriculum cross-walk: which guide topics feed each curriculum node.
export function guideTopicsForNode(nodeId: string): GuideTopic[] {
  return guideAllTopics().filter((t) => t.node === nodeId);
}

// Compact AI-memory block: the whole map in a few lines, prompt-injectable.
export function guideMapForPrompt(): string {
  const line = (s: GuideLevelSection) => {
    const g = s.grammar.map((t) => t.title.toLowerCase().replace(/ & /g, " and ")).join(", ");
    const v = s.vocabulary.map((t) => t.title.toLowerCase().replace(/ & /g, " and ")).join(", ");
    return `${s.level} grammar: ${g}. ${s.level} vocabulary: ${v}.`;
  };
  return GUIDE_LEVELS.map(line).join("\n");
}

// Import-time integrity: duplicate topic ids must fail loud (this module is
// data authority for the tool, the prompt memory and the UI panel). The
// curriculum cross-references (t.node) are validated in the battery, which
// imports both graphs - kept out of here so the module stays client-safe.
const SEEN_IDS = new Set<string>();
for (const t of guideAllTopics()) {
  if (SEEN_IDS.has(t.id)) throw new Error(`duplicate guide topic id ${t.id}`);
  SEEN_IDS.add(t.id);
}

// ---------- Task 131: activate the map ----------

// The shared AI-memory body consumed by BOTH tutor prompt twins (prompts.ts
// rule 14 and the ai.ts twin). Kept byte-identical by construction so the two
// surfaces can never drift: the battery pins distinctive substrings on both.
export function guideMemoryBody(): string {
  return [
    "B1 grammar: present, past, future tenses; modal verbs; conditionals; phrasal verbs; order of adjectives, comparatives and superlatives; passive voice; reported speech; question tags and indirect questions; verb patterns; prepositions of place and time. B1 vocabulary: family and relationships, personality and character, travel, likes and dislikes, health and fitness, learning and education, business roles and employment, money and finance, the environment, technology.",
    "B2 grammar: all tenses; reported speech; verb patterns; modal verbs; advanced clauses; the causative; mixed conditionals; advanced adjectives; impersonal passive; cleft sentences; word formation; punctuation. B2 vocabulary: appearance, childhood and growing up, pets and animals, relationships and weddings, British food, sport, the news, the internet, office jargon, health and the health system.",
    "C1 grammar: tense nuance; paraphrasing; modal verbs for speculation and deduction; advanced conditionals; all passive forms including get-passives; negative inversion; hedging and boosting; phrasal verbs with multiple meanings; advanced comparatives and superlatives; word formation. C1 vocabulary: food and nutrition, self-improvement and wellness, housing, urban and rural life, humour, personalities, tourism, remote work and commuting, quitting and job-hunting, freelancing.",
    "Teach a topic AT its guide level: cleft sentences, the causative and mixed conditionals are B2 material; negative inversion, get-passives, hedging and boosting are C1 material. When the learner asks what a level contains or what to learn next, answer from this map - never invent topics a level does not have, and never reassign a topic to a different level.",
  ].join("\n");
}

// Derived 12-week plan. Provenance, stated honestly: the book's example plans
// live on its printable pages (32-36, 58-62, 85-90) which are not in any
// public extract. What IS from the book: the 3-month-per-level method, the
// per-level topic order and the checklist-driven "work out your current level"
// loop. The week mapping below is the app's own derivation of that method,
// built ONLY from the level's real topic titles - it invents no topics.
export interface PlanWeek {
  week: number;
  phase: "Foundation" | "Expansion" | "Production" | "Verification";
  grammar: string; // book topic titles (" + " joined), or "" on verification weeks
  vocabulary: string;
  action: string;
}

// Task 146: topic search across ALL levels. The panel renders the hits as
// drill buttons, so a learner can reach any of the book's topics without
// paging through three level sections. Query shorter than 2 chars returns
// nothing (the box reads as empty rather than dumping the whole guide).
export interface TopicHit {
  id: string;
  title: string;
  kind: "grammar" | "vocabulary";
  level: GuideLevelId;
  page: number;
  hint: string;
}

export function searchGuideTopics(query: string, cap = 12): TopicHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hits: TopicHit[] = [];
  for (const s of GUIDE_LEVELS) {
    for (const [kind, arr] of [
      ["grammar", s.grammar],
      ["vocabulary", s.vocabulary],
    ] as const) {
      for (const t of arr) {
        if (`${t.title}`.toLowerCase().includes(q)) {
          hits.push({ id: t.id, title: t.title, kind, level: s.level, page: t.page, hint: t.hint });
          if (hits.length >= cap) return hits;
        }
      }
    }
  }
  return hits;
}

export function studyPlan12Week(level: GuideLevelId): PlanWeek[] {
  const s = guideSection(level);

  const g = s.grammar.map((t) => t.title);
  const v = s.vocabulary.map((t) => t.title);
  const gTagged = s.grammar.filter((t) => t.tags.length > 0).map((t) => t.title);
  const vTagged = s.vocabulary.filter((t) => t.tags.length > 0).map((t) => t.title);
  const join = (arr: string[]) => arr.join(" + ");
  const chunk = (arr: string[], from: number) => (arr.slice(from, from + 3).length > 0 ? arr.slice(from, from + 3) : arr.slice(0, 3));
  const weeks: PlanWeek[] = [];
  // Weeks 1-6: input, walking the book's topic order (Foundation then Expansion).
  const gPer = Math.ceil(g.length / 6);
  const vPer = Math.ceil(v.length / 6);
  for (let i = 0; i < 6; i++) {
    weeks.push({
      week: i + 1,
      phase: i < 3 ? "Foundation" : "Expansion",
      grammar: join(g.slice(i * gPer, (i + 1) * gPer)),
      vocabulary: join(v.slice(i * vPer, (i + 1) * vPer)),
      action: "study the pages, build 5 example sentences per structure, add 10 cards to the deck",
    });
  }
  // Weeks 7-9: production on the trap-tagged topics (the ones that feed the
  // app's mistake ledger), falling back to the level's own topics.
  weeks.push({
    week: 7,
    phase: "Production",
    grammar: join(chunk(gTagged, 0)),
    vocabulary: "",
    action: "spoken production: a one-minute monologue per structure, recorded and self-reviewed",
  });
  weeks.push({
    week: 8,
    phase: "Production",
    grammar: "",
    vocabulary: join(chunk(vTagged, 0)),
    action: "written production: one paragraph per topic using the topic's collocations, not single words",
  });
  weeks.push({
    week: 9,
    phase: "Production",
    grammar: join(chunk(gTagged, 3)),
    vocabulary: join(chunk(vTagged, 3)),
    action: "integration: one 200-word essay and one 2-minute talk combining this week's items",
  });
  // Weeks 10-12: verification - the book's checklist loop, now interactive.
  weeks.push({
    week: 10,
    phase: "Verification",
    grammar: "",
    vocabulary: "",
    action: "rate the full checklist honestly in the Guide panel (easy / some difficulty / difficult), then drill every difficult-rated item",
  });
  weeks.push({
    week: 11,
    phase: "Verification",
    grammar: "",
    vocabulary: v[0] ?? "",
    action: "re-rate: the easy count must rise; one timed essay and one 2-minute talk on the hardest vocabulary topic",
  });
  weeks.push({
    week: 12,
    phase: "Verification",
    grammar: "",
    vocabulary: "",
    action: "final rating and readiness verdict; claim the level or schedule 4 more weeks on the difficult items; pick the next level from the map",
  });
  return weeks;
}

// Checklist readiness verdict from real self-ratings (the book's 3-box
// method). 0 = easy, 1 = some difficulty, 2 = difficult. Thresholds are the
// app's own, derived from the book's "work out your current level" intent.
export interface ChecklistReadiness {
  rated: number;
  total: number;
  easy: number;
  mid: number;
  hard: number;
  verdict: string;
}

export function checklistReadiness(level: GuideLevelId, ratings: number[]): ChecklistReadiness {
  const total = guideSection(level).checklist.items.length;
  const easy = ratings.filter((r) => r === 0).length;
  const mid = ratings.filter((r) => r === 1).length;
  const hard = ratings.filter((r) => r === 2).length;
  const rated = ratings.length;
  let verdict: string;
  if (rated < total) verdict = `verdict unlocks when all ${total} items are rated`;
  else if (easy === total) verdict = `perfect score: claim ${level} and start the next level's map`;
  else if (hard === 0 && easy >= Math.ceil(total * 0.8)) verdict = `claim ${level}: at most minor friction left`;
  else if (hard >= Math.ceil(total * 0.4)) verdict = `not yet: too much of ${level} is still difficult - keep drilling`;
  else if (easy >= Math.ceil(total * 0.6)) verdict = `on track: patch the difficulty items for a few weeks, then claim ${level}`;
  else verdict = `mid-way: keep working through the ${level} map`;
  return { rated, total, easy, mid, hard, verdict };
}

// ---------- Task 133: one-click practice commands ----------
// Every guide topic, plan week and difficult-rated checklist item becomes a
// handCoach() command that opens the coach with a targeted practice request.
// Pure string builders here so batteries pin the exact prompts; GuidePanel
// only wires buttons.

export function practiceCommand(level: GuideLevelId, title: string, kind: "grammar" | "vocabulary"): string {
  const clean = title.trim();
  if (!clean) return "";
  const noun = kind === "grammar" ? "grammar structure" : "vocabulary topic";
  return `Practice ${level} ${kind} "${clean}" (a ${noun} from the B1-C1 guide map): teach it to me first, then give me 5 exercises and check my answers.`;
}

export function difficultItemsCommand(level: GuideLevelId, items: string[]): string {
  const hard = items.map((i) => i.trim()).filter(Boolean);
  if (hard.length === 0) return "";
  return `I rated these ${level} checklist items "difficult": ${hard.map((i) => `"${i}"`).join("; ")}. Diagnose my gaps on each, teach what I am missing, then drill me.`;
}

export function weekCommand(level: GuideLevelId, week: PlanWeek): string {
  const focus: string[] = [];
  if (week.grammar) focus.push(`grammar: ${week.grammar}`);
  if (week.vocabulary) focus.push(`vocabulary: ${week.vocabulary}`);
  const tail = focus.length ? `${focus.join(" | ")}. ` : "";
  return `Coach me through week ${week.week} (${week.phase}) of my ${level} plan. ${tail}Today's action: ${week.action}`;
}
