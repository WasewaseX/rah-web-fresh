// Exam and drill skills: the full exam generator, the quick check, and the
// four targeted 5-item drills.

import { db } from "@/lib/db";
import { generateExam, type ExamSkill } from "@/lib/exam";
import type { Skill } from "./run-types";
import { drill, toPublic } from "./quick-drills";

export const EXAM_SKILLS: Skill[] = [
  {
    id: "exam.generate",
    name: "Exam generator",
    blurb: "Full 10-item exam on any skill, graded with synonym-aware matching.",
    keywords: ["exam", "test", "quiz me", "assessment exam"],
    argHint: "collocations | grammar | vocabulary | spelling | mixed",
    async run(args, ctx) {
      const a = args.toLowerCase();
      const skill: ExamSkill = /collocation/.test(a) ? "collocation" : /grammar|tense/.test(a) ? "grammar" : /vocab|word/.test(a) ? "vocabulary" : /spell/.test(a) ? "spelling" : /read/.test(a) ? "reading" : /listen/.test(a) ? "listening" : /writ/.test(a) ? "writing" : "mixed";
      const spec = await generateExam({ skill, count: 10, kind: "standard", profile: ctx.profile });
      const created = await db.exam.create({
        data: { kind: "standard", skill, level: spec.level, spec: JSON.stringify(spec), status: "open" },
      });
      spec.id = created.id;
      await db.exam.update({ where: { id: created.id }, data: { spec: JSON.stringify(spec) } });
      return {
        label: `Generated a 10-item ${skill} exam`,
        summary: `A full 10-item exam (id ${created.id}, skill: ${skill}, about ${spec.minutes} minutes) is attached and renders inline. Announce exactly 10 items and ${spec.minutes} minutes, never any other count. The learner answers inline; grading is synonym-aware.`,
        payload: { type: "exam", examId: created.id, title: spec.title, minutes: spec.minutes, skill, items: toPublic(spec) },
      };
    },
  },
  {
    id: "exam.quick",
    name: "Quick check",
    blurb: "5-item rapid check when there is no time for a full exam.",
    keywords: ["quick", "fast test", "5 questions"],
    async run(args, ctx) {
      const a = args.toLowerCase();
      const skill: ExamSkill = /collocation/.test(a) ? "collocation" : /grammar/.test(a) ? "grammar" : /vocab|word/.test(a) ? "vocabulary" : "mixed";
      return drill(skill, ctx, `Generated a 5-item ${skill} quick check`);
    },
  },
  {
    id: "grammar.drill",
    name: "Grammar drill",
    blurb: "Targeted 5-item grammar drill tuned to your level and traps.",
    keywords: ["grammar drill", "drill my grammar", "grammar practice"],
    async run(_args, ctx) {
      return drill("grammar", ctx, "Generated a grammar drill");
    },
  },
  {
    id: "collocation.drill",
    name: "Collocation drill",
    blurb: "Verb-noun pairs that do not map from Farsi.",
    keywords: ["collocation", "word pairs", "make vs do"],
    async run(_args, ctx) {
      return drill("collocation", ctx, "Generated a collocation drill");
    },
  },
  {
    id: "vocabulary.drill",
    name: "Vocabulary drill",
    blurb: "B2-to-C1 word work in context.",
    keywords: ["vocabulary drill", "words drill", "vocab practice"],
    async run(_args, ctx) {
      return drill("vocabulary", ctx, "Generated a vocabulary drill");
    },
  },
  {
    id: "spelling.drill",
    name: "Spelling drill",
    blurb: "Common spelling traps for Farsi speakers.",
    keywords: ["spelling", "spell better", "orthography"],
    async run(_args, ctx) {
      return drill("spelling", ctx, "Generated a spelling drill");
    },
  },
];
