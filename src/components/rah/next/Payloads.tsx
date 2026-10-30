"use client";

// Interactive renderers for agent payloads. The engine attaches structured
// artifacts to a coach turn; these components make them usable inline:
// exams are answerable, assessments are readable bands, drills are revealable.

import { useState } from "react";
import { Check, ChevronDown, FileText, Headphones, Lightbulb, Mic, PenLine, Sparkles, X, Zap } from "lucide-react";
import { Bar, Btn, FA, Ring } from "../ui";

// ---------- exam ----------

interface ExamQuestionT {
  id: string;
  type: "mcq" | "cloze" | "fix" | "rewrite";
  prompt: string;
  choices?: string[];
  hint?: string;
}
export interface ExamT {
  id: number;
  title: string;
  area: string;
  count: number;
  level?: string;
  questions: ExamQuestionT[];
}
export interface ExamResultQ {
  id: string;
  type: string;
  prompt: string;
  given: string;
  expected: string;
  verdict: "right" | "accepted" | "wrong";
  why: string;
  fa: string;
}
export interface ExamResultT {
  examId?: number;
  title: string;
  area: string;
  score: number;
  accepted: number;
  total: number;
  pct: number;
  perQuestion: ExamResultQ[];
}

export function ExamCard({
  exam,
  result,
  onSubmit,
  submitting,
}: {
  exam: ExamT;
  result?: ExamResultT | null;
  onSubmit?: (examId: number, answers: Record<string, string>) => void;
  submitting?: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const answeredCount = Object.values(answers).filter((v) => v.trim()).length;

  if (result) {
    return (
      <div className="flex flex-col gap-4 rounded-3xl border border-white/[0.07] bg-[rgb(var(--c-bg-7))] p-5">
        <div className="flex items-center gap-4">
          <Ring value={result.score} max={result.total} label={`${result.score}/${result.total}`} sub={`${result.pct}%`} />
          <div className="min-w-0">
            <div className="text-sm font-extrabold tracking-tight text-[rgb(var(--c-text))]">{result.title}</div>
            <div className="mt-1 text-xs font-medium text-[rgb(var(--c-dim))]">
              {result.total} questions, {result.area}
              {result.accepted > 0 && ` · ${result.accepted} accepted as valid alternatives`}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          {result.perQuestion.map((q, i) => {
            const ok = q.verdict === "right";
            const syn = q.verdict === "accepted";
            return (
              <div
                key={q.id}
                className={`rounded-2xl border p-3.5 text-sm ${
                  ok
                    ? "border-[rgb(var(--c-green)/0.3)] bg-[rgb(var(--c-green)/0.07)]"
                    : syn
                      ? "border-[rgb(var(--c-cyan)/0.3)] bg-[rgb(var(--c-cyan)/0.07)]"
                      : "border-[rgb(var(--c-red)/0.3)] bg-[rgb(var(--c-red)/0.06)]"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {ok ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--c-green))]" />
                  ) : syn ? (
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--c-cyan))]" />
                  ) : (
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--c-red))]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[rgb(var(--c-dim))]">
                      {i + 1}. {q.type}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[rgb(var(--c-text-5))]">{q.prompt}</div>
                    {!ok && !syn && (
                      <div className="mt-1.5 text-xs">
                        <span className="text-[rgb(var(--c-rose))] line-through">{q.given || "(blank)"}</span>
                        <span className="mx-1.5 text-[rgb(var(--c-dim-4))]">→</span>
                        <span className="font-bold text-[rgb(var(--c-mint))]">{q.expected}</span>
                      </div>
                    )}
                    {syn && (
                      <div className="mt-1 text-xs font-semibold text-[rgb(var(--c-cyan-soft))]">“{q.given}” accepted</div>
                    )}
                    {q.why && <div className="mt-1 text-xs leading-relaxed text-[rgb(var(--c-text-6))]">{q.why}</div>}
                    {q.fa && (
                      <FA className="mt-1 block text-[11px] leading-loose text-[rgb(var(--c-dim))]">{q.fa}</FA>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-[rgb(var(--c-primary)/0.25)] bg-[rgb(var(--c-bg-7))] p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-extrabold tracking-tight text-[rgb(var(--c-text))]">{exam.title}</div>
          <div className="mt-0.5 text-xs font-medium text-[rgb(var(--c-dim))]">
            {exam.count} questions · {exam.area}
            {exam.level ? ` · ${exam.level}` : ""}
          </div>
        </div>
        <div className="rounded-2xl bg-[rgb(var(--c-primary)/0.12)] px-3 py-1.5 text-xs font-bold text-[rgb(var(--c-primary-soft))]">
          {answeredCount}/{exam.count}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {exam.questions.map((q, i) => (
          <div key={q.id} className="rounded-2xl border border-white/[0.06] bg-[rgb(var(--c-bg-6))] p-4">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--c-primary)/0.15)] text-[10px] font-black text-[rgb(var(--c-primary-soft))]">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed text-[rgb(var(--c-text-2))]">{q.prompt}</p>
                {q.type === "mcq" && q.choices ? (
                  <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                    {q.choices.map((c) => {
                      const active = answers[q.id] === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setAnswers((a) => ({ ...a, [q.id]: c }))}
                          className={`rounded-xl border px-3 py-2 text-left text-sm transition-all ${
                            active
                              ? "border-[rgb(var(--c-primary))] bg-[rgb(var(--c-primary)/0.14)] font-bold text-[rgb(var(--c-primary-frost))]"
                              : "border-white/[0.07] text-[rgb(var(--c-text-5))] hover:border-[rgb(var(--c-primary)/0.4)]"
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    placeholder={q.type === "rewrite" ? "Write the full sentence..." : "Your answer..."}
                    className="mt-2.5 w-full rounded-xl border border-white/[0.08] bg-[rgb(var(--c-bg-5))] px-3 py-2.5 text-sm text-[rgb(var(--c-text))] outline-none transition-colors placeholder:text-[rgb(var(--c-faint))] focus:border-[rgb(var(--c-primary))]"
                  />
                )}
                {q.hint && (
                  <div className="mt-1.5 flex items-start gap-1 text-[11px] text-[rgb(var(--c-gold-soft))]">
                    <Lightbulb className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{q.hint}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <Btn
        variant="go"
        disabled={submitting || answeredCount === 0}
        onClick={() => onSubmit?.(exam.id, answers)}
        className="self-end"
      >
        {submitting ? "Grading..." : `Submit ${answeredCount}/${exam.count}`}
      </Btn>
    </div>
  );
}

// ---------- assessment ----------

interface AssessmentSkill {
  skill: string;
  band: string;
  score: number;
  evidence: string[];
  focus: string;
}
interface AssessmentT {
  overall: { band: string; score: number; verdict: string; gap: string };
  skills: AssessmentSkill[];
}
const BANDS = ["A2", "B1", "B1+", "B2", "B2+", "C1", "C1+"];
export function AssessmentCard({ a }: { a: AssessmentT }) {
  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-[rgb(var(--c-cyan)/0.25)] bg-[rgb(var(--c-bg-7))] p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[rgb(var(--c-cyan-soft))]">Deep assessment</div>
          <div className="mt-1 text-3xl font-black leading-none tracking-tight text-[rgb(var(--c-text))]">
            Overall {a.overall.band}
          </div>
          <div className="mt-1.5 max-w-md text-xs leading-relaxed text-[rgb(var(--c-text-6))]">{a.overall.verdict}</div>
          {a.overall.gap && (
            <div className="mt-1 text-xs font-semibold text-[rgb(var(--c-gold-soft))]">First fix: {a.overall.gap}</div>
          )}
        </div>
        <Ring value={a.overall.score} max={100} label={a.overall.band} sub="overall" />
      </div>
      <div className="flex flex-col gap-3">
        {a.skills.map((s) => (
          <div key={s.skill} className="rounded-2xl border border-white/[0.06] bg-[rgb(var(--c-bg-6))] p-3.5">
            <div className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-sm font-bold capitalize text-[rgb(var(--c-text-3))]">{s.skill}</span>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-black ${
                  s.band === a.skills[0].band
                    ? "border-[rgb(var(--c-green)/0.3)] bg-[rgb(var(--c-green)/0.1)] text-[rgb(var(--c-mint))]"
                    : "border-[rgb(var(--c-primary)/0.25)] bg-[rgb(var(--c-primary)/0.1)] text-[rgb(var(--c-primary-soft))]"
                }`}
              >
                {s.band}
              </span>
              <div className="flex-1">
                <Bar value={s.score} max={100} tone={s.score >= 70 ? "emerald" : s.score >= 55 ? "blue" : "amber"} />
              </div>
            </div>
            {s.focus && <div className="mt-2 text-xs leading-relaxed text-[rgb(var(--c-text-6))]">Next: {s.focus}</div>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {BANDS.map((b) => (
          <span key={b} className="text-[10px] font-bold text-[rgb(var(--c-faint))]">
            {b}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- drill / reading / listening ----------

export function DrillCard({ d }: { d: { title: string; items: { q: string; a: string; why?: string; fa?: string }[] } }) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-white/[0.07] bg-[rgb(var(--c-bg-7))] p-5">
      <div className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-[rgb(var(--c-text))]">
        <Zap className="h-4 w-4 text-[rgb(var(--c-gold))]" /> {d.title}
      </div>
      {d.items?.map((it, i) => (
        <div key={i} className="rounded-2xl border border-white/[0.06] bg-[rgb(var(--c-bg-6))] p-3.5">
          <p className="text-sm leading-relaxed text-[rgb(var(--c-text-2))]">{it.q}</p>
          <button
            type="button"
            onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
            className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[rgb(var(--c-primary-soft))] hover:underline"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open[i] ? "rotate-180" : ""}`} />
            {open[i] ? "Hide" : "Show answer"}
          </button>
          {open[i] && (
            <div className="mt-2 border-t border-white/[0.06] pt-2">
              <div className="text-sm font-bold text-[rgb(var(--c-mint))]">{it.a}</div>
              {it.why && <div className="mt-1 text-xs text-[rgb(var(--c-text-6))]">{it.why}</div>}
              {it.fa && <FA className="mt-1 block text-[11px] leading-loose text-[rgb(var(--c-dim))]">{it.fa}</FA>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function PieceCard({
  kind,
  title,
  text,
  questions,
}: {
  kind: "reading" | "listening";
  title: string;
  text: string;
  questions: { q: string; a?: string; choices?: string[]; why?: string }[];
}) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const Icon = kind === "reading" ? FileText : Headphones;
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-white/[0.07] bg-[rgb(var(--c-bg-7))] p-5">
      <div className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-[rgb(var(--c-text))]">
        <Icon className="h-4 w-4 text-[rgb(var(--c-cyan))]" /> {title}
      </div>
      <div className="whitespace-pre-line text-sm leading-[1.9] text-[rgb(var(--c-text-3))]">{text}</div>
      {questions?.map((q, i) => (
        <div key={i} className="rounded-2xl border border-white/[0.06] bg-[rgb(var(--c-bg-6))] p-3.5">
          <p className="text-sm font-semibold text-[rgb(var(--c-text-2))]">{q.q}</p>
          {q.choices && <p className="mt-1.5 text-xs text-[rgb(var(--c-text-6))]">{q.choices.join("  ·  ")}</p>}
          <button
            type="button"
            onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
            className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[rgb(var(--c-primary-soft))] hover:underline"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open[i] ? "rotate-180" : ""}`} />
            {open[i] ? "Hide answer" : "Show answer"}
          </button>
          {open[i] && (
            <div className="mt-2 border-t border-white/[0.06] pt-2">
              <div className="text-sm font-bold text-[rgb(var(--c-mint))]">{q.a}</div>
              {q.why && <div className="mt-1 text-xs text-[rgb(var(--c-text-6))]">{q.why}</div>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------- misc payload cards ----------

export function RuleCard({ r }: { r: { rule: string; core: string; contrast_fa: string; examples: { en: string; fa: string }[] } }) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-white/[0.07] bg-[rgb(var(--c-bg-7))] p-5">
      <div className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-[rgb(var(--c-text))]">
        <Lightbulb className="h-4 w-4 text-[rgb(var(--c-gold))]" /> {r.rule}
      </div>
      <p className="text-sm leading-relaxed text-[rgb(var(--c-text-3))]">{r.core}</p>
      <FA className="block rounded-2xl bg-[rgb(var(--c-bg-5))] p-3 text-xs leading-loose text-[rgb(var(--c-text-5))]">{r.contrast_fa}</FA>
      {r.examples?.map((ex, i) => (
        <div key={i} className="border-l-2 border-[rgb(var(--c-primary)/0.4)] pl-3">
          <div className="text-sm font-semibold text-[rgb(var(--c-text-2))]">{ex.en}</div>
          <FA className="mt-0.5 block text-xs text-[rgb(var(--c-dim))]">{ex.fa}</FA>
        </div>
      ))}
    </div>
  );
}

export function CompareCard({ c }: { c: { a: string; b: string; verdict: string; rows: { form: string; use: string; example: string }[]; fa: string } }) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-white/[0.07] bg-[rgb(var(--c-bg-7))] p-5">
      <div className="text-sm font-extrabold tracking-tight text-[rgb(var(--c-text))]">
        {c.a} <span className="text-[rgb(var(--c-dim-3))]">vs</span> {c.b}
      </div>
      <p className="text-sm leading-relaxed text-[rgb(var(--c-text-3))]">{c.verdict}</p>
      {c.rows?.map((r, i) => (
        <div key={i} className="rounded-2xl border border-white/[0.06] bg-[rgb(var(--c-bg-6))] p-3">
          <div className="text-sm font-black text-[rgb(var(--c-primary-soft))]">{r.form}</div>
          <div className="mt-0.5 text-xs text-[rgb(var(--c-text-6))]">{r.use}</div>
          <div className="mt-1 text-sm italic text-[rgb(var(--c-text-3))]">“{r.example}”</div>
        </div>
      ))}
      <FA className="block text-xs leading-loose text-[rgb(var(--c-dim))]">{c.fa}</FA>
    </div>
  );
}

export function WordCard({ w }: { w: { word: string; core: string; collocations: string[]; register: string; c1_upgrade: string; examples: string[]; fa: string } }) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-white/[0.07] bg-[rgb(var(--c-bg-7))] p-5">
      <div className="text-lg font-black tracking-tight text-[rgb(var(--c-primary-soft))]">{w.word}</div>
      <p className="text-sm leading-relaxed text-[rgb(var(--c-text-3))]">{w.core}</p>
      <div className="flex flex-wrap gap-1.5">
        {w.collocations?.map((c, i) => (
          <span key={i} className="rounded-full border border-[rgb(var(--c-primary)/0.25)] bg-[rgb(var(--c-primary)/0.1)] px-2.5 py-1 text-xs font-semibold text-[rgb(var(--c-primary-frost))]">
            {c}
          </span>
        ))}
      </div>
      {w.register && <div className="text-xs text-[rgb(var(--c-text-6))]">Register: {w.register}</div>}
      {w.c1_upgrade && <div className="rounded-2xl bg-[rgb(var(--c-gold)/0.07)] p-3 text-xs leading-relaxed text-[rgb(var(--c-gold-tint))]">C1 move: {w.c1_upgrade}</div>}
      {w.examples?.map((e, i) => (
        <div key={i} className="text-sm italic leading-relaxed text-[rgb(var(--c-text-4))]">“{e}”</div>
      ))}
      <FA className="block text-xs leading-loose text-[rgb(var(--c-dim))]">{w.fa}</FA>
    </div>
  );
}

export function VocabPackCard({ p }: { p: { topic: string; pack: { front: string; back: string; fa: string; example: string; trap: string }[] } }) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-white/[0.07] bg-[rgb(var(--c-bg-7))] p-5">
      <div className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-[rgb(var(--c-text))]">
        <Sparkles className="h-4 w-4 text-[rgb(var(--c-primary-soft))]" /> Vocabulary pack: {p.topic}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {p.pack?.map((c, i) => (
          <div key={i} className="rounded-2xl border border-white/[0.06] bg-[rgb(var(--c-bg-6))] p-3.5">
            <div className="text-sm font-black text-[rgb(var(--c-text))]">{c.front}</div>
            <div className="mt-0.5 text-xs text-[rgb(var(--c-text-6))]">{c.back}</div>
            <FA className="mt-1 block text-xs text-[rgb(var(--c-dim))]">{c.fa}</FA>
            <div className="mt-1.5 text-xs italic text-[rgb(var(--c-text-5))]">“{c.example}”</div>
            {c.trap && <div className="mt-1 text-[11px] font-semibold text-[rgb(var(--c-gold-soft))]">Trap: {c.trap}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function WritingTaskCard({ t }: { t: { task: string; rubric: string[]; fa: string; words?: number } }) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-white/[0.07] bg-[rgb(var(--c-bg-7))] p-5">
      <div className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-[rgb(var(--c-text))]">
        <PenLine className="h-4 w-4 text-[rgb(var(--c-primary-soft))]" /> Writing task
      </div>
      <p className="text-sm leading-relaxed text-[rgb(var(--c-text-2))]">{t.task}</p>
      {t.rubric && (
        <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-[rgb(var(--c-text-6))]">
          {t.rubric.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
      <FA className="block text-xs leading-loose text-[rgb(var(--c-dim))]">{t.fa}</FA>
    </div>
  );
}

export function SpeakingTaskCard({ t }: { t: { prompt: string; constraint: string; fa: string } }) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-white/[0.07] bg-[rgb(var(--c-bg-7))] p-5">
      <div className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-[rgb(var(--c-text))]">
        <Mic className="h-4 w-4 text-[rgb(var(--c-rose))]" /> Speaking task
      </div>
      <p className="text-sm leading-relaxed text-[rgb(var(--c-text-2))]">{t.prompt}</p>
      <div className="rounded-2xl bg-[rgb(var(--c-red)/0.07)] p-3 text-xs font-semibold leading-relaxed text-[rgb(var(--c-red-tint))]">
        Constraint: {t.constraint}
      </div>
      <FA className="block text-xs leading-loose text-[rgb(var(--c-dim))]">{t.fa}</FA>
    </div>
  );
}

export function WritingFeedbackCard({ w }: { w: { level: string; scores: Record<string, number>; verdict: string; errors: { bad: string; good: string; fa: string }[]; upgrades: { plain: string; c1: string; fa: string }[]; next_focus: string } }) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-white/[0.07] bg-[rgb(var(--c-bg-7))] p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-[rgb(var(--c-text))]">
          <PenLine className="h-4 w-4 text-[rgb(var(--c-primary-soft))]" /> Graded
        </div>
        <span className="rounded-full border border-[rgb(var(--c-primary)/0.25)] bg-[rgb(var(--c-primary)/0.1)] px-3 py-1 text-xs font-black text-[rgb(var(--c-primary-soft))]">
          {w.level}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(w.scores ?? {}).map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-white/[0.06] bg-[rgb(var(--c-bg-6))] p-2.5 text-center">
            <div className="text-lg font-black text-[rgb(var(--c-text))]">{v}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[rgb(var(--c-dim-3))]">{k}</div>
          </div>
        ))}
      </div>
      <p className="text-sm leading-relaxed text-[rgb(var(--c-text-3))]">{w.verdict}</p>
      {w.errors?.map((e, i) => (
        <div key={i} className="rounded-2xl border border-[rgb(var(--c-red)/0.25)] bg-[rgb(var(--c-red)/0.05)] p-3 text-sm">
          <span className="text-[rgb(var(--c-rose))] line-through">{e.bad}</span>
          <span className="mx-1.5 text-[rgb(var(--c-dim-4))]">→</span>
          <span className="font-bold text-[rgb(var(--c-mint))]">{e.good}</span>
          <FA className="mt-1 block text-[11px] leading-loose text-[rgb(var(--c-dim))]">{e.fa}</FA>
        </div>
      ))}
      {w.upgrades?.map((u, i) => (
        <div key={i} className="rounded-2xl bg-[rgb(var(--c-gold)/0.06)] p-3 text-sm">
          <span className="text-[rgb(var(--c-text-6))]">{u.plain}</span>
          <span className="mx-1.5 text-[rgb(var(--c-dim-4))]">→</span>
          <span className="font-bold text-[rgb(var(--c-gold-soft))]">{u.c1}</span>
          <FA className="mt-1 block text-[11px] leading-loose text-[rgb(var(--c-dim))]">{u.fa}</FA>
        </div>
      ))}
      {w.next_focus && <div className="text-xs font-semibold text-[rgb(var(--c-primary-frost))]">Next: {w.next_focus}</div>}
    </div>
  );
}

// ---------- dispatcher ----------

export function PayloadView({
  kind,
  data,
  examResults,
  onSubmitExam,
  submitting,
}: {
  kind: string;
  data: any;
  examResults?: Record<number, ExamResultT>;
  onSubmitExam?: (examId: number, answers: Record<string, string>) => void;
  submitting?: boolean;
}) {
  switch (kind) {
    case "exam": {
      const result = examResults?.[data.id];
      return <ExamCard exam={data} result={result} onSubmit={onSubmitExam} submitting={submitting} />;
    }
    case "examResult":
      return <ExamCard exam={{ id: data.examId ?? 0, title: data.title, area: data.area, count: data.total, questions: [] }} result={data} />;
    case "assessment":
      return <AssessmentCard a={data} />;
    case "drill":
      return <DrillCard d={data} />;
    case "reading":
      return <PieceCard kind="reading" title={data.title} text={data.text} questions={data.questions} />;
    case "listening":
      return <PieceCard kind="listening" title={data.title} text={data.text} questions={data.questions} />;
    case "rule":
      return <RuleCard r={data} />;
    case "compare":
      return <CompareCard c={data} />;
    case "word":
      return <WordCard w={data} />;
    case "vocabPack":
      return <VocabPackCard p={data} />;
    case "writingTask":
      return <WritingTaskCard t={data} />;
    case "speakingTask":
      return <SpeakingTaskCard t={data} />;
    case "writingFeedback":
      return <WritingFeedbackCard w={data} />;
    default:
      return null;
  }
}
