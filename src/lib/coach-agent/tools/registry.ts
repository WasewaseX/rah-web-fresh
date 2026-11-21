// ---------- registry ----------

import type { ToolArgs, ToolResult } from "./types";
import { readState } from "./state";
import { listFiles, readFileTool, writeFileTool, runJs } from "./files";
import { webSearch, pageReader, dictionary } from "./web";
import { coachSkill, makePdf, setTheme, triageFlags } from "./actions";
import { reviewForecast, addCards, setGoal, progressReview } from "./learner";
import { studyGuide } from "./guide";
import { RE_TOOLS, RE_TOOL_TIERS } from "../re-tools";

export interface ToolDef {
  name: string;
  desc: string;
  args: string; // JSON args example for the prompt
  run: (args: ToolArgs) => Promise<ToolResult>;
}

// PERMISSION MATRIX (audit P1-8): every tool has an explicit tier. The loop
// shows the tier on every trace step and enforces per-run budgets on the
// dangerous tiers - a prompt-injected page cannot spend the run's whole budget
// on state changes or code execution.
export type ToolTier = "read" | "write" | "exec" | "network" | "state";
const BASE_TOOL_TIERS: Record<string, ToolTier> = {
  read_state: "read",
  list_files: "read",
  read_file: "read",
  write_file: "write",
  make_pdf: "write",
  run_js: "exec",
  web_search: "network",
  page_reader: "network",
  coach_skill: "state", // runs the full skill engine - can touch learner state
  set_theme: "state", // repaints the whole app and persists the choice
  triage_flags: "state", // resolve mutates the flag queue
  // Task 125 abilities:
  review_forecast: "read", // pure aggregation over CardState
  dictionary: "network", // keyless external fetch, read-only
  add_cards: "state", // writes UserCard rows into the live deck
  set_goal: "state", // writes Learner dailyGoal/newPerDay/focusSkill
  study_guide: "read", // pure read over the embedded B1-C1 guide data (Task 130)
  progress_review: "read", // aggregation over the drill ledger + checklist + DailyStat (Task 140)
};
// RE domain (reverse engineering / malware analysis) merges its own tiers in:
// lookups are network-tier (budgeted), the consent gate is network, case
// persistence is state-tier (DB write), normalize/runbook are pure reads.
export const TOOL_TIERS: Record<string, ToolTier> = { ...BASE_TOOL_TIERS, ...RE_TOOL_TIERS } as Record<string, ToolTier>;
export function toolTier(name: string): ToolTier {
  return TOOL_TIERS[name] ?? "state"; // unknown = treat as most dangerous
}

// Per-run budgets by tier (loop enforces; tool calls beyond these are refused
// without executing). state: 2 -> 3 (Task 124): a legitimate single turn can
// need set_theme + coach_skill + triage_flags, and the honest refusal of a
// cheap, idempotent repaint read to the learner like a fake product limit.
// The run itself stays capped by MAX_STEPS, so the ceiling is still safe.
export const TIER_BUDGETS: Partial<Record<ToolTier, number>> = {
  state: 3,
  exec: 2,
  network: 4,
};

const BASE_TOOLS: ToolDef[] = [
  {
    name: "read_state",
    desc: "Read the learner's full live state: level, streak, XP, gems, freezes, mastery ledger, mistake families, next-best actions, last 7 days of stats. Call this before any advice that depends on data.",
    args: "{}",
    run: readState,
  },
  {
    name: "list_files",
    desc: "List files in the workspace (or read a small file directly). Workspace is the agent's own sandbox: data/coach-workspace.",
    args: '{"path": "."}',
    run: listFiles,
  },
  {
    name: "read_file",
    desc: "Read a file from the workspace sandbox.",
    args: '{"path": "notes.md"}',
    run: readFileTool,
  },
  {
    name: "write_file",
    desc: "Create or overwrite a file in the workspace sandbox (text files: .md, .txt, .ts, .js, .json, .csv). Multi-step plans, study schedules, generated drills, scripts. Files appear in the learner's Workspace panel.",
    args: '{"path": "plan.md", "content": "# Plan\\n..."}',
    run: writeFileTool,
  },
  {
    name: "make_pdf",
    desc: "Render a REAL PDF the learner can download. Give source_md (path of a workspace .md file, e.g. a report you just wrote) OR inline markdown; out is the .pdf filename. Use for every '.pdf' request - never claim PDFs are impossible.",
    args: '{"source_md": "progress-report.md", "out": "progress-report.pdf"}',
    run: makePdf,
  },
  {
    name: "run_js",
    desc: "Execute a .ts/.js file from the workspace in a sandboxed bun process (12s timeout). Use for computations, generated-content checks, data crunching. Write the file first with write_file.",
    args: '{"file": "scratch.ts"}',
    run: runJs,
  },
  {
    name: "web_search",
    desc: "Search the web for current information.",
    args: '{"query": "present perfect vs past simple exercises"}',
    run: webSearch,
  },
  {
    name: "page_reader",
    desc: "Fetch and read a specific web page's text.",
    args: '{"url": "https://..."}',
    run: pageReader,
  },
  {
    name: "coach_skill",
    desc: "Run one of Rah's built-in teaching skills on a message (chat correction, roleplay, exam generation, drill, socratic, ...). Use when the learner asks for a lesson-type interaction.",
    args: '{"message": "/test present perfect"}',
    run: coachSkill,
  },
  {
    name: "set_theme",
    desc: "Repaint the ENTIRE app in a new theme, live. Accepts a preset name (midnight, ocean, forest, sunset, violet, rose), a plain color word (green, blue, orange, purple, pink, red), or 'reset' for the default. Use whenever the learner asks to change the theme/colors/look - never claim you cannot.",
    args: '{"theme": "green"}',
    run: setTheme,
  },
  {
    name: "triage_flags",
    desc: "Content-flag triage (review feature #17). action=list shows the open content flags with full notes; action=resolve marks one fixed or wontfix by id. Use when the learner reports something wrong in a question/explanation/Farsi note, or asks what is in the queue.",
    args: '{"action": "resolve", "id": 3, "status": "fixed"}',
    run: triageFlags,
  },
  {
    name: "review_forecast",
    desc: "Project the review queue for the next 7 days from the real FSRS state: overdue, today, each of the next 6 days, and the new-card queue (gated separately). MANDATORY for ANY question about the week, coming days, workload or planning ('what does my week look like', 'when are my next reviews', 'help me plan') - read_state only knows TODAY, so answering a week question without this tool is wrong. Day-by-day counts come from here, nowhere else.",
    args: "{}",
    run: () => reviewForecast(),
  },
  {
    name: "dictionary",
    desc: "Look up one English word in a real dictionary: definitions, part of speech, examples, phonetics, synonyms. Free and keyless. Use for 'what does X mean' when you want verified senses - teach from the result in your own words. Unreachable? Fall back to web_search or your own knowledge.",
    args: '{"word": "ubiquitous"}',
    run: dictionary,
  },
  {
    name: "add_cards",
    desc: "Add up to 12 cards STRAIGHT TO THE REVIEW DECK (real UserCard rows that join the normal FSRS queue) - this is what 'add (the word/words) to my deck/vocabulary/cards' means. When the learner asks to add words to the deck, call THIS tool - do NOT make a document or PDF instead; the deck is not a file. kinds: cloze (sentence with ___), ef (English word/phrase -> Farsi), fae (Farsi -> English). level: B1/B2/B2+/C1. Fill prompt/answer yourself for each word (definition in learner words + example), add the Farsi gloss in fa, and tell the learner the cards are in their deck.",
    args: '{"cards": [{"kind": "cloze", "prompt": "The vaccine is ___ across the country.", "answer": "ubiquitous", "en": "ubiquitous", "fa": "همه‌جا حاضر", "note": "formal register", "level": "C1"}]}',
    run: addCards,
  },
  {
    name: "set_goal",
    desc: "Update the learner's own targets: dailyGoal (reviews/day, 5-200), newPerDay (new cards/day, 2-50), focusSkill (grammar, vocabulary, writing, speaking, reading, listening). Use for 'set my daily goal to 30', 'I want more new cards', 'focus on listening this week'. Confirms exactly what changed - already-set values are reported, not rewritten.",
    args: '{"dailyGoal": 30, "focusSkill": "listening"}',
    run: setGoal,
  },
  {
    name: "study_guide",
    desc: "Read the embedded B1-C1 guide map (English with Lucy's 'The Ultimate Guide to B1 B2 C1 Grammar & Vocabulary'): every grammar topic, vocabulary topic, self-rating checklist and 3-month study plan per CEFR level. MANDATORY for 'what grammar/vocabulary do I need for B2', 'B1 checklist', 'what is on the C1 exam path', 'make me a study plan to reach X' - the map is the authority for what each level contains; NEVER guess a level's contents from memory. section: all (default) | grammar | vocabulary | pronunciation | checklist | study_plan (study_plan expands into the app's derived 12-week schedule). The checklist is self-ratable in the Guide panel and read_state reports the saved ratings. Pair it with read_state to place the learner on the map.",
    args: '{"level": "B2", "section": "grammar"}',
    run: studyGuide,
  },
  {
    name: "progress_review",
    desc: "The learner's PAST-activity review - the mirror of review_forecast, which looks FORWARD: real drill requests from the B1-C1 guide ledger over the last N days (default 7), per-level coverage, checklist readiness verdicts, and daily review stats (reviews/correct/xp). MANDATORY for 'how did my week go', 'what did I do this week', 'weekly report', 'my progress this week' - do NOT answer past-activity questions from read_state alone; it has no drill ledger. HONEST LABELING: drill counts are REQUESTS (panel clicks), never completed sessions - report them as requests. days: 1-30, default 7.",
    args: '{"days": 7}',
    run: progressReview,
  },
];

// Full registry = base app tools + the RE (reverse-engineering) domain.
// re-tools.ts imports only TYPES from this file, so this edge is acyclic.
export const TOOLS: ToolDef[] = [...BASE_TOOLS, ...RE_TOOLS];

export function toolByName(name: string): ToolDef | undefined {
  return TOOLS.find((t) => t.name === name);
}
