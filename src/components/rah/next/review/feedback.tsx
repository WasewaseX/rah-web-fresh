"use client";

// The feedback zone (again/miss notes) and the grade bar with live FSRS
// intervals. Pure render over props.

import { Note } from "../bits";
import { ivlLabel, preview as fsrsPreview } from "@/lib/fsrs";
import type { CardView, QueueItem, ReviewPhase } from "./shared";
import { GRADES } from "./shared";

export function Feedback({ phase, correct, dir, isBank, audioMcq, input, c }: { phase: ReviewPhase; correct: boolean; dir: string; isBank: boolean; audioMcq: boolean; input: string; c: CardView }) {
  return (
    <>
      {phase === "checked" && (
        <div className="mt-6">
          {correct ? (
            <Note tone="accent">
              <b>{dir === "fa2en" || isBank ? c.en : c.answer}</b> is right. {c.note}
            </Note>
          ) : (
            <Note tone="error">
              <b>{dir === "fa2en" || isBank ? c.en : c.answer}</b> was the target{!isBank && dir !== "mcq_fa" && !audioMcq ? <> , you wrote <b>{input || "nothing"}</b></> : null}. {c.note}
            </Note>
          )}
          {c.fa ? <div className="mt-3 fa-text text-[15px]" style={{ color: "var(--muted)" }}>{c.fa}</div> : null}
        </div>
      )}
      {phase === "reveal" && (
        <div className="mt-6">
          <Note>
            {c.fa ? <span dir="rtl" className="inline-block text-[15px]">{c.fa}</span> : null}
            {c.note ? <div className={c.fa ? "mt-1" : ""}>{c.note}</div> : null}
          </Note>
        </div>
      )}
    </>
  );
}

// The four grade keys, each showing what it does to the schedule.
export function GradeBar({ previews, grade, busy, cur }: { previews: ReturnType<typeof fsrsPreview>; grade: (r: number) => void; busy: boolean; cur: QueueItem }) {
  return (
    <>
      <div className="grid grid-cols-4 gap-2 mt-6">
        {GRADES.map((g) => (
          <button
            key={g.r}
            onClick={() => grade(g.r)}
            disabled={busy}
            className="rounded-2xl border py-3 text-center transition-transform active:scale-95 disabled:opacity-50"
            style={{ borderColor: "var(--line)", background: "var(--rah-field)" }}
          >
            <div className="text-[14px] font-bold" style={{ color: g.color }}>{g.label}</div>
            <div className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>{ivlLabel(previews[g.r - 1])}</div>
          </button>
        ))}
      </div>
      <div className="mt-4 text-[12px] text-center" style={{ color: "var(--muted)" }}>
        stability {cur.state.s ? cur.state.s.toFixed(1) : "new"} · difficulty {cur.state.d ? cur.state.d.toFixed(1) : "new"} · grades advance the schedule, <span className="kbd">1</span> to <span className="kbd">4</span>
      </div>
    </>
  );
}
