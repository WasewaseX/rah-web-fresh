// Records the listening-vs-shadowing sequencing decision (operator queue item).
//   DATABASE_URL=$(grep -E '^DATABASE_URL=' .env | cut -d= -f2-) bun scripts/decision-listening.ts
import "@prisma/client";

const KEY = "decision:listening-vs-shadowing-2026-11-03";

const value = JSON.stringify({
  question: "Evaluate order: voice shadowing vs structured B2-C1 listening library",
  decision: "LISTENING LIBRARY FIRST, shadowing second on top of it",
  evidence: {
    listening_library_status: "~70% built: ladderFor(level) gives band + ttsRate progression; /api/listen generates level-appropriate passages and returns the ladder; ListeningLog already records passageId/round/missType/detail misses; Checkpoint.listeningPct is the weekly protocol metric.",
    shadowing_status: "0% built (no shadow surface anywhere); foundations ready: /api/tts for reference audio, /api/asr for transcripts, SpeakSession/SpeakingAttempt.attemptNo already model repeat attempts per prompt.",
  },
  rationale:
    "1) The library is mostly built - finishing it is the highest progress-per-hour. 2) B2->C1 for a Farsi speaker is ear-bound: English stress-timing vs Farsi syllable-timing, th/w/v clusters, weak forms; blind listen + miss taxonomy attacks exactly that. 3) Shadowing needs material with a difficulty ladder anyway - the library becomes its source (shadow the same passageIds), so building shadowing first would stall on content.",
  sequence: [
    "1. Persist generated passages as a catalog (id, band, ttsRate, topic) instead of throwaway generations",
    "2. Band promotion rule: 3 rounds >= 80% at current band -> promote band + ttsRate step (B2 -> B2+ -> C1)",
    "3. Miss-driven replay: resurface passageIds with logged missTypes (ListeningLog) in the review loop",
    "4. THEN shadowing: same catalog passages as reference audio (TTS rate = band ladder), record + ASR + diff against reference, SpeakingAttempt.attemptNo progression, score = word-level recall + pace match",
  ],
  at: new Date().toISOString(),
});

const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();
await db.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
console.log("recorded:", KEY);
process.exit(0);
