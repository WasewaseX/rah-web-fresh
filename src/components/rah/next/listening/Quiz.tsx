"use client";

import type { ReactNode } from "react";
import { Note } from "../bits";
import type { ListenPassage } from "@/content/listening";

// Library v2 comprehension check: questions answered from the audio, with
// the deterministic result screen after the last one.
export function QuizPhase(props: {
  header: ReactNode;
  passage: ListenPassage;
  qIdx: number;
  quizScore: number | null;
  picked: number | null;
  setPicked: (v: number | null) => void;
  setQuizScore: (fn: (s: number | null) => number | null) => void;
  setQIdx: (fn: (i: number) => number) => void;
  log: (round: number, missType?: string, d?: string) => void;
  setPhase: (v: "end") => void;
}) {
  const { header, passage, qIdx, quizScore, picked, setPicked, setQuizScore, setQIdx, log, setPhase } = props;
  const q = passage.questions[qIdx];
  const done = qIdx >= passage.questions.length;
  return (
    <div className="max-w-2xl mx-auto">
      {header}
      <div className="card-rah p-8">
        {!done && q ? (
          <>
            <div className="display text-[22px] font-bold mb-1">Comprehension check {qIdx + 1}/{passage.questions.length}</div>
            <p className="text-[13.5px] mb-5" style={{ color: "var(--muted)" }}>
              Answered from the audio, not the transcript. Wrong answers name the exact line that settles it.
            </p>
            <p className="text-[16.5px] font-semibold leading-relaxed mb-5">{q.q}</p>
            <div className="grid gap-2">
              {q.choices.map((c, i) => (
                <QuizChoice key={i} text={c} i={i} picked={picked} correct={q.correct} setPicked={setPicked} />
              ))}
            </div>
            {picked !== null ? (
              <div className="mt-4">
                <Note tone={picked === q.correct ? "accent" : "warn"}>
                  {picked === q.correct ? "Right. " : "The audio says: "}{q.why}
                </Note>
              </div>
            ) : null}
            <div className="mt-5 text-right">
              <button
                className="btn-primary"
                disabled={picked === null}
                onClick={() => {
                  if (picked === q.correct) setQuizScore((s) => (s ?? 0) + 1);
                  setQIdx((i) => i + 1);
                  setPicked(null);
                }}
              >
                {qIdx + 1 < passage.questions.length ? "Next question" : "See the result"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="display text-[22px] font-bold mb-1">Comprehension: {quizScore ?? 0}/{passage.questions.length}</div>
            <p className="text-[13.5px] mb-6" style={{ color: "var(--muted)" }}>
              {quizScore === passage.questions.length
                ? "Full score - the passage is yours. Revisit it in a week and it should still hold."
                : "Below full score is normal at this level. The transcript round is where the misses get resolved - rerun this passage in a few days."}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                className="btn-primary"
                onClick={() => {
                  if (passage && quizScore !== null) log(6, "", `${quizScore}/${passage.questions.length}`);
                  setPhase("end");
                }}
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// The closing screen of the decoding cycle.
export function EndPhase(props: {
  quizScore: number | null;
  passage: ListenPassage | null;
  setQuizScore: (v: number | null) => void;
  setPhase: (v: "pick") => void;
}) {
  const { quizScore, passage, setQuizScore, setPhase } = props;
  return (
    <div className="max-w-xl mx-auto text-center pt-10">
      <div className="display text-[30px] font-bold mb-2">Decoding cycle complete</div>
      <p className="text-[14px] mb-4 leading-relaxed" style={{ color: "var(--muted)" }}>
        Blind, diagnose, transcript, clean listen, reproduce, comprehension. Missed words live in the transcript round; the
        real score is how much more resolved round 4 sounded than round 1.
      </p>
      {quizScore !== null ? (
        <div className="text-[14px] font-bold mb-6">Comprehension check: {quizScore}/{passage?.questions.length ?? 3}</div>
      ) : null}
      <div className="flex gap-3 justify-center">
        <button className="btn-primary" onClick={() => { setQuizScore(null); setPhase("pick"); }}>Another passage</button>
      </div>
    </div>
  );
}

// One answer row of the comprehension check (verbatim from the quiz body).
function QuizChoice(props: {
  text: string;
  i: number;
  picked: number | null;
  correct: number;
  setPicked: (v: number | null) => void;
}) {
  const { text, i, picked, correct, setPicked } = props;
  const isPicked = picked === i;
  const reveal = picked !== null;
  const isRight = i === correct;
  return (
    <button
      disabled={reveal}
      onClick={() => setPicked(i)}
      className="rounded-2xl border px-4 py-3 text-left text-[14px]"
      style={
        reveal && isRight
          ? { background: "var(--accent-dim)", borderColor: "var(--accent)" }
          : reveal && isPicked && !isRight
            ? { background: "var(--danger-dim, rgba(220,38,38,0.12))", borderColor: "var(--danger)" }
            : { borderColor: "var(--line)" }
      }
    >
      {text}
      {reveal && isRight ? " ✓" : ""}
    </button>
  );
}
