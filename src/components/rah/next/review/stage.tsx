"use client";

// The live card stage: header strip, per-direction prompt, answer input per
// interaction model, feedback zone and grade bar. Pure render - every value
// and setter arrives through the StageData bundle from ReviewView (the
// component owns the hooks; the stage owns none).

import type * as React from "react";
import { preview as fsrsPreview } from "@/lib/fsrs";
import type { QueueItem, ReviewPhase } from "./shared";
import { DIR_LABEL } from "./shared";
import { PromptBlock } from "./prompt";
import { BankInput, ChoiceList, EfCheck, SentArea, TypingInput } from "./inputs";
import { Feedback, GradeBar } from "./feedback";

// Everything the stage reads or writes, as one bundle.
export interface StageData {
  cur: QueueItem;
  dir: string;
  c: QueueItem["card"];
  audioMcq: boolean;
  needsTyping: boolean;
  isBank: boolean;
  tiles: string[];
  choices: string[];
  previews: ReturnType<typeof fsrsPreview>;
  phase: ReviewPhase;
  correct: boolean;
  input: string;
  choice: string | null;
  picked: number[];
  busy: boolean;
  counts: { due: number; fresh: number } | null;
  idx: number;
  total: number;
  textRef: React.RefObject<HTMLInputElement>;
  areaRef: React.RefObject<HTMLTextAreaElement>;
  setInput: (v: string) => void;
  setChoice: (v: string | null) => void;
  setPicked: (updater: (p: number[]) => number[]) => void;
  check: () => void;
  grade: (r: number) => void;
}

// The chips / counter strip and the progress bar above the card.
function StageHeader({ f }: { f: StageData }) {
  const shownPct = Math.round(((f.idx + 1) / Math.max(1, f.total)) * 100);
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="chip chip-accent">{f.c.skill}</span>
          <span className="chip">{f.c.level}</span>
          {f.cur.state.state === "new" ? <span className="chip" style={{ background: "var(--amber-dim)", color: "var(--c-gold-tint)", borderColor: "transparent" }}>new</span> : null}
        </div>
        <span className="text-[12.5px] font-semibold" style={{ color: "var(--muted)" }}>
          {f.idx + 1} / {f.total}
        </span>
      </div>

      <div className="h-1.5 rounded-full overflow-hidden mb-6" style={{ background: "var(--rah-track)" }}>
        <div className="h-full transition-all" style={{ width: `${shownPct}%`, background: "var(--accent)" }} />
      </div>
    </>
  );
}

export function ReviewStage({ f }: { f: StageData }) {
  return (
    <div className="max-w-3xl mx-auto">
      <StageHeader f={f} />

      {/* Task 109: the direction used to render as an all-caps kicker ABOVE
         the card - the eyebrow pattern the craft floor bans. It is an
         instruction, so it lives inside the card at readable weight. */}
      <div className="card-rah p-8">
        <div className="text-[13px] font-bold mb-4" style={{ color: "var(--accent-deep)" }}>
          {DIR_LABEL[f.dir] ?? f.dir}
        </div>

        <PromptBlock dir={f.dir} c={f.c} audioMcq={f.audioMcq} isBank={f.isBank} />

        {/* ---- answer input per interaction model ---- */}
        {f.needsTyping && f.phase === "prompt" && <TypingInput inputRef={f.textRef} input={f.input} setInput={f.setInput} />}
        {f.isBank && f.phase === "prompt" && <BankInput picked={f.picked} setPicked={f.setPicked} tiles={f.tiles} check={f.check} />}
        {f.choices.length > 0 && f.phase === "prompt" && <ChoiceList choices={f.choices} choice={f.choice} setChoice={f.setChoice} check={f.check} />}
        {f.dir === "ef" && f.phase === "prompt" && <EfCheck check={f.check} />}
        {f.dir === "sent" && f.phase === "prompt" && <SentArea inputRef={f.areaRef} input={f.input} setInput={f.setInput} check={f.check} />}

        {/* ---- feedback zone ---- */}
        <Feedback phase={f.phase} correct={f.correct} dir={f.dir} isBank={f.isBank} audioMcq={f.audioMcq} input={f.input} c={f.c} />

        {/* ---- grade bar: the four keys, live intervals ---- */}
        {(f.phase === "checked" || f.phase === "reveal") && <GradeBar previews={f.previews} grade={f.grade} busy={f.busy} cur={f.cur} />}
      </div>

      {f.counts ? (
        <div className="mt-4 text-[12px] text-center" style={{ color: "var(--muted)" }}>
          {f.counts.due} due · {f.counts.fresh} new waiting in the deck
        </div>
      ) : null}
    </div>
  );
}
