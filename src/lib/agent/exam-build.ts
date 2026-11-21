// Exam generation pipeline helpers: spec building, the item harvest/gate
// phases, quota enforcement and final assembly. The generateExam driver in
// ./exam owns the sequencing; every phase here runs in the exact order and
// with the exact strings it had before the file split.

import { db } from "@/lib/db";
import { aiJson } from "@/lib/ai";
import type { ProfileJson } from "@/lib/ai";
import { masteryWeakTags } from "@/lib/mastery";
import { contentUserId } from "@/lib/scope";
import type { ExamItem, ExamSpec, ExamClient } from "./types";
import { EXAM_TRACKS, trackTitle, isTrackId, type TrackId } from "./exam-tracks";
import { vetItems } from "./exam-ai";
import { distractorQuality, repairChoices, itemAnswerable, evidenceItem } from "./exam-gate";
import { examSystem, DANGLING_TEXT_REF, type Freshness } from "./exam-prompt";

export function newId(): string {
  return `ex${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export interface RawItem {
  type?: string;
  skill?: string;
  q?: string;
  choices?: string[];
  a?: string;
  accept?: string[];
  mustInclude?: string[];
  mustNotInclude?: string[];
  why?: string;
  tag?: string;
}

export interface RawExam {
  title?: string;
  items?: RawItem[];
}

// Shared mutable build state threaded through the generation phases: the item
// pool, the duplicate ledger and the gate-rejection report. The generateExam
// driver owns this object; the phase helpers mutate it in place.
export interface GenCtx {
  p: ProfileJson;
  spec: ExamSpec;
  fresh: Freshness;
  emit: (l: string, d?: string) => void;
  genOpts: { deep: boolean; temperature: number };
  seen: Set<string>;
  items: ExamItem[];
  dropped: string[];
}

export async function buildSpec(
  p: ProfileJson,
  targetSkills: string[],
  count: number,
  opts?: { track?: TrackId },
): Promise<{ spec: ExamSpec; track: TrackId | undefined }> {
  // Weakness quota input: mistake families carry production evidence, but the
  // mastery ledger can prove a weakness the families have not seen yet (three
  // exam misses on a tag with no family, or a slipping tag). Families first,
  // then proven danger/fragile tags - the quota cap stays 3.
  const ledgerTags = await masteryWeakTags();
  const familyTags = p.mistakes.map((m) => m.tag);
  const weakTags = [...new Set([...familyTags, ...ledgerTags])].slice(0, 3);
  const track = opts?.track && isTrackId(opts.track) ? opts.track : undefined;
  const plannedCount = Math.max(4, Math.min(20, count));
  const spec: ExamSpec = {
    level: p.level === "?" ? "B2" : p.level,
    targetSkills: targetSkills.length ? targetSkills : ["collocation", "grammar", "vocabulary"],
    plannedCount,
    minutes: Math.max(5, Math.round(plannedCount * (track ? EXAM_TRACKS[track].minutesPerItem : 1.1))),
    title: "",
    weakTags,
    ...(track ? { track } : {}),
  };
  return { spec, track };
}

// Harvest one generated batch into the item pool: dedupe, skill/focus guards,
// the answerability and distractor gates. Returns how many items survived.
export function harvestItems(ctx: GenCtx, rawItems: RawItem[] | undefined, batchStart: number): number {
  const { seen, items, dropped, spec } = ctx;
  let batchCount = 0;
  for (const r of rawItems ?? []) {
    const q = String(r.q ?? "").trim();
    const a = String(r.a ?? "").trim();
    if (!q || !a || seen.has(q)) continue;
    const type = (["mcq", "cloze", "short", "rewrite"] as const).includes(r.type as never) ? (r.type as ExamItem["type"]) : "cloze";
    if (type === "mcq" && (!Array.isArray(r.choices) || r.choices.length < 2)) continue;
    const skillRaw = /^(grammar|vocabulary|collocation|writing|reading|listening)$/.test(String(r.skill)) ? String(r.skill) : "vocabulary";
    // Collocation is vocabulary in narrower clothes: when the learner asked
    // for vocabulary only, a collocation item honors the promise (the level
    // engine already folds collocation into the vocabulary band), so relabel
    // instead of dropping it. That is how "4 vocab questions" stays 4.
    const skill = skillRaw === "collocation" && spec.targetSkills.includes("vocabulary") ? "vocabulary" : skillRaw;
    // Focus guard: an item tagged outside the requested focus would break the
    // promise the exam card makes ("mixed: ..." / "focus: ..."), so drop it.
    if (!spec.targetSkills.includes(skill)) continue;
    // Broken-item guard: no question may reference a text it fails to carry.
    if (DANGLING_TEXT_REF.test(q) && q.length < 220) continue;
    // ANSWERABILITY GATE (layer 1, deterministic): bare statements, trivia,
    // cloze without a forced blank, rewrite without an instruction, MCQ keys
    // not among the choices, leaked keys - all dead before the learner sees
    // them. This is the structural fix for the "random statement" bug class.
    const gate = itemAnswerable({ type, q, a, choices: type === "mcq" ? r.choices : undefined });
    if (!gate.ok) {
      dropped.push(`[${gate.reason}] ${q.slice(0, 70)}`);
      continue;
    }
    // DISTRACTOR QUALITY GATE (Task 81, polish #5): duplicates, empties and
    // key-identical choices get one deterministic repair (trim/dedupe), then
    // the quality verdict - still weak means dead, like any gate failure.
    let choicesOut = type === "mcq" ? r.choices!.map(String) : undefined;
    if (type === "mcq" && choicesOut) {
      const repaired = repairChoices(choicesOut);
      if (repaired.length !== choicesOut.length) choicesOut = repaired;
      const dq = distractorQuality(choicesOut, a);
      if (!dq.ok) {
        dropped.push(`[${dq.reason}] ${q.slice(0, 70)}`);
        continue;
      }
    }
    // Weakness tags are validated against the exam's family list so the
    // model can never invent a tag and poison the healing loop.
    const weakTag = spec.weakTags.includes(String(r.tag ?? "").trim().toLowerCase()) ? String(r.tag).trim().toLowerCase() : undefined;
    batchCount += 1;
    items.push({
      id: `i${batchStart + batchCount}`,
      type,
      skill,
      q,
      choices: choicesOut,
      a,
      accept: Array.isArray(r.accept) ? r.accept.map(String).filter(Boolean).slice(0, 6) : [],
      mustInclude: Array.isArray(r.mustInclude) ? r.mustInclude.map(String).filter(Boolean) : [],
      mustNotInclude: Array.isArray(r.mustNotInclude) ? r.mustNotInclude.map(String).filter(Boolean) : [],
      why: String(r.why ?? "").trim() || "Target pattern practice.",
      tag: weakTag,
    });
    seen.add(q);
  }
  return batchCount;
}

// If focus filtering or the gate left the exam short, top up with up to two
// more generation rounds locked to the requested skills, instead of shipping
// off-focus or unanswerable items or shrinking the announced count.
export async function topUpShortfall(ctx: GenCtx, onDegraded: (round: string) => (reason: string) => void): Promise<void> {
  for (let round = 0; round < 2 && ctx.items.length < ctx.spec.plannedCount; round++) {
    ctx.emit("Topping up", "keeping every item inside your requested focus");
    const avoid = [...ctx.items.map((i) => i.q.slice(0, 60)), ...ctx.fresh.bannedQ.slice(0, 10)];
    const need = ctx.spec.plannedCount - ctx.items.length;
    const raw2 = await aiJson<RawExam>(
      examSystem(ctx.p, ctx.spec, ctx.fresh),
      [{ role: "user", content: `Generate exactly ${need} more items now. The "skill" field of every item MUST be one of: ${ctx.spec.targetSkills.join(", ")}. Do not repeat or paraphrase any of these questions: ${JSON.stringify(avoid)}. Output the same JSON object shape with only the new items.` }],
      () => ({}),
      { ...ctx.genOpts, degraded: onDegraded("top-up round 2") },
    );
    harvestItems(ctx, raw2.items, ctx.items.length);
  }
}

// ANSWERABILITY GATE (layer 2, AI): the arbiter judges what regex cannot -
// ambiguous keys, unfair MCQs, items whose key does not fit - and audits
// weakness tags for integrity (a tag on an item that does not force that
// trap poisons the healing loop, so the tag is stripped, not the item).
export async function vetInPlace(ctx: GenCtx, pool: ExamItem[], label: string): Promise<void> {
  await vetItems(pool.map((it) => ({ id: it.id, type: it.type, skill: it.skill, q: it.q, choices: it.choices, a: it.a, accept: it.accept ?? [], tag: it.tag }))).then((vet) => {
    for (const it of pool.slice()) {
      const v = vet.get(it.id);
      if (v && !v.ok) {
        ctx.dropped.push(`[${label}: ${v.reason}] ${it.q.slice(0, 70)}`);
        ctx.items.splice(ctx.items.indexOf(it), 1);
      } else if (v && !v.keepTag) {
        it.tag = undefined;
      }
    }
  });
}

// If the gate dropped items, keep topping up (each round gated AND vetted)
// until the count promise is met or the retry budget is spent. The count
// the coach announces is the count the learner can actually sit.
export async function gateTopUp(ctx: GenCtx, onDegraded: (round: string) => (reason: string) => void): Promise<void> {
  let gateRounds = 0;
  while (ctx.items.length < ctx.spec.plannedCount && gateRounds < 3) {
    gateRounds++;
    ctx.emit("Topping up", `replacing what the gate rejected (round ${gateRounds})`);
    const avoid = [...ctx.items.map((i) => i.q.slice(0, 60)), ...ctx.fresh.bannedQ.slice(0, 10)];
    const need = ctx.spec.plannedCount - ctx.items.length;
    const raw3 = await aiJson<RawExam>(
      examSystem(ctx.p, ctx.spec, ctx.fresh),
      [{ role: "user", content: `Generate exactly ${need} more items now. The "skill" field of every item MUST be one of: ${ctx.spec.targetSkills.join(", ")}. Do not repeat or paraphrase any of these questions: ${JSON.stringify(avoid)}. Output the same JSON object shape with only the new items.` }],
      () => ({}),
      { ...ctx.genOpts, degraded: onDegraded("gate top-up round") },
    );
    const before = ctx.items.length;
    harvestItems(ctx, raw3.items, ctx.items.length);
    const freshItems = ctx.items.slice(before);
    if (freshItems.length > 0) await vetInPlace(ctx, freshItems, `ai-r${gateRounds}`);
  }
}

// QUOTA ENFORCEMENT (deterministic): the weakness quota is a PROMISE, not a
// hope. Two failure modes above are invisible to the learner but fatal to
// the healing loop: the model ignores the quota, or the AI vet strips every
// tag. Tag honesty is therefore evaluated ONCE at the END - first we force
// a tag-locked generation round for any hunted tag with zero surviving
// items, and if the model STILL ships none, we build the hunting item
// directly from the family's own evidence: the recorded wrong -> right
// pair IS a forced cloze, and re-serving the exact miss is precisely what
// the healing loop wants. spec.weakTags keeps the full hunted list until
// then so harvest's tag validation still accepts quota items.
export async function enforceQuota(ctx: GenCtx, hunted: string[], onDegraded: (round: string) => (reason: string) => void): Promise<void> {
  const { spec, items } = ctx;
  const missing = hunted.filter((t) => !items.some((it) => it.tag === t));
  if (missing.length > 0) {
    ctx.emit("Forcing the weakness quota", `no surviving item hunts: ${missing.join(", ")}`);
    const avoid2 = [...items.map((i) => i.q.slice(0, 60)), ...ctx.fresh.bannedQ.slice(0, 10)];
    const raw4 = await aiJson<RawExam>(
      examSystem(ctx.p, ctx.spec, ctx.fresh),
      [{
        role: "user",
        content: `CRITICAL OVERRIDE: this round has ONE job. Generate ${missing.length * 2} items and EVERY single one MUST have its "tag" field set to exactly one of: ${missing.join(", ")}. An item without a "tag" field from that list is a wasted generation and will be discarded. The item must genuinely force that exact weakness into play with a FRESH sentence. Do not repeat or paraphrase: ${JSON.stringify(avoid2)}. Output the same JSON object shape with only the new items.`,
      }],
      () => ({}),
      { ...ctx.genOpts, degraded: onDegraded("weakness-quota round") },
    );
    harvestItems(ctx, raw4.items, items.length);
    const freshItems = items.filter((it) => it.tag && missing.includes(it.tag));
    if (freshItems.length > 0) await vetInPlace(ctx, freshItems, "quota");
  }

  // Last-resort enforcement: build evidence items from the families
  // themselves. Deterministic, free, and always honest - the tag is in the
  // item's DNA because the item IS the family's recorded miss.
  const stillMissing = hunted.filter((t) => !items.some((it) => it.tag === t));
  if (stillMissing.length > 0) {
    const u = await contentUserId().catch(() => "me");
    const families = await db.mistakeFamily.findMany({ where: { userId: u, tag: { in: stillMissing }, resolvedAt: null } });
    for (const tag of stillMissing) {
      const fam = families.find((f) => f.tag === tag);
      const item = evidenceItem(tag, fam?.evidence ?? "");
      if (item) {
        items.push(item);
        ctx.emit("Evidence item", `built from your own recorded miss on ${tag}`);
      }
    }
  }

  // Tag honesty, evaluated once after enforcement: the exam card announces
  // "hunting: ..." from spec.weakTags. A family whose items all failed the
  // audit (and had no usable evidence) must not be announced.
  spec.weakTags = hunted.filter((t) => items.some((it) => it.tag === t));
}

// Guarantee the announced count: top up from the pool by trimming or
// padding with near-level review items. The count the coach announces IS
// the count graded, always. Quota items sort first so the slice can never
// amputate the family hunting it promised.
export function finalizeItems(ctx: GenCtx): ExamItem[] {
  const { spec, items } = ctx;
  const ordered = [...items.filter((it) => it.tag), ...items.filter((it) => !it.tag)];
  const finalItems = ordered.slice(0, spec.plannedCount).map((it, idx) => ({ ...it, id: `i${idx + 1}` }));
  spec.plannedCount = finalItems.length;
  spec.minutes = Math.max(4, Math.round(finalItems.length * 1.1));
  return finalItems;
}

// Persist the finished exam and build the client payload (no answer keys).
export async function persistExam(ctx: GenCtx, raw: RawExam, finalItems: ExamItem[]): Promise<ExamClient> {
  const { spec, emit } = ctx;
  const id = newId();
  const title = spec.track ? trackTitle(String(raw.title ?? "").trim().slice(0, 60) || `${spec.level} checkpoint`, spec.track) : String(raw.title ?? "").trim().slice(0, 60) || `${spec.level} checkpoint`;
  const client: ExamClient = {
    id,
    title,
    spec,
    count: finalItems.length,
    items: finalItems.map((it) => ({ id: it.id, type: it.type, skill: it.skill, q: it.q, choices: it.choices, tag: it.tag })),
  };

  await db.exam.create({
    data: { id, title, spec: JSON.stringify(spec), items: JSON.stringify(finalItems), status: "pending" },
  });
  emit("Exam ready", `${finalItems.length} items, about ${spec.minutes} minutes`);
  return client;
}
