// Sound Lab - phoneme-proxy feedback for the Voice Arena (review feature #2:
// "phoneme-level pronunciation feedback").
//
// Honesty doctrine, same as the rest of Rah: the ASR transcript is MEASURED
// (the recognizer really heard "vant" where the target said "want"); the SOUND
// behind the mismatch is an INFERENCE from the letter pattern. So this engine
// only claims a sound contrast when the pattern matches a documented
// Farsi-speaker confusion cleanly - everything else is reported as a plain
// word mismatch, never a made-up phoneme label.
//
// Deterministic end to end: same (target, transcript) pair in, same report
// out. No AI, no network. The battery pins the pairs below.
//
// This file holds the static tables (report types, drill banks, labels, tips);
// the alignment + detection engine lives in ./detect.

export interface SoundEvidence {
  target: string;
  heard: string;
}

export interface SoundContrast {
  key: string;
  label: string;
  tip: string;
  evidence: SoundEvidence[];
  drill: { front: string; back: string }[];
}

export interface SoundReport {
  contrasts: SoundContrast[];
  other: SoundEvidence[]; // word pairs that differ but match no known contrast
  note: string;
}

export const HONEST_NOTE =
  "What the mic heard is measured. The sound behind it is inferred from the pattern - the drills are the point, not the label.";

// Tense/lax vowel pairs: i vs ee/ea (ship/sheep, live/leave), a vs e (bad/bed),
// u vs oo (full/fool), o vs u (not/nut - reported sparingly).
export const VOWEL_SWAPS: Record<string, string[]> = {
  a: ["e"],
  e: ["a"],
  i: ["ee", "ea", "e"],
  ee: ["i"],
  ea: ["i", "e"],
  u: ["oo", "o"],
  oo: ["u"],
  o: ["u"],
};

// ---------- minimal-pair drills ----------

export const DRILLS: Record<string, { front: string; back: string }[]> = {
  "w-v": [
    { front: "west", back: "vest" },
    { front: "wine", back: "vine" },
    { front: "wet", back: "vet" },
  ],
  "p-b": [
    { front: "park", back: "bark" },
    { front: "pig", back: "big" },
    { front: "cap", back: "cab" },
  ],
  th: [
    { front: "think", back: "sink" },
    { front: "three", back: "tree" },
    { front: "faith", back: "face" },
  ],
  ng: [
    { front: "sin", back: "sing" },
    { front: "ran", back: "rang" },
    { front: "thin", back: "thing" },
  ],
  "s-sh": [
    { front: "sip", back: "ship" },
    { front: "seat", back: "sheet" },
    { front: "mass", back: "mash" },
  ],
  "vowel:a-e": [
    { front: "bad", back: "bed" },
    { front: "man", back: "men" },
    { front: "bat", back: "bet" },
  ],
  "vowel:i-ee": [
    { front: "ship", back: "sheep" },
    { front: "sit", back: "seat" },
    { front: "live", back: "leave" },
  ],
  "vowel:ee-i": [
    { front: "sheep", back: "ship" },
    { front: "seat", back: "sit" },
    { front: "leave", back: "live" },
  ],
  "vowel:ea-i": [
    { front: "leave", back: "live" },
    { front: "heat", back: "hit" },
  ],
  "vowel:e-ea": [
    { front: "set", back: "seat" },
    { front: "bet", back: "beat" },
  ],
  "vowel:u-oo": [
    { front: "full", back: "fool" },
    { front: "pull", back: "pool" },
  ],
  "vowel:oo-u": [
    { front: "fool", back: "full" },
    { front: "pool", back: "pull" },
  ],
  "vowel:o-u": [
    { front: "not", back: "nut" },
    { front: "cop", back: "cup" },
  ],
  "vowel:u-o": [
    { front: "nut", back: "not" },
    { front: "cup", back: "cop" },
  ],
  "vowel:e-a": [
    { front: "bed", back: "bad" },
    { front: "men", back: "man" },
  ],
  "vowel:i-e": [
    { front: "hit", back: "het" },
    { front: "sit", back: "set" },
  ],
  "vowel:e-i": [
    { front: "set", back: "sit" },
    { front: "met", back: "mit" },
  ],
  clusters: [
    { front: "asked", back: "asked (as-ked)" },
    { front: "texts", back: "texts (tex-ts)" },
    { front: "world", back: "world (wor-ld)" },
  ],
};

export const LABELS: Record<string, string> = {
  "w-v": "w vs v - Persian has no /w/",
  "p-b": "p vs b - unaspirated p reads as b",
  th: "th simplifies to t/s/z - no dental fricatives in Persian",
  ng: "final -ng drops to -n",
  "s-sh": "s vs sh",
  "vowel:a-e": "bad vs bed - lax ae vs e",
  "vowel:e-a": "bed vs bad - lax ae vs e",
  "vowel:i-ee": "ship vs sheep - lax vs tense i",
  "vowel:ee-i": "sheep vs ship - tense vs lax i",
  "vowel:ea-i": "leave vs live - tense vs lax i",
  "vowel:e-ea": "set vs seat - e vs tense ea",
  "vowel:i-e": "sit vs set - lax i vs e",
  "vowel:e-i": "set vs sit - e vs lax i",
  "vowel:u-oo": "full vs fool - short vs long u",
  "vowel:oo-u": "fool vs full - long vs short u",
  "vowel:o-u": "not vs nut - o vs u",
  "vowel:u-o": "nut vs not - u vs o",
  clusters: "final consonant clusters reduce - hold every letter",
};

export const TIPS: Record<string, string> = {
  "w-v": "Round your lips hard before the sound: W starts like OO, V starts with the top teeth on the lip.",
  "p-b": "Hold a strip of paper in front of your mouth - P must puff it out, B must not.",
  th: "Tongue tip between the teeth and blow. If it whistles like S or pops like T, it is not th.",
  ng: "Press the back of the tongue to the soft palate and keep the air in the nose - no n stop at the end.",
  "s-sh": "Widen the tongue groove for SH; S is a thin whistle with the tongue closer to the teeth.",
  "vowel:a-e": "Open the jaw for BAD (like a doctor's aaah, short) - BED keeps the jaw half shut.",
  "vowel:i-ee": "SHEEP is long with a smile; SHIP is short and relaxed. Overdo the length difference for a week.",
  "vowel:ee-i": "SHEEP is long with a smile; SHIP is short and relaxed.",
  "vowel:ea-i": "LEAVE is long; LIVE is short and relaxed - same smile, half the length.",
  "vowel:e-ea": "SEAT is long and tense; SET is short. Hold the length twice as long as feels natural.",
  "vowel:i-e": "SIT drops the jaw a touch more than SET. Say them in pairs until they feel different.",
  "vowel:e-i": "SET drops the jaw a touch more than SIT. Say them in pairs until they feel different.",
  "vowel:u-oo": "FULL is short with a loose lip; FOOL is long with rounded lips.",
  "vowel:oo-u": "FOOL is long with rounded lips; FULL is short with a loose lip.",
  "vowel:o-u": "NOT is rounded and low; NUT is a lazy central uh. Keep the lips still for NUT.",
  "vowel:u-o": "NUT is a lazy central uh; NOT rounds the lips and drops the jaw.",
  clusters: "Say the cluster slowly, then speed up without dropping letters: as-ked, tex-ts, wor-ld.",
};
