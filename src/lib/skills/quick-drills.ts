// ---------- drills ----------
// Shared plumbing for the quick 5-item drill skills.

import { db } from "@/lib/db";
import { generateExam, type ExamSkill } from "@/lib/exam";
import type { SkillCtx, SkillRun } from "./run-types";

async function drill(skill: ExamSkill, ctx: SkillCtx, label: string): Promise<SkillRun> {
  const spec = await generateExam({ skill, count: 5, kind: "quick", profile: ctx.profile });
  const created = await db.exam.create({
    data: { kind: "quick", skill, level: spec.level, spec: JSON.stringify(spec), status: "open" },
  });
  spec.id = created.id;
  await db.exam.update({ where: { id: created.id }, data: { spec: JSON.stringify(spec) } });
  return {
    label,
    summary: `A 5-item ${skill} drill (id ${created.id}) is ready inline. Items use mixed kinds; grading is synonym-aware.`,
    payload: { type: "exam", examId: created.id, title: spec.title, minutes: spec.minutes, skill, items: toPublic(spec) },
  };
}

function toPublic(spec: { items: { id: string; skill: string; kind: string; prompt: string; choices?: string[]; hint: string }[] }) {
  return spec.items.map((it) => ({ id: it.id, skill: it.skill, kind: it.kind, prompt: it.prompt, choices: it.choices, hint: it.hint }));
}

export { drill, toPublic };
