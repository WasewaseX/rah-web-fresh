"use client";

// Task 105: the Tutor hub. The Task 104 shell wired the recovered chat view
// (Socratic production coach over /api/ai). This pass lights up the rest of
// the recovered tutor system, whose server half has been live since Task 102
// with zero UI consumers:
//
//   Plan    GET/POST /api/tutor/plan        -> TutorReport(kind=plan)  7-day plan
//   Scan    GET/POST /api/tutor/scan        -> TutorReport(kind=scan)  band diagnostic
//   Clinic  GET/POST /api/tutor/clinic      -> TutorReport(kind=clinic) patterns + drill
//   Exam    POST /api/tutor/exam            -> ExamRun (answers stay server-side)
//           POST /api/tutor/exam/submit     -> mechanical grade + AI assessment (+20 XP)
//           GET  /api/tutor/exam            -> history / one run for review
//   Event   POST /api/tutor/event           -> drill outcome recorded, pays XP
//
// The interactive cards come from the recovered coach/Blocks.tsx: ExamTaker,
// DrillCard, ResultCard. Adapters here translate the routes' exact shapes
// onto the Blocks contracts (tutor/types) - nothing in Blocks changes.

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, Crosshair, GraduationCap, MessageCircle, Stethoscope } from "lucide-react";
import type { Boot } from "@/app/page";
import { SectionTitle } from "./bits";
import { ExamTaker, DrillCard, ResultCard } from "./coach/Blocks";
import type {
  Drill,
  DrillOutcome,
  Exam,
  ExamAnswers,
  ExamItemResult,
} from "@/lib/tutor/types";

// ---------- route shapes (exactly what the server returns) ----------

interface PlanDay {
  day: number;
  focus: string;
  tasks: { text: string; minutes: number }[];
}
interface PlanPayload {
  goal: string;
  days: PlanDay[];
}

interface ScanPayload {
  band: string;
  verdict: string;
  strengths: string[];
  weaknesses: { point: string; fix: string }[];
  actions: string[];
  confidence: number;
}

interface ClinicPattern {
  tag: string;
  count: number;
  examples: string[];
}
interface ClinicDrill {
  title: string;
  goal: string;
  items: { kind: string; q: string; a: string; fa: string }[];
}
interface ClinicPayload {
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
interface ExamStart {
  id: number;
  title: string;
  passage: string;
  items: ExamItemPublic[];
}

// POST /api/tutor/exam/submit -> { report: AssessReport, score, total, perSkill }
interface AssessReport {
  band: string;
  verdict: string;
  strengths: string[];
  weaknesses: string[];
  errors: { point: string; picked: string; right: string; fa: string }[];
  prescription: string[];
}
interface SubmitPayload {
  report: AssessReport;
  score: number;
  total: number;
}

// GET /api/tutor/exam (no id) -> history
interface ExamHistoryRow {
  id: number;
  kind: string;
  length: number;
  status: string;
  score: number | null;
  band: string | null;
  at: string;
}

// GET /api/tutor/exam?id= (done run) -> review mode with answers + report
interface ExamReview {
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
function toTutorExam(start: ExamStart): Exam {
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
function answersToArray(answers: ExamAnswers, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(answers[`q${i}`] ?? "");
  return out;
}

// submit -> CoachEnvelope["result"] for ResultCard. Per-item detail arrives
// via report.errors (the examiner's list), so the question-by-question review
// is built from exactly those entries.
function toResult(title: string, p: SubmitPayload): {
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
function toDrill(cd: ClinicDrill): Drill {
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

// ---------- the hub ----------

type Tab = "chat" | "plan" | "scan" | "clinic" | "exam";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "plan", label: "7-day plan", icon: CalendarDays },
  { id: "scan", label: "Diagnosis", icon: Stethoscope },
  { id: "clinic", label: "Clinic", icon: Crosshair },
  { id: "exam", label: "Exam", icon: GraduationCap },
];

interface Correction {
  wrong: string;
  right: string;
  fa: string;
  trap?: string;
}
interface Turn {
  role: "user" | "assistant";
  text?: string;
  reply?: string;
  corrections?: Correction[];
  fa_note?: string;
  error?: boolean;
}

export default function TutorView({ boot }: { boot: Boot }) {
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <div className="max-w-2xl mx-auto">
      <SectionTitle
        title="Tutor"
        sub="Socratic by contract: it makes you produce before it explains. Corrections carry the Farsi why."
        right={<span className="chip chip-accent">{boot.ai.builtin ? "built-in engine" : boot.ai.model}</span>}
      />
      <div className="mb-5 flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-all ${
                tab === t.id
                  ? "border-[var(--accent)] bg-[var(--accent)]/[0.14] text-[var(--accent-deep)]"
                  : "border-white/[0.08] text-[var(--muted)] hover:border-white/[0.2]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>
      {tab === "chat" && <ChatTab />}
      {tab === "plan" && <PlanTab />}
      {tab === "scan" && <ScanTab />}
      {tab === "clinic" && <ClinicTab />}
      {tab === "exam" && <ExamTab />}
    </div>
  );
}

// ---------- Chat (the Task 104 surface, unchanged contract) ----------

function ChatTab() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setTurns([
      {
        role: "assistant",
        reply:
          "Salam! I am your retrieval coach. Tell me about your week, and I will push you to produce English, not just understand it. Two sentences to start.",
        fa_note: "چیزی که می‌نویسی مهم نیست، مهم این است که تولید کنی. شروع کن.",
      },
    ]);
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setTurns((t) => [...t, { role: "user", text }]);
    setBusy(true);
    try {
      const history = [
        ...turns.map((t) => ({
          role: t.role,
          content: t.role === "user" ? "(user message)" : JSON.stringify({ reply: t.reply }),
        })),
        { role: "user", content: text },
      ];
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tutor", history }),
      });
      const j = await r.json();
      if (j.ok) {
        setTurns((t) => [
          ...t,
          { role: "assistant", reply: j.turn.reply, corrections: j.turn.corrections ?? [], fa_note: j.turn.fa_note },
        ]);
      } else {
        setTurns((t) => [
          ...t,
          { role: "assistant", reply: j.error ?? "The provider call failed.", error: true },
        ]);
      }
    } catch {
      setTurns((t) => [...t, { role: "assistant", reply: "Network error. Check your connection and try again.", error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 260px)" }}>
      <div ref={scroller} className="flex-1 overflow-y-auto pr-1 space-y-4">
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="rounded-3xl rounded-br-md px-5 py-3 max-w-[85%] text-[14.5px]" style={{ background: "var(--ink)", color: "#fff" }}>
                {t.text}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="card-rah px-5 py-4 max-w-[92%]">
                <div className="text-[14.5px] leading-relaxed whitespace-pre-wrap" style={t.error ? { color: "var(--danger)" } : undefined}>
                  {t.reply}
                </div>
                {t.corrections?.length ? (
                  <div className="mt-3 space-y-2">
                    {t.corrections.map((c, ci) => (
                      <div key={ci} className="rounded-xl p-3" style={{ background: "#f4f3ec" }}>
                        <div className="text-[13.5px]">
                          <span style={{ color: "var(--danger)", textDecoration: "line-through" }}>{c.wrong}</span>
                          {" → "}
                          <b style={{ color: "var(--accent-deep)" }}>{c.right}</b>
                        </div>
                        {c.fa ? <div dir="rtl" className="fa-text text-[13px] mt-1">{c.fa}</div> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {t.fa_note ? <div dir="rtl" className="fa-text text-[13px] mt-3 pt-3 border-t" style={{ borderColor: "var(--line)" }}>{t.fa_note}</div> : null}
              </div>
            </div>
          )
        )}
        {busy ? <div className="text-[13px]" style={{ color: "var(--muted)" }}>thinking...</div> : null}
      </div>
      <div className="pt-4">
        <div className="card-rah flex items-end gap-2 p-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            className="flex-1 resize-none rounded-2xl px-4 py-3 text-[14.5px] max-h-32"
            style={{ background: "transparent", border: "none", outline: "none" }}
            placeholder="Write in English. Mistakes welcome, that is the point."
            rows={1}
          />
          <button className="btn-primary text-[13.5px]" disabled={busy || !input.trim()} onClick={send}>
            Send
          </button>
        </div>
        <div className="text-[11.5px] mt-2 text-center" style={{ color: "var(--muted)" }}>
          Enter sends, Shift+Enter breaks a line. Powered by the built-in engine, no key required.
        </div>
      </div>
    </div>
  );
}

// ---------- shared tab scaffolding ----------

function TabBusy({ label }: { label: string }) {
  return (
    <div className="card-rah flex items-center gap-3 px-5 py-4 text-[13.5px]" style={{ color: "var(--muted)" }}>
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent)]" />
      {label}
    </div>
  );
}

function TabError({ msg, retry }: { msg: string; retry: () => void }) {
  return (
    <div className="card-rah px-5 py-4">
      <div className="text-[13.5px]" style={{ color: "var(--danger)" }}>{msg}</div>
      <button className="btn-primary mt-3 text-[13px]" onClick={retry}>Try again</button>
    </div>
  );
}

function GenerateBtn({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
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

// ---------- Plan: 7-day plan (TutorReport kind=plan) ----------

function PlanTab() {
  const [plan, setPlan] = useState<PlanPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (generate: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/tutor/plan", { method: generate ? "POST" : "GET", cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Plan failed.");
      if (j && j.days) setPlan(j as PlanPayload);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  return (
    <div className="space-y-3">
      {busy && <TabBusy label={loaded ? "Writing your 7-day plan..." : "Loading plan..."} />}
      {!busy && error && <TabError msg={error} retry={() => void load(true)} />}
      {!busy && !error && plan && (
        <div className="card-rah p-5">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
            This week, one goal
          </div>
          <div className="mt-1.5 text-[15px] font-bold leading-relaxed" style={{ color: "var(--text)" }}>{plan.goal}</div>
          <div className="mt-4 space-y-2.5">
            {plan.days.map((d) => (
              <div key={d.day} className="rounded-2xl p-3.5" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black" style={{ background: "var(--accent)", color: "#fff" }}>
                    {d.day}
                  </span>
                  <span className="text-[13.5px] font-bold" style={{ color: "var(--text)" }}>{d.focus}</span>
                </div>
                <div className="mt-2 space-y-1 pl-8">
                  {d.tasks.map((t, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span style={{ color: "var(--text-soft, #c9d2e3)" }}>{t.text}</span>
                      <span className="shrink-0 text-[11px] font-bold" style={{ color: "var(--muted)" }}>{t.minutes}m</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <button className="btn-primary text-[13px]" disabled={busy} onClick={() => void load(true)}>
              Rewrite the plan from today&apos;s evidence
            </button>
          </div>
        </div>
      )}
      {!busy && !error && !plan && loaded && (
        <GenerateBtn label="Build my 7-day plan" busy={busy} onClick={() => void load(true)} />
      )}
    </div>
  );
}

// ---------- Scan: band diagnostic (TutorReport kind=scan) ----------

function ScanTab() {
  const [scan, setScan] = useState<ScanPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (generate: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/tutor/scan", { method: generate ? "POST" : "GET", cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Scan failed.");
      if (j && j.report) setScan(j.report as ScanPayload);
      else setScan(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const conf = scan ? Math.round((scan.confidence ?? 0) * 100) : 0;

  return (
    <div className="space-y-3">
      {busy && <TabBusy label={loaded ? "Reading your evidence and grading honestly..." : "Loading last diagnosis..."} />}
      {!busy && error && <TabError msg={error} retry={() => void load(true)} />}
      {!busy && !error && scan && (
        <div className="card-rah p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
              Where you stand
            </div>
            <span className="chip">{conf < 40 ? "low evidence" : conf < 70 ? "fair evidence" : "strong evidence"}</span>
          </div>
          <div className="mt-2 flex items-end gap-3">
            <div className="display text-[38px] leading-none" style={{ color: "var(--accent-deep)" }}>{scan.band}</div>
            <div className="pb-1.5 text-[11.5px]" style={{ color: "var(--muted)" }}>provisional CEFR band, practice estimate</div>
          </div>
          <div className="mt-3 text-[13.5px] leading-relaxed" style={{ color: "var(--text)" }}>{scan.verdict}</div>
          {scan.strengths?.length > 0 && (
            <div className="mt-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Strengths</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {scan.strengths.map((s, i) => <span key={i} className="chip">{s}</span>)}
              </div>
            </div>
          )}
          {scan.weaknesses?.length > 0 && (
            <div className="mt-4 space-y-2">
              {scan.weaknesses.map((w, i) => (
                <div key={i} className="rounded-2xl p-3.5" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <div className="text-[13px] font-bold" style={{ color: "var(--text)" }}>{w.point}</div>
                  {w.fix && <div className="mt-1 text-[12.5px]" style={{ color: "var(--muted)" }}>Fix: {w.fix}</div>}
                </div>
              ))}
            </div>
          )}
          {scan.actions?.length > 0 && (
            <div className="mt-4 rounded-2xl p-3.5" style={{ background: "var(--accent)", opacity: 0.92 }}>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">Start today</div>
              <ul className="mt-1.5 space-y-1">
                {scan.actions.map((a, i) => (
                  <li key={i} className="text-[13px] font-semibold text-white">· {a}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 text-center">
            <button className="btn-primary text-[13px]" disabled={busy} onClick={() => void load(true)}>
              Re-scan with today&apos;s evidence
            </button>
          </div>
        </div>
      )}
      {!busy && !error && !scan && loaded && (
        <GenerateBtn
          label="Diagnose my level from reviews, writings, speaking and chats"
          busy={busy}
          onClick={() => void load(true)}
        />
      )}
    </div>
  );
}

// ---------- Clinic: patterns + instant drill (TutorReport kind=clinic) ----------

function ClinicTab() {
  const [data, setData] = useState<ClinicPayload | null>(null);
  const [drill, setDrill] = useState<Drill | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [posted, setPosted] = useState(false);

  const load = useCallback(async (generate: boolean) => {
    setBusy(true);
    setError(null);
    setDrill(null);
    setPosted(false);
    try {
      const r = await fetch("/api/tutor/clinic", { method: generate ? "POST" : "GET", cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Clinic failed.");
      const payload = (j && j.patterns ? (j as ClinicPayload) : null);
      setData(payload);
      if (payload?.drill && payload.drill.items?.length) setDrill(toDrill(payload.drill));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  // DrillCard grades locally; the outcome goes to /api/tutor/event, which
  // records it and pays XP - the recovered loop, now closed.
  const onDrillDone = async (o: DrillOutcome) => {
    if (posted) return;
    setPosted(true);
    try {
      await fetch("/api/tutor/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drill: { skill: o.skill, score: o.score, total: o.total, misses: [] } }),
      });
    } catch {
      // offline: the outcome is lost for XP, the practice itself already happened
    }
  };

  return (
    <div className="space-y-3">
      {busy && <TabBusy label={loaded ? "Mining your real mistakes..." : "Loading clinic..."} />}
      {!busy && error && <TabError msg={error} retry={() => void load(true)} />}
      {!busy && !error && data && data.patterns.length > 0 && (
        <div className="card-rah p-5">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
            Your recurring mistake patterns
          </div>
          <div className="mt-3 space-y-2">
            {data.patterns.map((p, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5" style={{ background: "rgba(255,255,255,0.03)" }}>
                <span className="text-[13.5px] font-bold capitalize" style={{ color: "var(--text)" }}>{p.tag.replace(/_/g, " ")}</span>
                <span className="chip">×{p.count}</span>
              </div>
            ))}
          </div>
          {data.message && <div className="mt-3 text-[12.5px]" style={{ color: "var(--muted)" }}>{data.message}</div>}
          <div className="mt-4 text-center">
            <button className="btn-primary text-[13px]" disabled={busy} onClick={() => void load(true)}>
              Re-mine mistakes and rebuild the drill
            </button>
          </div>
        </div>
      )}
      {!busy && !error && drill && (
        <DrillCard drill={drill} onDone={(o) => void onDrillDone(o)} />
      )}
      {!busy && !error && data && data.patterns.length === 0 && loaded && (
        <div className="card-rah px-5 py-4 text-[13.5px]" style={{ color: "var(--muted)" }}>
          {data.message ?? "No mistakes recorded yet. Use Tutor chat or grade some reviews first; the clinic mines real errors, not guesses."}
        </div>
      )}
      {!busy && !error && !data && loaded && (
        <GenerateBtn label="Mine my mistakes and build a 5-item drill" busy={busy} onClick={() => void load(true)} />
      )}
    </div>
  );
}

// ---------- Exam: ExamRun flow with ExamTaker + ResultCard ----------

function ExamTab() {
  const [exam, setExam] = useState<Exam | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Parameters<typeof ResultCard>[0]["result"] | null>(null);
  const [prescription, setPrescription] = useState<string[]>([]);
  const [history, setHistory] = useState<ExamHistoryRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drillView, setDrillView] = useState<Drill | null>(null);
  const [posted, setPosted] = useState(false);

  const KINDS: { id: string; label: string }[] = [
    { id: "mock", label: "Mock exam" },
    { id: "vocabulary", label: "Vocabulary" },
    { id: "grammar", label: "Grammar" },
    { id: "reading", label: "Reading" },
    { id: "use", label: "Use of English" },
  ];
  const LENGTHS: { id: string; label: string }[] = [
    { id: "quick", label: "Quick 8" },
    { id: "standard", label: "Standard 12" },
    { id: "full", label: "Full 18" },
  ];
  const [kind, setKind] = useState("mock");
  const [length, setLength] = useState("standard");

  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch("/api/tutor/exam", { cache: "no-store" });
      const j = await r.json();
      setHistory(j.history ?? []);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const startExam = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setPrescription([]);
    try {
      const r = await fetch("/api/tutor/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, length }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Exam generation failed.");
      setExam(toTutorExam(j as ExamStart));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitExam = async (id: number, answers: ExamAnswers) => {
    if (!exam) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/tutor/exam/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, answers: answersToArray(answers, exam.questions.length), elapsedMs: 0 }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Grading failed.");
      const p = j as SubmitPayload;
      setResult(toResult(exam.title, p));
      setPrescription(p.report.prescription ?? []);
      setExam(null);
      void loadHistory();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // ResultCard's follow-ups: weak spots -> the clinic builds the drill;
  // a new exam resets the flow.
  const drillWeak = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/tutor/clinic", { method: "POST", cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Clinic failed.");
      const payload = j as ClinicPayload;
      if (payload.drill && payload.drill.items?.length) {
        setResult(null);
        setPrescription([]);
        setDrillView(toDrill(payload.drill));
      } else {
        setError("The clinic found no patterns to drill yet.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // ResultCard's follow-ups: weak spots -> the clinic builds the drill;
  // a new exam resets the flow.
  const onDrillDone = async (o: DrillOutcome) => {
    if (posted) return;
    setPosted(true);
    try {
      await fetch("/api/tutor/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drill: { skill: o.skill, score: o.score, total: o.total, misses: [] } }),
      });
    } catch {
      // offline: practice happened, XP is lost - acceptable
    }
  };

  const openDone = async (id: number) => {
    setBusy(true);
    setError(null);
    setResult(null);
    setPrescription([]);
    try {
      const r = await fetch(`/api/tutor/exam?id=${id}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Not found.");
      const rev = j as ExamReview;
      if (rev.report) {
        const total = Array.isArray(rev.items) && rev.items.length > 0 ? rev.items.length : rev.report.errors?.length || 1;
        setResult(
          toResult(rev.title, {
            report: rev.report,
            score: rev.score ?? 0,
            total,
          }),
        );
        setPrescription(rev.report.prescription ?? []);
      } else {
        setError("That run has no stored report yet.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && <TabError msg={error} retry={() => setError(null)} />}

      {result && (
        <>
          <ResultCard result={result} onDrillWeak={() => void drillWeak()} onNewExam={() => { setResult(null); setPrescription([]); }} busy={busy} />
          {prescription.length > 1 && (
            <div className="card-rah p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                Full prescription
              </div>
              <ul className="mt-2 space-y-1.5">
                {prescription.map((p, i) => (
                  <li key={i} className="text-[13.5px]" style={{ color: "var(--text)" }}>{i + 1}. {p}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {drillView && (
        <DrillCard drill={drillView} onDone={(o) => void onDrillDone(o)} />
      )}

      {!result && !drillView && exam && (
        <ExamTaker exam={exam} done={false} busy={submitting} onSubmit={(id, answers) => void submitExam(id, answers)} />
      )}

      {!result && !drillView && !exam && (
        <>
          {busy && <TabBusy label="Working..." />}
          {!busy && (
            <div className="card-rah p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                Practice exam center
              </div>
              <p className="mt-1.5 text-[13px]" style={{ color: "var(--muted)" }}>
                Answers stay server-side; the grader owns the key. Submitting pays 20 XP and stores the full assessment.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {KINDS.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => setKind(k.id)}
                    className={`rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-all ${
                      kind === k.id ? "border-[var(--accent)] bg-[var(--accent)]/[0.14] text-[var(--accent-deep)]" : "border-white/[0.08] text-[var(--muted)]"
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {LENGTHS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLength(l.id)}
                    className={`rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-all ${
                      length === l.id ? "border-[var(--accent)] bg-[var(--accent)]/[0.14] text-[var(--accent-deep)]" : "border-white/[0.08] text-[var(--muted)]"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <button className="btn-primary text-[13.5px]" disabled={busy} onClick={() => void startExam()}>
                  Generate the exam
                </button>
              </div>
            </div>
          )}

          {history && history.length > 0 && (
            <div className="card-rah p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                Recent runs
              </div>
              <div className="mt-3 space-y-2">
                {history.slice(0, 8).map((h) => (
                  <button
                    key={h.id}
                    onClick={() => h.status === "done" && void openDone(h.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
                    style={{ background: "rgba(255,255,255,0.03)" }}
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold capitalize" style={{ color: "var(--text)" }}>
                        {h.kind} · {h.length} items
                      </div>
                      <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                        {h.status === "done" ? "graded - tap to review" : "in progress"}
                      </div>
                    </div>
                    {h.status === "done" ? (
                      <span className="chip">{h.score ?? "?"}/{h.length}{h.band ? ` · ${h.band}` : ""}</span>
                    ) : (
                      <span className="chip">open</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
