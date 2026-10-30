"use client";

import { useEffect, useState } from "react";
import { SectionTitle, Note, Fa } from "./bits";
import { GRAMMAR_LESSONS } from "@/lib/content";
import { answerEq } from "@/lib/fsrs";

export default function GrammarView({ onDone }: { onDone: () => void }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string>("");
  const [step, setStep] = useState(0); // 0 notice, 1 rule, 2 retrieve, 3 produce
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [reveal, setReveal] = useState<Record<number, boolean>>({});
  const [prodDone, setProdDone] = useState<Record<number, boolean>>({});

  const load = () => {
    fetch("/api/bootstrap")
      .then((r) => r.json())
      .then(() => {
        // bootstrap carries only a count; fetch full list from track? keep client list
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    // fetch done lessons via checkpoint-less endpoint: reuse /api/writing? Use /api/ai? Simpler: /api/bootstrap stats only.
    // Full done set comes from the lesson list endpoint:
    fetch("/api/grammar")
      .then((r) => (r.ok ? r.json() : { done: [] }))
      .then((j) => setDone(new Set(j.done ?? [])))
      .catch(() => undefined);
  }, []);

  const lesson = GRAMMAR_LESSONS.find((l) => l.id === openId);

  const markDone = async (id: string) => {
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "grammar", lessonId: id, minutes: 10 }),
    }).catch(() => undefined);
    setDone((s) => new Set([...s, id]));
    onDone();
  };

  if (lesson) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="chip chip-accent">{lesson.trap}</span>
            <span className="chip">5 minute lesson</span>
          </div>
          <button className="text-[12.5px] font-semibold" style={{ color: "var(--muted)" }} onClick={() => { setOpenId(""); setStep(0); }}>
            all lessons
          </button>
        </div>
        <h2 className="display text-[26px] font-bold mb-4">{lesson.title}</h2>

        <div className="flex gap-1.5 mb-5">
          {["Notice", "Rule", "Retrieve", "Produce"].map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(i)}
              className="text-[12.5px] font-bold rounded-full px-3.5 py-1.5 transition-colors"
              style={step === i ? { background: "var(--ink)", color: "#fff" } : { background: "#fff", color: "var(--muted)", border: "1px solid var(--line)" }}
            >
              {i + 1}. {s}
            </button>
          ))}
        </div>

        {step === 0 && (
          <div className="card-rah p-8">
            <div className="display text-[19px] font-bold mb-4">Notice the difference</div>
            {lesson.notice.map((n, i) => (
              <div key={i} className="rounded-xl border p-4 mb-3" style={{ borderColor: "var(--line)" }}>
                <div className="text-[14.5px]" style={{ color: "var(--danger)" }}>{n.bad}</div>
                <div className="text-[14.5px] font-bold" style={{ color: "var(--accent-deep)" }}>{n.good}</div>
              </div>
            ))}
            <div className="fa-text text-[14px] mt-2">{lesson.fa}</div>
            <button className="btn-primary mt-5" onClick={() => setStep(1)}>Next: the rule</button>
          </div>
        )}

        {step === 1 && (
          <div className="card-rah p-8">
            <div className="display text-[19px] font-bold mb-3">The rule, briefly</div>
            <p className="text-[15.5px] leading-[1.85] mb-4">{lesson.rule}</p>
            <Note tone="warn">Five minutes of understanding, then straight to retrieval. Grammar pages read at midnight never auto-correct your speech; retrieval does.</Note>
            <button className="btn-primary mt-5" onClick={() => setStep(2)}>Next: retrieve</button>
          </div>
        )}

        {step === 2 && (
          <div className="card-rah p-8">
            <div className="display text-[19px] font-bold mb-4">Retrieve without looking up</div>
            {lesson.retrieve.map((r, i) => (
              <div key={i} className="mb-5">
                <div className="text-[15px] mb-2">{r.q}</div>
                <div className="flex gap-2 items-center">
                  <input
                    value={inputs[i] ?? ""}
                    onChange={(e) => setInputs((x) => ({ ...x, [i]: e.target.value }))}
                    className="flex-1 rounded-xl border px-4 py-2.5 text-[14.5px]"
                    style={{ borderColor: "var(--line)", background: "#fff", outline: "none" }}
                    placeholder="type your answer"
                  />
                  <button
                    className="btn-ghost text-[12.5px]"
                    onClick={() => setReveal((x) => ({ ...x, [i]: true }))}
                  >
                    check
                  </button>
                </div>
                {reveal[i] ? (
                  <div className="mt-2 text-[13.5px] font-semibold" style={{ color: answerEq(inputs[i] ?? "", r.a) ? "var(--accent-deep)" : "var(--danger)" }}>
                    {answerEq(inputs[i] ?? "", r.a) ? "correct" : "target"}: {r.a}
                  </div>
                ) : null}
              </div>
            ))}
            <button className="btn-primary" onClick={() => setStep(3)}>Next: produce</button>
          </div>
        )}

        {step === 3 && (
          <div className="card-rah p-8">
            <div className="display text-[19px] font-bold mb-1">Produce out loud or in writing</div>
            <p className="text-[13.5px] mb-4" style={{ color: "var(--muted)" }}>
              Say each one, or write it. Ten quick variations move a rule from conscious knowledge to fast access.
            </p>
            {lesson.produce.map((p, i) => (
              <label key={i} className="flex items-start gap-3 rounded-xl border p-4 mb-2 cursor-pointer" style={{ borderColor: "var(--line)" }}>
                <input
                  type="checkbox"
                  checked={prodDone[i] ?? false}
                  onChange={(e) => setProdDone((x) => ({ ...x, [i]: e.target.checked }))}
                  className="mt-1"
                />
                <span className="text-[14.5px]">{p}</span>
              </label>
            ))}
            <div className="flex items-center justify-between mt-5">
              <button className="text-[12.5px] font-semibold" style={{ color: "var(--muted)" }} onClick={() => { setOpenId(""); setStep(0); }}>back to lessons</button>
              <button className="btn-primary" disabled={!Object.values(prodDone).every(Boolean) || prodDone[0] === undefined} onClick={() => markDone(lesson.id)}>
                Mark lesson complete
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <SectionTitle
        title="Grammar gym"
        sub="Not grammar worship, not grammar avoidance. Notice, understand for five minutes, retrieve, produce. Then back to real input."
      />
      <div className="grid md:grid-cols-2 gap-4">
        {GRAMMAR_LESSONS.map((l) => (
          <button
            key={l.id}
            className="card-rah p-5 text-left hover:shadow-md transition-shadow"
            onClick={() => { setOpenId(l.id); setStep(0); setInputs({}); setReveal({}); setProdDone({}); }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="chip chip-accent">{l.trap}</span>
              {done.has(l.id) ? <span className="chip" style={{ background: "var(--accent-dim)", color: "var(--accent-deep)", borderColor: "transparent" }}>done</span> : null}
            </div>
            <div className="font-bold text-[15.5px]">{l.title}</div>
            <Fa className="text-[13px] mt-1 block">{l.fa}</Fa>
          </button>
        ))}
      </div>
      <div className="mt-5">
        <Note>
          Every lesson here maps to a Farsi interference trap the placement test and the AI tutor watch for. Fixing these
          clears more B2 fog than any grammar book chapter.
        </Note>
      </div>
    </div>
  );
}
