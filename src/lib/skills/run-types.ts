// Shared contracts for the Rah skill system: the envelope a run returns,
// the band row shape, the theme patch, and the Skill interface the agent
// plans with.

import type { ProfileJson } from "@/lib/ai";

export interface BandRow {
  band: string; // grammar | vocabulary | writing | speaking | reading | listening | overall
  level: string; // A2 .. C1
  score: number; // 0 to 100
  evidence: string;
}

export interface ThemePatch {
  name: string;
  primary: string;
  primaryDeep: string;
  accent: string;
  rgb: string; // "r,g,b" of primary for shadows and washes
}

export type SkillPayload =
  | { type: "exam"; examId: string; title: string; minutes: number; skill: string; items: unknown[] }
  | { type: "bands"; title: string; bands: BandRow[]; deep: boolean }
  | { type: "theme"; patch: ThemePatch }
  | { type: "effect"; effect: string }
  | { type: "card"; title: string; body: string; reveal?: string };

export interface SkillRun {
  label: string; // short verb phrase shown in the agent trace, e.g. "Generated a 10-item exam"
  summary: string; // context handed to the reply synthesizer
  payload?: SkillPayload;
}

export interface SkillCtx {
  profile: ProfileJson;
  args: string; // everything after the skill id, trimmed
}

export interface Skill {
  id: string;
  name: string;
  blurb: string;
  keywords: string[];
  argHint?: string;
  run(args: string, ctx: SkillCtx): Promise<SkillRun>;
}
