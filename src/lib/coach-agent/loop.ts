// The agent loop. This is NOT a chat interface: it is a multi-step executor.
// Turn protocol (JSON, same contract pattern as every other AI surface in Rah):
//   { "thought": "...", "tool": "<name>", "args": {...} }   -> one tool call, then observe
//   { "thought": "...", "final": true, "reply": "...",      -> done; reply + client commands
//     "corrections": [...], "commands": [...] }
// Commands are what make the sidebar able to "access anything, show anything":
// the client executes them on every tab - navigate, refresh state, open views, toast.
// Hard cap MAX_STEPS keeps a runaway model from burning the quota; every event
// streams to the sidebar as it happens.
//
// The loop driver lives here; the protocol shapes, prompt text, JSON repair,
// ask classifiers and live-context line live in the loop-* siblings. This file
// re-exports every public name so importers keep importing from "./loop".

import ZAI from "z-ai-web-dev-sdk";
import { TOOLS, toolByName, ensureWorkspace, toolTier, TIER_BUDGETS, type ToolArgs, type ToolDef, type ToolResult, type ToolTier } from "./tools";
import { compressHistory } from "./context";
import type { ProfileJson } from "@/lib/ai";
import { MAX_STEPS, stoppedReply, type AgentCommand, type AgentEvent, type AgentTurn } from "./loop-types";
import { systemPrompt } from "./loop-prompt";
import { extractTurn, sanitizeReply, type TurnDecision } from "./loop-repair";
import { buildLiveContext } from "./loop-context";
import { isStateQuestion, isDeckAddAsk, isWeekAsk, isProgressAsk } from "./loop-ask";

export { MAX_STEPS, stoppedReply } from "./loop-types";
export type { AgentCommand, AgentEvent, AgentTurn } from "./loop-types";
export { systemPrompt } from "./loop-prompt";
export { extractTurn, sanitizeReply } from "./loop-repair";
export { buildLiveContext } from "./loop-context";
export { isStateQuestion, isDeckAddAsk, isWeekAsk, isProgressAsk } from "./loop-ask";

// Mutable per-run state plus the fixed wiring the phase helpers below share.
// The loop owns this object; helpers read and mutate it exactly as the
// inline code did before the phase split.
interface LoopCtx {
  message: string;
  history: { role: string; content: string }[];
  probe: boolean | undefined;
  push: (e: AgentEvent) => void;
  messages: { role: string; content: string }[];
  steps: { label: string; detail?: string; ok?: boolean }[];
  toolsUsed: string[];
  tierBudgetUse: Partial<Record<string, number>>;
  nudges: number;
  enforced: { state: number; deck: number; week: number; progress: number };
  // Audit P1: app actions the CLIENT must perform are merged in by the LOOP
  // from verified tool results - the model triggers them, it cannot fake them.
  themeCommand: AgentCommand | null;
}

type ZaiClient = { chat: { completions: { create: (args: unknown) => Promise<{ choices?: { message?: { content?: string } }[] }> } } };

// Copied verbatim out of runAgent's setup: the user-facing reply when the
// model call fails hard after retries.
const UNREACHABLE = "The model is unreachable right now (quota or network). Your message stands; try again in a moment.";

// Model call with 429/quota-aware retries: one hiccup should not kill the turn.
const MODEL_RETRY_DELAYS = [1500, 4000];
async function callModel(
  zai: ZaiClient,
  messages: { role: string; content: string }[],
  emit?: (e: AgentEvent) => void,
): Promise<string | null> {
  for (let attempt = 0; attempt <= MODEL_RETRY_DELAYS.length; attempt++) {
    try {
      const res = await zai.chat.completions.create({ messages } as never);
      return String(res?.choices?.[0]?.message?.content ?? "");
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      const retriable = /429|rate|quota|temporar|timeout|timed out|502|503|504|529|network|econn|fetch failed|socket/i.test(msg);
      if (attempt < MODEL_RETRY_DELAYS.length && retriable) {
        emit?.({ type: "error", label: `Model hiccup (${attempt + 1}) - retrying`, detail: msg.slice(0, 140) });
        await new Promise((r) => setTimeout(r, MODEL_RETRY_DELAYS[attempt]));
        continue;
      }
      emit?.({ type: "error", label: "Model unreachable", detail: msg.slice(0, 200) });
      return null;
    }
  }
  return null;
}

// Review feature #15 (the 7.4/10 wave): the learner can STOP a long run. The
// check sits between steps - the current model call finishes (it is already
// in flight), then the loop exits and closes gracefully from whatever work
// was actually done. The turn still persists. Returns the graceful stop turn,
// or null while the run continues.
function stoppedTurn(ctx: LoopCtx, signal: AbortSignal | undefined): AgentTurn | null {
  if (!signal?.aborted) return null;
  ctx.push({ type: "error", label: "Stopped by learner" });
  return { reply: stoppedReply(ctx.steps), corrections: [], commands: [], steps: ctx.steps, toolsUsed: ctx.toolsUsed, stopped: true };
}

// Thought-only / JSON junk: NOT a final answer. Nudge the model back on
// protocol (max twice) instead of showing the learner "no output". Returns
// the forced close once the nudge budget is spent, or null to continue.
function closeJunkOrNudge(ctx: LoopCtx, turn: TurnDecision, raw: string, step: number): AgentTurn | null {
  if (ctx.nudges < 2 && step < MAX_STEPS - 1) {
    ctx.nudges += 1;
    ctx.push({ type: "error", label: "Unclear step - re-running", ok: false });
    ctx.messages.push({ role: "assistant", content: raw });
    ctx.messages.push({
      role: "user",
      content: 'That was not a valid turn (a thought without a tool call and without final:true). Answer with EXACTLY one JSON object: {"thought":"...","tool":"<tool>","args":{...}} to act, or {"thought":"...","final":true,"reply":"...","corrections":[],"commands":[]} to answer the learner directly.',
    });
    return null;
  }
  // Nudge budget spent: close from whatever the model DID say.
  const reply = sanitizeReply(turn.thought || raw, "I could not form a clean answer that time. Send it again and I will take another run.");
  ctx.push({ type: "final", reply, commands: [] });
  return { reply, corrections: [], commands: [], steps: ctx.steps, toolsUsed: ctx.toolsUsed };
}

// Audit P1: app actions the CLIENT must perform are merged in by the LOOP
// from verified tool results - the model triggers them, it cannot fake them.
function withTheme(ctx: LoopCtx, cmds: AgentCommand[]): AgentCommand[] {
  const out = ctx.themeCommand ? [...cmds, ctx.themeCommand] : cmds;
  ctx.themeCommand = null;
  return out;
}

// The final-answer branch: deterministic enforcement nudges first (state,
// deck, week, progress - one per run each), then the sanitized close.
// Returns the finished turn, or null when a nudge was sent and the loop
// must continue.
function finalizeTurn(ctx: LoopCtx, turn: TurnDecision, raw: string, step: number): AgentTurn | null {
  // The MANDATORY read_state rule, enforced in code: a state-shaped
  // question answered with zero tool calls gets one nudge, then the run
  // continues and the model re-answers from real data.
  if (turn.final && ctx.toolsUsed.length === 0 && ctx.enforced.state < 1 && step < MAX_STEPS - 2 && isStateQuestion(ctx.message)) {
    ctx.enforced.state = 1;
    ctx.push({ type: "error", label: "State question needs read_state - enforcing", ok: false });
    ctx.messages.push({ role: "assistant", content: raw });
    ctx.messages.push({
      role: "user",
      content:
        'That was a state question and you answered it WITHOUT calling read_state - a protocol violation. First call read_state now: {"thought":"...","tool":"read_state","args":{}}. Then, with its result, emit your final object.',
    });
    return null;
  }
  // Task 125 enforcement: a deck-add ask finalized without add_cards -
  // the reply would claim an action that never happened.
  if (turn.final && !ctx.toolsUsed.includes("add_cards") && ctx.enforced.deck < 1 && step < MAX_STEPS - 2 && isDeckAddAsk(ctx.message)) {
    ctx.enforced.deck = 1;
    ctx.push({ type: "error", label: "Deck-add needs add_cards - enforcing", ok: false });
    ctx.messages.push({ role: "assistant", content: raw });
    ctx.messages.push({
      role: "user",
      content:
        'The learner asked to add words to their DECK and you finalized WITHOUT calling add_cards - documents and skill runs do not add cards, and claiming they do is a fabricated action. Call add_cards now: {"thought":"...","tool":"add_cards","args":{"cards":[{"kind":"cloze","prompt":"sentence with ___","answer":"...","en":"...","fa":"Farsi gloss","level":"B2"}]}} (build the cards for the asked words yourself). Then confirm from its real result.',
    });
    return null;
  }
  // Task 125 enforcement: a week/workload ask finalized without
  // review_forecast - read_state only knows today.
  if (turn.final && !ctx.toolsUsed.includes("review_forecast") && ctx.enforced.week < 1 && step < MAX_STEPS - 2 && isWeekAsk(ctx.message)) {
    ctx.enforced.week = 1;
    ctx.push({ type: "error", label: "Week question needs review_forecast - enforcing", ok: false });
    ctx.messages.push({ role: "assistant", content: raw });
    ctx.messages.push({
      role: "user",
      content:
        'That was a week/workload question answered without review_forecast - read_state only knows TODAY, so day-by-day numbers from it are wrong. Call review_forecast now: {"thought":"...","tool":"review_forecast","args":{}}. Then answer the learner from its real numbers.',
    });
    return null;
  }
  // Task 140 enforcement: a past-activity ask finalized without
  // progress_review - the drill ledger and readiness verdicts live in the
  // tool, nowhere else. Fires AFTER the forecast check so a combined
  // past+future ask can demand both tools across two nudges.
  if (turn.final && !ctx.toolsUsed.includes("progress_review") && ctx.enforced.progress < 1 && step < MAX_STEPS - 2 && isProgressAsk(ctx.message)) {
    ctx.enforced.progress = 1;
    ctx.push({ type: "error", label: "Past-activity question needs progress_review - enforcing", ok: false });
    ctx.messages.push({ role: "assistant", content: raw });
    ctx.messages.push({
      role: "user",
      content:
        'That was a past-activity question answered without progress_review - the drill-request ledger, checklist readiness and review stats are in that tool, not in your memory. Call progress_review now: {"thought":"...","tool":"progress_review","args":{}}. Then answer the learner from its real numbers, reporting drill counts as REQUESTS (never "completed" or "mastered").',
    });
    return null;
  }
  const reply = sanitizeReply(String(turn.reply ?? ""), "I ran out of useful moves; rephrase and I will take another run at it.");
  const commands = withTheme(ctx, Array.isArray(turn.commands) ? turn.commands : []);
  ctx.push({ type: "final", reply, commands });
  return {
    reply,
    corrections: Array.isArray(turn.corrections) ? turn.corrections : [],
    commands,
    steps: ctx.steps,
    toolsUsed: ctx.toolsUsed,
  };
}

function unknownTool(ctx: LoopCtx, tool: string, raw: string): void {
  ctx.steps.push({ label: `Unknown tool: ${tool}`, ok: false });
  ctx.push({ type: "observe", label: `Unknown tool: ${tool}`, ok: false });
  ctx.messages.push({ role: "assistant", content: raw });
  ctx.messages.push({ role: "user", content: `Tool "${tool}" does not exist. Valid tools: ${TOOLS.map((t) => t.name).join(", ")}. Continue.` });
}

// Permission matrix (P1-8): tier-tag the trace and enforce per-run budgets
// on the dangerous tiers. A refused call never executes. Returns true when
// the call was refused (the loop continues without running the tool).
function tierRefusal(ctx: LoopCtx, def: ToolDef, tier: ToolTier, raw: string): boolean {
  const budget = TIER_BUDGETS[tier];
  const used = ctx.tierBudgetUse[tier] ?? 0;
  if (budget !== undefined && used >= budget) {
    ctx.steps.push({ label: `${def.name} - tier budget spent`, detail: `${tier} tier already used ${used}/${budget} this run`, ok: false });
    ctx.push({ type: "observe", label: `${def.name} refused: ${tier}-tier budget spent (${used}/${budget} this run)`, ok: false });
    ctx.messages.push({ role: "assistant", content: raw });
    // Task 124: the bare refusal used to leak into the final reply as an
    // invented policy wall ("I've reached the limit for theme changes in
    // this session ... when the budget resets") - wrong on both counts
    // (per-message, not per-session; and phrased like a product rule). The
    // refusal now hands the model the exact honest sentence to use.
    ctx.messages.push({ role: "user", content: `Tool "${def.name}" (${tier} tier) is refused: the per-message budget of ${budget} ${tier} calls is spent. This is a real per-message cap, not a session limit, and there are no other limits. Emit the final object now; if the learner needs the action, tell them plainly: send the request again in a fresh message and it will run.` });
    return true;
  }
  if (budget !== undefined) ctx.tierBudgetUse[tier] = used + 1;
  return false;
}

// Execute the tool call the model emitted, stream the observation back and
// hand the result to the model as the next user message. A successful
// set_theme is captured for the final command merge by withTheme.
async function runToolStep(ctx: LoopCtx, turn: TurnDecision, def: ToolDef, thought: string, raw: string, tier: ToolTier): Promise<void> {
  ctx.toolsUsed.push(def.name);
  ctx.push({ type: "tool", label: def.name, detail: `${thought || def.desc.slice(0, 80)}` });
  ctx.steps.push({ label: def.name, detail: thought });

  let result: ToolResult;
  try {
    // Probe hygiene (Task 111 pattern): probes declare themselves to the
    // tools so DB-writing tools (case records, consent logs) can suppress
    // their writes - a battery run must leave zero trace beyond the SSE.
    // Hardening 2026-11-03: _probe and _history are RESERVED loop-to-tool
    // channels. The model's own args are stripped of them first - a prompt-
    // injected page must not be able to flip or forge either flag (forge
    // direction was fail-safe, but the invariant is cleaner: only the loop
    // speaks for these two keys).
    const callArgs: ToolArgs = { ...turn.args };
    delete callArgs._probe;
    delete callArgs._history;
    if (ctx.probe) callArgs._probe = true;
    // coach_skill used to run with EMPTY history (context-blind routing).
    // The loop owns the conversation, so it donates the trimmed tail here.
    if (def.name === "coach_skill" && Array.isArray(ctx.history) && ctx.history.length > 0) {
      callArgs._history = ctx.history.slice(-6);
    }
    result = await def.run(callArgs);
  } catch (e) {
    result = { ok: false, summary: `Tool threw: ${(e as Error).message}` };
  }
  ctx.steps[ctx.steps.length - 1] = { label: def.name, detail: result.summary, ok: result.ok };
  ctx.push({ type: "observe", label: result.summary, detail: result.detail?.slice(0, 300), ok: result.ok });

  // A successful set_theme is converted into a client command HERE, from the
  // tool's own validated data - the repaint is guaranteed to match what was
  // persisted, and a failed tool never produces a command.
  if (def.name === "set_theme" && result.ok && result.data && typeof result.data === "object") {
    const tokens = (result.data as { tokens?: unknown }).tokens;
    if (tokens) ctx.themeCommand = { type: "set_theme", tokens: JSON.stringify(tokens) };
  }

  ctx.messages.push({ role: "assistant", content: raw });
  ctx.messages.push({
    role: "user",
    content: `[tool result] ${def.name} [tier: ${tier}]\nok=${result.ok}\n${result.detail ?? result.summary}\n\nContinue with the protocol: another tool call, or the final object.`,
  });
}

// Step budget exhausted: force the close with one final model call.
async function closeOnBudget(ctx: LoopCtx, zai: ZaiClient): Promise<AgentTurn> {
  ctx.push({ type: "error", label: "Step budget spent" });
  ctx.messages.push({
    role: "user",
    content: 'Step budget exhausted. Emit the final object NOW: {"thought":"...","final":true,"reply":"...","corrections":[],"commands":[]}',
  });
  const raw = await callModel(zai, ctx.messages, ctx.push);
  if (raw === null) {
    return {
      reply: "I hit the step budget and the model went quiet. The work so far is in my step trace; ask again and I will resume.",
      corrections: [],
      commands: [],
      steps: ctx.steps,
      toolsUsed: ctx.toolsUsed,
    };
  }
  const { turn } = extractTurn(raw);
  const reply = sanitizeReply(
    String(turn.reply ?? "") || (turn.thought ?? ""),
    "I ran my step budget before finishing; ask me to continue and I will pick up where I left off.",
  );
  const commands = withTheme(ctx, Array.isArray(turn.commands) ? turn.commands : []);
  ctx.push({ type: "final", reply, commands });
  return { reply, corrections: Array.isArray(turn.corrections) ? turn.corrections : [], commands, steps: ctx.steps, toolsUsed: ctx.toolsUsed };
}

export async function runAgent(
  message: string,
  history: { role: string; content: string }[],
  opts: {
    profile?: ProfileJson;
    emit?: (e: AgentEvent) => void;
    currentView?: string;
    activity?: Record<string, unknown> | null;
    signal?: AbortSignal;
    probe?: boolean;
  } = {},
): Promise<AgentTurn> {
  const { profile, emit, currentView, activity, signal, probe } = opts;
  const p = profile ?? (await (await import("@/lib/server")).buildProfile());
  const push = (e: AgentEvent) => emit?.(e);

  await ensureWorkspace();

  const ctx: LoopCtx = {
    message,
    history,
    probe,
    push,
    messages: [
      { role: "system", content: systemPrompt() },
      // Audit P1 (context compression): history passes the bounded seam -
      // 8 turns, 400 chars each, 3600 total with oldest-first eviction.
      ...compressHistory(history),
      {
        role: "user",
        content: `${message}\n\n${buildLiveContext(p, currentView, activity)}`,
      },
    ],
    steps: [],
    toolsUsed: [],
    tierBudgetUse: {},
    nudges: 0,
    enforced: { state: 0, deck: 0, week: 0, progress: 0 },
    themeCommand: null,
  };

  const zai = (await ZAI.create()) as unknown as Parameters<typeof callModel>[0];

  for (let step = 0; step < MAX_STEPS; step++) {
    const stopped = stoppedTurn(ctx, signal);
    if (stopped) return stopped;

    const raw = await callModel(zai, ctx.messages, ctx.push);
    if (raw === null) {
      return { reply: UNREACHABLE, corrections: [], commands: [], steps: ctx.steps, toolsUsed: ctx.toolsUsed };
    }

    const { turn, kind } = extractTurn(raw);
    const thought = turn.thought ?? "";

    if (!turn.final && !turn.tool && kind !== "prose") {
      const closed = closeJunkOrNudge(ctx, turn, raw, step);
      if (closed) return closed;
      continue;
    }

    if (turn.final || !turn.tool) {
      const closed = finalizeTurn(ctx, turn, raw, step);
      if (closed) return closed;
      continue;
    }

    const def = toolByName(String(turn.tool));
    if (!def) {
      unknownTool(ctx, String(turn.tool), raw);
      continue;
    }

    // Permission matrix (P1-8): tier-tag the trace and enforce per-run budgets
    // on the dangerous tiers. A refused call never executes.
    const tier = toolTier(def.name);
    if (tierRefusal(ctx, def, tier, raw)) continue;

    await runToolStep(ctx, turn, def, thought, raw, tier);
  }

  return closeOnBudget(ctx, zai);
}
