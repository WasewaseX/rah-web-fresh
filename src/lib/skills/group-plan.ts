// Planning and reporting skills: the 7-day study plan and the progress
// report built from real app data.

import { db } from "@/lib/db";
import { aiText } from "@/lib/ai";
import type { Skill } from "./run-types";

export const PLAN_SKILLS: Skill[] = [
  {
    id: "study.plan",
    name: "Study plan",
    blurb: "A concrete 7-day plan from your real weak spots.",
    keywords: ["study plan", "plan for me", "what should i study"],
    async run(_args, ctx) {
      const plan = await aiText(
        `You plan study weeks inside Rah for a ${ctx.profile.level} Farsi speaker. Using the live profile given by the user, write a 7-day plan in English. Each day: one line, one primary focus (pull from the learner's actual weak skills), one concrete output (10 cards, 5-minute monologue, 120-word essay, and so on). Max 120 words total. No preamble, no closing fluff, never use the em dash character.`,
        [{ role: "user", content: JSON.stringify(ctx.profile) }],
      );
      return {
        label: "Drafted a 7-day plan",
        summary: "Plan attached. Ask which day to start today.",
        payload: { type: "card", title: "Your next 7 days", body: plan },
      };
    },
  },
  {
    id: "progress.report",
    name: "Progress report",
    blurb: "What the numbers say: volume, accuracy, leaks, level movement.",
    keywords: ["progress report", "how am i doing", "my stats"],
    async run(_args, ctx) {
      const stats = await db.dailyStat.findMany({ orderBy: { day: "asc" }, take: 30 });
      const xp = stats.reduce((a, s) => a + s.xp, 0);
      const reviews = stats.reduce((a, s) => a + s.reviews, 0);
      const correct = stats.reduce((a, s) => a + s.correct, 0);
      const l = await db.learner.findUnique({ where: { id: "me" } });
      const bands = await db.skillBand.findMany();
      const facts = {
        level: l?.level ?? "?",
        streak: l?.streak ?? 0,
        activeDays: stats.filter((s) => s.reviews > 0).length,
        xp30: xp,
        reviews30: reviews,
        accuracy: reviews ? Math.round((correct / reviews) * 100) : null,
        bands: bands.map((b) => ({ band: b.band, level: b.level, score: Math.round(b.score) })),
      };
      const report = await aiText(
        `You write progress reports inside Rah for a ${ctx.profile.level} Farsi speaker. From the JSON facts, write max 110 words in English: two things that are clearly working, one leak to fix, one sentence on level movement (or that bands are not yet measured). No headers, no bullet points, plain tight prose. Never use the em dash character.`,
        [{ role: "user", content: JSON.stringify(facts) }],
      );
      return {
        label: "Compiled a progress report",
        summary: "Report attached, built from real app data.",
        payload: { type: "card", title: "Progress report", body: report },
      };
    },
  },
];
