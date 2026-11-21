// Coaching-cycle power skills: the daily challenge, the weekly report,
// the pronunciation lab, summary scoring and mode exit.

import { db } from "@/lib/db";
import { aiJson } from "@/lib/ai";
import type { SkillDef, StepTrace } from "../types";
import { startDaily, clearMode } from "../mode-flow";
import { getSkillLevels } from "../levels";
import { topMistakes } from "@/lib/mistakes";
import { contentUserId } from "@/lib/scope";
import { MINIMAL_PAIRS } from "./data";

export const COACHING_SKILLS: SkillDef[] = [
  {
    id: "daily-challenge",
    name: "Daily challenge",
    oneLiner: "One hard item, built from your weakest spot today, graded on the spot",
    commands: ["daily", "challenge"],
    triggers: [/daily challenge/i, /\bchallenge me\b/i, /daily (quest|puzzle)/i, /todays? challenge/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      return startDaily(ctx.profile, (l, d) => steps.push({ label: l, detail: d }));
    },
  },
  {
    id: "coach-report",
    name: "Coach report",
    oneLiner: "Your week in hard numbers, with one focus for next week",
    commands: ["week", "report-card"],
    triggers: [/(weekly|coach) report/i, /how (was|did) my week/i, /report card/i, /week in (numbers|review)/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      steps.push({ label: "Crunching your data", detail: "7 days, bands, exams, memory" });
      const since = Date.now() / 1000;
      const days = await db.dailyStat.findMany({ where: { userId: await contentUserId().catch(() => "me"), day: { gte: Math.floor(since / 86400) - 7 } } });
      const reviews = days.reduce((a, d) => a + d.reviews, 0);
      const xp = days.reduce((a, d) => a + d.xp, 0);
      const correct = days.reduce((a, d) => a + d.correct, 0);
      const bands = await getSkillLevels();
      const mistakes = await topMistakes(50);
      const active = mistakes.filter((m) => !m.resolvedAt);
      const healed = mistakes.filter((m) => m.resolvedAt);
      const exams = await db.exam.findMany({ where: { status: "graded" }, orderBy: { createdAt: "desc" }, take: 5 });
      const pcts = exams.map((e) => {
        try {
          return (JSON.parse(e.result ?? "{}") as { pct?: number }).pct ?? 0;
        } catch {
          return 0;
        }
      });
      const trend = pcts.length >= 2 ? (pcts[0] >= pcts[pcts.length - 1] ? "trending up" : "slipping") : "not enough exams yet";
      const worstBand = [...bands].sort((a, b) => a.score - b.score)[0];
      const focus = active[0]?.label ?? worstBand ? `${worstBand ? `${worstBand.skill} (${worstBand.level})` : "consistency"}` : "consistency";
      const lines = [
        `Last 7 days: ${reviews} reviews, ${correct} correct, ${xp} XP, ${days.length} active day(s), streak ${ctx.profile.streak}.`,
        bands.length ? `Bands: ${bands.map((b) => `${b.skill} ${b.level}`).join(", ")}.` : "No measured bands yet - run /assess.",
        pcts.length ? `Recent exams: ${pcts.join("%, ")}% (${trend}).` : "No graded exams yet.",
        `Mistake memory: ${active.length} active famil${active.length === 1 ? "y" : "ies"}, ${healed.length} healed.`,
        `Next-week focus: ${active[0] ? `${active[0].label} - the exams already hunt it; two clean hits retire it.` : `${focus}.`}`,
      ];
      return { skill: "coach-report", reply: lines.join("\n"), corrections: [], fa_note: "", steps };
    },
  },
  {
    id: "minimal-pairs",
    name: "Pronunciation lab",
    oneLiner: "Minimal pairs for the exact sounds Persian speakers collapse",
    commands: ["pairs"],
    triggers: [/\bminimal pairs?\b/i, /pronunciation (lab|drill|pairs)/i, /\bth sounds?\b/i, /(practice|train|fix) my (th|w|v|pronunciation)/i, /i (cant|can't|cannot) (say|pronounce) (th|w)\b/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      const t = ctx.text.toLowerCase();
      const pick = MINIMAL_PAIRS.filter((b) => t.includes(b.tag.replace(/_/g, " ")) || t.includes(b.tag));
      const chosen = pick.length ? pick : [MINIMAL_PAIRS[Math.floor(Math.random() * MINIMAL_PAIRS.length)]];
      steps.push({ label: "Pronunciation lab", detail: chosen.map((b) => b.tag).join(", ") });
      const lines = chosen.flatMap((b, i) => [
        `${i + 1}. ${b.tag.replace(/_/g, " ")}:`,
        ...b.pairs.map(([a, c]) => `   - ${a}  vs  ${c}`),
        `   Tip: ${b.tip}`,
      ]);
      return {
        skill: "minimal-pairs",
        reply: `Say each pair aloud 3 times, exaggerating the contrast, then take them into the Speaking view and let the grader hear them.\n\n${lines.join("\n")}\n\nWant a specific sound next? Ask for "th sounds", "w vs v", "clusters", "ng" or "stress".`,
        corrections: [],
        fa_note: chosen.map((b) => b.fa).join(" "),
        steps,
      };
    },
  },
  {
    id: "summarize",
    name: "Summary check",
    oneLiner: "Scores your summary of any text for fidelity and language",
    commands: ["summarize"],
    triggers: [/^(check|grade|review) my (summary|summaries)/i, /\bmy summary\b/i, /^(here('s| is) )?my summary/i, /summar(ize|ise) check/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      const text = ctx.text.replace(/^(check|grade|review) my (summary|summaries)[:,-]?\s*/i, "").trim();
      if (text.length < 20) {
        return {
          skill: "summarize",
          reply: "Paste the summary (and, if you can, the original text after 'original:'). I score how faithfully it captures the source and how clean the English is - misses feed the mistake memory like everything else.",
          corrections: [],
          fa_note: "",
          steps,
        };
      }
      const original = text.match(/\boriginal:\s*([\s\S]+)/i)?.[1]?.trim() ?? "";
      const summary = original ? text.slice(0, text.toLowerCase().indexOf("original:")).trim() : text;
      steps.push({ label: "Reading your summary", detail: `${summary.split(/\s+/).length} words${original ? ", original provided" : ""}` });
      const out = await aiJson<{ reply?: string; corrections?: { wrong?: string; right?: string; fa?: string; trap?: string }[] }>(
        `You are the summary examiner inside Rah for a Farsi speaker around ${ctx.profile.level}.
${original ? `ORIGINAL TEXT:\n${original.slice(0, 1200)}\n\n` : "No original provided - judge language quality and coherence only.\n"}LEARNER'S SUMMARY:\n${summary.slice(0, 1200)}

reply: max 110 words. ${original ? "How faithful is the summary (anything missed, anything distorted), then language verdict. " : "Language and coherence verdict. "}End with ONE concrete upgrade to try.
corrections: up to 3 real errors, each {"wrong", "right", "fa" (Farsi why), "trap" (one of: statives, articles, countability, plurals, copula, prepositions, perfect, question_order, adjectives, that_omission, word_choice, register)}.
Output ONE JSON object, no em dash.`,
        [{ role: "user", content: text.slice(0, 2000) }],
        () => ({}),
        { deep: false, temperature: 0.4 },
      );
      return {
        skill: "summarize",
        reply: String(out.reply ?? "").trim() || "Tell me more about the summary and I will grade it properly.",
        corrections: (Array.isArray(out.corrections) ? out.corrections : []).slice(0, 3).map((c) => ({
          wrong: String(c.wrong ?? ""),
          right: String(c.right ?? ""),
          fa: String(c.fa ?? ""),
          trap: String(c.trap ?? "word_choice"),
        })),
        fa_note: "",
        steps,
      };
    },
  },
  {
    id: "exit-mode",
    name: "End mode",
    oneLiner: "Leave roleplay, debate, socratic or the daily challenge",
    commands: ["end", "exit", "stop"],
    triggers: [],
    run: async (_ctx) => {
      const steps: StepTrace[] = [];
      const learner = await db.learner.findUnique({ where: { id: "me" } });
      if (learner && learner.mode !== "coach") {
        await clearMode("slash exit");
        return { skill: "exit-mode", reply: "Mode closed. Back in coach mode - what next?", corrections: [], fa_note: "", steps };
      }
      return { skill: "exit-mode", reply: "No active mode right now. Start one: /roleplay, /debate, /socratic or /daily.", corrections: [], fa_note: "", steps };
    },
  },
];
