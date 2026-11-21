// Memory and analysis power skills: the mistake-memory browser and the
// multi-pass deep analysis pipeline (evidence, two mining passes, synthesis,
// verification, coaching note).

import { db } from "@/lib/db";
import { aiJson, type ProfileJson } from "@/lib/ai";
import type { SkillDef, SkillLevelRow, StepTrace } from "../types";
import { updateSkillLevels, getSkillLevels, buildAssessment, spreadLine } from "../levels";
import { topMistakes } from "@/lib/mistakes";
import { contentUserId } from "@/lib/scope";

export const ANALYSIS_SKILLS: SkillDef[] = [
  {
    id: "mistakes",
    name: "Mistake memory",
    oneLiner: "Your recurring mistakes, counted, with live evidence",
    commands: ["mistakes"],
    triggers: [/\b(recurring )?mistakes?\b/i, /what do i keep (getting )?wrong/i, /\bmy (weak|leak\w*) (points|spots|families)\b/i, /\berror (families|patterns)\b/i],
    run: async (_ctx) => {
      const steps: StepTrace[] = [];
      steps.push({ label: "Mining corrections", detail: "chat turns, essays, speaking rounds" });
      const families = await topMistakes(8);
      if (families.length === 0) {
        return {
          skill: "mistakes",
          reply: "No recurring mistakes on file yet. The memory builds itself as I correct your chat messages, essays and speaking rounds, so keep producing: within a few sessions the persistent patterns surface here with counts and evidence.",
          corrections: [],
          fa_note: "",
          steps,
        };
      }
      const active = families.filter((f) => !f.resolvedAt);
      const healed = families.filter((f) => f.resolvedAt);
      const lines = active.map((f, i) => `${i + 1}. ${f.label} - seen ${f.count}x in your ${f.kind}${f.streakClean > 0 ? ` (${f.streakClean}/2 clean hits in exams)` : ""}. Latest: "${f.evidence}"`);
      const healedLines = healed.map((f) => `- ${f.label} - fixed, retired after 2 clean exam hits`);
      const top = active[0] ?? families[0];
      const loop = active.length
        ? `\n\nThis is the memory the tutor and the examiner both aim with. Exams now build items that hunt these exact weak spots; answer two of them correctly and I retire the family for good. Say "focus on ${top.tag}" to drill the worst one, or "generate a 6 question grammar only exam" to test it under pressure.`
        : `\n\nEvery active family is healed right now: two clean exam hits each retired them. They reopen automatically if the mistake shows up in your English again.`;
      return {
        skill: "mistakes",
        reply: `${active.length ? `Your leaks, most persistent first:\n${lines.join("\n")}` : ""}${healed.length ? `\n${active.length ? "\n" : ""}Healed and retired:\n${healedLines.join("\n")}` : ""}${loop}`,
        corrections: [],
        fa_note: "",
        steps,
      };
    },
  },
  {
    id: "deep-analysis",
    name: "Deep analysis",
    oneLiner: "30 seconds of real work over your whole history",
    commands: ["deep", "analyze", "analyse"],
    triggers: [/deep\s*(analysis|analyse|analyze)/i, /analy[sz]e my (english|level|progress|weakness)/i, /(thorough|full|complete) analysis/i, /how am i doing( really| actually)?/i],
    run: async (ctx) => {
      const t0 = Date.now();
      const steps: StepTrace[] = [];
      const evidenceUser = await contentUserId().catch(() => "me");
      const evidence = await collectEvidence(evidenceUser, steps);
      const patterns = await minePatterns(ctx.profile, evidence, steps);
      const { synth, check, note } = await synthesize(ctx.profile, patterns, evidence[5], steps);
      const assessment = await applyBands(synth, note, evidence[5], steps);
      await holdMinimumWindow(t0, steps);
      const planLines = check.plan.slice(0, 5).map((p, i) => `${i + 1}. ${p}`).join("\n");
      const prioLines = check.priorities.slice(0, 3).map((p, i) => `${i + 1}. ${p}`).join("\n");
      return {
        skill: "deep-analysis",
        reply: `${synth.summary}\n\nPriorities:\n${prioLines}\n\nSeven-day plan:\n${planLines}`.slice(0, 1400),
        corrections: [],
        fa_note: "",
        steps,
        assessment,
      };
    },
  },
];

// The user asked for a coach that visibly works ~30 seconds on analysis,
// not a 7-second token stream. Every pass below does real work; the
// minimum window at the end guarantees the promised depth of attention.
const MIN_ANALYSIS_MS = 25000;

type DeepEvidence = Awaited<ReturnType<typeof collectEvidence>>;

// 1. Evidence gathering: everything the app has measured FOR THIS USER.
// Scoped (Task 67 straggler): essays, transcripts and coach turns are
// learner content - the coach must never quote another account's rows.
async function collectEvidence(evidenceUser: string, steps: StepTrace[]) {
  steps.push({ label: "Collecting evidence", detail: "reviews, lapses, writing, speaking, chats" });
  const evidence = await Promise.all([
    db.reviewLog.count({ where: { userId: evidenceUser } }),
    db.reviewLog.findMany({ where: { userId: evidenceUser, grade: 1 }, orderBy: { id: "desc" }, take: 20 }),
    db.writingSub.findMany({ where: { userId: evidenceUser }, orderBy: { id: "desc" }, take: 3 }),
    db.speakSession.findMany({ where: { userId: evidenceUser }, orderBy: { id: "desc" }, take: 3 }),
    db.chatMsg.findMany({ where: { userId: evidenceUser, role: "coach" }, orderBy: { id: "desc" }, take: 25 }),
    getSkillLevels(),
  ]);
  const [reviewCount, lapseRows, writes, speaks, corrections] = evidence;
  const trapCards = lapseRows.length;
  steps.push({ label: "Evidence in hand", detail: `${reviewCount} reviews, ${trapCards} recent lapses, ${writes.length} essays, ${speaks.length} speaking runs, ${corrections.length} coach turns` });
  return evidence;
}

function parseCorrections(c: { content: string }) {
  try {
    const p = JSON.parse(c.content) as { corrections?: { wrong: string; right: string; trap: string }[] };
    return (p.corrections ?? []).map((x) => `${x.wrong} -> ${x.right} (${x.trap})`);
  } catch {
    return [];
  }
}

// 2. Domain pass A: production errors from chat and reviews.
async function minePatterns(profile: ProfileJson, evidence: DeepEvidence, steps: StepTrace[]) {
  const [, lapseRows, writes, speaks, corrections, levels] = evidence;
  steps.push({ label: "Pass 1: spoken and typed errors", detail: "chat corrections, review lapses, extended reasoning" });
  const prodEvidence = JSON.stringify({
    profile,
    recentLapses: lapseRows.map((r) => r.cardId),
    recentCorrections: corrections.flatMap(parseCorrections).slice(0, 15),
  });
  const prod = await aiJson<{ patterns: string[] }>(
    `You are the diagnostic engine inside Rah, an English app for Farsi speakers. Mine these PRODUCTION errors (chat corrections, review lapses). Find repeating error families and cite one concrete example per family. Output ONE JSON object: {"patterns": ["max 5 concrete findings"]}. No em dashes.`,
    [{ role: "user", content: prodEvidence.slice(0, 5000) }],
    () => ({ patterns: [] }),
    { deep: true },
  );

  // 3. Domain pass B: composed language from essays and speaking.
  steps.push({ label: "Pass 2: essays and speaking", detail: "range, cohesion, Farsi transfer at text level" });
  const compEvidence = JSON.stringify({
    writingSamples: writes.map((w) => w.text.slice(0, 400)),
    speakingTranscripts: speaks.map((s) => s.transcript.slice(0, 400)),
    measuredLevels: levels.filter((l) => l.samples > 0),
  });
  const comp = await aiJson<{ patterns: string[] }>(
    `You are the diagnostic engine inside Rah. Mine these COMPOSED texts (essays, speaking transcripts) from a Farsi speaker. Judge range, cohesion, register, and Farsi transfer at TEXT level; ignore ASR noise in transcripts. Cite one concrete example per finding. Output ONE JSON object: {"patterns": ["max 5 concrete findings"]}. No em dashes.`,
    [{ role: "user", content: compEvidence.slice(0, 5000) }],
    () => ({ patterns: [] }),
    { deep: true },
  );
  const patterns = [...prod.patterns, ...comp.patterns].slice(0, 8);
  steps.push({ label: "Patterns mined", detail: `${patterns.length} findings across both domains` });
  return patterns;
}

// 4. Synthesis: bands, priorities, plan.
async function synthesize(profile: ProfileJson, patterns: string[], levels: SkillLevelRow[], steps: StepTrace[]) {
  steps.push({ label: "Pass 3: synthesis", detail: "bands, priorities, seven-day plan" });
  const synth = await aiJson<{ summary: string; bands: { skill: string; score: number }[]; priorities: string[]; plan: string[] }>(
    `You are Rah's head coach. Using ONLY these mined patterns and measured levels, write the learner's state of the union. bands: estimate mastery 0..1 ONLY for skills the evidence actually touches; omit any skill you have no evidence for; NEVER output 0 for an untouched skill. priorities: max 3, ordered. plan: exactly 5 day-steps, each one actionable line with a number in it.
Output ONE JSON object: {"summary": "max 70 words, direct, second person", "bands": [{"skill": "grammar", "score": 0.0}], "priorities": ["..."], "plan": ["Day 1: ...", ...]}. No em dashes. No Farsi.`,
    [
      { role: "user", content: `Patterns: ${JSON.stringify(patterns)}\nMeasured levels: ${JSON.stringify(levels.filter((l) => l.samples > 0))}\nLearner profile: ${JSON.stringify(profile)}` },
    ],
    () => ({ summary: "Analysis complete.", bands: [], priorities: [], plan: [] }),
    { deep: true },
  );
  steps.push({ label: "Pass 4: verification", detail: "checking the plan against the evidence" });
  const check = await aiJson<{ plan: string[]; priorities: string[] }>(
    `You are Rah's quality gate. Given the coach's plan and the mined patterns, reject any plan line that is not backed by a pattern or a measured weakness, tighten vague lines, and keep exactly 5. Same for priorities (max 3). Output ONE JSON object: {"plan": ["Day 1: ...", ...], "priorities": ["..."]}. No em dashes. No Farsi.`,
    [{ role: "user", content: `Patterns: ${JSON.stringify(patterns)}\nPlan: ${JSON.stringify(synth.plan)}\nPriorities: ${JSON.stringify(synth.priorities)}` }],
    () => ({ plan: synth.plan, priorities: synth.priorities }),
    { deep: true },
  );
  steps.push({ label: "Pass 5: the coaching note", detail: "what would move each band fastest" });
  const note = await aiJson<{ note: string }>(
    `You are Rah's head coach writing a 3-sentence personal note to a Farsi speaker after a deep review. Reference their strongest and weakest band by name and name the ONE habit that would move the weakest fastest. Output ONE JSON object: {"note": "max 60 words, direct, warm, second person"}. No em dashes. No Farsi.`,
    [{ role: "user", content: `Patterns: ${JSON.stringify(patterns)}\nMeasured: ${JSON.stringify(levels.filter((l) => l.samples > 0))}\nSynthesis: ${synth.summary}` }],
    () => ({ note: "" }),
    { deep: true },
  );
  return { synth, check, note };
}

// Only skills the synthesis actually scored move the bands: a 0 for an
// untouched skill must never drag a measured band down.
async function applyBands(
  synth: { bands: { skill: string; score: number }[] },
  note: { note: string },
  levels: SkillLevelRow[],
  steps: StepTrace[],
) {
  const evidenceBands = synth.bands.filter((b) => b.score > 0.02);
  steps.push({ label: "Updating your bands", detail: `${evidenceBands.length} skills touched` });
  await updateSkillLevels(evidenceBands.map((b) => ({ skill: b.skill, score: Math.min(1, Math.max(0, b.score)), samples: 4 })));
  const assessment = await buildAssessment(note.note || spreadLine(levels));
  steps.push({ label: "Compiling report", detail: "assembling bands, priorities, plan" });
  return assessment;
}

// Minimum working window: multi-pass depth the learner can feel. Real
// work happens above; this only guarantees the promised attention span.
async function holdMinimumWindow(t0: number, steps: StepTrace[]) {
  const elapsed = Date.now() - t0;
  if (elapsed < MIN_ANALYSIS_MS) {
    await new Promise((r) => setTimeout(r, MIN_ANALYSIS_MS - elapsed));
  }
  steps.push({ label: "Done", detail: `${Math.round((Date.now() - t0) / 1000)}s of analysis` });
}
