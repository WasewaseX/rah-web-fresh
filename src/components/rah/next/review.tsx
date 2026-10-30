"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Boot } from "@/app/page";
import { SectionTitle, Note, Fa } from "./bits";
import { answerEq, ivlLabel } from "@/lib/fsrs";

interface CardView {
  id: string;
  kind: string;
  skill: string;
  level: string;
  prompt: string;
  answer: string;
  alt: string[];
  en: string;
  fa: string;
  note: string;
  distractors: string[];
}
interface QueueItem {
  cardId: string;
  dir: string;
  fsrs: { s: number; d: number; due: number; last: number; laps: number; reps: number; state: string; lastivl: number };
  previews: number[];
  card: CardView;
  isNew: boolean;
}

const DIR_LABEL: Record<string, string> = {
  cloze: "Retrieve the missing word",
  ef: "Recall the Persian meaning",
  fae: "Produce the English chunk",
  sent: "Use it in your own sentence",
};

const GRADES = [
  { r: 1, label: "Again", key: "1", color: "var(--danger)" },
  { r: 2, label: "Hard", key: "2", color: "#b7791f" },
  { r: 3, label: "Good", key: "3", color: "var(--accent)" },
  { r: 4, label: "Easy", key: "4", color: "var(--accent-deep)" },
];

function Cloze({ text }: { text: string }) {
  const parts = text.split("___");
  return (
    <p className="text-[22px] leading-relaxed">
      {parts.map((p, i, arr) => (
        <span key={i}>
          {p}
          {i < arr.length - 1 ? <span className="inline-block w-24 border-b-2 mx-1" style={{ borderColor: "var(--accent)" }} /> : null}
        </span>
      ))}
    </p>
  );
}

export default function ReviewView({ boot, onDone, go }: { boot: Boot; onDone: () => void; go: (v: string) => void }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<"prompt" | "checked" | "reveal">("prompt");
  const [correct, setCorrect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState<null | { n: number; hit: number; secs: number }>(null);
  const startedAt = useRef(Date.now());
  const cardShownAt = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    fetch("/api/review/queue", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setItems(j.items ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const cur = items[idx];

  useEffect(() => {
    cardShownAt.current = Date.now();
    setInput("");
    setPhase("prompt");
    setCorrect(false);
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [idx]);

  const grade = useCallback(
    async (r: number) => {
      if (!cur) return;
      const wasCorrect = phase === "checked" ? correct : r >= 2;
      await fetch("/api/review/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: cur.cardId, dir: cur.dir, rating: r, tookMs: Date.now() - cardShownAt.current, correct: wasCorrect }),
      }).catch(() => undefined);
      // requeue "Again" inside this session after 5 cards
      if (r === 1) {
        setItems((xs) => {
          const copy = xs.slice();
          const relearn = { ...cur, previews: [1, 1, 2, 5] };
          const at = Math.min(copy.length, idx + 6);
          copy.splice(at, 0, relearn);
          return copy;
        });
      }
      if (idx + 1 >= items.length) {
        const secs = Math.round((Date.now() - startedAt.current) / 1000);
        const mins = Math.max(1, Math.min(30, Math.round(secs / 60)));
        fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "review", minutes: mins }),
        }).then(onDone).catch(() => onDone());
        setDone({ n: items.length, hit: gradeStats.current.hit, secs });
      } else {
        setIdx((i) => i + 1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cur, idx, items, phase, correct]
  );

  const gradeStats = useRef({ hit: 0, n: 0 });
  useEffect(() => {
    if (phase === "checked") {
      gradeStats.current.n += 1;
      if (correct) gradeStats.current.hit += 1;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const check = useCallback(() => {
    if (!cur || phase !== "prompt") return;
    const c = cur.card;
    if (cur.dir === "cloze") {
      const ok = answerEq(input, c.answer, c.alt);
      setCorrect(ok);
      if (ok) gradeStats.current.hit += 1;
      gradeStats.current.n += 1;
      setPhase("checked");
    } else if (cur.dir === "fae") {
      const ok = answerEq(input, c.answer, [...c.alt, c.en]);
      setCorrect(ok);
      if (ok) gradeStats.current.hit += 1;
      gradeStats.current.n += 1;
      setPhase("checked");
    } else {
      setPhase("reveal");
    }
  }, [cur, input, phase]);

  // keyboard: 1-4 to grade when checked/revealed
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (phase === "prompt" && e.key === "Enter") {
        e.preventDefault();
        check();
      } else if ((phase === "checked" || phase === "reveal") && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        grade(Number(e.key));
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [phase, check, grade]);

  if (loading) {
    return <div className="py-20 text-center text-[14px]" style={{ color: "var(--muted)" }}>building today&apos;s queue...</div>;
  }

  if (done) {
    const acc = done.n ? Math.round((gradeStats.current.hit / Math.max(1, gradeStats.current.n)) * 100) : 0;
    return (
      <div className="max-w-xl mx-auto text-center pt-10">
        <div className="display text-[34px] font-bold mb-2">Session done</div>
        <p className="text-[14px] mb-8" style={{ color: "var(--muted)" }}>
          Retrieval is the workout. The schedule is already adjusted for what you found hard.
        </p>
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="card-rah p-5">
            <div className="display text-[26px] font-bold">{done.n}</div>
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>cards retrieved</div>
          </div>
          <div className="card-rah p-5">
            <div className="display text-[26px] font-bold" style={{ color: "var(--accent)" }}>{acc}%</div>
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>recalled without help</div>
          </div>
          <div className="card-rah p-5">
            <div className="display text-[26px] font-bold">{Math.floor(done.secs / 60)}:{String(done.secs % 60).padStart(2, "0")}</div>
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>time on task</div>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <button className="btn-primary" onClick={() => go("today")}>Back to today</button>
          <button className="btn-ghost" onClick={() => window.location.reload()}>More cards</button>
        </div>
      </div>
    );
  }

  if (!cur) {
    return (
      <div className="max-w-xl mx-auto text-center pt-16">
        <div className="display text-[30px] font-bold mb-2">Nothing is due. That is the schedule working.</div>
        <p className="text-[14px] mb-8 leading-relaxed" style={{ color: "var(--muted)" }}>
          FSRS-5 spaced the next retrievals into the future. Come back tomorrow, or train another strand now: listening
          decoding, speaking, writing repair. They all feed the same memory.
        </p>
        <button className="btn-primary" onClick={() => go("today")}>Back to today</button>
      </div>
    );
  }

  const c = cur.card;
  const shownPct = Math.round(((idx + 1) / Math.max(1, items.length)) * 100);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="chip chip-accent">{c.skill}</span>
          <span className="chip">{c.level}</span>
          {cur.isNew ? <span className="chip" style={{ background: "var(--amber-dim)", color: "#8a5a12", borderColor: "transparent" }}>new</span> : null}
        </div>
        <span className="text-[12.5px] font-semibold" style={{ color: "var(--muted)" }}>
          {idx + 1} / {items.length}
        </span>
      </div>

      <div className="h-1.5 rounded-full overflow-hidden mb-6" style={{ background: "#efeee7" }}>
        <div className="h-full transition-all" style={{ width: `${shownPct}%`, background: "var(--accent)" }} />
      </div>

      <div className="text-[12.5px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--accent-deep)" }}>
        {DIR_LABEL[cur.dir] ?? cur.dir}
      </div>

      <div className="card-rah p-8">
        {cur.dir === "cloze" && (
          <>
            <Cloze text={c.prompt} />
            {phase === "prompt" ? (
              <div className="mt-6">
                <input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  value={input}
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
            ) : null}
          </>
        )}

        {cur.dir === "ef" && (
          <>
            <p className="text-[26px] display font-bold">{c.en}</p>
            {c.prompt && c.prompt !== c.en && c.kind === "ef" ? <p className="text-[13.5px] mt-1" style={{ color: "var(--muted)" }}>from: {c.prompt.replace("___", c.answer)}</p> : null}
            {phase === "prompt" ? (
              <div className="mt-5">
                <button className="btn-primary" onClick={() => { setPhase("reveal"); gradeStats.current.n += 1; }}>
                  I said it, show the answer
                </button>
                <div className="mt-3 text-[12.5px]" style={{ color: "var(--muted)" }}>
                  Say the Persian meaning out loud first. Grading yourself honestly is the whole game.
                </div>
              </div>
            ) : null}
          </>
        )}

        {cur.dir === "fae" && (
          <>
            <p className="fa-text text-[24px] font-bold leading-relaxed">{c.fa}</p>
            <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>produce the English chunk</p>
            {phase === "prompt" ? (
              <div className="mt-6">
                <input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="cloze-input text-[17px]"
                  placeholder="type the English"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                <div className="mt-4 text-[12.5px]" style={{ color: "var(--muted)" }}>
                  Press <span className="kbd">Enter</span> to check. Minor spelling is forgiven, wrong words are not.
                </div>
              </div>
            ) : null}
          </>
        )}

        {cur.dir === "sent" && (
          <>
            <p className="text-[24px] display font-bold">{c.en}</p>
            <p className="text-[13.5px] mt-1" style={{ color: "var(--muted)" }}>{c.fa ? <Fa>{c.fa}</Fa> : null}</p>
            <div className="mt-5">
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full rounded-2xl border p-4 min-h-[110px] text-[15.5px] leading-relaxed"
                style={{ borderColor: "var(--line)", background: "#fff", outline: "none" }}
                placeholder="Write one natural sentence that uses it. Make it about your own life so it sticks."
              />
              <div className="mt-3">
                <button className="btn-primary" onClick={() => { setPhase("reveal"); gradeStats.current.n += 1; }}>
                  Done, show usage note
                </button>
              </div>
            </div>
          </>
        )}

        {/* feedback zone */}
        {phase === "checked" && (
          <div className="mt-6">
            {correct ? (
              <Note tone="accent">
                <b>{c.answer}</b> is right. {c.note}
              </Note>
            ) : (
              <Note tone="error">
                <b>{c.answer}</b> was the target, you wrote <b>{input || "nothing"}</b>. {c.note}
              </Note>
            )}
            {c.fa ? <div className="mt-3 fa-text text-[15px]" style={{ color: "var(--muted)" }}>{c.fa}</div> : null}
          </div>
        )}
        {phase === "reveal" && (
          <div className="mt-6">
            <Note>
              {c.fa ? <span dir="rtl" className="inline-block text-[15px]">{c.fa}</span> : null}
              {c.note ? <div className={c.fa ? "mt-1" : ""}>{c.note}</div> : null}
            </Note>
          </div>
        )}

        {/* grade bar */}
        {(phase === "checked" || phase === "reveal") && (
          <div className="grid grid-cols-4 gap-2 mt-6">
            {GRADES.map((g) => (
              <button
                key={g.r}
                onClick={() => grade(g.r)}
                className="rounded-2xl border py-3 text-center transition-transform active:scale-95"
                style={{ borderColor: "var(--line)", background: "#fff" }}
              >
                <div className="text-[14px] font-bold" style={{ color: g.color }}>{g.label}</div>
                <div className="text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>{ivlLabel(cur.previews[g.r - 1])}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 text-[12px] text-center" style={{ color: "var(--muted)" }}>
        stability {cur.fsrs.s ? cur.fsrs.s.toFixed(1) : "new"} · difficulty {cur.fsrs.d ? cur.fsrs.d.toFixed(1) : "new"} · grades advance the schedule, <span className="kbd">1</span> to <span className="kbd">4</span>
      </div>
    </div>
  );
}
