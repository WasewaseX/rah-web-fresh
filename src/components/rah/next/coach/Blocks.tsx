"use client";

// Coach blocks: rich interactive cards rendered inside the chat transcript.
// ExamTaker (formal exam flow), DrillCard (instant-feedback practice),
// ResultCard (assessment), report cards (analysis family). All built from the
// shared Rah primitives.

import { useMemo, useState } from "react";
import {
  BookOpen, Brain, CalendarDays, Check, CheckCircle2, GraduationCap, Headphones,
  LayoutGrid, ListChecks, Mic, PenLine, RotateCcw, Shuffle, SpellCheck, Stethoscope,
  Target, TrendingUp, X, ChevronLeft, ChevronRight, Send,
} from "lucide-react";
import { Bar, Btn, Chip, FA, Note, Ring } from "../../ui";
import { fuzzyMatch } from "@/lib/tutor/grading";
import type {
  DeepLevelReport, DiagnosisReport, Drill, DrillItem, DrillOutcome, Exam,
  ExamAnswers, ExamItemResult, ForecastReport, PlanReport,
} from "@/lib/tutor/types";

export const SKILL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  BookMarked: BookOpen, SpellCheck, Link2: LayoutGrid, BookOpen, GraduationCap, Brain,
  Stethoscope, TrendingUp, Target, Layers: ListChecks, Shuffle, Lightbulb: Brain,
  Repeat2: RotateCcw, Network: LayoutGrid, Type: SpellCheck, Puzzle: Target, Timer: Headphones,
  Scissors: PenLine, PenLine, Mic, Copy: PenLine, MessagesSquare: LayoutGrid,
  Languages: LayoutGrid, BookOpenCheck: BookOpen, CalendarDays, MessageCircle: LayoutGrid,
};

// local answer check (same fuzzy rules as the server grader: exact,
// acceptable variants, article tolerance, one-letter typo tolerance)
function isCorrect(item: DrillItem | (ExamItemResult & { choices?: string[] }), given: string): boolean {
  const tier = fuzzyMatch(given ?? "", (item as DrillItem).answer, (item as DrillItem).acceptable ?? []);
  return tier === "exact" || tier === "typo" || tier === "accepted";
}

// ============================ EXAM TAKER ============================

export function ExamTaker({
  exam, done, busy, onSubmit,
}: {
  exam: Exam;
  done: boolean;
  busy: boolean;
  onSubmit: (runId: number, answers: ExamAnswers) => void;
}) {
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<ExamAnswers>({});
  const [confirming, setConfirming] = useState(false);

  const q = exam.questions[idx];
  const isLast = idx === exam.questions.length - 1;
  const answeredCount = exam.questions.filter((x) => (answers[x.id] ?? "").trim()).length;

  const setAnswer = (v: string) => setAnswers((a) => ({ ...a, [q.id]: v }));

  if (done) {
    return (
      <div className="rah-pop rounded-3xl border border-[#3ccb7f]/25 bg-[#3ccb7f]/[0.06] p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-[#7fe0ac]">
          <CheckCircle2 className="h-4 w-4" /> Submitted and graded. The full assessment is below.
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="rah-pop rounded-3xl border border-(--accent)/25 bg-(--accent)/[0.06] p-5">
        <div className="flex items-center gap-2 text-sm font-black tracking-tight text-[#cfe0ff]">
          <GraduationCap className="h-5 w-5 text-(--accent-soft)" /> {exam.title}
        </div>
        <FA className="mt-1 block text-sm">{exam.title_fa}</FA>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip tone="blue">{exam.level}</Chip>
          <Chip tone="slate">{exam.questions.length} questions</Chip>
          <Chip tone="cyan">{exam.timeLimitMin} min</Chip>
        </div>
        <div className="mt-4">
          <Btn variant="primary" onClick={() => setStarted(true)} disabled={busy}>
            Start exam
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="rah-pop rounded-3xl border border-white/[0.08] bg-[#1a1f2b] p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-[0.12em] text-(--accent-dim)">
          {q.section} · Q{idx + 1}/{exam.questions.length}
        </div>
        <Chip tone="slate">{answeredCount} answered</Chip>
      </div>
      <Bar value={idx + 1} max={exam.questions.length} tone="blue" />

      {q.passage && (idx === 0 || exam.questions[idx - 1]?.section !== q.section) && (
        <div dir="ltr" className="mt-4 rounded-2xl border border-white/[0.07] bg-[#141924] p-4 text-sm leading-relaxed text-[#dbe3f0]">
          {q.passage}
        </div>
      )}

      <div dir="ltr" className="mt-4 text-[15px] font-semibold leading-relaxed text-[#f2f5fa]">{q.q}</div>

      {q.type === "mcq" && q.choices && (
        <div className="mt-4 flex flex-col gap-2" dir="ltr">
          {q.choices.map((c) => (
            <button
              key={c}
              onClick={() => setAnswer(c)}
              className={`rounded-2xl border-2 px-4 py-3 text-left text-sm font-semibold transition-all ${
                answers[q.id] === c
                  ? "border-(--accent) bg-(--accent)/[0.12] text-[#cfe0ff]"
                  : "border-[#2a3242] bg-[#141924] text-[#b7c1d3] hover:border-(--accent)/50"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {q.type === "write" ? (
        <textarea
          dir="ltr"
          value={answers[q.id] ?? ""}
          onChange={(e) => setAnswer(e.target.value)}
          rows={6}
          placeholder="Write your answer (about 150 words)..."
          className="mt-4 w-full rounded-2xl border-2 border-[#2a3242] bg-[#141924] px-4 py-3 text-sm text-[#f2f5fa] outline-none transition-colors placeholder:text-[#5c6678] focus:border-(--accent)"
        />
      ) : (
        q.type !== "mcq" && (
          <input
            dir="ltr"
            value={answers[q.id] ?? ""}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isLast) setIdx((i) => i + 1);
            }}
            placeholder={q.type === "cloze" ? "Type the missing word..." : "Type your answer..."}
            className="mt-4 min-h-12 w-full rounded-2xl border-2 border-[#2a3242] bg-[#141924] px-4 text-sm text-[#f2f5fa] outline-none transition-colors placeholder:text-[#5c6678] focus:border-(--accent)"
          />
        )
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <Btn variant="ghost" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="px-3">
          <ChevronLeft className="h-4 w-4" /> Prev
        </Btn>
        <div className="flex items-center gap-2">
          {!isLast ? (
            <Btn variant="soft" onClick={() => setIdx((i) => i + 1)}>
              Next <ChevronRight className="h-4 w-4" />
            </Btn>
          ) : confirming ? (
            <>
              <Btn variant="ghost" onClick={() => setConfirming(false)} className="text-xs">Keep editing</Btn>
              <Btn variant="go" disabled={busy} onClick={() => onSubmit(exam.id, answers)}>
                <Send className="h-4 w-4" /> Grade it
              </Btn>
            </>
          ) : (
            <Btn variant="go" onClick={() => setConfirming(true)}>
              Submit exam
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================ DRILL CARD ============================

export function DrillCard({ drill, onDone }: { drill: Drill; onDone: (o: DrillOutcome) => void }) {
  const [idx, setIdx] = useState(0);
  const [given, setGiven] = useState("");
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [finished, setFinished] = useState(false);
  const [posted, setPosted] = useState(false);

  const item = drill.items[idx];
  const isLast = idx === drill.items.length - 1;
  const wasChecked = checked[idx] !== undefined;
  const ok = wasChecked ? checked[idx] : false;
  const checkedCount = Object.keys(checked).length;

  const check = () => {
    if (!given.trim() || wasChecked) return;
    setChecked((c) => ({ ...c, [idx]: isCorrect(item, given) }));
  };
  const next = () => {
    if (isLast) {
      const score = Object.values(checked).filter(Boolean).length;
      setFinished(true);
      if (!posted) {
        setPosted(true);
        onDone({ skill: drill.title, score, total: drill.items.length, misses: [] });
      }
      return;
    }
    setIdx((i) => i + 1);
    setGiven("");
  };
  const finalScore = Object.values(checked).filter(Boolean).length;

  if (finished) {
    const pct = Math.round((finalScore / drill.items.length) * 100);
    return (
      <div className="rah-pop rounded-3xl border border-white/[0.08] bg-[#1a1f2b] p-5">
        <div className="flex items-center gap-4">
          <Ring value={pct} max={100} size={72} label={`${pct}%`} sub="drill" />
          <div>
            <div className="text-sm font-black text-[#f2f5fa]">{drill.title}</div>
            <div className="mt-0.5 text-xs text-[#8b96a9]">{finalScore}/{drill.items.length} correct</div>
            <FA className="mt-1 block text-xs">
              {pct >= 80 ? "عالی؛ همین مسیر را ادامه بده." : pct >= 50 ? "نیمه راه آمدی؛ غلط‌ها را مرور کن." : "غلط‌های امروز، تمرین فردای تو هستند."}
            </FA>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rah-pop rounded-3xl border border-white/[0.08] bg-[#1a1f2b] p-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-[0.12em] text-(--accent-dim)">{drill.title} · {idx + 1}/{drill.items.length}</div>
        <Chip tone="slate">{checkedCount} checked</Chip>
      </div>
      <Bar value={idx + 1} max={drill.items.length} tone="cyan" />

      <div dir="ltr" className="mt-4 text-[15px] font-semibold leading-relaxed text-[#f2f5fa]">
        {item.q}
        {item.type !== "mcq" && <span className="ml-1 text-xs font-bold text-(--accent-dim)">({item.type})</span>}
      </div>

      {item.type === "mcq" && item.choices ? (
        <div className="mt-3 flex flex-col gap-2" dir="ltr">
          {item.choices.map((c) => (
            <button
              key={c}
              disabled={wasChecked}
              onClick={() => setGiven(c)}
              className={`rounded-2xl border-2 px-4 py-2.5 text-left text-sm font-semibold transition-all ${
                given === c ? "border-(--accent) bg-(--accent)/[0.12] text-[#cfe0ff]" : "border-[#2a3242] bg-[#141924] text-[#b7c1d3] hover:border-(--accent)/50"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      ) : (
        <input
          dir="ltr"
          value={given}
          disabled={wasChecked}
          onChange={(e) => setGiven(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (wasChecked) next();
              else check();
            }
          }}
          placeholder="Your answer..."
          className="mt-3 min-h-12 w-full rounded-2xl border-2 border-[#2a3242] bg-[#141924] px-4 text-sm text-[#f2f5fa] outline-none transition-colors placeholder:text-[#5c6678] focus:border-(--accent)"
        />
      )}

      {wasChecked && (
        <div className={`mt-3 rounded-2xl border p-3.5 text-sm ${ok ? "border-[#3ccb7f]/25 bg-[#3ccb7f]/[0.07]" : "border-[#ff6b81]/25 bg-[#ff6b81]/[0.07]"}`}>
          <div className="flex items-center gap-2 font-black" dir="ltr">
            {ok ? <Check className="h-4 w-4 text-[#7fe0ac]" /> : <X className="h-4 w-4 text-[#ffa3b1]" />}
            <span className={ok ? "text-[#7fe0ac]" : "text-[#ffa3b1]"}>{ok ? "Correct" : `Answer: ${item.answer}`}</span>
          </div>
          {item.why && <div dir="ltr" className="mt-1.5 text-xs leading-relaxed text-[#b7c1d3]">{item.why}</div>}
          {item.fa && <FA className="mt-1 block text-xs leading-loose">{item.fa}</FA>}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        {!wasChecked ? (
          <Btn variant="primary" disabled={!given.trim()} onClick={check}>Check</Btn>
        ) : (
          <Btn variant={isLast ? "go" : "soft"} onClick={next}>
            {isLast ? "Finish" : "Next"} <ChevronRight className="h-4 w-4" />
          </Btn>
        )}
      </div>
    </div>
  );
}

// ============================ RESULT CARD ============================

export function ResultCard({
  result, onDrillWeak, onNewExam, busy,
}: {
  result: NonNullable<import("@/lib/tutor/types").CoachEnvelope["result"]>;
  onDrillWeak: () => void;
  onNewExam: () => void;
  busy: boolean;
}) {
  const tone = result.percent >= 75 ? "emerald" : result.percent >= 50 ? "amber" : "rose";
  return (
    <div className="rah-pop rounded-3xl border border-white/[0.08] bg-[#1a1f2b] p-5">
      <div className="flex flex-wrap items-center gap-4">
        <Ring value={result.percent} max={100} size={84} label={`${result.percent}%`} sub="exam" />
        <div className="min-w-40 flex-1">
          <div className="text-sm font-black tracking-tight text-[#f2f5fa]">{result.title}</div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Chip tone="blue">Band {result.band}</Chip>
            <Chip tone={tone}>{result.score}/{result.total}</Chip>
          </div>
        </div>
      </div>

      {result.write_eval && result.write_eval.note && (
        <div className="mt-4">
          <Note tone="amber">
            <span className="font-bold">Writing {result.write_eval.score}/10. </span>
            {result.write_eval.note}
            <FA className="mt-1 block text-xs leading-loose">{result.write_eval.fa}</FA>
          </Note>
        </div>
      )}

      {result.dimensions && (
        <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {(["vocabulary", "grammar", "reading", "writing"] as const).map((k) => {
            const v = result.dimensions![k] ?? 0;
            return (
              <div key={k} className="flex items-center gap-3">
                <span dir="ltr" className="w-20 shrink-0 text-xs font-bold capitalize text-[#a9b4c6]">{k}</span>
                <Bar value={v} max={100} tone={v >= 72 ? "emerald" : v >= 50 ? "blue" : "amber"} />
                <span className="w-8 shrink-0 text-right text-xs font-black text-[#f2f5fa]">{v}</span>
              </div>
            );
          })}
        </div>
      )}

      {(result.strengths.length > 0 || result.weaknesses.length > 0) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {result.strengths.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7fe0ac]">Strengths</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {result.strengths.map((s, i) => <Chip key={i} tone="emerald">{s}</Chip>)}
              </div>
            </div>
          )}
          {result.weaknesses.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#ffd08a]">Weak spots</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {result.weaknesses.map((s, i) => <Chip key={i} tone="amber">{s}</Chip>)}
              </div>
            </div>
          )}
        </div>
      )}

      {result.leaks.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {result.leaks.map((l, i) => (
            <div key={i} className="rounded-2xl border border-[#ffb02e]/20 bg-[#ffb02e]/[0.05] p-3 text-sm">
              <span className="font-bold text-[#ffd08a]">{l.trap.replace(/_/g, " ")}</span>
              <span dir="ltr" className="ml-2 text-[#b7c1d3]">{l.note}</span>
              <FA className="mt-1 block text-xs leading-loose">{l.fa}</FA>
            </div>
          ))}
        </div>
      )}

      <details className="mt-4 rounded-2xl border border-white/[0.06] bg-[#141924] p-4">
        <summary className="cursor-pointer text-sm font-bold text-[#b7c1d3]">Question-by-question review</summary>
        <div className="mt-3 flex flex-col gap-3">
          {result.items.map((it) => {
            const accepted = it.verdict === "typo" || (it.verdict === "accepted" && it.type !== "write");
            return (
              <div key={it.qid} className="rounded-xl bg-white/[0.03] p-3 text-sm">
                <div className="flex items-start gap-2" dir="ltr">
                  {it.type === "write" ? (
                    <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-[#ffd08a]" />
                  ) : it.ok ? (
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${accepted ? "text-[#9de6fb]" : "text-[#7fe0ac]"}`} />
                  ) : (
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-[#ffa3b1]" />
                  )}
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-[#e7ecf5]">{it.q.slice(0, 160)}</div>
                    <div className="mt-1 text-xs text-[#8b96a9]">
                      You: <span className={it.ok ? (accepted ? "text-[#9de6fb]" : "text-[#7fe0ac]") : "text-[#ffa3b1]"}>{it.given || "(blank)"}</span>
                      {!it.ok && it.type !== "write" && <> · Expected: <span className="text-[#7fe0ac]">{it.expected}</span></>}
                      {accepted && it.expected && <span className="ml-1.5 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold text-[#9de6fb]">{it.verdict === "typo" ? "spelling" : "accepted"} · key: {it.expected}</span>}
                    </div>
                    {(it.note || it.why) && <div className="mt-1 text-xs leading-relaxed text-[#a9b4c6]">{it.note || it.why}</div>}
                    {!it.ok && it.fa && <FA className="mt-1 block text-xs leading-loose">{it.fa}</FA>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </details>

      {result.next_action && (
        <div className="mt-4">
          <Note tone="blue">
            <span className="font-bold">Next: </span>{result.next_action}
          </Note>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Btn variant="primary" disabled={busy} onClick={onDrillWeak} className="text-xs">
          <Target className="h-4 w-4" /> Drill my weak spots
        </Btn>
        <Btn variant="soft" disabled={busy} onClick={onNewExam} className="text-xs">
          <GraduationCap className="h-4 w-4" /> New full exam
        </Btn>
      </div>
    </div>
  );
}

// ============================ REPORT CARDS ============================

export function ReportCard({ report }: { report: NonNullable<import("@/lib/tutor/types").CoachEnvelope["report"]> }) {
  if ("skills" in report) return <DeepLevelCard report={report as DeepLevelReport} />;
  if ("patterns" in report) return <DiagnosisCard report={report as DiagnosisReport} />;
  if ("eta_weeks" in report) return <ForecastCard report={report as ForecastReport} />;
  return <PlanCard report={report as PlanReport} />;
}

function DeepLevelCard({ report }: { report: DeepLevelReport }) {
  return (
    <div className="rah-pop rounded-3xl border border-(--accent)/20 bg-gradient-to-b from-[#1a2233] to-[#1a1f2b] p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-(--accent-dim)">Deep level analysis</div>
        <Chip tone={report.confidence === "high" ? "emerald" : report.confidence === "medium" ? "amber" : "slate"}>confidence: {report.confidence}</Chip>
        {report.source === "mechanical" && <Chip tone="slate">offline mode</Chip>}
      </div>
      <div className="mt-2 flex items-end gap-3">
        <div className="text-4xl font-black leading-none text-[#f2f5fa]">{report.overall}</div>
        <div className="pb-1 text-xs text-[#8b96a9]">overall band (provisional until you take exams)</div>
      </div>

      <div className="mt-5 flex flex-col gap-2.5">
        {report.skills.map((s) => (
          <div key={s.name} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs font-bold text-[#a9b4c6]">{s.name}</span>
            <Bar value={s.score} max={100} tone={s.score >= 72 ? "emerald" : s.score >= 50 ? "blue" : "amber"} />
            <Chip tone="slate">{s.band}</Chip>
            <span dir="ltr" className="hidden w-44 shrink-0 truncate text-[11px] text-[#6e7a8e] sm:block">{s.note}</span>
          </div>
        ))}
      </div>

      {report.evidence?.length > 0 && (
        <div className="mt-5 rounded-2xl border border-white/[0.06] bg-[#141924] p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-(--accent-dim)">Evidence</div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {report.evidence.map((e, i) => (
              <li key={i} dir="ltr" className="text-xs leading-relaxed text-[#b7c1d3]">· {e}</li>
            ))}
          </ul>
        </div>
      )}

      {report.leaks?.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {report.leaks.map((l, i) => (
            <div key={i} className="rounded-2xl border border-[#ffb02e]/20 bg-[#ffb02e]/[0.05] p-3 text-sm">
              <span className="font-bold text-[#ffd08a]">{String(l.trap).replace(/_/g, " ")}</span>
              <FA className="mt-0.5 block text-xs leading-loose">{l.fa}</FA>
            </div>
          ))}
        </div>
      )}

      {report.plan?.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-(--accent-dim)">7-day plan</div>
          <div className="mt-2 flex flex-col gap-2">
            {report.plan.map((p, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-2xl bg-white/[0.03] p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--accent)/15 text-xs font-black text-(--accent-soft)">{i + 1}</span>
                <div>
                  <div dir="ltr" className="text-[13px] font-semibold text-[#e7ecf5]">{p.step}</div>
                  <FA className="mt-0.5 block text-xs leading-loose">{p.fa}</FA>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DiagnosisCard({ report }: { report: DiagnosisReport }) {
  return (
    <div className="rah-pop rounded-3xl border border-white/[0.08] bg-[#1a1f2b] p-5">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-(--accent-dim)">
        <Stethoscope className="h-4 w-4" /> Error pattern diagnosis
      </div>
      <div dir="ltr" className="mt-2 text-sm font-bold text-[#f2f5fa]">{report.headline}</div>
      <div className="mt-4 flex flex-col gap-2.5">
        {report.patterns.map((p, i) => (
          <div key={i} className="rounded-2xl border border-[#ffb02e]/20 bg-[#ffb02e]/[0.05] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span dir="ltr" className="text-sm font-black text-[#ffd08a]">{p.title || p.trap.replace(/_/g, " ")}</span>
              <Chip tone="amber">×{p.count}</Chip>
            </div>
            <FA className="mt-1 block text-xs leading-loose">{p.fa}</FA>
            {p.fix && <div dir="ltr" className="mt-1 text-xs leading-relaxed text-[#b7c1d3]">Fix: {p.fix}</div>}
          </div>
        ))}
      </div>
      <div dir="ltr" className="mt-3 text-xs leading-relaxed text-[#a9b4c6]">{report.verdict}</div>
    </div>
  );
}

function ForecastCard({ report }: { report: ForecastReport }) {
  return (
    <div className="rah-pop rounded-3xl border border-white/[0.08] bg-[#1a1f2b] p-5">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-(--accent-dim)">
        <TrendingUp className="h-4 w-4" /> Progress forecast
      </div>
      <div dir="ltr" className="mt-2 text-sm font-bold text-[#f2f5fa]">{report.headline}</div>
      {report.pace && <div dir="ltr" className="mt-1 text-xs text-[#8b96a9]">{report.pace}</div>}
      {report.moves?.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {report.moves.map((m, i) => (
            <div key={i} className="flex items-start gap-2.5 rounded-2xl bg-white/[0.03] p-3">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-(--accent-soft)" />
              <div dir="ltr">
                <div className="text-[13px] font-semibold text-[#e7ecf5]">{m.move}</div>
                <div className="text-xs text-[#8b96a9]">{m.effect}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PLAN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  review: RotateCcw, drill: Target, exam: GraduationCap, write: PenLine, speak: Mic, listen: Headphones, read: BookOpen,
};

function PlanCard({ report }: { report: PlanReport }) {
  return (
    <div className="rah-pop rounded-3xl border border-white/[0.08] bg-[#1a1f2b] p-5">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-(--accent-dim)">
        <CalendarDays className="h-4 w-4" /> Today's plan
      </div>
      <div dir="ltr" className="mt-2 text-sm font-bold text-[#f2f5fa]">{report.headline}</div>
      <div className="mt-4 flex flex-col gap-2">
        {report.blocks.map((b, i) => {
          const Icon = PLAN_ICONS[b.icon] ?? Target;
          return (
            <div key={i} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--accent)/12 text-(--accent-soft)">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <div dir="ltr" className="text-[13px] font-bold text-[#e7ecf5]">{b.title}</div>
                <FA className="block text-xs leading-loose">{b.why}</FA>
              </div>
              <Chip tone="cyan">{b.minutes}m</Chip>
            </div>
          );
        })}
      </div>
    </div>
  );
}


