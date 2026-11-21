// Exam-format power skills: IELTS/TOEFL/C1 tracks, the general exam builder
// (with negation-aware skill targeting) and the quick level probe.

import type { SkillDef, StepTrace } from "../types";
import { generateExam } from "../exam";
import { EXAM_TRACKS } from "@/lib/agent/exam-tracks";

export const EXAM_SKILLS: SkillDef[] = [
  {
    id: "exam-track",
    name: "Exam-format tracks",
    oneLiner: "IELTS / TOEFL / Cambridge C1-style practice with a rough band reference",
    commands: ["ielts", "toefl", "c1"],
    triggers: [
      /\b(ielts)\b/i,
      /\btoefl\b/i,
      /\b(c1 advanced|cambridge c1|c1a)\b/i,
    ],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      const track = /\bielts\b/i.test(ctx.text) ? "ielts" : /\btoefl\b/i.test(ctx.text) ? "toefl" : "c1a";
      const t = EXAM_TRACKS[track];
      const countMatch = ctx.text.match(/(\d{1,2})\s*(questions?|items?|q\b)/i) ?? ctx.args.match(/(\d{1,2})/);
      const count = countMatch ? parseInt(countMatch[1], 10) : t.defaultCount;
      const { client, spec } = await generateExam(ctx.profile, ["collocation", "grammar", "vocabulary", "reading", "writing"], count, (l, d) => steps.push({ label: l, detail: d }), { track });
      return {
        skill: "exam-track",
        reply: `${client.title}: ${client.count} questions, about ${spec.minutes} minutes, ${t.label} task types. Submit when done and I will break it down by skill with a band reference. Honest limits: ${t.disclaimer}`,
        corrections: [],
        fa_note: "",
        steps,
        exam: client,
      };
    },
  },
  {
    id: "generate-exam",
    name: "Exam builder",
    oneLiner: "A full checkpoint exam, graded with mercy for synonyms",
    commands: ["exam", "test", "quiz-full"],
    triggers: [
      // Narrowed (conversations-100 finding): the old /\b(exam|test|...)\b/ net
      // fired on HISTORY questions ("what did I score on the last exam") and
      // launched the builder. The builder now needs builder-shaped intent;
      // score/result/history questions belong to exam-history.
      /generate (an? )?(exam|test)/i,
      /test (me|myself)/i,
      /quiz me/i,
      /assess.*exam/i,
      /\b(take|start|do|run|practice|want|need|give me|build|create|make|try)\b[^.?!]*\b(exam|test|checkpoint|mock)\b/i,
      /\b(full|new|another|quick|complete) (exam|test|checkpoint|mock)\b/i,
      /\b(exam|test) (time|please|mode|session)\b/i,
      /\b(test|quiz) my\b/i,
      /\bcheckpoint\b/i,
    ],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      steps.push({ label: "Reading your profile", detail: `level ${ctx.profile.level}, leaks: ${ctx.profile.weakSkills.join(", ") || "none flagged"}` });
      const countMatch = ctx.text.match(/(\d{1,2})\s*(questions?|items?|q\b)/i) ?? ctx.args.match(/(\d{1,2})/);
      const count = countMatch ? parseInt(countMatch[1], 10) : 10;
      // Skill words, tolerant of spelling ("grammer" is a real user spelling)
      // and of NEGATION: "vocab only no grammar" must exclude grammar, not
      // include it just because the word appeared. Negated mentions are
      // stripped before matching and collected into an exclusion set.
      const SKILL_WORD = /\b(?:collocation|gram\w*|vocab\w*|writing|reading|listening|phrasal)/gi;
      const NEGATION = /\b(?:anything\s+but|no|not|without|zero|except(?:\s+for)?|other\s+than|aside\s+from|excluding)\s+(?:(?:about|on|for|of|the|a|any)\s+)?(?:collocation|gram\w*|vocab\w*|writing|reading|listening|phrasal)\w*/gi;
      const normalizeSkill = (s: string) => s.toLowerCase().replace(/vocab\w*/, "vocabulary").replace(/gram\w*/, "grammar").replace(/phrasal/, "vocabulary");
      const excluded = new Set<string>();
      for (const m of ctx.text.matchAll(NEGATION)) {
        const hit = m[0].match(SKILL_WORD);
        if (hit) excluded.add(normalizeSkill(hit[0]));
      }
      const positiveText = ctx.text.replace(NEGATION, " ");
      const skillMatch = [...positiveText.matchAll(SKILL_WORD)].map((m) => m[0]);
      const targetSkills = (skillMatch.length
        ? [...new Set(skillMatch.map(normalizeSkill))]
        : ["collocation", "grammar", "vocabulary"]
      ).filter((s) => !excluded.has(s));
      const { client, spec } = await generateExam(ctx.profile, targetSkills, count, (l, d) => steps.push({ label: l, detail: d }));
      return {
        skill: "generate-exam",
        reply: `${client.title}: ${client.count} questions, about ${spec.minutes} minutes. Answer everything you can; blank answers count against the total, and near-miss wordings still score. Submit when done and I will break it down by skill.`,
        corrections: [],
        fa_note: "",
        steps,
        exam: client,
      };
    },
  },
  {
    id: "assess-level",
    name: "Level probe",
    oneLiner: "Quick probe that updates grammar, vocab and reading bands",
    commands: ["assess", "probe", "level"],
    triggers: [/\bassess\b/i, /(what|whats|what is) my level/i, /my (english )?level\?*$/i, /level check/i, /recheck my level/i, /how (good|bad) is my english/i],
    run: async (ctx) => {
      const steps: StepTrace[] = [];
      steps.push({ label: "Designing the probe", detail: "grammar, vocabulary, reading, 8 items" });
      const { client, spec } = await generateExam(ctx.profile, ["grammar", "vocabulary", "reading"], 8, (l, d) => steps.push({ label: l, detail: d }));
      return {
        skill: "assess-level",
        reply: `Short probe: ${client.count} items, about ${spec.minutes} minutes. It measures grammar, vocabulary and reading separately, then updates the band for each. No filler, no practice round: start when ready.`,
        corrections: [],
        fa_note: "",
        steps,
        exam: client,
      };
    },
  },
];
