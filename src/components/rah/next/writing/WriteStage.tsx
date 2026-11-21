"use client";

import type { ReactNode } from "react";
import { Note } from "../bits";
import { REGISTER_DIAL } from "./shared";

// The drafting screen: prompt, register dial, essay field, submit bar,
// self-check rubric. The register dial and the rubric are extracted below;
// the submit handler arrives from the parent as `submit` (it needs the
// parent's prompt/goal closure).

export function WriteStage(props: {
  header: ReactNode;
  prompt: { prompt: string; minWords: number };
  text: string;
  setText: (v: string) => void;
  goal: "exam" | "work" | "casual";
  setGoal: (v: "exam" | "work" | "casual") => void;
  words: number;
  inRange: boolean;
  fbState: string;
  fbMsg: string;
  submit: () => Promise<void>;
  selfCheck: Record<string, boolean>;
  setSelfCheck: (fn: (x: Record<string, boolean>) => Record<string, boolean>, k: string, v: boolean) => void;
}) {
  const { header, prompt, text, setText, goal, setGoal, words, inRange, fbState, fbMsg, submit, selfCheck, setSelfCheck } = props;
  return (
    <div className="max-w-3xl mx-auto">
      {header}
      <p className="text-[17px] leading-relaxed mb-5">{prompt.prompt}</p>
      <div className="card-rah p-6">
        {/* P2 item 2: the register dial, learner-facing at last. The choice
           travels to /api/writing and scales how strictly register is
           judged - visible conditioning, never a hidden scorer. */}
        <RegisterDial goal={goal} setGoal={setGoal} />
        <textarea
          value={text}
          aria-label="Your writing"
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-2xl border p-5 min-h-[300px] text-[15.5px] leading-[1.8]"
          style={{ borderColor: "var(--line)", background: "var(--rah-field)", outline: "none" }}
          placeholder="Answer the prompt with a position and two developed reasons. Collocations over loose pairs."
        />
        <SubmitBar words={words} inRange={inRange} prompt={prompt} fbState={fbState} submit={submit} />
        {fbMsg ? <div className="mt-3"><Note tone="warn">{fbMsg}. No problem: use the self-check rubric below, then repair from your own re-read. The rubric catches most of what the examiner would.</Note></div> : null}
        <SelfCheck selfCheck={selfCheck} setSelfCheck={setSelfCheck} />
      </div>
    </div>
  );
}

// P2: who grades this? The dial text mirrors the server's conditioned examiner.
function RegisterDial(props: { goal: "exam" | "work" | "casual"; setGoal: (v: "exam" | "work" | "casual") => void }) {
  const { goal, setGoal } = props;
  return (
    <div className="mb-4">
      <div className="text-[12.5px] font-bold mb-2">Who grades this?</div>
      <div className="flex gap-2">
        {REGISTER_DIAL.map((g) => (
          <button
            key={g.id}
            className={`seg-quiet ${goal === g.id ? "seg-on" : ""}`}
            onClick={() => setGoal(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>
      <p className="text-[12.5px] mt-2" style={{ color: "var(--muted)" }}>
        {REGISTER_DIAL.find((g) => g.id === goal)?.copy}
      </p>
    </div>
  );
}

// Word-count line + the submit button (busy state lives in the parent).
function SubmitBar(props: {
  words: number;
  inRange: boolean;
  prompt: { minWords: number };
  fbState: string;
  submit: () => Promise<void>;
}) {
  const { words, inRange, prompt, fbState, submit } = props;
  return (
    <div className="flex items-center justify-between mt-3">
      <span className="text-[13px] font-semibold" style={{ color: inRange ? "var(--accent-deep)" : "var(--muted)" }}>
        {words} words {inRange ? "· in range" : `· target ${prompt.minWords}+`}
      </span>
      <div className="flex gap-2">
        <button
          className="btn-primary"
          disabled={words < 40 || fbState === "busy"}
          onClick={async () => {
            await submit();
          }}
        >
          {fbState === "busy" ? "The examiner is reading..." : "Submit for CEFR feedback"}
        </button>
      </div>
    </div>
  );
}

// Self-check rubric (no AI needed) - catches most of what the examiner would.
function SelfCheck(props: {
  selfCheck: Record<string, boolean>;
  setSelfCheck: (fn: (x: Record<string, boolean>) => Record<string, boolean>, k: string, v: boolean) => void;
}) {
  const { selfCheck, setSelfCheck } = props;
  return (
    <div className="mt-5 rounded-2xl p-5" style={{ background: "var(--rah-callout)" }}>
      <div className="font-bold text-[13px] mb-2">Self-check rubric (no AI needed)</div>
      {[
        ["task", "I answered every part of the prompt with development, not just a position"],
        ["org", "Two or more paragraphs, each with one job, connected with discourse markers"],
        ["range", "At least five collocations or fixed expressions, one hedged claim"],
        ["accuracy", "I re-read for my trap list: articles, countability, prepositions, that-omission"],
      ].map(([k, label]) => (
        <label key={k} className="flex items-start gap-2.5 py-1.5 text-[13.5px] cursor-pointer">
          <input
            type="checkbox"
            aria-label={label}
            checked={selfCheck[k] ?? false}
            onChange={(e) => setSelfCheck((x) => ({ ...x, [k]: e.target.checked }), k as string, e.target.checked)}
            className="mt-0.5"
          />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}
