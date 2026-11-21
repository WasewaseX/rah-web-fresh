// Reporting power skills: per-skill band report, the five-day study plan
// and the exam history browser.

import { db } from "@/lib/db";
import { aiJson } from "@/lib/ai";
import type { SkillDef, StepTrace } from "../types";
import { buildAssessment, getSkillLevels, spreadLine } from "../levels";
import { basePersona } from "../skills-util";

export const REPORT_SKILLS: SkillDef[] = [
  {
    id: "skill-report",
    name: "Skill report",
    oneLiner: "Per-skill bands: grammar vs vocab vs the rest",
    commands: ["report", "bands"],
    triggers: [/(skill|progress) report/i, /\bbands?\b/i, /my (strong|weak) (skill|spot)/i, /skill levels/i],
    run: async (_ctx) => {
      const steps: StepTrace[] = [];
      steps.push({ label: "Reading measured bands", detail: "grammar, vocabulary, writing, speaking, reading, listening" });
      const levels = await getSkillLevels();
      const assessment = await buildAssessment(spreadLine(levels));
      const measured = levels.filter((l) => l.samples > 0);
      const lines = measured.length
        ? measured.map((l) => `- ${l.skill}: ${l.level} (${Math.round(l.score * 100)}% mastery)`).join("\n")
        : "Nothing measured yet. Run /assess for the quick probe or /deep for the full analysis.";
      steps.push({ label: "Report ready", detail: `${measured.length} skills measured` });
      return {
        skill: "skill-report",
        reply: measured.length
          ? `Overall band: ${assessment.overall}.\n${lines}\n\n${assessment.note}`
          : `Overall band: not yet measurable.\n${lines}`,
        corrections: [],
        fa_note: "",
        steps,
        assessment,
      };
    },
  },
  {
    id: "study-plan",
    name: "Study plan",
    oneLiner: "Five days, aimed at your leaks",
    commands: ["plan"],
    triggers: [/study plan/i, /(daily|weekly|7[- ]day|five[- ]day) plan/i, /what should i (do|study|practice)( tomorrow| next| today)/i, /plan for (this|next) week/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      steps.push({ label: "Weighing your leaks", detail: `weak: ${ctx.profile.weakSkills.join(", ") || "balanced"}` });
      const out = await aiJson<{ plan: string[] }>(
        `${basePersona(ctx.profile)}

You are building a five-day plan, one line per day, each line a concrete task with a number in it (items, minutes, words). Aim every day at the learner's weak skills and traps. Output ONE JSON object: {"plan": ["Day 1: ...", ...]} with exactly 5 entries. No em dashes. No Farsi.`,
        [{ role: "user", content: `Build the plan. Profile: ${JSON.stringify(ctx.profile)}` }],
        () => ({ plan: [] }),
        {
          // Audit P1 (typed output validation): plan must be an array of
          // strings, else the retry budget runs and the fallback plan shows.
          validate: (o) =>
            o && typeof o === "object" && Array.isArray((o as { plan?: unknown }).plan) && (o as { plan: unknown[] }).plan.every((x) => typeof x === "string")
              ? null
              : "plan must be an array of strings",
        },
      );
      steps.push({ label: "Plan ready", detail: `${out.plan.length} days` });
      const plan = out.plan.length ? out.plan.map((p, i) => `${i + 1}. ${p}`).join("\n") : "Review 10 due cards, write 80 words about your day, and ask me for a collocation drill.";
      return {
        skill: "study-plan",
        reply: `Five days, aimed at your leaks:\n${plan}`.slice(0, 1000),
        corrections: [],
        fa_note: "",
        steps,
      };
    },
  },
  {
    id: "exam-history",
    name: "Exam history",
    oneLiner: "Past exams and scores",
    commands: ["history"],
    triggers: [/(exam|test) (history|results?|scores?)/i, /past (exams|tests)/i, /how did i do on (the|my) (last|previous)/i, /what did i (score|get) on (the|my) (last|previous)/i, /\b(last|previous) (exam|test)('s)? (score|result|grade)\b/i, /my exam (score|result|grade)/i],
    run: async (_ctx) => {
      const steps: StepTrace[] = [];
      steps.push({ label: "Loading graded exams", detail: "newest first" });
      const rows = await db.exam.findMany({ orderBy: { createdAt: "desc" }, take: 5 });
      const graded = rows.filter((r) => r.status === "graded" && r.result);
      steps.push({ label: "Found", detail: `${graded.length} graded of ${rows.length}` });
      const lines = graded.map((r) => {
        const res = JSON.parse(r.result!) as { correct: number; total: number; pct: number };
        return `- ${r.title}: ${res.correct}/${res.total} (${res.pct}%)`;
      });
      const pending = rows.filter((r) => r.status === "pending");
      return {
        skill: "exam-history",
        reply: graded.length
          ? `Last exams:\n${lines.join("\n")}${pending.length ? `\n\nOne exam is still open: ${pending[0].title}. Say "open my exam" and I will bring it back.` : ""}`
          : pending.length
            ? `No graded exams yet, but "${pending[0].title}" is still open. Finish and submit it.`
            : "No exams on record yet. Say the word and I will build one.",
        corrections: [],
        fa_note: "",
        steps,
      };
    },
  },
];
