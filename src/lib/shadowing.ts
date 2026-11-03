// Goal-bound voice shadowing (ROADMAP §3.1 / §5 ELSA row).
//
// Loop: listen → imitate → word-level compare (the measured ASR-alignment
// tier from lib/pronunciation.ts) → recurring errors become FSRS items.
//
// This module is the pure, deterministic seam: the target pool with its
// interference tags, the miss extractor, the cross-attempt aggregation, and
// the card-minting decision. No AI, no network, no DB - the route composes
// these with the real stores, the battery pins the arithmetic.

import type { PronReport } from "./pronunciation";

// Same interference taxonomy as Sound Lab's minimal pairs (focus ids), plus
// two speech-flow tags the pair drill never covered. Each sentence stresses
// its documented Farsi-speaker trouble spot so a short shadow produces usable
// contrast evidence.
export interface ShadowTarget {
  id: string;
  text: string;
  focus: string; // wv | th | ae_e | i_i | o_oo | linking | stress
  focusLabel: string;
}

export const SHADOW_TARGETS: ShadowTarget[] = [
  { id: "sh1", text: "We went to see a very wide river in the west on a windy Wednesday.", focus: "wv", focusLabel: "w vs v" },
  { id: "sh2", text: "I would like to reserve a table for two people at eight in the evening.", focus: "wv", focusLabel: "w vs v" },
  { id: "sh3", text: "The thirty-three thieves thought that they thrilled the throne throughout Thursday.", focus: "th", focusLabel: "th vs s/t" },
  { id: "sh4", text: "They bathed in the warm air while their brother gathered the weather data.", focus: "th", focusLabel: "th vs s/t" },
  { id: "sh5", text: "Put the park pass in that paper bag beside the pink pig.", focus: "ae_e", focusLabel: "ae vs e" },
  { id: "sh6", text: "She sells fresh fish and chips on ships near the seashore.", focus: "i_i", focusLabel: "short i vs long ee" },
  { id: "sh7", text: "The full pool felt cool under the fool's fooling moon.", focus: "o_oo", focusLabel: "short o vs long oo" },
  { id: "sh8", text: "His best test asked for the texts and the world map.", focus: "ae_e", focusLabel: "final clusters" },
  { id: "sh9", text: "What are you going to do about the second interview?", focus: "linking", focusLabel: "reductions: whaddaya gonna" },
  { id: "sh10", text: "I used to walk to work, but I want to take the bus this winter.", focus: "linking", focusLabel: "used to / want to" },
  { id: "sh11", text: "The photographer took a photograph of the development opportunity.", focus: "stress", focusLabel: "stress shifts" },
  { id: "sh12", text: "It is responsible development for a growing population.", focus: "stress", focusLabel: "stress shifts" },
];

export const SHADOW_FOCUS_IDS = Array.from(new Set(SHADOW_TARGETS.map((t) => t.focus)));

// ---------- miss extraction ----------

export interface ShadowMiss {
  word: string;
  heard: string | null;
  near: boolean;
}

// The words worth tracking: everything the recognizer did NOT hear as a clean
// hit (near = half credit, miss = not recognized). Deterministic.
export function missesOf(report: PronReport): ShadowMiss[] {
  return report.words
    .filter((w) => w.status === "near" || w.status === "miss")
    .map((w) => ({ word: w.target, heard: w.heard, near: w.status === "near" }));
}

// ---------- cross-attempt aggregation ----------

export interface MissTally {
  word: string;
  count: number;
  nearCount: number;
  lastHeard: string | null;
  focuses: string[]; // focus ids of targets the word was missed in
}

// Aggregate a learner's shadow history (oldest first) into per-word tallies.
// `attempts` carries the misses extracted from each stored attempt.
export function tallyMisses(attempts: { focus: string; misses: ShadowMiss[] }[]): Map<string, MissTally> {
  const map = new Map<string, MissTally>();
  for (const att of attempts) {
    for (const m of att.misses) {
      const key = m.word.toLowerCase();
      const cur = map.get(key) ?? { word: m.word.toLowerCase(), count: 0, nearCount: 0, lastHeard: null, focuses: [] };
      cur.count += 1;
      if (m.near) cur.nearCount += 1;
      // Last attempt wins, even when it heard nothing: a stale mishearing
      // must not survive an attempt where the word was dropped entirely.
      cur.lastHeard = m.heard;
      if (!cur.focuses.includes(att.focus)) cur.focuses.push(att.focus);
      map.set(key, cur);
    }
  }
  return map;
}

// A word becomes an FSRS item when it has been missed this many times across
// DIFFERENT attempts (repetition is what makes it recurring, not one bad day).
export const CARD_THRESHOLD = 3;

export function wordsNeedingCards(tallies: Map<string, MissTally>, existingCardWords: Set<string>): string[] {
  const out: string[] = [];
  for (const [word, t] of tallies) {
    if (t.count >= CARD_THRESHOLD && !existingCardWords.has(`shadow-miss:${word}`)) out.push(word);
  }
  return out.sort();
}

// The card shape minted from a recurring miss. Honest provenance lives in the
// note (marker used for dedupe + the human-readable line); the sentence that
// exposed the word rides along as context. kind "ef" = see the English word,
// recall it in context - a pronunciation card is self-checked out loud.
export function shadowCardFor(word: string, tally: MissTally, sentence: string) {
  return {
    kind: "ef",
    prompt: word,
    answer: sentence,
    en: sentence,
    fa: "",
    note: `shadow-miss:${word} — pronunciation watch: missed ${tally.count}× in shadowing (${
      tally.lastHeard ? `last heard as "${tally.lastHeard}"` : "not recognized on the last try"
    }). Say it in the sentence, then compare.`,
  };
}

// ---------- weak-focus ranking (goal-bound target order) ----------

// Rank focus tags by the learner's measured weakness: minimal-pair Sound Log
// error rates first (more attempts = more confident the rank), then focus
// tags that keep appearing in shadow misses. Returns focus ids, weakest first.
export function rankWeakFocuses(
  soundLog: { focus: string; correct: boolean }[],
  missFocuses: string[] // focus ids from shadow attempts, repetition-weighted
): string[] {
  const all = new Set<string>(SHADOW_FOCUS_IDS);
  const acc = new Map<string, { c: number; n: number }>();
  for (const s of soundLog) {
    if (!all.has(s.focus)) continue;
    const cur = acc.get(s.focus) ?? { c: 0, n: 0 };
    cur.n += 1;
    if (s.correct) cur.c += 1;
    acc.set(s.focus, cur);
  }
  const missWeight = new Map<string, number>();
  for (const f of missFocuses) missWeight.set(f, (missWeight.get(f) ?? 0) + 1);

  const score = (f: string): number => {
    const a = acc.get(f);
    // error rate 0..1, confidence-scaled by attempts (0 attempts -> 0.5 prior, weight 0)
    const errRate = a && a.n > 0 ? 1 - a.c / a.n : 0.5;
    const confidence = a ? Math.min(1, a.n / 8) : 0;
    const fromSound = errRate * confidence;
    const fromMisses = Math.min(1, (missWeight.get(f) ?? 0) / 6) * 0.5;
    return fromSound + fromMisses;
  };
  return Array.from(all).sort((x, y) => score(y) - score(x));
}

// Order the target pool weakest-focus-first, stable within a focus.
export function orderTargets(targets: ShadowTarget[], weakFirst: string[]): ShadowTarget[] {
  const rank = new Map(weakFirst.map((f, i) => [f, i]));
  return [...targets].sort((a, b) => (rank.get(a.focus) ?? 99) - (rank.get(b.focus) ?? 99) || a.id.localeCompare(b.id));
}
