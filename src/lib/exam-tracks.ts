// Authentic exam tracks (audit Stage 03 feature #3): real IELTS/TOEFL reading
// task types with enforced pacing. The honesty line is the product decision:
// these are TRAINING formats - real task types, real timing pressure, real
// passage-dependence - but they are not the real test and the score is not an
// official band. Every surface that shows a track score repeats that line.
//
// This module is PURE (no db, no server imports) so the client card can use
// the same registry the server generates and gates with: one source of truth
// for what a task type demands.

export interface TrackTaskType {
  id: string;
  label: string;
  share: number; // rough share of the item count
  contract: string; // exact item shape the generator must follow
}

export interface ExamTrack {
  id: string;
  label: string; // full honest label
  shortLabel: string; // chip text
  minutesPerItem: number; // authentic pacing, from the real formats
  caveat: string; // repeated verbatim wherever a track score shows
  passageMinWords: number; // a real reading passage is not 60 words
  taskTypes: TrackTaskType[];
}

export const IELTS_READING: ExamTrack = {
  id: "ielts_reading",
  label: "IELTS Academic Reading - training format",
  shortLabel: "IELTS Reading",
  minutesPerItem: 1.5, // the real format: 60 minutes / 40 questions
  caveat:
    "Training format: real IELTS reading task types and pacing, built fresh for you. It is not the real test, and the score is practice evidence, not an official band.",
  passageMinWords: 150, // real passages run longer, but the model reliably writes 150-250 - the floor must be reachable to be honest
  taskTypes: [
    {
      id: "tfng",
      label: "True / False / Not Given",
      share: 0.4,
      contract: `q must be exactly "True/False/Not Given: " followed by ONE statement, and choices MUST be exactly ["True", "False", "Not Given"] in that order. "a" is one of those three. The statement uses the passage's own topic but must be decidable from it alone: True when the passage agrees, False when the passage contradicts it, Not Given when the passage simply does not say. Never build a statement the passage only half-touches.`,
    },
    {
      id: "short-answer",
      label: "Short answers (lifted from the text)",
      share: 0.3,
      contract: `q is a question the passage directly answers, ending with "(NO MORE THAN THREE WORDS)". "a" is lifted VERBATIM from the passage (1-3 words, real IELTS rule: the answer is in the text). "accept" lists case and spelling variants. Never ask for an inference here - the answer string must literally sit in the passage.`,
    },
    {
      id: "detail-mcq",
      label: "Multiple choice (detail)",
      share: 0.3,
      contract: `A standard 4-choice question about a detail the passage states. Exactly one choice is defensible from the text; the distractors contradict it, swap details, or go beyond what the passage says. Distractors must reuse plausible passage vocabulary - that is what makes them IELTS-hard.`,
    },
  ],
};

export const TOEFL_READING: ExamTrack = {
  id: "toefl_reading",
  label: "TOEFL Reading - training format",
  shortLabel: "TOEFL Reading",
  minutesPerItem: 1.75, // the real format: ~35 minutes / 20 questions
  caveat:
    "Training format: real TOEFL reading task types and pacing, built fresh for you. It is not the real test, and the score is practice evidence, not an official band.",
  passageMinWords: 160, // real passages run longer, but the model reliably writes 150-250 - the floor must be reachable to be honest
  taskTypes: [
    {
      id: "vocab-in-context",
      label: "Vocabulary in context",
      share: 0.35,
      contract: `q must be exactly: In the passage, "<word>" is closest in meaning to: - where <word> is a real word FROM the passage (quote it exactly as the passage uses it). "a" is the closest synonym in that same part of speech; the other choices are same-part-of-speech words that fit the word in OTHER contexts but not here.`,
    },
    {
      id: "detail-mcq",
      label: "Factual detail",
      share: 0.35,
      contract: `A 4-choice question about a fact the passage explicitly states (dates, causes, claims, examples). Exactly one choice is stated or clearly entailed; distractors contradict the text or exchange its details.`,
    },
    {
      id: "inference-mcq",
      label: "Inference",
      share: 0.3,
      contract: `q asks what can be inferred from the passage (it may begin "According to the passage" only if the question stays about the text). Exactly one choice follows from the passage; the others contradict it, overstate it, or introduce information the passage never supports.`,
    },
  ],
};

export const TRACKS: ExamTrack[] = [IELTS_READING, TOEFL_READING];

export function trackById(id: string | null | undefined): ExamTrack | null {
  if (!id) return null;
  return TRACKS.find((t) => t.id === id) ?? null;
}

// Authentic pacing: the real formats' minutes-per-question, floored at 6 so a
// 3-item training set still feels like a timed section, not a flashcard.
export function minutesFor(track: ExamTrack, items: number): number {
  return Math.max(6, Math.ceil(items * track.minutesPerItem));
}

// Count clamp: a track exam is a passage-anchored section - short enough to
// finish inside the timer, long enough to feel like the format.
export function trackCount(track: ExamTrack, requested: number): number {
  return Math.max(6, Math.min(12, requested));
}

// ---------- content-word machinery (pure, battery-pinned) ----------

const STOP = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "any", "can", "her", "was", "one", "our", "out", "day", "get", "has", "him", "his", "how", "man", "new", "now", "old", "see", "two", "way", "who", "did", "its", "let", "she", "too", "use", "that", "with", "have", "this", "will", "your", "from", "they", "know", "want", "been", "good", "much", "some", "time", "very", "when", "come", "here", "just", "like", "make", "many", "more", "only", "over", "such", "take", "than", "them", "well", "were", "what", "which", "there", "their", "would", "could", "should", "about", "into", "than", "them", "because", "while", "where", "these", "those", "then", "also", "between", "both", "each", "most", "other", "same", "under", "after", "before", "during", "through", "against", "among",
]);

export function contentWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
}

function overlapCount(q: string, passage: string): number {
  const pWords = new Set(contentWords(passage));
  const seen = new Set<string>();
  let hits = 0;
  for (const w of contentWords(q)) {
    if (pWords.has(w) && !seen.has(w)) {
      seen.add(w);
      hits += 1;
    }
  }
  return hits;
}

export interface TrackItemShape {
  q: string;
  a: string;
  accept?: string[];
  choices?: string[];
  taskId?: string;
}

// The deterministic track gate: does this item actually hang on THIS passage?
// These checks are what make a track exam honest - a "short answer" whose key
// is not in the text is a fabricated item in real-IELTS clothing, and it dies
// here before the learner ever sees it.
export function trackItemAnswerable(item: TrackItemShape, passage: string): { ok: boolean; reason?: string } {
  const pLower = passage.toLowerCase();
  switch (item.taskId) {
    case "tfng": {
      if (!Array.isArray(item.choices) || item.choices.join("|") !== "True|False|Not Given") {
        return { ok: false, reason: "tfng choices must be exactly True/False/Not Given" };
      }
      if (!item.choices.includes(item.a)) return { ok: false, reason: "tfng key not among the three choices" };
      const statement = item.q.replace(/^true\/false\/not given:\s*/i, "");
      const hits = overlapCount(statement, passage);
      if (hits < 3) return { ok: false, reason: `statement barely touches the passage (${hits} shared content words)` };
      return { ok: true };
    }
    case "short-answer": {
      const words = item.a.trim().split(/\s+/).filter(Boolean);
      if (words.length < 1 || words.length > 3) return { ok: false, reason: "short-answer key must be 1-3 words" };
      const lifted = pLower.includes(item.a.trim().toLowerCase()) || (item.accept ?? []).some((x) => pLower.includes(String(x).trim().toLowerCase()));
      if (!lifted) return { ok: false, reason: "key is not lifted verbatim from the passage" };
      return { ok: true };
    }
    case "vocab-in-context": {
      const m = item.q.match(/"([^"]+)"(?: is closest in meaning to)/i);
      if (!m) return { ok: false, reason: 'vocab-in-context must quote the target word: In the passage, "word" is closest in meaning to:' };
      if (!pLower.includes(m[1].toLowerCase())) return { ok: false, reason: "the quoted target word does not appear in the passage" };
      if (!Array.isArray(item.choices) || item.choices.length < 3) return { ok: false, reason: "vocab-in-context needs at least 3 choices" };
      if (!item.choices.includes(item.a)) return { ok: false, reason: "key not among the choices" };
      return { ok: true };
    }
    case "detail-mcq":
    case "inference-mcq": {
      if (!Array.isArray(item.choices) || item.choices.length < 3) return { ok: false, reason: "mcq needs at least 3 choices" };
      if (!item.choices.includes(item.a)) return { ok: false, reason: "key not among the choices" };
      const hits = overlapCount(item.q, passage);
      if (hits < 3) return { ok: false, reason: `question barely touches the passage (${hits} shared content words)` };
      return { ok: true };
    }
    default:
      return { ok: false, reason: `unknown track task type: ${item.taskId ?? "(none)"}` };
  }
}

// Task-type share plan for a given count: deterministic split so the format
// promise (roughly these shares) holds even when generation needs top-ups.
export function taskTypePlan(track: ExamTrack, count: number): string[] {
  const out: string[] = [];
  for (const tt of track.taskTypes) {
    const n = Math.round(tt.share * count);
    for (let i = 0; i < n; i++) out.push(tt.id);
  }
  // Fill any rounding remainder with the largest-share type.
  const biggest = [...track.taskTypes].sort((a, b) => b.share - a.share)[0];
  while (out.length < count) out.push(biggest.id);
  return out.slice(0, count);
}
