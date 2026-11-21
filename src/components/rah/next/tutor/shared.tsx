// Shared route shapes, adapters and tab scaffolding for the tutor tabs. The
// shapes mirror exactly what the /api/tutor/* routes return; the adapters
// translate them onto the Blocks contracts (tutor/types) - nothing in Blocks
// changes. Split out of tutor.tsx so each tab owns its render while the
// shapes and the shared cards stay in one place.

import type {
  Drill,
  DrillOutcome,
  Exam,
  ExamAnswers,
  ExamItemResult,
} from "@/lib/tutor/types";

// ---------- route shapes (exactly what the server returns) ----------

export interface PlanDay {
  day: number;
  focus: string;
  tasks: { text: string; minutes: number }[];
}
export interface PlanPayload {
  goal: string;
  days: PlanDay[];
}

export interface ScanPayload {
  band: string;
  verdict: string;
  strengths: string[];
  weaknesses: { point: string; fix: string }[];
  actions: string[];
  confidence: number;
}

export interface ClinicPattern {
  tag: string;
  count: number;
  examples: string[];
}
export interface ClinicDrill {
  title: string;
  goal: string;
  items: { kind: string; q: string; a: string; fa: string }[];
}
export interface ClinicPayload {
  patterns: ClinicPattern[];
  drill: ClinicDrill | null;
  message?: string;
}

// POST /api/tutor/exam -> items without answers (they stay server-side)
interface ExamItemPublic {
  type: string;
  skill: string;
  q: string;
  choices: string[];
}
export interface ExamStart {
  id: number;
  title: string;
  passage: string;
  items: ExamItemPublic[];
}

// POST /api/tutor/exam/submit -> { report: AssessReport, score, total, perSkill }
export interface AssessReport {
  band: string;
  verdict: string;
  strengths: string[];
  weaknesses: string[];
  errors: { point: string; picked: string; right: string; fa: string }[];
  prescription: string[];
  // Degraded honesty (audit P1-7): present only when the mechanical fallback
  // graded the run because the AI grader was unreachable.
  degraded?: boolean;
  degradedNotice?: string;
}
export interface SubmitPayload {
  report: AssessReport;
  score: number;
  total: number;
}

// GET /api/tutor/exam (no id) -> history
export interface ExamHistoryRow {
  id: number;
  kind: string;
  length: number;
  status: string;
  score: number | null;
  band: string | null;
  at: string;
}

// GET /api/tutor/exam?id= (done run) -> review mode with answers + report
export interface ExamReview {
  id: number;
  title: string;
  status: string;
  score: number | null;
  report: AssessReport | null;
  items?: unknown[];
}

// ---------- adapters: route shapes -> Blocks contracts ----------

// /api/tutor/exam items carry {type, skill, q, choices}; ExamTaker renders
// questions from the tutor/types Exam. Answers never ship to the client
// (the grader owns them), so the adapter fills inert placeholders for the
// grading-only fields ExamTaker never reads.
export function toTutorExam(start: ExamStart): Exam {
  return {
    id: start.id,
    title: start.title,
    title_fa: "",
    level: "",
    spec: "",
    timeLimitMin: 0,
    questions: start.items.map((it, i) => ({
      id: `q${i}`,
      type: (it.type === "mcq" || it.type === "cloze" || it.type === "transform" || it.type === "write" ? it.type : "short") as Exam["questions"][number]["type"],
      section: it.skill || "Exam",
      q: it.q,
      passage: start.passage || undefined,
      choices: it.choices?.length ? it.choices : undefined,
      answer: "",
      acceptable: [],
      why: "",
      fa: "",
      points: 1,
    })),
  };
}

// ExamTaker answers by question id; the submit route wants the picks as one
// array aligned with the run's item order. The adapter made ids q0..qn-1 in
// order, so numeric order restores the alignment.
export function answersToArray(answers: ExamAnswers, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(answers[`q${i}`] ?? "");
  return out;
}

// submit -> CoachEnvelope["result"] for ResultCard. Per-item detail arrives
// via report.errors (the examiner's list), so the question-by-question review
// is built from exactly those entries.
export function toResult(title: string, p: SubmitPayload): {
  title: string;
  score: number;
  total: number;
  percent: number;
  band: string;
  items: ExamItemResult[];
  strengths: string[];
  weaknesses: string[];
  leaks: { trap: string; note: string; fa: string }[];
  next_action: string;
} {
  const total = p.total > 0 ? p.total : 1;
  return {
    title,
    score: p.score,
    total,
    percent: Math.round((p.score / total) * 100),
    band: p.report.band,
    items: (p.report.errors ?? []).map((e, i) => ({
      qid: `e${i}`,
      section: "",
      type: "short" as const,
      q: e.point,
      given: e.picked,
      expected: e.right,
      ok: false,
      why: "",
      fa: e.fa ?? "",
      verdict: "wrong" as const,
    })),
    strengths: p.report.strengths ?? [],
    weaknesses: p.report.weaknesses ?? [],
    leaks: (p.report.errors ?? []).map((e) => ({ trap: e.point, note: `${e.picked} -> ${e.right}`, fa: e.fa ?? "" })),
    next_action: p.report.prescription?.[0] ?? "",
  };
}

// clinic drill {title, goal, items:[{kind,q,a,fa}]} -> tutor Drill for
// DrillCard, which grades locally with the same fuzzy rules as the server.
// Clinic items carry their choices inside the q text, so every item runs as
// a short-answer item; exact/typo tolerance keeps mcq-style answers fair.
export function toDrill(cd: ClinicDrill): Drill {
  return {
    title: cd.title,
    title_fa: "",
    intro: cd.goal,
    items: cd.items.map((it) => ({
      type: "short" as const,
      q: it.q,
      answer: it.a,
      acceptable: [],
      why: it.kind === "mcq" ? "Pick the correct choice and type it out - production, not recognition." : "",
      fa: it.fa ?? "",
    })),
  };
}

// DrillCard grades locally; the outcome goes to /api/tutor/event, which
// records it and pays XP - the recovered loop, now closed. Shared by the
// clinic and exam tabs (identical POST, identical offline tolerance).
export async function postDrillOutcome(o: DrillOutcome): Promise<void> {
  try {
    await fetch("/api/tutor/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drill: { skill: o.skill, score: o.score, total: o.total, misses: [] } }),
    });
  } catch {
    // offline: the outcome is lost for XP, the practice itself already happened
  }
}

// ---------- shared tab scaffolding ----------

export function TabBusy({ label }: { label: string }) {
  return (
    <div className="card-rah flex items-center gap-3 px-5 py-4 text-[13.5px]" style={{ color: "var(--muted)" }}>
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent)]" />
      {label}
    </div>
  );
}

export function TabError({ msg, retry }: { msg: string; retry: () => void }) {
  return (
    <div className="card-rah px-5 py-4">
      <div className="text-[13.5px]" style={{ color: "var(--danger)" }}>{msg}</div>
      <button className="btn-primary mt-3 text-[13px]" onClick={retry}>Try again</button>
    </div>
  );
}

export function GenerateBtn({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return (
    <div className="card-rah flex flex-col items-center gap-3 px-6 py-8 text-center">
      <p className="text-[13.5px] max-w-md" style={{ color: "var(--muted)" }}>
        {label}
      </p>
      <button className="btn-primary text-[13.5px]" disabled={busy} onClick={onClick}>
        {busy ? "Working..." : label}
      </button>
    </div>
  );
}
