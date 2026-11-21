"use client";

import { useState } from "react";
import { SectionTitle, Note } from "./bits";
import { MINIMAL_PAIRS, PAIR_FOCUS, STRESS_ITEMS, LINK_ITEMS } from "@/lib/content";
import { speak } from "./speech";
import { seededShuffle } from "@/lib/fsrs";

// Perception first: hear, identify, distinguish, then reproduce. A 2025
// meta-analysis of 65 studies found perception training beats shadowing.
// Monotonic seed: every re-seed gets a fresh shuffle order without an
// impure Date.now()/Math.random() call inside a component function body.
let soundSeed = 0;

type Mode = "pairs" | "stress" | "reduce";
type LastResult = { ok: boolean; word: string } | null;

function logSound(id: string, focus: string, correct: boolean) {
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "sound", pairId: id, focus, correct }),
  }).catch(() => undefined);
}

function finishSound(mode: Mode, onDone: () => void) {
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "sound", minutes: 10, meta: { mode } }),
  }).then(onDone).catch(() => undefined);
}

function ModeTabs({ mode, start }: { mode: Mode; start: (m: Mode) => void }) {
  return (
    <div className="flex gap-1.5 mb-6">
      {([["pairs", "Minimal pairs"], ["stress", "Word stress"], ["reduce", "Fast speech"]] as const).map(([m, label]) => (
        <button
          key={m}
          onClick={() => start(m as Mode)}
          className="text-[13px] font-bold rounded-full px-4 py-2 transition-colors"
          style={mode === m ? { background: "var(--rah-callout-hover)", color: "var(--ink)", border: "1px solid rgba(255, 255, 255, 0.18)" } : { background: "var(--rah-field)", color: "var(--muted)", border: "1px solid var(--line)" }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function PairRound({ pair, round, count, score, playing, noVoice, lastResult, onSay, onPick, onNext, onRestart, onFinish }: {
  pair: (typeof MINIMAL_PAIRS)[number] | undefined;
  round: number;
  count: number;
  score: number;
  playing: boolean;
  noVoice: boolean;
  lastResult: LastResult;
  onSay: (text: string) => void;
  onPick: (ok: boolean, word: string) => void;
  onNext: () => void;
  onRestart: () => void;
  onFinish: () => void;
}) {
  const finished = round >= count && count > 0;
  if (finished) {
    return (
      <div className="card-rah p-8 text-center">
        <div className="display text-[30px] font-bold mb-1">{score}/{count}</div>
        <p className="text-[13.5px] mb-6" style={{ color: "var(--muted)" }}>
          Perception training shows large effects in meta-analysis, and gains show up in production too. Ten rounds a day beats thirty minutes of shadowing.
        </p>
        <div className="flex gap-2 justify-center">
          <button className="btn-primary" onClick={onRestart}>Another ten</button>
          <button className="btn-ghost" onClick={onFinish}>Log 10 minutes</button>
        </div>
      </div>
    );
  }
  if (!pair) return null;
  return (
    <div className="card-rah p-8 text-center">
      {/* Task 109: was an all-caps kicker (banned eyebrow pattern); a
         sentence-case status line reads cleaner and stays honest. */}
      <div className="text-[13px] font-bold mb-2" style={{ color: "var(--accent-deep)" }}>
        Round {round + 1} of {count} — {PAIR_FOCUS.find((f) => f.id === pair.focus)?.label}
      </div>
      <p className="text-[14px] mb-6" style={{ color: "var(--muted)" }}>One word will be spoken. Which one is it?</p>
      <button className="btn-primary text-[15px] px-8 py-3 mb-8" onClick={() => onSay(Math.random() < 0.5 ? pair.a : pair.b)}>
        {playing ? "..." : "Play the word"}
      </button>
      {noVoice ? <div className="mb-4"><Note tone="warn">No English system voice in this browser. Rah works best in Chrome or Edge on desktop, which ship English voices.</Note></div> : null}
      <div className="grid grid-cols-2 gap-3">
        {[pair.a, pair.b].map((w) => {
          const revealed = lastResult !== null;
          const isAnswer = lastResult ? lastResult.word === w : false;
          return (
            <button
              key={w}
              disabled={revealed || playing}
              onClick={() => onPick(isAnswer, w)}
              className="rounded-2xl border py-4 text-[18px] font-bold display"
              style={
                revealed
                  ? isAnswer
                    ? { background: "var(--accent-dim)", borderColor: "transparent", color: "var(--accent-deep)" }
                    : { borderColor: "var(--line)", color: "var(--muted)" }
                  : { borderColor: "var(--line)" }
              }
            >
              {w}
            </button>
          );
        })}
      </div>
      {lastResult ? (
        <div className="mt-5">
          <Note tone={lastResult.ok ? "accent" : "error"}>
            {lastResult.ok ? "Correct. " : `It was ${lastResult.word}. `}{pair.hint}.
          </Note>
          <button className="btn-primary mt-4" onClick={onNext}>
            Next pair
          </button>
        </div>
      ) : null}
    </div>
  );
}

function StressRound({ item, count, score, lastResult, onPick, onNext, onRestart, onFinish }: {
  item: (typeof STRESS_ITEMS)[number] | undefined;
  count: number;
  score: number;
  lastResult: LastResult;
  onPick: (right: boolean, syl: string) => void;
  onNext: () => void;
  onRestart: () => void;
  onFinish: () => void;
}) {
  const finished = count > 0 && item === undefined;
  if (finished) {
    return (
      <div className="card-rah p-8 text-center">
        <div className="display text-[30px] font-bold mb-1">{score}/{count}</div>
        <div className="flex gap-2 justify-center">
          <button className="btn-primary" onClick={onRestart}>Another eight</button>
          <button className="btn-ghost" onClick={onFinish}>Log 10 minutes</button>
        </div>
      </div>
    );
  }
  if (!item) return null;
  return (
    <div className="card-rah p-8 text-center">
      <p className="text-[14px] mb-2" style={{ color: "var(--muted)" }}>Where does the stress fall?</p>
      <div className="display text-[30px] font-bold mb-8">{item.word}</div>
      <div className="grid gap-2 max-w-xs mx-auto">
        {item.syllables.map((s, i) => {
          const revealed = lastResult !== null;
          const right = i === item.stress;
          return (
            <button
              key={i}
              disabled={revealed}
              onClick={() => onPick(right, s)}
              className="rounded-xl border py-3 text-[17px] font-bold display"
              style={
                revealed
                  ? right
                    ? { background: "var(--accent-dim)", borderColor: "transparent", color: "var(--accent-deep)" }
                    : { borderColor: "var(--line)", color: "var(--muted)" }
                  : { borderColor: "var(--line)" }
              }
            >
              {s}
            </button>
          );
        })}
      </div>
      {lastResult ? (
        <div className="mt-5">
          <Note tone={lastResult.ok ? "accent" : "warn"}>{item.shiftNote}.</Note>
          <button className="btn-primary mt-4" onClick={onNext}>Next word</button>
        </div>
      ) : null}
    </div>
  );
}

function ReduceList({ linkQueue, onSay, onFinish }: {
  linkQueue: string[];
  onSay: (text: string) => void;
  onFinish: () => void;
}) {
  return (
    <div className="card-rah p-8">
      {linkQueue.map((id) => {
        const item = LINK_ITEMS.find((x) => x.id === id)!;
        return (
          <div key={id} className="rounded-2xl border p-5 mb-3" style={{ borderColor: "var(--line)" }}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-[16px] font-bold display">{item.written}</div>
                <div className="text-[14px] mt-1" style={{ color: "var(--accent-deep)" }}>sounds like: <b>{item.heard}</b></div>
                <div className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>{item.note}</div>
              </div>
              <button className="btn-ghost text-[12.5px]" onClick={() => onSay(item.written)}>hear it</button>
            </div>
          </div>
        );
      })}
      <div className="text-center mt-4">
        <button className="btn-ghost" onClick={onFinish}>Log 10 minutes</button>
      </div>
    </div>
  );
}

export default function SoundView({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<Mode>("pairs");
  const [noVoice, setNoVoice] = useState(false);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [lastResult, setLastResult] = useState<LastResult>(null);
  // Task 112: the queue seeds in the initializer - no setState-in-effect
  // (CI #31); the seeded shuffle is the only real mount work, so it belongs in useState.
  const [queue, setQueue] = useState<string[]>(() =>
    seededShuffle(MINIMAL_PAIRS.map((p) => p.id), Date.now() >>> 0).slice(0, 10)
  );
  const [playing, setPlaying] = useState(false);

  const pairQueue = queue.filter((id) => id.startsWith("p"));
  const stressQueue = queue.filter((id) => id.startsWith("s"));
  const linkQueue = queue.filter((id) => id.startsWith("k"));

  // Task 109: `start` is called only from user events (never a mount effect).
  const start = (m: Mode) => {
    setMode(m);
    setRound(0);
    setScore(0);
    setLastResult(null);
    if (m === "pairs") setQueue(seededShuffle(MINIMAL_PAIRS.map((p) => p.id), ++soundSeed).slice(0, 10));
    if (m === "stress") setQueue(seededShuffle(STRESS_ITEMS.map((p) => p.id), ++soundSeed).slice(0, 8));
    if (m === "reduce") setQueue(LINK_ITEMS.map((p) => p.id));
  };

  const say = async (text: string) => {
    setPlaying(true);
    const ok = await speak(text, 0.9);
    setPlaying(false);
    if (!ok) setNoVoice(true);
  };

  const stressItem = STRESS_ITEMS.find((p) => p.id === stressQueue[round]);
  const pairItem = MINIMAL_PAIRS.find((p) => p.id === pairQueue[round]);
  const pickPair = (ok: boolean, word: string) => {
    if (!pairItem) return;
    if (ok) setScore((s) => s + 1);
    logSound(pairItem.id, pairItem.focus, ok);
    setLastResult({ ok, word });
  };
  const pickStress = (right: boolean, syl: string) => {
    if (!stressItem) return;
    if (right) setScore((x) => x + 1);
    logSound(stressItem.id, "stress", right);
    setLastResult({ ok: right, word: syl });
    say(stressItem.word);
  };
  const nextRound = () => {
    setLastResult(null);
    setRound((r) => r + 1);
  };
  const finish = () => finishSound(mode, onDone);

  if (mode === "pairs") {
    return (
      <div className="max-w-xl mx-auto">
        <SectionTitle title="Sound & rhythm" sub="Your brain must hear the difference before your mouth can make it." />
        <ModeTabs mode={mode} start={start} />
        <PairRound pair={pairItem} round={round} count={pairQueue.length} score={score} playing={playing} noVoice={noVoice}
          lastResult={lastResult} onSay={(t) => void say(t)} onPick={pickPair} onNext={nextRound}
          onRestart={() => start("pairs")} onFinish={finish} />
      </div>
    );
  }

  if (mode === "stress") {
    return (
      <div className="max-w-xl mx-auto">
        <SectionTitle title="Sound & rhythm" sub="Flat, syllable-timed stress is the biggest single marker of a Persian accent. Fix the stress, fix the signal." />
        <ModeTabs mode={mode} start={start} />
        <StressRound item={stressItem} count={stressQueue.length} score={score} lastResult={lastResult}
          onPick={pickStress} onNext={nextRound} onRestart={() => start("stress")} onFinish={finish} />
      </div>
    );
  }

  // reduce: fast speech awareness
  return (
    <div className="max-w-xl mx-auto">
      <SectionTitle title="Sound & rhythm" sub="What you hear is not what is written. Train the mapping once and subtitles become optional." />
      <ModeTabs mode={mode} start={start} />
      <ReduceList linkQueue={linkQueue} onSay={(t) => void say(t)} onFinish={finish} />
    </div>
  );
}
