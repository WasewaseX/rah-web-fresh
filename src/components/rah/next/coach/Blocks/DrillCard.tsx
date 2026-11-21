"use client";

import { useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import { Bar, Btn, Chip, FA, Ring } from "../../../ui";
import { isCorrect } from "./shared";
import type { Drill, DrillItem, DrillOutcome } from "@/lib/tutor/types";

// ============================ DRILL CARD ============================

export function DrillCard({ drill, onDone }: { drill: Drill; onDone: (o: DrillOutcome) => void }) {
  const [idx, setIdx] = useState(0);
  const [given, setGiven] = useState("");
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [finished, setFinished] = useState(false);
  const [posted, setPosted] = useState(false);

  const item = drill.items[idx];
  const isLast = idx === drill.items.length - 1;
  const wasChecked = checked[idx] !== undefined;
  const ok = wasChecked ? checked[idx] : false;
  const checkedCount = Object.keys(checked).length;

  const check = () => {
    if (!given.trim() || wasChecked) return;
    setChecked((c) => ({ ...c, [idx]: isCorrect(item, given) }));
  };
  const next = () => {
    if (isLast) {
      const score = Object.values(checked).filter(Boolean).length;
      setFinished(true);
      if (!posted) {
        setPosted(true);
        onDone({ skill: drill.title, score, total: drill.items.length, misses: [] });
      }
      return;
    }
    setIdx((i) => i + 1);
    setGiven("");
  };
  const finalScore = Object.values(checked).filter(Boolean).length;

  if (finished) return <DrillDone drill={drill} finalScore={finalScore} />;

  return (
    <DrillPlay
      drill={drill} idx={idx} item={item} given={given} checkedCount={checkedCount}
      wasChecked={wasChecked} ok={ok} setGiven={setGiven} check={check} next={next}
    />
  );
}

// The score screen after the last item is finished.
function DrillDone(props: { drill: Drill; finalScore: number }) {
  const { drill, finalScore } = props;
  const pct = Math.round((finalScore / drill.items.length) * 100);
  return (
    <div className="rah-pop rounded-3xl border border-white/[0.08] bg-[var(--rah-surface)] p-5">
      <div className="flex items-center gap-4">
        <Ring value={pct} max={100} size={72} label={`${pct}%`} sub="drill" />
        <div>
          <div className="text-sm font-black text-[#f2f5fa]">{drill.title}</div>
          <div className="mt-0.5 text-xs text-[#8b96a9]">{finalScore}/{drill.items.length} correct</div>
          <FA className="mt-1 block text-xs">
            {pct >= 80 ? "عالی؛ همین مسیر را ادامه بده." : pct >= 50 ? "نیمه راه آمدی؛ غلط‌ها را مرور کن." : "غلط‌های امروز، تمرین فردای تو هستند."}
          </FA>
        </div>
      </div>
    </div>
  );
}

// One practice item: prompt, answer surface, feedback band, nav row.
function DrillPlay(props: {
  drill: Drill;
  idx: number;
  item: DrillItem;
  given: string;
  checkedCount: number;
  wasChecked: boolean;
  ok: boolean;
  setGiven: (v: string) => void;
  check: () => void;
  next: () => void;
}) {
  const { drill, idx, item, given, checkedCount, wasChecked, ok, setGiven, check, next } = props;
  const isLast = idx === drill.items.length - 1;
  return (
    <div className="rah-pop rounded-3xl border border-white/[0.08] bg-[var(--rah-surface)] p-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-[0.12em] text-(--accent-dim)">{drill.title} · {idx + 1}/{drill.items.length}</div>
        <Chip tone="slate">{checkedCount} checked</Chip>
      </div>
      <Bar value={idx + 1} max={drill.items.length} tone="cyan" />

      <div dir="ltr" className="mt-4 text-[15px] font-semibold leading-relaxed text-[#f2f5fa]">
        {item.q}
        {item.type !== "mcq" && <span className="ml-1 text-xs font-bold text-(--accent-dim)">({item.type})</span>}
      </div>

      <ItemInput item={item} given={given} wasChecked={wasChecked} setGiven={setGiven} check={check} next={next} />

      {wasChecked && (
        <div className={`mt-3 rounded-2xl border p-3.5 text-sm ${ok ? "border-[#3ccb7f]/25 bg-[#3ccb7f]/[0.07]" : "border-[#ff6b81]/25 bg-[#ff6b81]/[0.07]"}`}>
          <div className="flex items-center gap-2 font-black" dir="ltr">
            {ok ? <Check className="h-4 w-4 text-[#7fe0ac]" /> : <X className="h-4 w-4 text-[#ffa3b1]" />}
            <span className={ok ? "text-[#7fe0ac]" : "text-[#ffa3b1]"}>{ok ? "Correct" : `Answer: ${item.answer}`}</span>
          </div>
          {item.why && <div dir="ltr" className="mt-1.5 text-xs leading-relaxed text-[#b7c1d3]">{item.why}</div>}
          {item.fa && <FA className="mt-1 block text-xs leading-loose">{item.fa}</FA>}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        {!wasChecked ? (
          <Btn variant="primary" disabled={!given.trim()} onClick={check}>Check</Btn>
        ) : (
          <Btn variant={isLast ? "go" : "soft"} onClick={next}>
            {isLast ? "Finish" : "Next"} <ChevronRight className="h-4 w-4" />
          </Btn>
        )}
      </div>
    </div>
  );
}

// mcq buttons or the text input (Enter checks, then advances).
function ItemInput(props: {
  item: DrillItem;
  given: string;
  wasChecked: boolean;
  setGiven: (v: string) => void;
  check: () => void;
  next: () => void;
}) {
  const { item, given, wasChecked, setGiven, check, next } = props;
  if (item.type === "mcq" && item.choices) {
    return (
      <div className="mt-3 flex flex-col gap-2" dir="ltr">
        {item.choices.map((c) => (
          <button
            key={c}
            disabled={wasChecked}
            onClick={() => setGiven(c)}
            className={`rounded-2xl border-2 px-4 py-2.5 text-left text-sm font-semibold transition-all ${
              given === c ? "border-(--accent) bg-(--accent)/[0.12] text-[#cfe0ff]" : "border-[#2a3242] bg-[#141924] text-[#b7c1d3] hover:border-(--accent)/50"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
    );
  }
  return (
    <input
      dir="ltr"
      value={given}
      aria-label="Your answer"
      disabled={wasChecked}
      onChange={(e) => setGiven(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          if (wasChecked) next();
          else check();
        }
      }}
      placeholder="Your answer..."
      className="mt-3 min-h-12 w-full rounded-2xl border-2 border-[#2a3242] bg-[#141924] px-4 text-sm text-[#f2f5fa] outline-none transition-colors placeholder:text-[#8b96a9] focus:border-(--accent)"
    />
  );
}
