"use client";

// Review: the multi-direction retrieval loop. One item, many roads in:
// gap-fill, reverse translate, Farsi→English, audio dictation, word-bank
// build, meaning choice, produce-English, self-graded recall. FSRS-5
// schedules what comes back and when.
//
// Task 106 (contract repair): this recovered component still spoke the OLD
// generation's wire format - it read `items` from /api/review/queue (the live
// route answers `batch`), so the daily loop showed a false "Nothing is due"
// with 18 cards waiting; it POSTed `rating` where the grade route reads
// `grade` (every grade silently defaulted to Good); and five of the eight
// retrieval directions had no renderer at all. Rewritten against the live
// contract, keeping the recovered midnight-shell visual language. The dir
// renderers, acceptability check and offline-grade flow are ported from the
// proven pre-recovery implementation (git 5fecac8^ Review.tsx).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Boot } from "@/app/page";
import { SectionTitle, Note, Fa } from "./bits";
import { answerEq, ivlLabel, preview as fsrsPreview, dayIndex, defaultState, type FsrsState } from "@/lib/fsrs";
import { DECK } from "@/lib/content";
import { submitGrade } from "@/lib/offline";

interface CardView {
  id: string;
  unit?: string;
  kind: string;
  skill: string;
  level: string;
  prompt: string;
  answer: string;
  alt: string[];
  en: string;
  fa: string;
  note: string;
  traps?: string[];
  distractors?: string[];
}
// The live /api/review/queue item: { card, state, dir, tiles, ahead }.
interface QueueItem {
  card: CardView;
  state: FsrsState;
  dir: string;
  tiles: string[];
  ahead: boolean;
}

const DIR_LABEL: Record<string, string> = {
  cloze: "Retrieve the missing word",
  reverse: "Say it back in Farsi - type the chunk",
  fa2en: "Farsi on the left - produce the English",
  fae: "Produce the English chunk",
  audio: "Listen, then write what you heard",
  bank: "Build the English sentence from tiles",
  mcq_fa: "Pick the right meaning",
  pairs: "Pair match",
  ef: "Recall the Persian meaning",
  sent: "Use it in your own sentence",
};

const GRADES = [
  { r: 1, label: "Again", key: "1", color: "var(--danger)" },
  { r: 2, label: "Hard", key: "2", color: "var(--rah-grade-hard)" },
  { r: 3, label: "Good", key: "3", color: "var(--accent)" },
  { r: 4, label: "Easy", key: "4", color: "var(--accent-deep)" },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:'"()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// What counts as "came back right" per direction: fa2en and bank ask for the
// whole English phrase; everything else checks against the card's answer.
function acceptable(card: CardView, input: string, dir: string): boolean {
  const got = normalize(input);
  if (!got) return false;
  const targets = dir === "fa2en" ? [card.en, ...(card.alt ?? [])] : [card.answer, ...(card.alt ?? [])];
  return targets.some((t) => normalize(t) === got);
}

// Browser TTS: zero dependencies, works offline, matches the lightweight rule.
function speak(text: string, rate = 0.92) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = rate;
    window.speechSynthesis.speak(u);
  } catch {
    // no tts in this browser; the text is always shown as fallback
  }
}

// Meaning-choice distractors: three Farsi glosses from elsewhere in the deck.
function mcqChoices(card: CardView): string[] {
  const pool = DECK.filter((c) => c.fa && c.fa !== card.fa).sort(() => Math.random() - 0.5).slice(0, 3);
  return [card.fa, ...pool.map((c) => c.fa)].sort(() => Math.random() - 0.5);
}

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
  const [counts, setCounts] = useState<{ due: number; fresh: number } | null>(null);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [choice, setChoice] = useState<string | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [wasRight, setWasRight] = useState(false);
  const [phase, setPhase] = useState<"prompt" | "checked" | "reveal">("prompt");
  const [correct, setCorrect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { n: number; hit: number; secs: number }>(null);
  const startedAt = useRef(Date.now());
  const cardShownAt = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const gradeStats = useRef({ hit: 0, n: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      const r = await fetch("/api/review/queue", { cache: "no-store" });
      const j = await r.json();
      if (Array.isArray(j.batch)) {
        setItems(j.batch as QueueItem[]);
        setCounts(j.counts ?? null);
        setIdx(0);
      } else {
        setLoadErr(typeof j.error === "string" ? j.error : "The queue came back malformed.");
      }
    } catch {
      setLoadErr("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cur = items[idx];
  const dir = cur?.dir ?? "cloze";
  const c = cur?.card;

  // Interaction model per direction (ported from the proven implementation):
  // typed dirs, the audio-as-MCQ variant for ef/fae cards, tile building, MCQ.
  const audioMcq = dir === "audio" && (c?.kind === "ef" || c?.kind === "fae");
  const needsTyping = ["cloze", "reverse", "fa2en", "fae", "audio"].includes(dir) && !audioMcq;
  const isBank = dir === "bank";
  const tiles = isBank && cur?.tiles ? cur.tiles : [];
  const choices = useMemo(
    () => (cur && (dir === "mcq_fa" || audioMcq) ? mcqChoices(cur.card) : []),
    [cur, dir, audioMcq],
  );

  // Live FSRS previews: the four grade buttons show what each choice does to
  // the schedule before the learner commits.
  const previews = useMemo(
    () => fsrsPreview(cur?.state ?? defaultState(), dayIndex(), 0.9),
    [cur],
  );

  useEffect(() => {
    cardShownAt.current = Date.now();
    setInput("");
    setChoice(null);
    setPicked([]);
    setRevealed(false);
    setWasRight(false);
    setPhase("prompt");
    setCorrect(false);
    setTimeout(() => inputRef.current?.focus(), 60);
    // audio dictation auto-plays once per card arrival
    if (dir === "audio" && cur?.card) speak(cur.card.en);
  }, [idx]);

  const reveal = useCallback((right: boolean) => {
    setWasRight(right);
    setRevealed(true);
    setPhase("checked");
    setCorrect(right);
    gradeStats.current.n += 1;
    if (right) gradeStats.current.hit += 1;
  }, []);

  const check = useCallback(() => {
    if (!cur || phase !== "prompt") return;
    if (isBank) {
      if (picked.length === 0) return;
      reveal(acceptable(cur.card, picked.map((i) => tiles[i]).join(" "), "fa2en"));
      return;
    }
    if (dir === "mcq_fa" || audioMcq) {
      if (!choice) return;
      reveal(choice === cur.card.fa);
      return;
    }
    if (dir === "ef" || dir === "sent") {
      // self-graded recall: nothing to mark before the grade
      setRevealed(true);
      setPhase("reveal");
      return;
    }
    if (dir === "cloze") {
      reveal(answerEq(input, cur.card.answer, cur.card.alt));
      return;
    }
    if (dir === "fae" || dir === "fa2en") {
      reveal(answerEq(input, cur.card.answer, [...cur.card.alt, cur.card.en]));
      return;
    }
    if (dir === "reverse") {
      reveal(acceptable(cur.card, input, "reverse"));
      return;
    }
    if (dir === "audio") {
      reveal(acceptable(cur.card, input, "audio"));
      return;
    }
    setRevealed(true);
    setPhase("reveal");
  }, [cur, phase, isBank, picked, tiles, dir, audioMcq, choice, input, reveal]);

  const grade = useCallback(
    async (r: number) => {
      if (!cur || busy) return;
      setBusy(true);
      // Real offline sync (Task 68 doctrine): submitGrade stamps a gid, and on
      // network loss the grade lands in the local outbox for the reconnect
      // flush - the server's gid receipt makes replays idempotent.
      await submitGrade(cur.card.id, r, dir).catch(() => undefined);
      setBusy(false);
      // requeue "Again" inside this session after 5 cards
      if (r === 1) {
        setItems((xs) => {
          const copy = xs.slice();
          const relearn = { ...cur, tiles: [], ahead: cur.ahead };
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
    [cur, idx, items, busy, dir],
  );

  // keyboard: Enter checks, 1-4 grades when the answer is out
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

  if (loadErr) {
    const auth = loadErr.toLowerCase().includes("sign in");
    return (
      <div className="max-w-xl mx-auto text-center pt-16">
        <div className="display text-[30px] font-bold mb-2">The queue is not reachable right now.</div>
        <p className="text-[14px] mb-8 leading-relaxed" style={{ color: "var(--muted)" }}>
          {auth
            ? "Your session expired, so the schedule stays private. Sign in again from the Home screen and your cards are waiting."
            : loadErr + " Nothing is lost - reopen Review in a moment."}
        </p>
        <button className="btn-primary" onClick={() => go("today")}>Back to today</button>
      </div>
    );
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
          <button className="btn-ghost" onClick={() => { setDone(null); gradeStats.current = { hit: 0, n: 0 }; startedAt.current = Date.now(); void load(); }}>
            More cards
          </button>
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

  const shownPct = Math.round(((idx + 1) / Math.max(1, items.length)) * 100);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="chip chip-accent">{c!.skill}</span>
          <span className="chip">{c!.level}</span>
          {cur.state.state === "new" ? <span className="chip" style={{ background: "var(--amber-dim)", color: "var(--c-gold-tint)", borderColor: "transparent" }}>new</span> : null}
        </div>
        <span className="text-[12.5px] font-semibold" style={{ color: "var(--muted)" }}>
          {idx + 1} / {items.length}
        </span>
      </div>

      <div className="h-1.5 rounded-full overflow-hidden mb-6" style={{ background: "var(--rah-track)" }}>
        <div className="h-full transition-all" style={{ width: `${shownPct}%`, background: "var(--accent)" }} />
      </div>

      {/* Task 109: the direction used to render as an all-caps kicker ABOVE
         the card - the eyebrow pattern the craft floor bans. It is an
         instruction, so it lives inside the card at readable weight. */}
      <div className="card-rah p-8">
        <div className="text-[13px] font-bold mb-4" style={{ color: "var(--accent-deep)" }}>
          {DIR_LABEL[dir] ?? dir}
        </div>

        {/* ---- prompt per direction ---- */}
        {dir === "cloze" && <Cloze text={c!.prompt} />}

        {dir === "reverse" && (
          <>
            <p className="text-[26px] display font-bold">{c!.en}</p>
            <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>type the key chunk, in Farsi</p>
          </>
        )}

        {(dir === "fae" || dir === "fa2en") && (
          <>
            <p className="fa-text text-[24px] font-bold leading-relaxed">{c!.fa}</p>
            <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>{dir === "fa2en" ? "type the whole English phrase" : "produce the English chunk"}</p>
          </>
        )}

        {dir === "audio" && !audioMcq && (
          <>
            <button
              onClick={() => speak(c!.en)}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white transition-transform hover:scale-105 active:scale-95"
              style={{ background: "var(--accent)" }}
              aria-label="Play audio"
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>
            </button>
            <p className="text-[13px] mt-4 text-center" style={{ color: "var(--muted)" }}>listen, then type what fills the gap</p>
          </>
        )}

        {isBank && (
          <>
            <p className="fa-text text-[24px] font-bold leading-relaxed text-center">{c!.fa}</p>
            <p className="text-[13px] mt-1 text-center" style={{ color: "var(--muted)" }}>tap the words in order</p>
          </>
        )}

        {(dir === "mcq_fa" || audioMcq) && (
          <>
            <p className="text-[26px] display font-bold">{c!.en}</p>
            {audioMcq && (
              <button
                onClick={() => speak(c!.en)}
                className="mx-auto mt-3 flex h-10 w-10 items-center justify-center rounded-full text-white"
                style={{ background: "var(--accent)" }}
                aria-label="Play audio"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
              </button>
            )}
          </>
        )}

        {dir === "ef" && (
          <>
            <p className="text-[26px] display font-bold">{c!.en}</p>
            {c!.prompt && c!.prompt !== c!.en && c!.kind === "ef" ? <p className="text-[13.5px] mt-1" style={{ color: "var(--muted)" }}>from: {c!.prompt.replace("___", c!.answer)}</p> : null}
          </>
        )}

        {dir === "sent" && (
          <>
            <p className="text-[24px] display font-bold">{c!.en}</p>
            <p className="text-[13.5px] mt-1" style={{ color: "var(--muted)" }}>{c!.fa ? <Fa>{c!.fa}</Fa> : null}</p>
          </>
        )}

        {/* ---- answer input per interaction model ---- */}
        {needsTyping && phase === "prompt" && (
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
        )}

        {isBank && phase === "prompt" && (
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
        )}

        {choices.length > 0 && phase === "prompt" && (
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
        )}

        {dir === "ef" && phase === "prompt" && (
          <div className="mt-5">
            <button className="btn-primary" onClick={check}>
              I said it, show the answer
            </button>
            <div className="mt-3 text-[12.5px]" style={{ color: "var(--muted)" }}>
              Say the Persian meaning out loud first. Grading yourself honestly is the whole game.
            </div>
          </div>
        )}

        {dir === "sent" && phase === "prompt" && (
          <div className="mt-5">
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={input}
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
        )}

        {/* ---- feedback zone ---- */}
        {phase === "checked" && (
          <div className="mt-6">
            {correct ? (
              <Note tone="accent">
                <b>{dir === "fa2en" || isBank ? c!.en : c!.answer}</b> is right. {c!.note}
              </Note>
            ) : (
              <Note tone="error">
                <b>{dir === "fa2en" || isBank ? c!.en : c!.answer}</b> was the target{!isBank && dir !== "mcq_fa" && !audioMcq ? <> , you wrote <b>{input || "nothing"}</b></> : null}. {c!.note}
              </Note>
            )}
            {c!.fa ? <div className="mt-3 fa-text text-[15px]" style={{ color: "var(--muted)" }}>{c!.fa}</div> : null}
          </div>
        )}
        {phase === "reveal" && (
          <div className="mt-6">
            <Note>
              {c!.fa ? <span dir="rtl" className="inline-block text-[15px]">{c!.fa}</span> : null}
              {c!.note ? <div className={c!.fa ? "mt-1" : ""}>{c!.note}</div> : null}
            </Note>
          </div>
        )}

        {/* ---- grade bar: the four keys, live intervals ---- */}
        {(phase === "checked" || phase === "reveal") && (
          <>
            <div className="grid grid-cols-4 gap-2 mt-6">
              {GRADES.map((g) => (
                <button
                  key={g.r}
                  onClick={() => grade(g.r)}
                  disabled={busy}
                  className="rounded-2xl border py-3 text-center transition-transform active:scale-95 disabled:opacity-50"
                  style={{ borderColor: "var(--line)", background: "var(--rah-field)" }}
                >
                  <div className="text-[14px] font-bold" style={{ color: g.color }}>{g.label}</div>
                  <div className="text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>{ivlLabel(previews[g.r - 1])}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 text-[12px] text-center" style={{ color: "var(--muted)" }}>
              stability {cur.state.s ? cur.state.s.toFixed(1) : "new"} · difficulty {cur.state.d ? cur.state.d.toFixed(1) : "new"} · grades advance the schedule, <span className="kbd">1</span> to <span className="kbd">4</span>
            </div>
          </>
        )}
      </div>

      {counts ? (
        <div className="mt-4 text-[12px] text-center" style={{ color: "var(--muted)" }}>
          {counts.due} due · {counts.fresh} new waiting in the deck
        </div>
      ) : null}
    </div>
  );
}
