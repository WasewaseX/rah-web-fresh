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
//
// Barrel file: the implementation lives in the ai-* siblings (shared types,
// JSON envelope machinery, prompt builders, BYO engine layer). This file
// re-exports every public name so importers keep importing from "@/lib/ai".

export type { ChatMsg, ProfileJson } from "./ai-types";
export { extractJson, aiJson } from "./ai-json";
export {
  profileBlock,
  tutorSystem,
  WRITING_GOALS,
  writingSystem,
  quizSystem,
  speakSystem,
  placementWritingSystem,
  listenSystem,
  planSystem,
  scanSystem,
  clinicSystem,
  assessSystem,
  examSystem,
} from "./ai-prompts";
export type { WritingGoal } from "./ai-prompts";
export {
  BUILTIN_MODEL,
  BUILTIN_PROFILE,
  presets,
  isBuiltin,
  effectiveProfile,
  profileView,
  chat,
  smartChat,
  aiText,
  listModels,
} from "./ai-engine";
export type { AiProfile, AiPreset } from "./ai-engine";
