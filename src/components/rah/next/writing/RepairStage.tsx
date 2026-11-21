"use client";

import type { ReactNode } from "react";
import { Note } from "../bits";
import type { Feedback } from "./shared";

// The repair screen: the examiner's feedback panel, then the repair form
// (the one error + two reuse sentences), where the actual learning happens.

export function RepairStage(props: {
  header: ReactNode;
  feedback: Feedback | null;
  prompt: { prompt: string };
  repaired: string;
  setRepaired: (v: string) => void;
  reuse: string[];
  setReuse: (fn: (xs: string[]) => string[]) => void;
  lastId: number | null;
  setStage: (v: "write" | "model") => void;
}) {
  const { header, feedback, prompt, repaired, setRepaired, reuse, setReuse, lastId, setStage } = props;
  return (
    <div className="max-w-3xl mx-auto">
      {header}
      {feedback ? <FeedbackPanel feedback={feedback} /> : (
        <div className="mb-4">
          <Note tone="warn">
            No AI examiner connected, so grade yourself: pick your single worst error from the draft and answer the two
            questions below honestly. The repair is the exercise, not the grading.
          </Note>
        </div>
      )}

      <RepairForm prompt={prompt} repaired={repaired} setRepaired={setRepaired} reuse={reuse} setReuse={setReuse} lastId={lastId} setStage={setStage} />
    </div>
  );
}

// The AI examiner's report: level, scores, corrections, upgrades, next focus.
function FeedbackPanel(props: { feedback: Feedback }) {
  const { feedback } = props;
  return (
    <div className="card-rah p-6 mb-4">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="display text-[24px] font-bold" style={{ color: "var(--accent-deep)" }}>{feedback.level}</span>
        {feedback.goal ? <span className="chip">graded as {feedback.goal} register</span> : null}
        <span className="text-[13px]" style={{ color: "var(--muted)" }}>{feedback.verdict}</span>
      </div>
      {feedback.scores ? (
        <div className="grid grid-cols-4 gap-3 mb-4">
          {Object.entries(feedback.scores).map(([k, v]) => (
            <div key={k} className="rounded-xl p-3 text-center" style={{ background: "var(--rah-callout)" }}>
              <div className="display text-[20px] font-bold">{v}/10</div>
              <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>{k}</div>
            </div>
          ))}
        </div>
      ) : null}
      {feedback.errors?.length ? (
        <>
          <div className="font-bold text-[14px] mb-2">Corrections, with the why in Farsi</div>
          {feedback.errors.map((e, i) => (
            <div key={i} className="rounded-xl border p-4 mb-2" style={{ borderColor: "var(--line)" }}>
              <div className="text-[14px]"><span style={{ color: "var(--danger)", textDecoration: "line-through" }}>{e.bad}</span> → <b>{e.good}</b></div>
              <div dir="rtl" className="fa-text text-[13.5px] mt-1">{e.fa}</div>
            </div>
          ))}
        </>
      ) : null}
      {feedback.upgrades?.length ? (
        <>
          <div className="font-bold text-[14px] mb-2 mt-4">B2 to C1 upgrades</div>
          {feedback.upgrades.map((u, i) => (
            <div key={i} className="rounded-xl p-4 mb-2" style={{ background: "var(--accent-dim)" }}>
              <div className="text-[13.5px]"><span style={{ color: "var(--muted)" }}>{u.plain}</span> → <b>{u.c1}</b></div>
              {u.fa ? <div dir="rtl" className="fa-text text-[12.5px] mt-1">{u.fa}</div> : null}
            </div>
          ))}
        </>
      ) : null}
      {feedback.next_focus ? <div className="mt-4 text-[13.5px] font-semibold">Next focus: {feedback.next_focus}</div> : null}
    </div>
  );
}

// The repair form: name the worst error, then reuse the corrected structure
// twice. Saving rides the route's save-only leg (no AI call, no XP).
function RepairForm(props: {
  prompt: { prompt: string };
  repaired: string;
  setRepaired: (v: string) => void;
  reuse: string[];
  setReuse: (fn: (xs: string[]) => string[]) => void;
  lastId: number | null;
  setStage: (v: "write" | "model") => void;
}) {
  const { prompt, repaired, setRepaired, reuse, setReuse, lastId, setStage } = props;
  return (
    <div className="card-rah p-6 mb-4">
      <div className="display text-[19px] font-bold mb-2">The repair, where the learning happens</div>
      <label htmlFor="repair-error" className="text-[12.5px] font-bold block mb-1 mt-3">1. The one error I keep making (worst one only)</label>
      <textarea
        id="repair-error"
        value={repaired}
        aria-label="The error I keep making"
        onChange={(e) => setRepaired(e.target.value)}
        className="w-full rounded-2xl border p-4 min-h-[80px] text-[14.5px]"
        style={{ borderColor: "var(--line)", background: "var(--rah-field)", outline: "none" }}
        placeholder='e.g. "I have seen him yesterday" needs past simple: I saw him yesterday. Time point means past tense.'
      />
      <label htmlFor="reuse-0" className="text-[12.5px] font-bold block mb-1 mt-4">2. Now use that corrected structure in two brand new sentences</label>
      {reuse.map((v, i) => (
        <input
          key={i}
          id={`reuse-${i}`}
          value={v}
          aria-label={`Reuse sentence ${i + 1}`}
          onChange={(e) => setReuse((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))}
          className="w-full rounded-xl border px-4 py-2.5 text-[14px] mb-2"
          style={{ borderColor: "var(--line)", background: "var(--rah-field)", outline: "none" }}
          placeholder={i === 0 ? "New sentence one, different topic" : "New sentence two, different topic again"}
        />
      ))}
      <div className="flex justify-between items-center mt-4">
        <button className="text-[12.5px] font-semibold" style={{ color: "var(--muted)" }} onClick={() => setStage("write")}>back to draft</button>
        <button
          className="btn-primary"
          disabled={!repaired.trim() || !reuse[0].trim() || !reuse[1].trim()}
          onClick={async () => {
            // Task 108: action:"save" now hits the route's save-only leg
            // (stores the repair as the draft's revision - revision 2
            // when the graded draft's id is known - no AI call, no XP).
            await fetch("/api/writing", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt: prompt.prompt, text: repaired + "\n\nReuse:\n" + reuse.filter(Boolean).join("\n"), revisingId: lastId ?? 0, action: "save" }),
            }).catch(() => undefined);
            setStage("model");
          }}
        >
          Save repair, compare with the model
        </button>
      </div>
    </div>
  );
}
