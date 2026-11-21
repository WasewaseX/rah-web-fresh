// Shared types, direction labels and pure helpers for the Review loop.
// Split out of review.tsx so the component files stay inside the length
// budgets; the answer check and the TTS helper are ported unchanged from the
// proven pre-recovery implementation (git 5fecac8^ Review.tsx).

import { DECK } from "@/lib/content";
import type { FsrsState } from "@/lib/fsrs";

export interface CardView {
  id: string;
  unit?: string;
  kind: string;
  skill: string;
  level: string;
  prompt: string;
  answer: string;
  alt: string[];
  en: string;
  fa: string;
  note: string;
  traps?: string[];
  distractors?: string[];
}
// The live /api/review/queue item: { card, state, dir, tiles, ahead }.
export interface QueueItem {
  card: CardView;
  state: FsrsState;
  dir: string;
  tiles: string[];
  ahead: boolean;
}

// The session summary the completion screen reads from state (never a ref).
export type SessionDone = { n: number; reveals: number; hit: number; secs: number };

export type ReviewPhase = "prompt" | "checked" | "reveal";

export const DIR_LABEL: Record<string, string> = {
  cloze: "Retrieve the missing word",
  reverse: "Say it back in Farsi - type the chunk",
  fa2en: "Farsi on the left - produce the English",
  fae: "Produce the English chunk",
  audio: "Listen, then write what you heard",
  bank: "Build the English sentence from tiles",
  mcq_fa: "Pick the right meaning",
  pairs: "Pair match",
  ef: "Recall the Persian meaning",
  sent: "Use it in your own sentence",
};

export const GRADES = [
  { r: 1, label: "Again", key: "1", color: "var(--danger)" },
  { r: 2, label: "Hard", key: "2", color: "var(--rah-grade-hard)" },
  { r: 3, label: "Good", key: "3", color: "var(--accent)" },
  { r: 4, label: "Easy", key: "4", color: "var(--accent-deep)" },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:'"()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// What counts as "came back right" per direction: fa2en and bank ask for the
// whole English phrase; everything else checks against the card's answer.
export function acceptable(card: CardView, input: string, dir: string): boolean {
  const got = normalize(input);
  if (!got) return false;
  const targets = dir === "fa2en" ? [card.en, ...(card.alt ?? [])] : [card.answer, ...(card.alt ?? [])];
  return targets.some((t) => normalize(t) === got);
}

// Browser TTS: zero dependencies, works offline, matches the lightweight rule.
export function speak(text: string, rate = 0.92) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = rate;
    window.speechSynthesis.speak(u);
  } catch {
    // no tts in this browser; the text is always shown as fallback
  }
}

// Meaning-choice distractors: three Farsi glosses from elsewhere in the deck.
export function mcqChoices(card: CardView): string[] {
  const pool = DECK.filter((c) => c.fa && c.fa !== card.fa).sort(() => Math.random() - 0.5).slice(0, 3);
  return [card.fa, ...pool.map((c) => c.fa)].sort(() => Math.random() - 0.5);
}
