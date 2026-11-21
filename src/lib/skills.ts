// The Rah skill system. The coach is an agent that plans and executes these
// skills; the learner can also invoke any of them directly with /skill <id>.
// Every skill returns a SkillRun: a summary plus an optional payload the UI
// renders (interactive exam, level bands, theme patch, formatted card).
//
// The implementations live in sibling modules under skills/ (topic files,
// alongside the existing exam-generation internals); this entry is the public
// surface - it re-exports every name this module exported before, so
// importers keep their exact import paths.

export type {
  BandRow,
  ThemePatch,
  SkillPayload,
  SkillRun,
  SkillCtx,
  Skill,
} from "./skills/run-types";
export { getSetting, setSetting } from "./skills/settings-store";
export { THEME_PRESETS } from "./skills/appearance-presets";
export { SKILLS, findSkill, skillCatalog } from "./skills/skill-registry";
