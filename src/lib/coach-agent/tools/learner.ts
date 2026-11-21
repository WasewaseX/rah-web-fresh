// Learner-state tools: review_forecast, add_cards, set_goal and the
// past-activity progress_review (all read or write the learner's own rows).

import type { ToolArgs, ToolResult } from "./types";

// ---------- review_forecast: the next 7 days of the queue ----------

// Task 125: read_state answers "how much is due TODAY"; the coach kept having
// no honest answer for "what does my week look like". This projects the real
// FSRS queue: overdue, today, the next 6 days, and the new-card queue (which
// is gated by Learner.newPerDay, so it is reported separately, not summed).
async function reviewForecast(): Promise<ToolResult> {
  const { db } = await import("@/lib/db");
  const { dayIndex } = await import("@/lib/fsrs");
  const today = dayIndex();
  const states = await db.cardState.findMany({
    where: { learnerId: "me", suspended: false, state: { not: "new" } },
    select: { due: true },
  });
  const fresh = await db.cardState.count({ where: { learnerId: "me", suspended: false, state: "new" } });
  const perDay = Array.from({ length: 7 }, () => 0); // [0] = today, [1..6] = the next days
  let overdue = 0;
  for (const s of states) {
    if (s.due < today) overdue++;
    else if (s.due <= today + 6) perDay[s.due - today]++;
  }
  const l = await db.learner.findUnique({ where: { id: "me" }, select: { newPerDay: true, dailyGoal: true } });
  const row = (label: string, n: number) => `${label}: ${n}`;
  const detail = [
    row("overdue (past days)", overdue),
    row("today", perDay[0]),
    ...perDay.slice(1).map((n, i) => row(`+${i + 1} day${i ? "s" : ""}`, n)),
    row("new cards waiting", fresh),
    `new-card gate: ${l?.newPerDay ?? 10}/day | daily goal: ${l?.dailyGoal ?? 20} reviews/day`,
    "7-day total (overdue + due): " + (overdue + perDay.reduce((a, b) => a + b, 0)),
  ].join("\n");
  return {
    ok: true,
    summary: `Forecast: ${overdue} overdue, ${perDay[0]} due today, then ${perDay.slice(1).join("/")}, ${fresh} new waiting`,
    detail,
  };
}

// ---------- add_cards: the coach can grow the deck from chat ----------

// Task 125: "add these words to my deck" used to have no surface - the model
// could only describe the cards it could not create. This writes real UserCard
// rows (same table the import flow uses), so the cards enter the normal FSRS
// queue. Probe runs validate the shape and write NOTHING (probes never write).
const CARD_KINDS = new Set(["cloze", "ef", "fae"]);
const CARD_LEVELS = new Set(["B1", "B2", "B2+", "C1"]);
interface NewCard {
  kind: string;
  prompt: string;
  answer: string;
  en: string;
  fa: string;
  note: string;
  level: string;
}
function sanitizeNewCard(raw: unknown): NewCard | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const prompt = String(c.prompt ?? "").trim();
  const answer = String(c.answer ?? "").trim();
  if (!prompt || !answer || prompt.length > 500 || answer.length > 500) return null;
  const kind = CARD_KINDS.has(String(c.kind)) ? String(c.kind) : "cloze";
  const level = CARD_LEVELS.has(String(c.level)) ? String(c.level) : "B2";
  const clip = (v: unknown) => String(v ?? "").trim().slice(0, 500);
  return { kind, prompt, answer, en: clip(c.en) || answer, fa: clip(c.fa), note: clip(c.note), level };
}
async function addCards(args: ToolArgs): Promise<ToolResult> {
  const cards = (Array.isArray(args.cards) ? args.cards : []).map(sanitizeNewCard).filter((c): c is NewCard => !!c).slice(0, 12);
  if (cards.length === 0) {
    return { ok: false, summary: "add_cards needs cards: [{prompt, answer, kind?, en?, fa?, note?, level?}] (max 12, prompt+answer required)" };
  }
  const preview = cards.map((c) => `${c.kind}/${c.level}: ${c.prompt.slice(0, 60)} -> ${c.answer.slice(0, 40)}`).join("\n");
  if (args._probe === true) {
    return {
      ok: true,
      summary: `add_cards probe dry-run: ${cards.length} card(s) validated, nothing written`,
      detail: `${preview}\nProbe mode: no UserCard rows created. Real runs add these to the learner's deck and FSRS queue.`,
      data: { count: cards.length },
    };
  }
  const { db } = await import("@/lib/db");
  await db.userCard.createMany({ data: cards.map((c) => ({ learnerId: "me", ...c })) });
  return {
    ok: true,
    summary: `${cards.length} card(s) added to your deck - they join the normal review queue`,
    detail: `${preview}\nTell the learner the cards are in the deck; new BYO cards share the same queue and budget as the built-in ones.`,
    data: { count: cards.length },
  };
}

// ---------- set_goal: the coach can tune the learner's own targets ----------

// Task 125: "make my daily goal 30" or "focus on listening this week" had no
// surface. Validated, diff-reported (no phantom writes when values already
// match), and probe-safe. focusSkill uses the app's canonical skill bands.
const SKILL_BANDS = ["grammar", "vocabulary", "writing", "speaking", "reading", "listening"];
async function setGoal(args: ToolArgs): Promise<ToolResult> {
  const { db } = await import("@/lib/db");
  const l = await db.learner.findUnique({ where: { id: "me" }, select: { dailyGoal: true, newPerDay: true, focusSkill: true } });
  if (!l) return { ok: false, summary: "Learner row missing - nothing to update" };
  const updates: { dailyGoal?: number; newPerDay?: number; focusSkill?: string } = {};
  const changes: string[] = [];
  if (args.dailyGoal !== undefined) {
    const g = Math.round(Number(args.dailyGoal));
    if (!Number.isFinite(g) || g < 5 || g > 200) return { ok: false, summary: "dailyGoal must be a number from 5 to 200 reviews/day" };
    if (g !== l.dailyGoal) {
      updates.dailyGoal = g;
      changes.push(`daily goal ${l.dailyGoal} -> ${g} reviews/day`);
    }
  }
  if (args.newPerDay !== undefined) {
    const n = Math.round(Number(args.newPerDay));
    if (!Number.isFinite(n) || n < 2 || n > 50) return { ok: false, summary: "newPerDay must be a number from 2 to 50 new cards/day" };
    if (n !== l.newPerDay) {
      updates.newPerDay = n;
      changes.push(`new cards/day ${l.newPerDay} -> ${n}`);
    }
  }
  if (args.focusSkill !== undefined) {
    const f = String(args.focusSkill).toLowerCase().trim();
    if (!SKILL_BANDS.includes(f)) return { ok: false, summary: `focusSkill must be one of: ${SKILL_BANDS.join(", ")}` };
    if (f !== l.focusSkill) {
      updates.focusSkill = f;
      changes.push(`focus skill ${l.focusSkill} -> ${f}`);
    }
  }
  if (changes.length === 0) {
    return { ok: true, summary: "Goals already match what was asked - nothing written", detail: `current: dailyGoal=${l.dailyGoal}, newPerDay=${l.newPerDay}, focusSkill=${l.focusSkill}` };
  }
  if (args._probe === true) {
    return { ok: true, summary: `set_goal probe dry-run: ${changes.join("; ")} - nothing persisted`, detail: "Probe mode: Learner row untouched.", data: { changes } };
  }
  await db.learner.update({ where: { id: "me" }, data: updates });
  return { ok: true, summary: `Updated: ${changes.join("; ")}`, data: { changes } };
}

// ---------- progress_review: the past-activity review (Task 140) ----------

async function progressReview(args: ToolArgs): Promise<ToolResult> {
  const { db } = await import("@/lib/db");
  const days = Math.max(1, Math.min(30, Math.round(Number(args.days) || 7)));
  const [drillRow, ratingRows] = await Promise.all([
    db.setting.findUnique({ where: { key: "guide:practice" } }),
    db.setting.findMany({ where: { key: { startsWith: "guide:checklist:" } } }),
  ]);
  const ratings: Record<string, unknown> = {};
  for (const row of ratingRows) {
    const lv = row.key.slice("guide:checklist:".length);
    try {
      ratings[lv] = JSON.parse(row.value);
    } catch {
      // malformed checklist row - that level contributes no ratings
    }
  }
  let rawDrills: unknown = null;
  if (drillRow) {
    try {
      rawDrills = JSON.parse(drillRow.value);
    } catch {
      // malformed practice ledger - weekly progress line is omitted
    }
  }
  const { weeklyProgress } = await import("@/lib/guide-ledger");
  const rep = weeklyProgress({ drills: rawDrills, ratings, nowMs: Date.now(), windowDays: days });

  const lines: string[] = [
    `PAST ${rep.windowDays} DAY(S) - honest accounting (drill counts are REQUESTS, not completed sessions):`,
    rep.summary,
    "",
    "PER LEVEL:",
  ];
  for (const p of rep.perLevel) {
    let line = `- ${p.level}: ${p.events} drill request(s) in window; coverage ${p.grammarCovered}/${p.grammarTotal} grammar, ${p.vocabCovered}/${p.vocabTotal} vocabulary`;
    if (p.readiness) line += `; checklist ${p.readiness.easy}/${p.readiness.total} easy, ${p.readiness.mid} some difficulty, ${p.readiness.hard} difficult - ${p.readiness.verdict}`;
    else line += "; checklist not rated yet (no verdict - say so, do not guess)";
    lines.push(line);
  }
  if (rep.latest) {
    lines.push("", `Most recent request: "${rep.latest.title}" (${rep.latest.level} ${rep.latest.kind}) at ${rep.latest.at}.`);
  }
  if (rep.legacyEntries > 0) {
    lines.push(`${rep.legacyEntries} ledger entr${rep.legacyEntries === 1 ? "y" : "ies"} predate per-event history; their in-window count uses the last-request date only.`);
  }

  try {
    const { contentUserId } = await import("@/lib/scope");
    const stats = await db.dailyStat.findMany({
      where: { userId: await contentUserId().catch(() => "me") },
      orderBy: { day: "desc" },
      take: days,
    });
    if (stats.length > 0) {
      lines.push("", "REVIEW STATS (per day, newest first):");
      for (const s of stats) lines.push(`- ${s.day}: ${s.reviews} reviews, ${s.correct} correct, ${s.xp} xp`);
    } else {
      lines.push("", "REVIEW STATS: none recorded in the window.");
    }
  } catch {
    // stats are a garnish on the ledger truth - never fail the tool for them
  }

  // Pure read: probe runs (args._probe === true) get the identical response.
  return { ok: true, summary: rep.summary, detail: lines.join("\n").slice(0, 4000) };
}

export { reviewForecast, addCards, setGoal, progressReview };
