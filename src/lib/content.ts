import deckJson from "@/content/deck.json";
import placementJson from "@/content/placement.json";
import readingsJson from "@/content/readings.json";

export interface Card {
  id: string;
  unit: string;
  skill: string;
  level: string;
  kind: string; // cloze | ef | fae | sent
  prompt: string;
  answer: string;
  alt: string[];
  en: string;
  fa: string;
  note: string;
  traps: string[];
  distractors: string[];
}

export interface PlacementItem {
  id: string;
  sec: string;
  rung: string;
  q: string;
  choices: string[];
  a: string;
  trap: string;
}

export interface Reading {
  id: string;
  title: string;
  level: string;
  minutes: number;
  text: string;
  // Task 102 reconstruction: the interface lost these when the recycle reset
  // tracked files; readings.json (tracked) always carried the data.
  glossary: { w: string; fa: string }[];
  questions: { q: string; choices: string[]; a: number; why?: string }[];
}

export const DECK: Card[] = (deckJson as { cards: Card[] }).cards;
export const PLACEMENT_ITEMS: PlacementItem[] = (placementJson as { items: PlacementItem[] }).items;
export const READINGS: Reading[] = (readingsJson as { readings: Reading[] }).readings;

export const cardById = (id: string): Card | undefined => DECK.find((c) => c.id === id);

export const SKILLS = ["vocabulary", "collocation", "grammar"] as const;

export function deckStats() {
  const byLevel: Record<string, number> = {};
  const byUnit: Record<string, number> = {};
  for (const c of DECK) {
    byLevel[c.level] = (byLevel[c.level] ?? 0) + 1;
    byUnit[c.unit] = (byUnit[c.unit] ?? 0) + 1;
  }
  return { total: DECK.length, byLevel, byUnit };
}

// ---------- Task 102 reconstruction: practice + listening content wiring ----------
// The feature session added these modules and re-exported them here; the
// recycle reset this file before that was committed. The content files
// survived (src/content/practice.ts, src/content/listening.ts) and define
// the exact names the components import.
import { WRITE_PROMPTS } from "@/content/practice";
export {
  GRAMMAR_LESSONS,
  SPEAK_PROMPTS,
  WRITE_PROMPTS,
  CHECKPOINT_TEXTS,
} from "@/content/practice";
export {
  MISS_TYPES,
  PASSAGES,
  PAIR_FOCUS,
  MINIMAL_PAIRS,
  STRESS_ITEMS,
  LINK_ITEMS,
} from "@/content/listening";

export const CARD_BY_ID = cardById;

// The new placement flow wants items + the writing prompt in one object.
export const PLACEMENT = { items: PLACEMENT_ITEMS, prompts: WRITE_PROMPTS.map((w) => w.prompt) };
