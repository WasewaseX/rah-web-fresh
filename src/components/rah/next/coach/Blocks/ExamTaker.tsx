"use client";

import { useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, GraduationCap, Send } from "lucide-react";
import { Bar, Btn, Chip, FA } from "../../../ui";
import type { Exam, ExamAnswers } from "@/lib/tutor/types";

type ExamQuestion = Exam["questions"][number];

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
    <ExamView
      exam={exam} idx={idx} q={q} answers={answers} answeredCount={answeredCount}
      isLast={isLast} busy={busy} confirming={confirming}
      setAnswer={setAnswer} setIdx={setIdx} setConfirming={setConfirming} onSubmit={onSubmit}
    />
  );
}

// The live question screen: header + progress + passage + input + nav.
function ExamView(props: {
  exam: Exam;
  idx: number;
  q: ExamQuestion;
  answers: ExamAnswers;
  answeredCount: number;
  isLast: boolean;
  busy: boolean;
  confirming: boolean;
  setAnswer: (v: string) => void;
  setIdx: (fn: (i: number) => number) => void;
  setConfirming: (v: boolean) => void;
  onSubmit: (runId: number, answers: ExamAnswers) => void;
}) {
  const { exam, idx, q, answers, answeredCount, isLast, busy, confirming, setAnswer, setIdx, setConfirming, onSubmit } = props;
  return (
    <div className="rah-pop rounded-3xl border border-white/[0.08] bg-[var(--rah-surface)] p-5">
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

      <QuestionInput q={q} answers={answers} setAnswer={setAnswer} isLast={isLast} setIdx={setIdx} />

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

// The answer surface for one question: mcq buttons, textarea for write,
// plain input for everything else (Enter advances unless on the last one).
function QuestionInput(props: {
  q: ExamQuestion;
  answers: ExamAnswers;
  setAnswer: (v: string) => void;
  isLast: boolean;
  setIdx: (fn: (i: number) => number) => void;
}) {
  const { q, answers, setAnswer, isLast, setIdx } = props;
  if (q.type === "mcq" && q.choices) {
    return (
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
    );
  }
  if (q.type === "write") {
    return (
      <textarea
        dir="ltr"
        value={answers[q.id] ?? ""}
        onChange={(e) => setAnswer(e.target.value)}
        rows={6}
        aria-label="Written answer"
        placeholder="Write your answer (about 150 words)..."
        className="mt-4 w-full rounded-2xl border-2 border-[#2a3242] bg-[#141924] px-4 py-3 text-sm text-[#f2f5fa] outline-none transition-colors placeholder:text-[#8b96a9] focus:border-(--accent)"
      />
    );
  }
  return (
    <input
      dir="ltr"
      value={answers[q.id] ?? ""}
      aria-label="Your answer"
      onChange={(e) => setAnswer(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !isLast) setIdx((i) => i + 1);
      }}
      placeholder={q.type === "cloze" ? "Type the missing word..." : "Type your answer..."}
      className="mt-4 min-h-12 w-full rounded-2xl border-2 border-[#2a3242] bg-[#141924] px-4 text-sm text-[#f2f5fa] outline-none transition-colors placeholder:text-[#8b96a9] focus:border-(--accent)"
    />
  );
}
