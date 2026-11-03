// The revived registry. CORE_SKILLS + POWER_SKILLS (count lives in
// REGISTRY.length - never hardcode it again); the planner routes into this table.

import type { SkillDef, SkillId } from "./types";
import { CORE_SKILLS } from "./skills-core";
import { POWER_SKILLS } from "./skills-power";

// REGISTRY order is routing priority (routeByTrigger iterates first-match):
// CORE teaching skills are SPECIFIC (collocation, phrasal, idioms...) and must
// beat the broad POWER verbs (explain, debate...). The conversations-100
// battery caught the old power-first order misrouting "explain phrasal verbs"
// to the generic explainer. NEVER hardcode REGISTRY.length again.
export const REGISTRY: SkillDef[] = [...CORE_SKILLS, ...POWER_SKILLS];

export function getSkill(id: string): SkillDef | undefined {
  return REGISTRY.find((s) => s.id === id);
}

export function hasSkill(id: string): id is SkillId {
  return REGISTRY.some((s) => s.id === id);
}

export function skillCatalog(): string {
  return REGISTRY.map((s) => `- ${s.id}: ${s.name} (${s.oneLiner})`).join("\n");
}

export function commandMap(): Map<string, SkillDef> {
  const m = new Map<string, SkillDef>();
  for (const s of REGISTRY) for (const c of s.commands) m.set(c, s);
  return m;
}
