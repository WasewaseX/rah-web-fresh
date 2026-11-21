// The registry: the ordered SKILLS list, the fuzzy finder and the catalog
// projection. Group arrays are concatenated in their original order so the
// planner and /skill routing behave exactly as before.

import type { Skill } from "./run-types";
import { EXAM_SKILLS } from "./group-exam";
import { LEVEL_SKILLS } from "./group-level";
import { PRACTICE_SKILLS } from "./group-practice";
import { PLAN_SKILLS } from "./group-plan";
import { APP_SKILLS } from "./group-app";

export const SKILLS: Skill[] = [
  ...EXAM_SKILLS,
  ...LEVEL_SKILLS,
  ...PRACTICE_SKILLS,
  ...PLAN_SKILLS,
  ...APP_SKILLS,
];

export function findSkill(idOrName: string): Skill | undefined {
  const q = idOrName.trim().toLowerCase().replace(/^\/+/, "").replace(/^skill\s+/, "");
  if (!q) return undefined;
  const direct =
    SKILLS.find((s) => s.id.toLowerCase() === q) ??
    SKILLS.find((s) => s.id.toLowerCase().replace(".", " ") === q) ??
    SKILLS.find((s) => s.id.toLowerCase().endsWith(`.${q}`)) ??
    SKILLS.find((s) => s.name.toLowerCase() === q);
  if (direct) return direct;
  // Fuzzy fallback: score skills by how many of the caller's words appear in
  // the id, name, or keywords, so "/skill generate exam" still lands on
  // exam.generate regardless of word order or extra filler.
  const tokens = q.split(/[^a-z0-9#]+/).filter((t) => t.length > 2 && t !== "skill" && t !== "generate" && t !== "make" && t !== "create" && t !== "build" && t !== "please" && t !== "want" && t !== "give" && t !== "show" && t !== "run" && t !== "start");
  const stop = new Set(["the", "and", "for", "with", "some", "that", "this", "about", "quick", "deep", "full", "new", "set", "reset"]);
  const scoreOf = (s: Skill) => {
    const hay = `${s.id} ${s.name} ${s.keywords.join(" ")}`.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (!stop.has(t) && hay.includes(t)) score += 1;
    }
    return score;
  };
  let best: { s: Skill; score: number } | null = null;
  for (const s of SKILLS) {
    const score = scoreOf(s);
    if (score > 0 && (!best || score > best.score)) best = { s, score };
  }
  return best && best.score >= 1 ? best.s : undefined;
}

export function skillCatalog() {
  return SKILLS.map((s) => ({ id: s.id, name: s.name, blurb: s.blurb, argHint: s.argHint ?? null }));
}
