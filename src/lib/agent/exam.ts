// Exam engine v2. Generation bakes answer keys server side; grading is fuzzy
// and generous to meaning. The announced count always equals the graded count:
// the client grades every item in the stored exam, unanswered items count as
// incorrect in the total but never inflate or deflate per-skill numbers.
//
// The generateExam / gradeExamSubmission drivers live here; the prompt surface
// lives in ./exam-prompt and the generation pipeline phases in ./exam-build.

import { db } from "@/lib/db";
import { aiJson } from "@/lib/ai";
import type { ProfileJson } from "@/lib/ai";
import { gradeAnswer } from "./fuzzy";
import type { ExamItem, ExamSpec, ExamClient, ExamResult, ExamVerdict, StepTrace } from "./types";
import { EXAM_TRACKS, bandReference, type TrackId } from "./exam-tracks";
import { updateSkillLevels } from "./levels";
import { noteExamAnswer, noteTagOutcome } from "@/lib/mistakes";
import { arbitrateMisses } from "./exam-ai";
import { resolveExamCardTargets, scheduleExamOutcomes } from "@/lib/exam-cards";
import { examSystem, loadFreshness } from "./exam-prompt";
import { buildSpec, harvestItems, topUpShortfall, vetInPlace, gateTopUp, enforceQuota, finalizeItems, persistExam, type GenCtx, type RawExam } from "./exam-build";

export async function generateExam(
  p: ProfileJson,
  targetSkills: string[],
  count: number,
  emit: (l: string, d?: string) => void,
  opts?: { track?: TrackId },
): Promise<{ client: ExamClient; items: ExamItem[]; spec: ExamSpec }> {
  const { spec, track } = await buildSpec(p, targetSkills, count, opts);

  emit(track ? `Building the ${EXAM_TRACKS[track].label} set` : "Calibrating difficulty", `level ${spec.level}, edge of ${spec.level} toward C1`);
  const fresh = await loadFreshness();
  emit("Rotating topics", fresh.domains.join(", "));
  const genOpts = { deep: true, temperature: 0.9 };
  // Degraded-result honesty (P1-7): every generation round that fell back to
  // the fallback envelope is counted and surfaced. The exam still ships - the
  // count promise and the answerability gate are deterministic and stay
  // enforced - but the spec carries degraded:true so nothing pretends the
  // build was fully AI-quality.
  let degradedRounds = 0;
  const onDegraded = (round: string) => (reason: string) => {
    degradedRounds += 1;
    emit("Degraded round", `${round}: ${reason.slice(0, 90)}`);
  };
  const ctx: GenCtx = { p, spec, fresh, emit, genOpts, seen: new Set(), items: [], dropped: [] };

  const raw = await aiJson<RawExam>(examSystem(p, spec, fresh), [{ role: "user", content: `Generate the ${spec.plannedCount}-item exam now. Cover: ${spec.targetSkills.join(", ")}. Respect every BAN list and freshness rule.` }], () => ({}), { ...genOpts, degraded: onDegraded("main batch") });
  emit("Validating answer keys", "every item needs a key and a why");

  harvestItems(ctx, raw.items, 0);
  await topUpShortfall(ctx, onDegraded);

  if (ctx.items.length > 0) {
    emit("Answerability gate", "every item must be fairly answerable");
    await vetInPlace(ctx, ctx.items, "ai");
  }

  await gateTopUp(ctx, onDegraded);

  const hunted = spec.weakTags.slice();
  await enforceQuota(ctx, hunted, onDegraded);

  if (ctx.dropped.length > 0) {
    emit("Gate report", `${ctx.dropped.length} item(s) rejected before delivery`);
  }

  const finalItems = finalizeItems(ctx);
  if (degradedRounds > 0) {
    spec.degraded = true;
    emit("Degraded build", `${degradedRounds} generation round(s) fell back - the count and answerability gates still held`);
  }
  const client = await persistExam(ctx, raw, finalItems);
  return { client, items: finalItems, spec };
}

// Mechanical pass: one verdict per item from the deterministic fuzzy grader.
function gradeMechanically(items: ExamItem[], answers: Record<string, string>): ExamVerdict[] {
  return items.map((it) => {
    const given = String(answers[it.id] ?? "").trim();
    const correct = gradeAnswer({ given, type: it.type, a: it.a, accept: it.accept, mustInclude: it.mustInclude, mustNotInclude: it.mustNotInclude, choices: it.choices });
    return { itemId: it.id, given, correct, key: it.a, why: it.why, skill: it.skill };
  });
}

// Hybrid grading, stage 2: every mechanical miss goes to the AI arbiter,
// which accepts meaning-equal answers the regex was blind to ("combine" for
// "blend") and writes a coaching note (rule + Farsi takeaway) for real
// misses. Then stats are computed from the FINAL verdicts, so the learner
// is never punished for the regex's blindness.
async function arbitrateVerdicts(
  items: ExamItem[],
  verdicts: ExamVerdict[],
): Promise<{ arb: Awaited<ReturnType<typeof arbitrateMisses>>; degradedReason: string | undefined }> {
  const misses = items
    .filter((it) => {
      const v = verdicts.find((x) => x.itemId === it.id);
      return v && !v.correct && v.given.length > 0;
    })
    .map((it) => {
      const v = verdicts.find((x) => x.itemId === it.id)!;
      return { id: it.id, type: it.type, skill: it.skill, q: it.q, a: it.a, given: v.given, why: it.why };
    });
  let degradedReason: string | undefined;
  const arb = await arbitrateMisses(misses, (reason) => {
    degradedReason = reason;
  });
  for (const [id, v] of arb) {
    const verdict = verdicts.find((x) => x.itemId === id);
    if (!verdict) continue;
    if (v.accept) {
      verdict.correct = true;
      verdict.acceptedAI = true;
    } else {
      verdict.coach = { rule: v.rule, fa: v.fa };
    }
  }
  return { arb, degradedReason };
}

// Healing loop: every weakness-targeted item reports its outcome back to the
// mistake memory - item tag first, arbiter's trap tag as the fallback so an
// untagged miss still lands in a family. Correct answers (including
// arbiter-accepted ones) extend the clean streak toward retirement; misses
// count as relapse evidence and reopen the family. The same outcome feeds
// the mastery ledger - BOTH sides of it, so "45% on articles, rising"
// becomes computable instead of guessed.
async function reportOutcomes(items: ExamItem[], verdicts: ExamVerdict[], arb: Awaited<ReturnType<typeof arbitrateMisses>>): Promise<void> {
  await Promise.allSettled(
    items.map((it) => {
      const v = verdicts.find((x) => x.itemId === it.id)!;
      const tag = it.tag ?? arb.get(it.id)?.tag;
      if (!tag) return Promise.resolve();
      return Promise.all([noteExamAnswer(tag, v.given, it.a, v.correct), noteTagOutcome(tag, v.correct)]);
    }),
  );
}

// P1 exam->FSRS unification: final verdicts land on the FSRS schedule.
// Deck-matched items reschedule their real card (bomb pulls it due today,
// pass extends it); tagged items without a deck match land in the
// exam:<tag> healing namespace and resurface in the review queue as
// evidence-derived cloze cards. Nothing resolves -> nothing schedules;
// the learner is never charged an outcome the exam did not actually earn.
async function scheduleOutcomes(items: ExamItem[], verdicts: ExamVerdict[]): Promise<Awaited<ReturnType<typeof scheduleExamOutcomes>>> {
  try {
    const targets = resolveExamCardTargets(items, verdicts);
    return await scheduleExamOutcomes(targets);
  } catch {
    // Scheduling must never break grading - the exam result stands on its own.
    return [];
  }
}

function aggregateBySkill(verdicts: ExamVerdict[]): { skill: string; correct: number; total: number }[] {
  const bySkillMap = new Map<string, { correct: number; total: number }>();
  for (const v of verdicts) {
    const agg = bySkillMap.get(v.skill) ?? { correct: 0, total: 0 };
    agg.total += 1;
    if (v.correct) agg.correct += 1;
    bySkillMap.set(v.skill, agg);
  }
  return [...bySkillMap.entries()]
    .map(([skill, a]) => ({ skill, ...a }))
    .sort((a, b) => b.total - a.total);
}

function buildHeadline(pct: number, total: number, correct: number, bySkill: { skill: string; correct: number; total: number }[]): string {
  const weakest = [...bySkill].filter((s) => s.correct / s.total < 0.6)[0];
  const headline =
    pct >= 85
      ? `Strong pass: ${correct}/${total}. This band is C1 territory; keep the pressure on.`
      : pct >= 60
        ? `Solid: ${correct}/${total}. ${weakest ? `Your leak is ${weakest.skill}; that is where the next session goes.` : "Consistent B2 performance."}`
        : `${correct}/${total}. The gap is specific, not general: ${weakest ? `${weakest.skill} broke first. Drill it before the next exam.` : "the fundamentals need another pass."}`;
  return headline;
}

export async function gradeExamSubmission(
  examId: string,
  answers: Record<string, string>,
): Promise<ExamResult | null> {
  const row = await db.exam.findUnique({ where: { id: examId } });
  if (!row) return null;
  const items: ExamItem[] = JSON.parse(row.items);
  const spec: ExamSpec = JSON.parse(row.spec);

  const verdicts = gradeMechanically(items, answers);
  const { arb, degradedReason } = await arbitrateVerdicts(items, verdicts);
  await reportOutcomes(items, verdicts, arb);

  const total = items.length;
  const answered = verdicts.filter((v) => v.given.length > 0).length;
  const correct = verdicts.filter((v) => v.correct).length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  const scheduled = await scheduleOutcomes(items, verdicts);
  const bySkill = aggregateBySkill(verdicts);
  const headline = buildHeadline(pct, total, correct, bySkill);

  // Degraded grading honesty (P1-7): if the arbiter was unreachable, the
  // result is regex-only - meaning-equal answers may sit among the misses.
  // That travels with the result so nothing presents it as a full assessment.
  const result: ExamResult = {
    total,
    answered,
    correct,
    pct,
    bySkill,
    verdicts,
    headline,
    scheduled,
    ...(spec.track ? { trackLabel: EXAM_TRACKS[spec.track].label, band: bandReference(pct, spec.track) } : {}),
    ...(degradedReason ? { degraded: true, degradedNotice: `Graded mechanically: the answer arbiter was unreachable (${degradedReason.slice(0, 90)}). Meaning-equal answers may be marked wrong.` } : {}),
  };

  await db.exam.update({ where: { id: examId }, data: { status: "graded", result: JSON.stringify(result) } });
  // Feed the per-skill level engine with the exam outcome.
  await updateSkillLevelsFromExam(bySkill);
  return result;
}

async function updateSkillLevelsFromExam(bySkill: { skill: string; correct: number; total: number }[]) {
  const map: Record<string, string> = { collocation: "vocabulary", writing: "writing", reading: "reading", listening: "listening", grammar: "grammar", vocabulary: "vocabulary" };
  const filtered = bySkill
    .filter((s) => map[s.skill])
    .map((s) => ({ skill: map[s.skill], score: s.total ? s.correct / s.total : 0, samples: s.total }));
  await updateSkillLevels(filtered);
}

export { type StepTrace };
