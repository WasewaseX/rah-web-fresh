"use client";

import { Check, GraduationCap, PenLine, Target, X } from "lucide-react";
import { Bar, Btn, Chip, FA, Note, Ring } from "../../../ui";

type CoachResult = NonNullable<import("@/lib/tutor/types").CoachEnvelope["result"]>;

// ============================ RESULT CARD ============================

export function ResultCard({
  result, onDrillWeak, onNewExam, busy,
}: {
  result: CoachResult;
  onDrillWeak: () => void;
  onNewExam: () => void;
  busy: boolean;
}) {
  const tone = result.percent >= 75 ? "emerald" : result.percent >= 50 ? "amber" : "rose";
  return (
    <div className="rah-pop rounded-3xl border border-white/[0.08] bg-[var(--rah-surface)] p-5">
      <div className="flex flex-wrap items-center gap-4">
        <Ring value={result.percent} max={100} size={84} label={`${result.percent}%`} sub="exam" />
        <div className="min-w-40 flex-1">
          <div className="text-sm font-black tracking-tight text-[#f2f5fa]">{result.title}</div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Chip tone="blue">Band {result.band}</Chip>
            <Chip tone={tone}>{result.score}/{result.total}</Chip>
          </div>
        </div>
      </div>

      {result.write_eval && result.write_eval.note && (
        <div className="mt-4">
          <Note tone="amber">
            <span className="font-bold">Writing {result.write_eval.score}/10. </span>
            {result.write_eval.note}
            <FA className="mt-1 block text-xs leading-loose">{result.write_eval.fa}</FA>
          </Note>
        </div>
      )}

      {result.dimensions && <ResultDims result={result} />}
      {(result.strengths.length > 0 || result.weaknesses.length > 0) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {result.strengths.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7fe0ac]">Strengths</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {result.strengths.map((s, i) => <Chip key={i} tone="emerald">{s}</Chip>)}
              </div>
            </div>
          )}
          {result.weaknesses.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#ffd08a]">Weak spots</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {result.weaknesses.map((s, i) => <Chip key={i} tone="amber">{s}</Chip>)}
              </div>
            </div>
          )}
        </div>
      )}

      {result.leaks.length > 0 && <ResultLeaks result={result} />}
      {result.items.length > 0 && <ResultItems result={result} />}

      {result.next_action && (
        <div className="mt-4">
          <Note tone="blue">
            <span className="font-bold">Next: </span>{result.next_action}
          </Note>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Btn variant="primary" disabled={busy} onClick={onDrillWeak} className="text-xs">
          <Target className="h-4 w-4" /> Drill my weak spots
        </Btn>
        <Btn variant="soft" disabled={busy} onClick={onNewExam} className="text-xs">
          <GraduationCap className="h-4 w-4" /> New full exam
        </Btn>
      </div>
    </div>
  );
}

// The four per-skill dimension bars.
function ResultDims({ result }: { result: CoachResult }) {
  return (
    <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {(["vocabulary", "grammar", "reading", "writing"] as const).map((k) => {
        const v = result.dimensions![k] ?? 0;
        return (
          <div key={k} className="flex items-center gap-3">
            <span dir="ltr" className="w-20 shrink-0 text-xs font-bold capitalize text-[#a9b4c6]">{k}</span>
            <Bar value={v} max={100} tone={v >= 72 ? "emerald" : v >= 50 ? "blue" : "amber"} />
            <span className="w-8 shrink-0 text-right text-xs font-black text-[#f2f5fa]">{v}</span>
          </div>
        );
      })}
    </div>
  );
}

// The trap "leak" cards.
function ResultLeaks({ result }: { result: CoachResult }) {
  return (
    <div className="mt-4 flex flex-col gap-2">
      {result.leaks.map((l, i) => (
        <div key={i} className="rounded-2xl border border-[#ffb02e]/20 bg-[#ffb02e]/[0.05] p-3 text-sm">
          <span className="font-bold text-[#ffd08a]">{l.trap.replace(/_/g, " ")}</span>
          <span dir="ltr" className="ml-2 text-[#b7c1d3]">{l.note}</span>
          <FA className="mt-1 block text-xs leading-loose">{l.fa}</FA>
        </div>
      ))}
    </div>
  );
}

// Question-by-question review, collapsed behind <details>.
function ResultItems({ result }: { result: CoachResult }) {
  return (
    <details className="mt-4 rounded-2xl border border-white/[0.06] bg-[#141924] p-4">
      <summary className="cursor-pointer text-sm font-bold text-[#b7c1d3]">Question-by-question review</summary>
      <div className="mt-3 flex flex-col gap-3">
        {result.items.map((it) => {
          const accepted = it.verdict === "typo" || (it.verdict === "accepted" && it.type !== "write");
          return (
            <div key={it.qid} className="rounded-xl bg-white/[0.03] p-3 text-sm">
              <div className="flex items-start gap-2" dir="ltr">
                {it.type === "write" ? (
                  <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-[#ffd08a]" />
                ) : it.ok ? (
                  <Check className={`mt-0.5 h-4 w-4 shrink-0 ${accepted ? "text-[#9de6fb]" : "text-[#7fe0ac]"}`} />
                ) : (
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-[#ffa3b1]" />
                )}
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[#e7ecf5]">{it.q.slice(0, 160)}</div>
                  <div className="mt-1 text-xs text-[#8b96a9]">
                    You: <span className={it.ok ? (accepted ? "text-[#9de6fb]" : "text-[#7fe0ac]") : "text-[#ffa3b1]"}>{it.given || "(blank)"}</span>
                    {!it.ok && it.type !== "write" && <> · Expected: <span className="text-[#7fe0ac]">{it.expected}</span></>}
                    {accepted && it.expected && <span className="ml-1.5 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold text-[#9de6fb]">{it.verdict === "typo" ? "spelling" : "accepted"} · key: {it.expected}</span>}
                  </div>
                  {(it.note || it.why) && <div className="mt-1 text-xs leading-relaxed text-[#a9b4c6]">{it.note || it.why}</div>}
                  {!it.ok && it.fa && <FA className="mt-1 block text-xs leading-loose">{it.fa}</FA>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
