"use client";

// The answer input per interaction model: typed input, tile bank, meaning
// choice, self-graded prompts. Pure render over props - the state setters and
// the check callback arrive from ReviewView through the stage bundle.

import type * as React from "react";
import { Fa } from "../bits";

export function TypingInput({ inputRef, input, setInput }: { inputRef: React.RefObject<HTMLInputElement>; input: string; setInput: (v: string) => void }) {
  return (
    <div className="mt-6">
      <input
        ref={inputRef}
        value={input}
        aria-label="Your answer"
        onChange={(e) => setInput(e.target.value)}
        className="cloze-input text-[18px]"
        placeholder="type it"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      <div className="mt-4 text-[12.5px]" style={{ color: "var(--muted)" }}>
        Produce it from memory, then press <span className="kbd">Enter</span>. Typing it beats choosing it.
      </div>
    </div>
  );
}

export function BankInput({ picked, setPicked, tiles, check }: { picked: number[]; setPicked: (updater: (p: number[]) => number[]) => void; tiles: string[]; check: () => void }) {
  return (
    <div className="mt-6">
      <div className="min-h-14 rounded-2xl border-2 border-dashed p-2.5" style={{ borderColor: "var(--line)", background: "var(--rah-field)" }}>
        {picked.length === 0 ? (
          <div className="py-1.5 text-center text-[13px]" style={{ color: "var(--muted)" }}>Tap the words below in order…</div>
        ) : (
          <div className="flex flex-wrap justify-center gap-1.5">
            {picked.map((i) => (
              <button
                key={`${i}-built`}
                onClick={() => setPicked((p) => p.filter((x) => x !== i))}
                className="rounded-xl px-3 py-2 text-[14px] font-bold text-white transition-transform active:scale-95"
                style={{ background: "var(--accent)" }}
              >
                {tiles[i]}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {tiles.map((t, i) =>
          picked.includes(i) ? null : (
            <button
              key={`${i}-tile`}
              onClick={() => setPicked((p) => [...p, i])}
              className="rounded-xl px-3 py-2 text-[14px] font-bold transition-transform active:scale-95"
              style={{ background: "var(--rah-field)", border: "1px solid var(--line)" }}
            >
              {t}
            </button>
          ),
        )}
      </div>
      <div className="mt-4 flex justify-center">
        <button className="btn-primary" disabled={picked.length === 0} onClick={check}>Check</button>
      </div>
    </div>
  );
}

export function ChoiceList({ choices, choice, setChoice, check }: { choices: string[]; choice: string | null; setChoice: (v: string | null) => void; check: () => void }) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {choices.map((ch) => (
        <button
          key={ch}
          onClick={() => setChoice(ch)}
          className={`rounded-2xl border-2 px-4 py-3.5 text-[15px] font-semibold transition-all active:scale-[.99] ${choice === ch ? "" : "hover:bg-white/[0.04]"}`}
          style={{ borderColor: choice === ch ? "var(--accent)" : "var(--line)", background: choice === ch ? "var(--accent-dim)" : "var(--rah-field)" }}
        >
          <Fa>{ch}</Fa>
        </button>
      ))}
      <div className="sm:col-span-2 flex justify-center mt-2">
        <button className="btn-primary" disabled={!choice} onClick={check}>Check</button>
      </div>
    </div>
  );
}

export function EfCheck({ check }: { check: () => void }) {
  return (
    <div className="mt-5">
      <button className="btn-primary" onClick={check}>
        I said it, show the answer
      </button>
      <div className="mt-3 text-[12.5px]" style={{ color: "var(--muted)" }}>
        Say the Persian meaning out loud first. Grading yourself honestly is the whole game.
      </div>
    </div>
  );
}

export function SentArea({ inputRef, input, setInput, check }: { inputRef: React.RefObject<HTMLTextAreaElement>; input: string; setInput: (v: string) => void; check: () => void }) {
  return (
    <div className="mt-5">
      <textarea
        ref={inputRef}
        value={input}
        aria-label="Rebuild the sentence"
        onChange={(e) => setInput(e.target.value)}
        className="w-full rounded-2xl border p-4 min-h-[110px] text-[15.5px] leading-relaxed"
        style={{ borderColor: "var(--line)", background: "var(--rah-field)", outline: "none" }}
        placeholder="Write one natural sentence that uses it. Make it about your own life so it sticks."
      />
      <div className="mt-3">
        <button className="btn-primary" onClick={check}>
          Done, show usage note
        </button>
      </div>
    </div>
  );
}
