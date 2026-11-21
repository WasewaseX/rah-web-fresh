"use client";

// ---------- Exam: ExamRun flow with ExamTaker + ResultCard ----------
// Split out of tutor.tsx: the component owns the hooks and the layout, the
// module helpers own the route calls and the state choreography, and the
// big render blocks (setup card, history, prescription) are prop-fed
// subcomponents.

import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useState } from "react";
import { ExamTaker, DrillCard, ResultCard } from "../coach/Blocks";
import type { Drill, DrillOutcome, Exam, ExamAnswers } from "@/lib/tutor/types";
import type {
  AssessReport,
  ClinicPayload,
  ExamHistoryRow,
  ExamReview,
  ExamStart,
  SubmitPayload,
} from "./shared";
import { TabBusy, TabError, answersToArray, postDrillOutcome, toDrill, toResult, toTutorExam } from "./shared";

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

type ExamResult = Parameters<typeof ResultCard>[0]["result"];

// The exam flow's reads and writes, grouped as one bundle so the component
// stays inside the function-length budget: hooks live in ExamTab, the
// choreography below receives the setters through this interface.
interface ExamFlow {
  setExam: Dispatch<SetStateAction<Exam | null>>;
  setSubmitting: Dispatch<SetStateAction<boolean>>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setResult: Dispatch<SetStateAction<ExamResult | null>>;
  setPrescription: Dispatch<SetStateAction<string[]>>;
  setDegradedNotice: Dispatch<SetStateAction<string | null>>;
  setHistory: Dispatch<SetStateAction<ExamHistoryRow[] | null>>;
  setDrillView: Dispatch<SetStateAction<Drill | null>>;
}

// ---------- route calls (module helpers) ----------

// POST /api/tutor/exam -> items without answers (they stay server-side)
async function requestExam(kind: string, length: string): Promise<Exam> {
  const r = await fetch("/api/tutor/exam", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, length }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? "Exam generation failed.");
  return toTutorExam(j as ExamStart);
}

// POST /api/tutor/exam/submit -> mechanical grade + AI assessment (+20 XP)
async function requestGrade(id: number, answers: ExamAnswers, count: number): Promise<SubmitPayload> {
  const r = await fetch("/api/tutor/exam/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, answers: answersToArray(answers, count), elapsedMs: 0 }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? "Grading failed.");
  return j as SubmitPayload;
}

// POST /api/tutor/clinic -> the drill for a result's weak spots. Throws the
// clinic's "nothing to drill" line so the caller's error path shows it.
async function requestWeakSpotDrill(): Promise<Drill> {
  const r = await fetch("/api/tutor/clinic", { method: "POST", cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? "Clinic failed.");
  const payload = j as ClinicPayload;
  if (payload.drill && payload.drill.items?.length) return toDrill(payload.drill);
  throw new Error("The clinic found no patterns to drill yet.");
}

// GET /api/tutor/exam?id= (done run) -> review mode with answers + report
async function requestExamReview(id: number): Promise<ExamReview> {
  const r = await fetch(`/api/tutor/exam?id=${id}`, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? "Not found.");
  return j as ExamReview;
}

// GET /api/tutor/exam (no id) -> history rows for the "Recent runs" list
async function requestHistory(): Promise<ExamHistoryRow[]> {
  try {
    const r = await fetch("/api/tutor/exam", { cache: "no-store" });
    const j = await r.json();
    return j.history ?? [];
  } catch {
    return [];
  }
}

// ---------- flow choreography (module helpers over the ExamFlow bundle) ----------

async function refreshHistory(f: ExamFlow): Promise<void> {
  f.setHistory(await requestHistory());
}

async function runStartExam(f: ExamFlow, kind: string, length: string): Promise<void> {
  f.setBusy(true);
  f.setError(null);
  f.setResult(null);
  f.setPrescription([]);
  try {
    f.setExam(await requestExam(kind, length));
  } catch (e) {
    f.setError((e as Error).message);
  } finally {
    f.setBusy(false);
  }
}

async function runSubmitExam(f: ExamFlow, exam: Exam, id: number, answers: ExamAnswers): Promise<void> {
  f.setSubmitting(true);
  f.setError(null);
  try {
    const p = await requestGrade(id, answers, exam.questions.length);
    f.setResult(toResult(exam.title, p));
    f.setPrescription(p.report.prescription ?? []);
    f.setDegradedNotice(degradedOf(p.report));
    f.setExam(null);
    void refreshHistory(f);
  } catch (e) {
    f.setError((e as Error).message);
  } finally {
    f.setSubmitting(false);
  }
}

async function runDrillWeak(f: ExamFlow): Promise<void> {
  f.setBusy(true);
  f.setError(null);
  try {
    const drill = await requestWeakSpotDrill();
    f.setResult(null);
    f.setPrescription([]);
    f.setDrillView(drill);
  } catch (e) {
    f.setError((e as Error).message);
  } finally {
    f.setBusy(false);
  }
}

async function runOpenDone(f: ExamFlow, id: number): Promise<void> {
  f.setBusy(true);
  f.setError(null);
  f.setResult(null);
  f.setPrescription([]);
  try {
    const rev = await requestExamReview(id);
    if (rev.report) {
      const total = Array.isArray(rev.items) && rev.items.length > 0 ? rev.items.length : rev.report.errors?.length || 1;
      f.setResult(
        toResult(rev.title, {
          report: rev.report,
          score: rev.score ?? 0,
          total,
        }),
      );
      f.setPrescription(rev.report.prescription ?? []);
      f.setDegradedNotice(degradedOf(rev.report));
    } else {
      f.setError("That run has no stored report yet.");
    }
  } catch (e) {
    f.setError((e as Error).message);
  } finally {
    f.setBusy(false);
  }
}

// Degraded honesty (audit P1-7): the notice only when the mechanical fallback
// graded the run because the AI grader was unreachable.
function degradedOf(report: AssessReport): string | null {
  return report.degraded ? report.degradedNotice ?? "This assessment was computed mechanically - the AI grader was unreachable." : null;
}

// ---------- render blocks (prop-fed subcomponents) ----------

function DegradedBanner({ notice }: { notice: string }) {
  return (
    <div className="card-rah p-4" style={{ borderColor: "var(--warn, #b45309)", borderWidth: 1 }}>
      <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--warn, #b45309)" }}>
        Degraded assessment
      </div>
      <p className="mt-1 text-[13px]" style={{ color: "var(--text)" }}>{notice}</p>
    </div>
  );
}

function PrescriptionList({ items }: { items: string[] }) {
  return (
    <div className="card-rah p-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
        Full prescription
      </div>
      <ul className="mt-2 space-y-1.5">
        {items.map((p, i) => (
          <li key={i} className="text-[13.5px]" style={{ color: "var(--text)" }}>{i + 1}. {p}</li>
        ))}
      </ul>
    </div>
  );
}

// The practice exam center: kind + length pickers and the generate button.
// Rendered only while idle, so the buttons are never disabled.
function ExamSetupCard({ kind, onKind, length, onLength, onStart }: { kind: string; onKind: (id: string) => void; length: string; onLength: (id: string) => void; onStart: () => void }) {
  return (
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
            onClick={() => onKind(k.id)}
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
            onClick={() => onLength(l.id)}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-all ${
              length === l.id ? "border-[var(--accent)] bg-[var(--accent)]/[0.14] text-[var(--accent-deep)]" : "border-white/[0.08] text-[var(--muted)]"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <button className="btn-primary text-[13.5px]" onClick={onStart}>
          Generate the exam
        </button>
      </div>
    </div>
  );
}

// "Recent runs": last 8 history rows; done runs open for review.
function ExamHistoryList({ history, onOpen }: { history: ExamHistoryRow[]; onOpen: (id: number) => void }) {
  return (
    <div className="card-rah p-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
        Recent runs
      </div>
      <div className="mt-3 space-y-2">
        {history.slice(0, 8).map((h) => (
          <button
            key={h.id}
            onClick={() => h.status === "done" && onOpen(h.id)}
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
  );
}

// ---------- the tab ----------

export function ExamTab() {
  const [exam, setExam] = useState<Exam | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [prescription, setPrescription] = useState<string[]>([]);
  const [degradedNotice, setDegradedNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<ExamHistoryRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drillView, setDrillView] = useState<Drill | null>(null);
  const [posted, setPosted] = useState(false);
  const [kind, setKind] = useState("mock");
  const [length, setLength] = useState("standard");

  const loadHistory = useCallback(async () => {
    setHistory(await requestHistory());
  }, []);

  useEffect(() => {
    // one-tick deferral: loadHistory() sets state synchronously
    const t = setTimeout(() => void loadHistory(), 0);
    return () => clearTimeout(t);
  }, [loadHistory]);

  const flow: ExamFlow = { setExam, setSubmitting, setBusy, setError, setResult, setPrescription, setDegradedNotice, setHistory, setDrillView };

  // ResultCard's follow-ups: weak spots -> the clinic builds the drill;
  // a new exam resets the flow.
  const drillWeak = () => void runDrillWeak(flow);
  const onDrillDone = async (o: DrillOutcome) => {
    if (posted) return;
    setPosted(true);
    await postDrillOutcome(o);
  };

  return (
    <div className="space-y-3">
      {error && <TabError msg={error} retry={() => setError(null)} />}

      {result && (
        <>
          {degradedNotice && <DegradedBanner notice={degradedNotice} />}
          <ResultCard result={result} onDrillWeak={drillWeak} onNewExam={() => { setResult(null); setPrescription([]); setDegradedNotice(null); }} busy={busy} />
          {prescription.length > 1 && <PrescriptionList items={prescription} />}
        </>
      )}

      {drillView && (
        <DrillCard drill={drillView} onDone={(o) => void onDrillDone(o)} />
      )}

      {!result && !drillView && exam && (
        <ExamTaker exam={exam} done={false} busy={submitting} onSubmit={(id, answers) => { if (exam) void runSubmitExam(flow, exam, id, answers); }} />
      )}

      {!result && !drillView && !exam && (
        <>
          {busy && <TabBusy label="Working..." />}
          {!busy && (
            <ExamSetupCard kind={kind} onKind={setKind} length={length} onLength={setLength} onStart={() => void runStartExam(flow, kind, length)} />
          )}
          {history && history.length > 0 && (
            <ExamHistoryList history={history} onOpen={(id) => void runOpenDone(flow, id)} />
          )}
        </>
      )}
    </div>
  );
}
