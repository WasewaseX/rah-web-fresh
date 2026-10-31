"use client";

import { useMemo, useState } from "react";
import type { Boot } from "@/app/page";
import { SectionTitle, Note, Bar } from "./bits";
import { PLACEMENT } from "@/lib/content";

interface Result {
  level: string;
  correct: number;
  total: number;
  strands: Record<string, number>;
  traps: Record<string, number>;
  ai: Record<string, unknown> | null;
}

const TRAP_LABELS: Record<string, string> = {
  articles: "articles",
  countability: "countability",
  perfect: "present perfect vs past",
  question_order: "embedded question order",
  prepositions: "prepositions",
  statives: "state verbs",
  conditionals: "conditionals",
  copula: "missing verb to be",
  that_omission: "missing subject it",
  adjectives: "adjective order",
};

export default function PlacementView({ boot, onDone, go }: { boot: Boot; onDone: () => void; go: (v: string) => void }) {
  const [step, setStep] = useState(0); // 0=intro, 1..n questions, n+1 writing, n+2 result
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [writing, setWriting] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const items = useMemo(() => PLACEMENT.items, []);
  const qIndex = step - 1;
  const inQuestions = step >= 1 && step <= items.length;
  const inWriting = step === items.length + 1;

  const pick = (id: string, choice: string) => {
    setAnswers((a) => ({ ...a, [id]: choice }));
    setTimeout(() => setStep((s) => s + 1), 160);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, writing }),
      });
      const j = await r.json();
      setResult(j);
      setStep(items.length + 2);
      onDone();
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const strandLabels: Record<string, string> = { grammar: "Grammar", vocab: "Vocabulary", collocation: "Collocation", reading: "Reading" };
    return (
      <div className="max-w-2xl mx-auto">
        <SectionTitle title={`Placed at ${result.level}`} sub={`${result.correct} of ${result.total} questions correct.`} />
        <div className="card-rah p-6 mb-4">
          <div className="font-bold mb-3 text-[15px]">Accuracy by strand</div>
          {Object.entries(result.strands).map(([k, v]) => (
            <div key={k} className="mb-3">
              <div className="flex justify-between text-[13px] mb-1">
                <span className="font-semibold">{strandLabels[k] ?? k}</span>
                <span style={{ color: "var(--muted)" }}>{v}%</span>
              </div>
              <Bar pct={v} />
            </div>
          ))}
        </div>
        {result.ai ? (
          <div className="card-rah p-5 mb-4">
            <div className="font-bold text-[14px] mb-1">AI writing examiner</div>
            <p className="text-[13.5px]" style={{ color: "var(--muted)" }}>
              {String((result.ai as { reasons?: string }).reasons ?? "")}
            </p>
          </div>
        ) : writing.trim().length > 40 ? (
          <Note>Connect an AI provider to also have your writing sample placed by the examiner.</Note>
        ) : null}
        {Object.keys(result.traps).length ? (
          <div className="card-rah p-5 mb-4">
            <div className="font-bold text-[14px] mb-2">Farsi interference signals detected</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(result.traps).map(([t, n]) => (
                <span key={t} className="chip" title={`${n} miss`}>{TRAP_LABELS[t] ?? t}</span>
              ))}
            </div>
          </div>
        ) : null}
        <Note tone="accent">
          Your daily plan now gives extra minutes to the weakest strand. Review runs every day; the checkpoint every two to
          four weeks re-measures the real thing.
        </Note>
        <div className="text-center mt-6">
          <button className="btn-primary" onClick={() => go("today")}>
            Go to today&apos;s plan
          </button>
        </div>
      </div>
    );
  }

  if (inQuestions) {
    const it = items[qIndex];
    const pct = Math.round((qIndex / items.length) * 100);
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="chip">{it.sec}</span>
          <span className="text-[12.5px] font-semibold" style={{ color: "var(--muted)" }}>
            {qIndex + 1} / {items.length}
          </span>
        </div>
        <div className="mb-5"><Bar pct={pct} /></div>
        <div className="card-rah p-8">
          {qIndex === 0 ? <p className="text-[13px] mb-4" style={{ color: "var(--muted)" }}>Answer fast, no second guesses. Wrong answers tell Rah more than slow right ones.</p> : null}
          {it.q.includes("___") ? (
            <p className="text-[19px] leading-relaxed mb-6">{it.q.split("___").map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 ? <span className="inline-block w-16 border-b-2 mx-1" style={{ borderColor: "var(--accent)" }} /> : null}
              </span>
            ))}</p>
          ) : (
            <p className="text-[19px] leading-relaxed mb-6">{it.q}</p>
          )}
          <div className="grid gap-2.5">
            {it.choices.map((c) => {
              const chosen = answers[it.id] === c;
              return (
                <button
                  key={c}
                  onClick={() => pick(it.id, c)}
                  className="text-left rounded-2xl border px-5 py-3.5 text-[15px] font-medium transition-colors"
                  style={chosen ? { background: "var(--ink)", color: "#fff", borderColor: "transparent" } : { borderColor: "var(--line)" }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex justify-between mt-4">
          <button className="btn-ghost text-[13px]" onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</button>
          <button className="text-[13px] font-semibold" style={{ color: "var(--muted)" }} onClick={() => setStep(items.length + 1)}>
            Skip the test, start at B2
          </button>
        </div>
      </div>
    );
  }

  if (inWriting) {
    const prompt = PLACEMENT.prompts[0];
    const words = writing.split(/\s+/).filter(Boolean).length;
    return (
      <div className="max-w-2xl mx-auto">
        <SectionTitle title="One writing sample" sub="Optional but valuable: the AI examiner places writing more precisely than multiple choice. About 200 words." />
        <div className="card-rah p-6">
          <p className="text-[15.5px] leading-relaxed mb-4">{prompt}</p>
          <textarea
            value={writing}
            onChange={(e) => setWriting(e.target.value)}
            className="w-full rounded-2xl border p-4 min-h-[220px] text-[15px] leading-relaxed"
            style={{ borderColor: "var(--line)", background: "var(--rah-field)", outline: "none" }}
            placeholder="Write here. Take a position and defend it with two reasons."
          />
          <div className="flex justify-between items-center mt-3">
            <span className="text-[12.5px]" style={{ color: "var(--muted)" }}>{words} words</span>
            <button className="btn-primary" disabled={busy} onClick={submit}>
              {busy ? "Scoring..." : "Finish and see results"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // intro
  return (
    <div className="max-w-2xl mx-auto text-center pt-6">
      <div className="display text-[34px] font-bold leading-tight mb-3">Where is your English, exactly?</div>
      <p className="text-[14.5px] leading-relaxed mb-8 max-w-lg mx-auto" style={{ color: "var(--muted)" }}>
        25 questions across grammar, vocabulary, collocation and reading, then one optional writing sample. No studying
        first, guessing is fine. The result sets your level, exposes Farsi interference patterns, and re-weights your daily
        plan toward the weakest strand.
      </p>
      <div className="card-rah p-6 text-left mb-8">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="display text-[24px] font-bold">25</div>
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>questions</div>
          </div>
          <div>
            <div className="display text-[24px] font-bold">~15</div>
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>minutes</div>
          </div>
          <div>
            <div className="display text-[24px] font-bold">B1 to C1</div>
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>CEFR range</div>
          </div>
        </div>
      </div>
      <button className="btn-primary text-[15px] px-8 py-3" onClick={() => setStep(1)}>
        Start the placement test
      </button>
      <div className="mt-4">
        <button className="text-[13px] font-semibold" style={{ color: "var(--muted)" }} onClick={() => go("today")}>
          Later
        </button>
      </div>
    </div>
  );
}
