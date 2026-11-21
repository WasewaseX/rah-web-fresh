"use client";

import { useEffect, useState } from "react";
import { SectionTitle, Note, Fa } from "./bits";
import { GRAMMAR_LESSONS } from "@/lib/content";
import { answerEq } from "@/lib/fsrs";

type Lesson = (typeof GRAMMAR_LESSONS)[number];

async function markLessonDone(id: string, setDone: (f: (s: Set<string>) => Set<string>) => void, onDone: () => void) {
  await fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "grammar", lessonId: id, minutes: 10 }),
  }).catch(() => undefined);
  setDone((s) => new Set([...s, id]));
  onDone();
}

function LessonHeader({ lesson, onBack }: { lesson: Lesson; onBack: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="chip chip-accent">{lesson.trap}</span>
        <span className="chip">5 minute lesson</span>
      </div>
      <button className="text-[12.5px] font-semibold" style={{ color: "var(--muted)" }} onClick={onBack}>
        all lessons
      </button>
    </div>
  );
}

function StepDots({ step, setStep }: { step: number; setStep: (n: number) => void }) {
  return (
    <div className="flex gap-1.5 mb-5">
      {["Notice", "Rule", "Retrieve", "Produce"].map((s, i) => (
        <button
          key={s}
          onClick={() => setStep(i)}
          className="text-[12.5px] font-bold rounded-full px-3.5 py-1.5 transition-colors"
          style={step === i ? { background: "var(--rah-callout-hover)", color: "var(--ink)", border: "1px solid rgba(255, 255, 255, 0.18)" } : { background: "var(--rah-field)", color: "var(--muted)", border: "1px solid var(--line)" }}
        >
          {i + 1}. {s}
        </button>
      ))}
    </div>
  );
}

function NoticeStep({ lesson, onNext }: { lesson: Lesson; onNext: () => void }) {
  return (
    <div className="card-rah p-8">
      <div className="display text-[19px] font-bold mb-4">Notice the difference</div>
      {lesson.notice.map((n, i) => (
        <div key={i} className="rounded-xl border p-4 mb-3" style={{ borderColor: "var(--line)" }}>
          <div className="text-[14.5px]" style={{ color: "var(--danger)" }}>{n.bad}</div>
          <div className="text-[14.5px] font-bold" style={{ color: "var(--accent-deep)" }}>{n.good}</div>
        </div>
      ))}
      <div className="fa-text text-[14px] mt-2">{lesson.fa}</div>
      <button className="btn-primary mt-5" onClick={onNext}>Next: the rule</button>
    </div>
  );
}

function RuleStep({ lesson, onNext }: { lesson: Lesson; onNext: () => void }) {
  return (
    <div className="card-rah p-8">
      <div className="display text-[19px] font-bold mb-3">The rule, briefly</div>
      <p className="text-[15.5px] leading-[1.85] mb-4">{lesson.rule}</p>
      <Note tone="warn">Five minutes of understanding, then straight to retrieval. Grammar pages read at midnight never auto-correct your speech; retrieval does.</Note>
      <button className="btn-primary mt-5" onClick={onNext}>Next: retrieve</button>
    </div>
  );
}

function RetrieveStep({ lesson, inputs, setInputs, reveal, setReveal, onNext }: {
  lesson: Lesson;
  inputs: Record<number, string>;
  setInputs: (f: (x: Record<number, string>) => Record<number, string>) => void;
  reveal: Record<number, boolean>;
  setReveal: (f: (x: Record<number, boolean>) => Record<number, boolean>) => void;
  onNext: () => void;
}) {
  return (
    <div className="card-rah p-8">
      <div className="display text-[19px] font-bold mb-4">Retrieve without looking up</div>
      {lesson.retrieve.map((r, i) => (
        <div key={i} className="mb-5">
          <div className="text-[15px] mb-2">{r.q}</div>
          <div className="flex gap-2 items-center">
            <input
              value={inputs[i] ?? ""}
              aria-label={r.q}
              onChange={(e) => setInputs((x) => ({ ...x, [i]: e.target.value }))}
              className="flex-1 rounded-xl border px-4 py-2.5 text-[14.5px]"
              style={{ borderColor: "var(--line)", background: "var(--rah-field)", outline: "none" }}
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
      <button className="btn-primary" onClick={onNext}>Next: produce</button>
    </div>
  );
}

function ProduceStep({ lesson, prodDone, setProdDone, onBack, onComplete }: {
  lesson: Lesson;
  prodDone: Record<number, boolean>;
  setProdDone: (f: (x: Record<number, boolean>) => Record<number, boolean>) => void;
  onBack: () => void;
  onComplete: () => void;
}) {
  return (
    <div className="card-rah p-8">
      <div className="display text-[19px] font-bold mb-1">Produce out loud or in writing</div>
      <p className="text-[13.5px] mb-4" style={{ color: "var(--muted)" }}>
        Say each one, or write it. Ten quick variations move a rule from conscious knowledge to fast access.
      </p>
      {lesson.produce.map((p, i) => (
        <label key={i} className="flex items-start gap-3 rounded-xl border p-4 mb-2 cursor-pointer" style={{ borderColor: "var(--line)" }}>
          <input
            type="checkbox"
            aria-label="Practiced out loud"
            checked={prodDone[i] ?? false}
            onChange={(e) => setProdDone((x) => ({ ...x, [i]: e.target.checked }))}
            className="mt-1"
          />
          <span className="text-[14.5px]">{p}</span>
        </label>
      ))}
      <div className="flex items-center justify-between mt-5">
        <button className="text-[12.5px] font-semibold" style={{ color: "var(--muted)" }} onClick={onBack}>back to lessons</button>
        <button className="btn-primary" disabled={!Object.values(prodDone).every(Boolean) || prodDone[0] === undefined} onClick={onComplete}>
          Mark lesson complete
        </button>
      </div>
    </div>
  );
}

function LessonCard({ l, done, onOpen }: { l: Lesson; done: boolean; onOpen: () => void }) {
  return (
    <button
      className="card-rah p-5 text-left hover:shadow-md transition-shadow"
      onClick={onOpen}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="chip chip-accent">{l.trap}</span>
        {done ? <span className="chip" style={{ background: "var(--accent-dim)", color: "var(--accent-deep)", borderColor: "transparent" }}>done</span> : null}
      </div>
      <div className="font-bold text-[15.5px]">{l.title}</div>
      <Fa className="text-[13px] mt-1 block">{l.fa}</Fa>
    </button>
  );
}

export default function GrammarView({ onDone }: { onDone: () => void }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string>("");
  const [step, setStep] = useState(0); // 0 notice, 1 rule, 2 retrieve, 3 produce
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [reveal, setReveal] = useState<Record<number, boolean>>({});
  const [prodDone, setProdDone] = useState<Record<number, boolean>>({});

  useEffect(() => {
    // fetch done lessons via checkpoint-less endpoint: reuse /api/writing? Use /api/ai? Simpler: /api/bootstrap stats only.
    // Full done set comes from the lesson list endpoint:
    fetch("/api/grammar")
      .then((r) => (r.ok ? r.json() : { done: [] }))
      .then((j) => setDone(new Set(j.done ?? [])))
      .catch(() => undefined);
  }, []);

  const lesson = GRAMMAR_LESSONS.find((l) => l.id === openId);
  const back = () => {
    setOpenId("");
    setStep(0);
  };
  const open = (id: string) => {
    setOpenId(id);
    setStep(0);
    setInputs({});
    setReveal({});
    setProdDone({});
  };
  const complete = (id: string) => void markLessonDone(id, setDone, onDone);

  if (lesson) {
    return (
      <div className="max-w-3xl mx-auto">
        <LessonHeader lesson={lesson} onBack={back} />
        <h2 className="display text-[26px] font-bold mb-4">{lesson.title}</h2>
        <StepDots step={step} setStep={setStep} />
        {step === 0 && <NoticeStep lesson={lesson} onNext={() => setStep(1)} />}
        {step === 1 && <RuleStep lesson={lesson} onNext={() => setStep(2)} />}
        {step === 2 && (
          <RetrieveStep lesson={lesson} inputs={inputs} setInputs={setInputs} reveal={reveal} setReveal={setReveal} onNext={() => setStep(3)} />
        )}
        {step === 3 && (
          <ProduceStep lesson={lesson} prodDone={prodDone} setProdDone={setProdDone} onBack={back} onComplete={() => complete(lesson.id)} />
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
          <LessonCard key={l.id} l={l} done={done.has(l.id)} onOpen={() => open(l.id)} />
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
