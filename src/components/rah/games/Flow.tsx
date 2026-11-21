"use client";

// Focus Flow: one 12-item drill queue, one item on screen, a 15-minute
// window, and a shell that dims everything else. Finish with 80%+ for the
// bonus and the chain hit.

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Timer } from "lucide-react";
import { Btn, Card, Chip, Note, Spinner } from "../ui";
import { submitGameResult } from "@/lib/offline";

interface Item {
  id: string;
  kind: "cloze" | "mcq";
  q: string;
  choices?: string[];
  key: string;
  accepts: string[];
}

interface FlowData {
  items: Item[];
  streak: number;
  best: number;
  due: number;
}

const FLOW_MS = 15 * 60_000;

function normalize(s: string): string {
  return s.toLowerCase().replace(/[.,!?;:'"()]/g, "").replace(/\s+/g, " ").trim();
}

// Settle the run once: stop the clock, post the real tallies, show the report.
type FlowFinish = {
  doneRef: { current: boolean };
  timerRef: { current: ReturnType<typeof setInterval> | null };
  corRef: { current: number };
  totRef: { current: number };
  startRef: { current: number };
  setPhase: (p: "idle" | "running" | "done") => void;
  setReport: (r: { xpGain: number; streak: number; perfectBonus: boolean; queued?: boolean } | null) => void;
  onChange: () => void;
};

async function finishFlow(o: FlowFinish) {
  if (o.doneRef.current) return;
  o.doneRef.current = true;
  if (o.timerRef.current) clearInterval(o.timerRef.current);
  o.setPhase("done");
  const res = await submitGameResult("/api/flow", {
    correct: o.corRef.current,
    total: o.totRef.current,
    ms: FLOW_MS - (Date.now() - o.startRef.current),
  });
  if (res.online) {
    o.setReport(res.data as { xpGain: number; streak: number; perfectBonus: boolean });
  } else {
    o.setReport({ xpGain: 0, streak: 0, perfectBonus: false, queued: true });
  }
  o.onChange();
}

function startFlowTimer(startRef: { current: number }, setLeft: (ms: number) => void, onTimeUp: () => void): ReturnType<typeof setInterval> {
  const t0 = startRef.current;
  return setInterval(() => {
    const ms = FLOW_MS - (Date.now() - t0);
    if (ms <= 0) onTimeUp();
    else setLeft(ms);
  }, 1000);
}

function FlowHeader({ data, phase, left }: { data: FlowData; phase: string; left: number }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3ccb7f]/[0.14] text-[#7fe0ac]">
        <Timer className="h-4 w-4" />
      </span>
      <div>
        <div className="text-sm font-extrabold text-[#f2f5fa]">Focus Flow</div>
        <div className="text-[11px] text-[#7d889c]">
          12 weakness-biased drills, 15 minutes, one item at a time. Streak {data.streak} · best {data.best} · {data.due} cards due
        </div>
      </div>
      {phase === "running" && <Chip tone={left < 120_000 ? "rose" : "emerald"}>{Math.floor(left / 60000)}:{String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}</Chip>}
    </div>
  );
}

function FlowIdle({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm text-[#a9b4c6]">The queue aims at your active leak tags. Skip nothing, rush nothing: 80%+ accuracy pays a +30 bonus and extends your momentum chain.</div>
      <Btn variant="primary" onClick={onStart}>
        <Play className="h-4 w-4" /> Begin flow
      </Btn>
    </div>
  );
}

function FlowRunning({ item, left, input, setInput, flash, tally, onAnswer }: {
  item: Item;
  left: number;
  input: string;
  setInput: (v: string) => void;
  flash: "ok" | "miss" | null;
  tally: { correct: number; total: number };
  onAnswer: (ok: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-[#3ccb7f] transition-all" style={{ width: `${(left / FLOW_MS) * 100}%` }} />
      </div>
      <div className="whitespace-pre-line text-[15px] font-semibold leading-relaxed text-[#e7ecf5]">{item.q}</div>
      {item.choices ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {item.choices.map((c) => (
            <Btn key={c} variant="soft" onClick={() => onAnswer(c === item.key)}>
              {c}
            </Btn>
          ))}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) {
              onAnswer(item.accepts.includes(normalize(input)));
              setInput("");
            }
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Calm and precise..."
            aria-label="Flow answer"
            className="min-h-12 flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#e7ecf5] outline-none focus:border-[#3ccb7f]/50"
          />
          <Btn type="submit" disabled={!input.trim()}>
            Enter
          </Btn>
        </form>
      )}
      {flash && <div className={`text-xs font-bold ${flash === "ok" ? "text-[#7fe0ac]" : "text-[#ffa3b1]"}`}>{flash === "ok" ? "Clean." : "Miss - keep moving."}</div>}
      <div className="text-xs text-[#7d889c]">
        {tally.correct}/{tally.total}
      </div>
    </div>
  );
}

function FlowDone({ report, onReload }: { report: { xpGain: number; streak: number; perfectBonus: boolean; queued?: boolean }; onReload: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-lg font-black text-[#7fe0ac]">Flow complete.</div>
      <div className="text-sm text-[#a9b4c6]">
        {report.xpGain > 0 ? `+${report.xpGain} XP` : "no XP"} · flow streak {report.streak} day{report.streak === 1 ? "" : "s"}
        {(report as { queued?: boolean }).queued ? <span className="ml-2 text-[11px] text-amber-300">Offline - the flow is queued to sync</span> : null}
        {report.perfectBonus ? " · 80% bonus paid" : ""}
      </div>
      <Btn variant="soft" onClick={onReload}>
        Another queue
      </Btn>
    </div>
  );
}

export default function Flow({ onChange }: { onChange: () => void }) {
  const [data, setData] = useState<FlowData | null>(null);
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [tally, setTally] = useState({ correct: 0, total: 0 });
  const [left, setLeft] = useState(FLOW_MS);
  const [flash, setFlash] = useState<"ok" | "miss" | null>(null);
  const [report, setReport] = useState<{ xpGain: number; streak: number; perfectBonus: boolean; queued?: boolean } | null>(null);
  const corRef = useRef(0);
  const totRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);
  const startRef = useRef(0);

  const load = useCallback(() => {
    fetch("/api/flow", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: FlowData) => {
        setData(d);
        setPhase("idle");
      })
      .catch(() => undefined);
  }, []);
  useEffect(load, [load]);
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  const finish = useCallback(() => void finishFlow({ doneRef, timerRef, corRef, totRef, startRef, setPhase, setReport, onChange }), [onChange]);

  const start = () => {
    if (!data) return;
    doneRef.current = false;
    corRef.current = 0;
    totRef.current = 0;
    setTally({ correct: 0, total: 0 });
    setIdx(0);
    setLeft(FLOW_MS);
    setPhase("running");
    startRef.current = Date.now();
    timerRef.current = startFlowTimer(startRef, setLeft, finish);
  };

  const answer = (ok: boolean) => {
    corRef.current += ok ? 1 : 0;
    totRef.current += 1;
    setTally({ correct: corRef.current, total: totRef.current });
    setFlash(ok ? "ok" : "miss");
    setTimeout(() => setFlash(null), 420);
    const nextIdx = idx + 1;
    if (nextIdx >= (data?.items.length ?? 0)) void finish();
    else setIdx(nextIdx);
  };

  if (!data) return <Spinner label="Drawing the queue..." />;
  const item = data.items[Math.min(idx, data.items.length - 1)];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <FlowHeader data={data} phase={phase} left={left} />
        {phase === "idle" && <FlowIdle onStart={start} />}
        {phase === "running" && item && (
          <FlowRunning item={item} left={left} input={input} setInput={setInput} flash={flash} tally={tally} onAnswer={answer} />
        )}
        {phase === "done" && report && <FlowDone report={report} onReload={load} />}
      </Card>
      {phase === "running" && <Note tone="emerald">Flow shield on: this is the only card that matters for the next {Math.ceil(left / 60000)} minutes.</Note>}
    </div>
  );
}
