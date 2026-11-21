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
// Implementation split: ./phonemes/data.ts holds the report types and the
// static tables (drill banks, labels, tips); ./phonemes/detect.ts holds the
// alignment engine and diagnoseSounds. This module re-exports the same
// public surface as before the split, so importers do not change.

export type { SoundEvidence, SoundContrast, SoundReport } from "./phonemes/data";
export { alignWords, diagnoseSounds } from "./phonemes/detect";
