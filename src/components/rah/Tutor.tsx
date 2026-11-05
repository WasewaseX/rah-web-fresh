"use client";

// Tutor Skills Hub: the coach's real instruments, on demand. No badges, no
// nagging, no popups. Four skills: Deep Level Scan, Exam Center, Mistake
// Clinic, Study Plan. You run what you want, when you want.

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, ClipboardList, Stethoscope, CalendarDays, Play, ArrowRight, ArrowLeft, Check, RotateCcw, Trash2, FileText } from "lucide-react";
import { Bar, Btn, Card, Chip, FA, Note, Ring, SectionHead, Spinner } from "./ui";
import type { AppState, ViewId } from "./App";

// ---------- shared types ----------

interface ScanReport {
  band: string;
  confidence: number;
  vocabEstimate: number;
  skills: { skill: string; band: string; score: number; evidence: string }[];
  strengths: { point: string; evidence: string }[];
  weaknesses: { point: string; evidence: string; fix: string }[];
  actions: string[];
}

interface ExamListItem {
  id: string;
  kind: string;
  length: number;
  status: string;
  score: number | null;
  band: string | null;
  at: string;
}

interface RunnerItem {
  type: "mcq" | "cloze" | "short";
  skill: string;
  q: string;
  choices: string[];
}

interface FullItem extends RunnerItem {
  a: string;
  fa: string;
  why: string;
}

interface ExamReport {
  band: string;
  verdict: string;
  strengths: string[];
  weaknesses: string[];
  errors: { point: string; picked: string; right: string; fa: string }[];
  prescription: string[];
}

interface ClinicData {
  patterns: { tag: string; count: number; examples: string[] }[];
  drill: { title: string; goal: string; items: { kind: string; q: string; a: string; fa: string }[] } | null;
  message?: string;
}

interface PlanData {
  goal: string;
  days: { day: number; focus: string; tasks: { text: string; minutes: number }[] }[];
}

const KINDS: { id: string; label: string; desc: string }[] = [
  { id: "vocabulary", label: "Vocabulary", desc: "Words in context, collocations, word formation" },
  { id: "grammar", label: "Grammar", desc: "Structure choices, Farsi interference half the items" },
  { id: "reading", label: "Reading", desc: "One passage, literal + inference items" },
  { id: "use", label: "Use of English", desc: "Register, discourse markers, phrasal verbs" },
  { id: "mock", label: "Full mock", desc: "Mixed blueprint, B2 to the C1 edge" },
];

const LENGTHS: { id: string; label: string }[] = [
  { id: "quick", label: "Quick 8" },
  { id: "standard", label: "Standard 12" },
  { id: "full", label: "Full 18" },
];

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:"'`()\-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- main ----------

export default function TutorView({ state, go }: { state: AppState; go: (v: ViewId) => void }) {
  const [tab, setTab] = useState<"scan" | "exams" | "clinic" | "plan">("scan");

  const tabs = [
    { id: "scan", label: "Level Scan", icon: Activity },
    { id: "exams", label: "Exams", icon: ClipboardList },
    { id: "clinic", label: "Clinic", icon: Stethoscope },
    { id: "plan", label: "7-Day Plan", icon: CalendarDays },
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      {/* Segment switcher */}
      <div className="flex gap-1.5 rounded-2xl border border-white/[0.07] bg-[#161b26] p-1.5">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-bold transition-all sm:text-sm ${
                active ? "bg-[#4e8cff]/[0.16] text-[#9dc0ff] shadow-[inset_0_0_0_1px_rgba(78,140,255,.3)]" : "text-[#7d889c] hover:bg-white/[0.04] hover:text-[#dbe3f0]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {tab === "scan" && <ScanTab state={state} />}
      {tab === "exams" && <ExamsTab state={state} />}
      {tab === "clinic" && <ClinicTab />}
      {tab === "plan" && <PlanTab state={state} go={go} />}
    </div>
  );
}

// ---------- 1. Deep Level Scan ----------

const SCAN_STAGES = ["Collecting every signal", "Weighing the evidence", "Writing the prescription"];

function ScanTab({ state }: { state: AppState }) {
  const [report, setReport] = useState<ScanReport | null>(null);
  const [at, setAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    fetch("/api/tutor/scan")
      .then((r) => r.json())
      .then((d) => {
        if (d.report) {
          setReport(d.report as ScanReport);
          setAt(d.at);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setStage((s) => (s + 1) % SCAN_STAGES.length), 4000);
    return () => clearInterval(t);
  }, [busy]);

  const run = async () => {
    setBusy(true);
    setError(null);
    setStage(0);
    try {
      const r = await fetch("/api/tutor/scan", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "scan failed");
      setReport(d.report as ScanReport);
      setAt(d.at);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <Card className="flex flex-col items-center gap-4 py-14">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#2a3242] border-t-[#4e8cff]" />
        <div className="text-sm font-bold text-[#dbe3f0]">{SCAN_STAGES[stage]}</div>
        <p className="max-w-xs text-center text-xs leading-relaxed text-[#7d889c]">
          Reviews, corrections, writing scores, speaking scores, streaks: everything the app has recorded gets read at once.
        </p>
      </Card>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col gap-4">
        <Card>
          <SectionHead kicker="Skill 1" title="Deep Level Scan" />
          <p className="mt-2 text-sm leading-relaxed text-[#a9b4c6]">
            A senior-examiner read of all your evidence: SRS accuracy per skill, every correction and its Farsi interference tag, writing and speaking
            dimension scores, consistency. Output: honest bands per skill, a vocabulary estimate, and a prescription.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip tone="blue">{state.seen} cards seen</Chip>
            <Chip tone="slate">{state.chatCount} coach turns</Chip>
            <Chip tone="slate">{state.writes} writings</Chip>
            <Chip tone="slate">{state.speaks} monologues</Chip>
          </div>
          {state.seen === 0 && state.chatCount === 0 && (
            <Note tone="amber">
              Almost no evidence yet. The scan will lean on thin data; use Review and Coach first, then scan for a real read.
            </Note>
          )}
          {error && (
            <div className="mt-4">
              <Note tone="rose">{error}</Note>
            </div>
          )}
          <Btn onClick={run} className="mt-5">
            <Play className="h-4 w-4" /> Run deep scan
          </Btn>
        </Card>
      </div>
    );
  }

  const conf = report.confidence <= 1 ? Math.round(report.confidence * 100) : Math.round(report.confidence);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <SectionHead kicker={at ? `Scanned ${new Date(at).toLocaleDateString()}` : "Latest scan"} title={`Overall band: ${report.band}`} />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Chip tone="blue">confidence {conf}%</Chip>
              {report.vocabEstimate > 0 && <Chip tone="cyan">~{report.vocabEstimate.toLocaleString()} word families</Chip>}
              {state.learner.level !== "?" && state.learner.level !== report.band && <Chip tone="amber">app level: {state.learner.level}</Chip>}
            </div>
          </div>
          <Btn variant="soft" onClick={run} className="shrink-0 !min-h-10 !px-3 !py-2 text-xs">
            <RotateCcw className="h-3.5 w-3.5" /> Rescan
          </Btn>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {report.skills.map((s) => (
            <div key={s.skill}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-sm font-bold capitalize text-[#dbe3f0]">{s.skill}</span>
                <span className="text-xs font-black text-[#9dc0ff]">{s.band}</span>
              </div>
              <Bar value={s.score <= 10 ? s.score * 10 : s.score} max={100} tone={s.score >= 75 ? "emerald" : s.score >= 40 ? "blue" : "amber"} />
              <div className="mt-1 text-xs leading-relaxed text-[#7d889c]">{s.evidence}</div>
            </div>
          ))}
        </div>
      </Card>

      {report.weaknesses.length > 0 && (
        <Card>
          <SectionHead kicker="Fix these first" title="Weaknesses" />
          <div className="mt-3 flex flex-col gap-4">
            {report.weaknesses.map((w, i) => (
              <div key={i} className="rounded-2xl border border-[#ff6b81]/20 bg-[#ff6b81]/[0.06] p-4">
                <div className="text-sm font-bold text-[#ffc9d2]">{w.point}</div>
                <div className="mt-1 text-xs leading-relaxed text-[#a9b4c6]">{w.evidence}</div>
                <div className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-[#7fe0ac]">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w.fix}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {report.strengths.length > 0 && (
        <Card>
          <SectionHead kicker="Keep compounding" title="Strengths" />
          <div className="mt-3 flex flex-col gap-2.5">
            {report.strengths.map((s, i) => (
              <div key={i} className="text-sm leading-relaxed text-[#a9b4c6]">
                <span className="font-bold text-[#c4f2d8]">{s.point}</span> {s.evidence && <span className="text-[#7d889c]">, {s.evidence}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {report.actions.length > 0 && (
        <Note tone="blue">
          <div className="font-bold">Next actions</div>
          <ul className="mt-1.5 list-inside list-disc">
            {report.actions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </Note>
      )}
    </div>
  );
}

// ---------- 2. Exam Center ----------

function ExamsTab({ state }: { state: AppState }) {
  // launcher | runner | done | review
  const [mode, setMode] = useState<"launcher" | "runner" | "done" | "review">("launcher");
  const [kind, setKind] = useState("mock");
  const [len, setLen] = useState("standard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [exam, setExam] = useState<{ id: string; title: string; passage: string; items: RunnerItem[] } | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const startedAt = useRef(0);

  const [result, setResult] = useState<{ report: ExamReport; score: number; total: number; perSkill: Record<string, { ok: number; total: number }> } | null>(null);
  const [review, setReview] = useState<{ title: string; items: FullItem[]; learnerAnswers: string[]; report: ExamReport | null; score: number | null } | null>(null);
  const [history, setHistory] = useState<ExamListItem[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch("/api/tutor/exam");
      const d = await r.json();
      setHistory(d.history ?? []);
    } catch {
      // history is cosmetic; ignore
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/tutor/exam", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, length: len }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "generation failed");
      setExam(d);
      setPicks(new Array(d.items.length).fill(""));
      setQIdx(0);
      startedAt.current = Date.now();
      setMode("runner");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!exam) return;
    setBusy(true);
    try {
      const r = await fetch("/api/tutor/exam/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: exam.id, answers: picks, elapsedMs: Date.now() - startedAt.current }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "submit failed");
      setResult(d);
      setMode("done");
      loadHistory();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openFromHistory = async (id: string, status: string) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/tutor/exam?id=${id}`);
      const d = await r.json();
      if (d.status === "done") {
        setReview({ title: d.title, items: d.items, learnerAnswers: d.learnerAnswers ?? [], report: d.report, score: d.score });
        setMode("review");
      } else if (d.status === "active" && d.items) {
        // Resume an abandoned run.
        setExam({ id: d.id, title: d.title, passage: d.passage ?? "", items: d.items });
        setPicks(new Array(d.items.length).fill("").map((_, i) => d.answers?.[i] ?? ""));
        setQIdx(0);
        startedAt.current = Date.now();
        setMode("runner");
      }
    } finally {
      setBusy(false);
    }
  };

  // ----- launcher -----
  if (mode === "launcher") {
    const activeRun = history.find((h) => h.status === "active");
    return (
      <div className="flex flex-col gap-4">
        <Card>
          <SectionHead kicker="Skill 2" title="Exam Center" />
          <p className="mt-2 text-sm leading-relaxed text-[#a9b4c6]">
            A fresh exam written for your band every time, graded mechanically, then assessed: band, per-section accuracy, error analysis with the
            Farsi why, and a prescription. Elapsed time is recorded, never a countdown.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button
                key={k.id}
                onClick={() => setKind(k.id)}
                className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                  kind === k.id ? "border-[#4e8cff]/40 bg-[#4e8cff]/[0.14] text-[#9dc0ff]" : "border-white/[0.07] bg-white/[0.03] text-[#8b96a9] hover:text-[#dbe3f0]"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs leading-relaxed text-[#7d889c]">{KINDS.find((k) => k.id === kind)?.desc}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {LENGTHS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLen(l.id)}
                className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                  len === l.id ? "border-[#4cc9f0]/40 bg-[#4cc9f0]/[0.12] text-[#9de6fb]" : "border-white/[0.07] bg-white/[0.03] text-[#8b96a9] hover:text-[#dbe3f0]"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
          {error && (
            <div className="mt-4">
              <Note tone="rose">{error}</Note>
            </div>
          )}
          <Btn onClick={start} disabled={busy} className="mt-5">
            {busy ? <Spinner label="Writing your exam" /> : (
              <>
                <Play className="h-4 w-4" /> Generate and start
              </>
            )}
          </Btn>
          {busy && <p className="mt-2 text-xs text-[#7d889c]">The examiner writes every item fresh: this takes up to a minute.</p>}
        </Card>

        {activeRun && (
          <Card className="border-[#ffb02e]/25">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-[#ffd08a]">Unfinished exam</div>
                <div className="text-xs text-[#a9b4c6]">{activeRun.kind}, {activeRun.length} items, still open.</div>
              </div>
              <Btn variant="warm" onClick={() => openFromHistory(activeRun.id, "active")} className="!min-h-10 !px-4 text-xs">
                Resume <ArrowRight className="h-3.5 w-3.5" />
              </Btn>
            </div>
          </Card>
        )}

        {history.filter((h) => h.status === "done").length > 0 && (
          <Card>
            <SectionHead kicker="Past runs" title="Exam history" />
            <div className="mt-3 flex flex-col gap-2">
              {history
                .filter((h) => h.status === "done")
                .map((h) => (
                  <button
                    key={h.id}
                    onClick={() => openFromHistory(h.id, h.status)}
                    className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-left transition-all hover:border-white/[0.14]"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-[#5f8fe8]" />
                      <div>
                        <div className="text-sm font-bold capitalize text-[#dbe3f0]">{h.kind} exam</div>
                        <div className="text-xs text-[#7d889c]">
                          {new Date(h.at).toLocaleDateString()} {new Date(h.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {h.band && <Chip tone="blue">{h.band}</Chip>}
                      <span className="text-sm font-black text-[#f2f5fa]">
                        {h.score}/{h.length}
                      </span>
                      <ArrowRight className="h-4 w-4 text-[#3a4356] group-hover:text-[#4e8cff]" />
                    </div>
                  </button>
                ))}
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ----- runner -----
  if (mode === "runner" && exam) {
    const item = exam.items[qIdx];
    const answered = picks.filter((p) => p.trim() !== "").length;
    const last = qIdx === exam.items.length - 1;
    return (
      <div className="flex flex-col gap-4">
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5f8fe8]">{exam.title}</div>
            <Chip tone="slate">{item.skill}</Chip>
          </div>
          <Bar value={qIdx + 1} max={exam.items.length} />
          <div className="mt-2 text-xs font-semibold text-[#7d889c]">
            Question {qIdx + 1} of {exam.items.length}
          </div>

          {exam.passage && qIdx === 0 && (
            <div className="mt-4 max-h-56 overflow-y-auto rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 text-sm leading-relaxed text-[#dbe3f0]">
              {exam.passage}
            </div>
          )}
          {exam.passage && qIdx > 0 && (
            <details className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3">
              <summary className="cursor-pointer text-xs font-bold text-[#5f8fe8]">Show the passage</summary>
              <p className="mt-2 text-sm leading-relaxed text-[#dbe3f0]">{exam.passage}</p>
            </details>
          )}

          <p className="mt-5 text-[15px] font-semibold leading-relaxed text-[#f2f5fa]">{item.q}</p>

          {item.type === "mcq" ? (
            <div className="mt-4 flex flex-col gap-2">
              {item.choices.map((c, ci) => {
                const selected = picks[qIdx] === c;
                return (
                  <button
                    key={ci}
                    onClick={() => setPicks((p) => p.map((v, i) => (i === qIdx ? c : v)))}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-all ${
                      selected ? "border-[#4e8cff]/50 bg-[#4e8cff]/[0.14] text-[#cfe0ff]" : "border-white/[0.08] bg-white/[0.03] text-[#a9b4c6] hover:border-white/[0.16] hover:text-[#e7ecf5]"
                    }`}
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black ${selected ? "bg-[#4e8cff] text-white" : "bg-white/[0.07] text-[#8b96a9]"}`}>
                      {String.fromCharCode(65 + ci)}
                    </span>
                    {c}
                  </button>
                );
              })}
            </div>
          ) : (
            <input
              value={picks[qIdx] ?? ""}
              onChange={(e) => setPicks((p) => p.map((v, i) => (i === qIdx ? e.target.value : v)))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !last) setQIdx((i) => i + 1);
              }}
              placeholder={item.type === "cloze" ? "Type the missing part" : "Type your answer"}
              className="mt-4 w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-sm text-[#f2f5fa] outline-none transition-colors placeholder:text-[#5d6779] focus:border-[#4e8cff]/50"
              dir="ltr"
            />
          )}

          <div className="mt-6 flex items-center justify-between">
            <Btn variant="soft" onClick={() => setQIdx((i) => Math.max(0, i - 1))} disabled={qIdx === 0} className="!min-h-10 !px-4 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Btn>
            {!last ? (
              <Btn onClick={() => setQIdx((i) => i + 1)} className="!min-h-10 !px-4 text-xs">
                Next <ArrowRight className="h-3.5 w-3.5" />
              </Btn>
            ) : (
              <Btn variant="go" onClick={submit} disabled={busy} className="!min-h-10 !px-4 text-xs">
                {busy ? <Spinner label="Assessing" /> : (
                  <>
                    <Check className="h-3.5 w-3.5" /> Submit{exam.items.length - answered > 0 ? ` (${exam.items.length - answered} blank)` : ""}
                  </>
                )}
              </Btn>
            )}
          </div>
        </Card>
        {error && <Note tone="rose">{error}</Note>}
      </div>
    );
  }

  // ----- assessment report -----
  if (mode === "done" && result) {
    const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
    return (
      <div className="flex flex-col gap-4">
        <Card>
          <div className="flex items-center gap-6">
            <Ring value={result.score} max={result.total} size={104} label={`${pct}%`} sub={`${result.score}/${result.total}`} />
            <div>
              <SectionHead kicker="Assessment" title={`Band: ${result.report.band}`} />
              <p className="mt-2 text-sm leading-relaxed text-[#a9b4c6]">{result.report.verdict}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-2.5">
            {Object.entries(result.perSkill).map(([skill, v]) => (
              <div key={skill} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm font-medium capitalize text-[#a9b4c6]">{skill}</span>
                <Bar value={v.ok} max={v.total} tone={v.ok / v.total >= 0.7 ? "emerald" : v.ok / v.total >= 0.4 ? "blue" : "rose"} />
                <span className="w-10 shrink-0 text-right text-sm font-black text-[#f2f5fa]">
                  {v.ok}/{v.total}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {result.report.errors.length > 0 && (
          <Card>
            <SectionHead kicker="Learn from these" title="Wrong picks" />
            <div className="mt-3 flex flex-col gap-4">
              {result.report.errors.map((e, i) => (
                <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="text-sm font-semibold leading-relaxed text-[#dbe3f0]">{e.point}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold">
                    <span className="rounded-lg bg-[#ff6b81]/[0.12] px-2 py-1 text-[#ffa3b1] line-through">{e.picked || "blank"}</span>
                    <ArrowRight className="h-3 w-3 text-[#5d6779]" />
                    <span className="rounded-lg bg-[#3ccb7f]/[0.12] px-2 py-1 text-[#7fe0ac]">{e.right}</span>
                  </div>
                  {e.fa && (
                    <div className="mt-2">
                      <FA className="text-xs leading-relaxed">{e.fa}</FA>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {result.report.prescription.length > 0 && (
          <Note tone="blue">
            <div className="font-bold">Prescription</div>
            <ul className="mt-1.5 list-inside list-disc">
              {result.report.prescription.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </Note>
        )}

        <div className="flex gap-3">
          <Btn
            variant="soft"
            onClick={() => {
              setMode("launcher");
              setResult(null);
            }}
          >
            <RotateCcw className="h-4 w-4" /> Another exam
          </Btn>
        </div>
      </div>
    );
  }

  // ----- review of a past exam -----
  if (mode === "review" && review) {
    return (
      <div className="flex flex-col gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <SectionHead kicker="Past exam" title={review.title} />
            {review.score !== null && <Chip tone="blue">{review.score}/{review.items.length}</Chip>}
          </div>
          {review.report && <p className="mt-2 text-sm leading-relaxed text-[#a9b4c6]">{review.report.verdict}</p>}
          <div className="mt-4 flex flex-col gap-3">
            {review.items.map((it, i) => {
              const mine = review.learnerAnswers[i] ?? "";
              const ok = norm(mine) === norm(it.a) || it.a.split("|").map(norm).includes(norm(mine));
              return (
                <div key={i} className={`rounded-2xl border p-4 ${ok ? "border-[#3ccb7f]/20 bg-[#3ccb7f]/[0.04]" : "border-[#ff6b81]/20 bg-[#ff6b81]/[0.04]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold leading-relaxed text-[#dbe3f0]">{it.q}</div>
                    <Chip tone={ok ? "emerald" : "rose"}>{ok ? "ok" : "miss"}</Chip>
                  </div>
                  {!ok && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold">
                      <span className="rounded-lg bg-[#ff6b81]/[0.12] px-2 py-1 text-[#ffa3b1] line-through">{mine || "blank"}</span>
                      <ArrowRight className="h-3 w-3 text-[#5d6779]" />
                      <span className="rounded-lg bg-[#3ccb7f]/[0.12] px-2 py-1 text-[#7fe0ac]">{it.a.split("|")[0]}</span>
                    </div>
                  )}
                  {it.why && <div className="mt-2 text-xs leading-relaxed text-[#7d889c]">{it.why}</div>}
                </div>
              );
            })}
          </div>
        </Card>
        <Btn
          variant="soft"
          onClick={() => {
            setMode("launcher");
            setReview(null);
          }}
        >
          <ArrowLeft className="h-4 w-4" /> Back to exams
        </Btn>
      </div>
    );
  }

  return null;
}

// ---------- 3. Mistake Clinic ----------

function ClinicTab() {
  const [data, setData] = useState<ClinicData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drillPicks, setDrillPicks] = useState<string[]>([]);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [revealed, setRevealed] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    fetch("/api/tutor/clinic")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.patterns) {
          setData(d as ClinicData);
          if (d.drill) {
            setDrillPicks(new Array(d.drill.items.length).fill(""));
            setChecked(new Array(d.drill.items.length).fill(false));
          }
        }
      })
      .catch(() => undefined);
  }, []);

  const mine = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/tutor/clinic", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "clinic failed");
      setData(d as ClinicData);
      if (d.drill) {
        setDrillPicks(new Array(d.drill.items.length).fill(""));
        setChecked(new Array(d.drill.items.length).fill(false));
        setRevealed(false);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const checkItem = (i: number) => {
    if (!data?.drill) return;
    const item = data.drill.items[i];
    const mineAns = norm(drillPicks[i] ?? "");
    const ok = item.a.split("|").map(norm).includes(mineAns);
    setChecked((c) => c.map((v, ci) => (ci === i ? ok : v)));
  };

  if (busy) {
    return (
      <Card className="flex flex-col items-center gap-4 py-14">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#2a3242] border-t-[#4e8cff]" />
        <div className="text-sm font-bold text-[#dbe3f0]">Mining your corrections and lapses</div>
      </Card>
    );
  }

  const noData = data && (data.patterns.length === 0 || data.message);
  const maxCount = data?.patterns[0]?.count ?? 1;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <SectionHead kicker="Skill 3" title="Mistake Clinic" />
          {data && !noData && (
            <Btn variant="soft" onClick={mine} className="shrink-0 !min-h-10 !px-3 !py-2 text-xs">
              <RotateCcw className="h-3.5 w-3.5" /> Remine
            </Btn>
          )}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[#a9b4c6]">
          Every correction the coach made, every lapsed card, every writing error: clustered into your dominant error patterns. The top pattern gets a
          five-item drill that forces the right form out of you.
        </p>
        {!data && (
          <Btn onClick={mine} className="mt-5">
            <Stethoscope className="h-4 w-4" /> Mine my mistakes
          </Btn>
        )}
        {error && (
          <div className="mt-4">
            <Note tone="rose">{error}</Note>
          </div>
        )}
      </Card>

      {noData && (
        <Note tone="amber">{data?.message ?? "No mistakes recorded yet."}</Note>
      )}

      {data && !noData && (
        <>
          <Card>
            <SectionHead kicker="Your error fingerprint" title="Patterns" />
            <div className="mt-4 flex flex-col gap-3">
              {data.patterns.map((p) => (
                <div key={p.tag}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-sm font-bold capitalize text-[#dbe3f0]">{p.tag.replace(/_/g, " ")}</span>
                    <span className="text-xs font-black text-[#ffa3b1]">{p.count} hits</span>
                  </div>
                  <Bar value={p.count} max={maxCount} tone="rose" />
                </div>
              ))}
            </div>
          </Card>

          {data.drill && (
            <Card>
              <SectionHead kicker={`Drill: ${data.drill.goal}`} title={data.drill.title} />
              <div className="mt-4 flex flex-col gap-4">
                {data.drill.items.map((item, i) => (
                  <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                    <div className="flex items-start gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#4e8cff]/[0.14] text-xs font-black text-[#9dc0ff]">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold leading-relaxed text-[#f2f5fa]">{item.q}</div>
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#5d6779]">{item.kind}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            value={drillPicks[i] ?? ""}
                            onChange={(e) => setDrillPicks((p) => p.map((v, pi) => (pi === i ? e.target.value : v)))}
                            placeholder="Your answer"
                            className="min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-[#f2f5fa] outline-none transition-colors placeholder:text-[#5d6779] focus:border-[#4e8cff]/50"
                            dir="ltr"
                          />
                          <Btn
                            variant={checked[i] === true ? "go" : checked[i] === false ? "danger" : "soft"}
                            onClick={() => checkItem(i)}
                            className="!min-h-9 !px-3 !py-1.5 text-xs"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Btn>
                        </div>
                        {checked[i] !== undefined && checked[i] !== null && (
                          <div className="mt-1.5 text-xs font-bold">
                            {checked[i] ? (
                              <span className="text-[#7fe0ac]">Correct.</span>
                            ) : (
                              <span className="text-[#ffa3b1]">
                                Not yet. {revealed ? `Answer: ${item.a.split("|")[0]}` : "Try again or reveal below."}
                              </span>
                            )}
                          </div>
                        )}
                        {revealed && (
                          <div className="mt-2">
                            <FA className="text-xs leading-relaxed">{item.fa}</FA>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {!revealed && (
                <Btn variant="soft" onClick={() => setRevealed(true)} className="mt-2">
                  Show Farsi hints
                </Btn>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ---------- 4. Study Plan ----------

function PlanTab({ state, go }: { state: AppState; go: (v: ViewId) => void }) {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    fetch("/api/tutor/plan")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.days) setPlan(d as PlanData);
      })
      .catch(() => undefined);
  }, []);

  const build = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/tutor/plan", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "plan failed");
      setPlan(d as PlanData);
      setDone({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <Card className="flex flex-col items-center gap-4 py-14">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#2a3242] border-t-[#4e8cff]" />
        <div className="text-sm font-bold text-[#dbe3f0]">Building your week</div>
      </Card>
    );
  }

  if (!plan) {
    return (
      <Card>
        <SectionHead kicker="Skill 4" title="7-Day Plan" />
        <p className="mt-2 text-sm leading-relaxed text-[#a9b4c6]">
          One week of concrete tasks built from your latest diagnosis and queue: what to review, which pattern to drill, what to write and record. It
          spirals: day 1's weakness comes back on day 4 and day 6 from a different angle.
        </p>
        {error && (
          <div className="mt-4">
            <Note tone="rose">{error}</Note>
          </div>
        )}
        <Btn onClick={build} className="mt-5">
          <CalendarDays className="h-4 w-4" /> Build my week
        </Btn>
      </Card>
    );
  }

  const totalTasks = plan.days.reduce((a, d) => a + d.tasks.length, 0);
  const doneCount = Object.values(done).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <SectionHead kicker="This week" title={plan.goal} />
          <Btn variant="soft" onClick={build} className="shrink-0 !min-h-10 !px-3 !py-2 text-xs">
            <RotateCcw className="h-3.5 w-3.5" /> Rebuild
          </Btn>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Bar value={doneCount} max={totalTasks} tone="emerald" />
          <span className="shrink-0 text-xs font-black text-[#7fe0ac]">
            {doneCount}/{totalTasks}
          </span>
        </div>
      </Card>

      {plan.days.map((d) => (
        <Card key={d.day}>
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-black tracking-tight text-[#f2f5fa]">Day {d.day}</div>
            <Chip tone={d.day === 7 ? "emerald" : "blue"}>{d.focus}</Chip>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {d.tasks.map((t, ti) => {
              const key = `${d.day}-${ti}`;
              const isDone = !!done[key];
              return (
                <button
                  key={key}
                  onClick={() => setDone((v) => ({ ...v, [key]: !v[key] }))}
                  className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3 text-left transition-all hover:border-white/[0.14]"
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${
                      isDone ? "border-[#3ccb7f] bg-[#3ccb7f] text-[#062012]" : "border-white/[0.15] text-transparent"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span className={`flex-1 text-sm leading-relaxed ${isDone ? "text-[#5d6779] line-through" : "text-[#dbe3f0]"}`}>{t.text}</span>
                  <span className="shrink-0 text-xs font-bold text-[#7d889c]">{t.minutes}m</span>
                </button>
              );
            })}
          </div>
        </Card>
      ))}

      <Note tone="blue">
        Tasks point at real features. Miss a day and the spaced-repetition queue absorbs it: <FA>برنامه هفتگی، بدون اضطراب.</FA>
      </Note>
      <Btn variant="soft" onClick={() => go("review")}>
        <Play className="h-4 w-4" /> Start today with review
      </Btn>
    </div>
  );
}
