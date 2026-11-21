// Power skills: exams, assessment, deep analysis, plans, and the app-control
// plugins (theme, navigation, focus, settings). These are the capabilities the
// learner asked for by name.
//
// The definitions live in sibling modules under skills-power/ (topic files);
// this entry concatenates them into POWER_SKILLS in the exact order the
// deterministic router matches them, so importers see one list as before.

import type { SkillDef } from "./types";
import { INTERACTIVE_SKILLS } from "./skills-power/interactive";
import { COACHING_SKILLS } from "./skills-power/coaching";
import { EXAM_SKILLS } from "./skills-power/exams";
import { ANALYSIS_SKILLS } from "./skills-power/analysis";
import { REPORT_SKILLS } from "./skills-power/reports";
import { APP_CONTROL_SKILLS } from "./skills-power/app-control";

export const POWER_SKILLS: SkillDef[] = [
  ...INTERACTIVE_SKILLS,
  ...COACHING_SKILLS,
  ...EXAM_SKILLS,
  ...ANALYSIS_SKILLS,
  ...REPORT_SKILLS,
  ...APP_CONTROL_SKILLS,
];
