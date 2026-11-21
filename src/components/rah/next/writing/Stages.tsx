"use client";

import type { ReactNode } from "react";
import { SectionTitle, Note } from "../bits";
import { WRITE_PROMPTS } from "@/lib/content";
import { wordCount } from "@/lib/fsrs";
import type { Sample } from "./shared";

// The prompt picker: library grid, restored-draft note, recent drafts.
export function PickStage(props: {
  draftNote: string;
  history: Sample[];
  restored: { text: string; goalSel: string } | null;
  setPid: (v: string) => void;
  setText: (v: string) => void;
  setGoal: (v: "exam" | "work" | "casual") => void;
  setRestored: (v: null) => void;
  setFeedback: (v: null) => void;
  setStage: (v: "write") => void;
}) {
  const { draftNote, history, restored, setPid, setText, setGoal, setRestored, setFeedback, setStage } = props;
  return (
    <div>
      <SectionTitle
        title="Writing workshop"
        sub="One hundred to two hundred fifty words a day. Feedback only counts when you repair the error and reuse the structure."
      />
      {draftNote ? (
        <div className="mb-4">
          <Note tone="accent">{draftNote}</Note>
        </div>
      ) : null}
      <div className="grid md:grid-cols-2 gap-4">
        {WRITE_PROMPTS.map((p) => (
          <button
            key={p.id}
            className="card-rah p-5 text-left hover:shadow-md transition-shadow"
            onClick={() => {
              setPid(p.id);
              if (restored) {
                // The restored (server-newer) draft loads into whatever
                // prompt the learner opens; the restore is one-shot.
                setText(restored.text);
                if (restored.goalSel === "exam" || restored.goalSel === "work" || restored.goalSel === "casual") setGoal(restored.goalSel);
                setRestored(null);
              } else {
                setText("");
              }
              setFeedback(null);
              setStage("write");
            }}
          >
            {/* Task 109: two chips per card x 6 cards was the pill-noise
               pattern; metadata demotes to a quiet line. */}
            <div className="text-[12px] font-semibold mb-2" style={{ color: "var(--muted)" }}>
              {p.minWords}–{p.maxWords} words · model answer inside
            </div>
            <div className="text-[14.5px] font-semibold leading-relaxed">{p.prompt}</div>
          </button>
        ))}
      </div>
      {history.length ? (
        <div className="card-rah p-5 mt-5">
          <div className="font-bold text-[14px] mb-2">Your last drafts</div>
          {history.slice(0, 5).map((h) => (
            <div key={h.id} className="flex items-baseline justify-between gap-4 py-1.5 border-b last:border-0 text-[13px]" style={{ borderColor: "var(--line)" }}>
              <span className="truncate max-w-[60%]">{h.text.slice(0, 70)}...</span>
              <span style={{ color: "var(--muted)" }}>{wordCount(h.text)} words · rev {h.revision}{h.result ? " · graded" : ""}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// The C1 model answer screen: read as a builder, not a judge.
export function ModelStage(props: {
  header: ReactNode;
  prompt: { model: string; modelNotes: string[] };
  setStage: (v: "pick") => void;
}) {
  const { header, prompt, setStage } = props;
  return (
    <div className="max-w-3xl mx-auto">
      {header}
      <div className="card-rah p-8">
        <div className="display text-[19px] font-bold mb-2">The C1 model answer</div>
        <p className="text-[13.5px] mb-4" style={{ color: "var(--muted)" }}>
          Research on L2 writing keeps finding that studying high-quality models beats error correction alone. Read it as
          a builder, not a judge: how does it open, how does each paragraph earn its place, where does it concede?
        </p>
        <p className="text-[16px] leading-[1.9] rounded-2xl p-6 mb-5" style={{ background: "var(--rah-callout)" }}>{prompt.model}</p>
        <div className="font-bold text-[13.5px] mb-2">What makes it C1</div>
        <ul className="text-[14px] leading-relaxed list-disc pl-5 space-y-1.5">
          {prompt.modelNotes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
        <div className="mt-6 flex gap-2">
          <button className="btn-primary" onClick={() => setStage("pick")}>Another prompt</button>
        </div>
      </div>
    </div>
  );
}
