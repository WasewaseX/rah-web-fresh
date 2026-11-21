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
//
// The card stage, the out-of-loop screens and the flow choreography (queue
// intake, grade commit, keyboard) live in ./review/* sibling modules.

import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Boot } from "@/app/page";
import { dayIndex, defaultState, preview as fsrsPreview } from "@/lib/fsrs";
import type { QueueItem, ReviewPhase, SessionDone } from "./review/shared";
import { judgeAnswer, keyJudge, runGrade, runLoad } from "./review/flow";
import { mcqChoices, speak } from "./review/shared";
import { DoneScreen, EmptyScreen, LoadErrorScreen, LoadingScreen } from "./review/screens";
import { ReviewStage } from "./review/stage";

export default function ReviewView({ onDone, go }: { boot: Boot; onDone: () => void; go: (v: string) => void }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [counts, setCounts] = useState<{ due: number; fresh: number } | null>(null);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [choice, setChoice] = useState<string | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [phase, setPhase] = useState<ReviewPhase>("prompt");
  const [correct, setCorrect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // reveals snapshots gradeStats.n at completion (refs are not render data).
  const [done, setDone] = useState<SessionDone | null>(null);
  // Wall-clock anchors are stamped post-render (react purity: no Date.now() in render).
  const startedAt = useRef(0);
  const cardShownAt = useRef(0);
  useEffect(() => { if (startedAt.current === 0) startedAt.current = Date.now(); }, []);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const gradeStats = useRef({ hit: 0, n: 0 });

  const load = useCallback(() => void runLoad({ setLoading, setLoadErr, setItems, setCounts, setIdx, setInput, setChoice, setPicked, setPhase, setCorrect }), []);

  useEffect(() => {
    // Deferred one tick (BlitzDeck pattern): no synchronous setState in effects.
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const cur = items[idx], dir = cur?.dir ?? "cloze", c = cur?.card;
  const audioMcq = dir === "audio" && (c?.kind === "ef" || c?.kind === "fae");
  const needsTyping = ["cloze", "reverse", "fa2en", "fae", "audio"].includes(dir) && !audioMcq;
  const isBank = dir === "bank";
  const tiles = useMemo(() => (isBank && cur?.tiles ? cur.tiles : []), [isBank, cur]);
  const choices = useMemo(() => (cur && (dir === "mcq_fa" || audioMcq) ? mcqChoices(cur.card) : []), [cur, dir, audioMcq]);
  const previews = useMemo(() => fsrsPreview(cur?.state ?? defaultState(), dayIndex(), 0.9), [cur]);

  // Card arrival: stamp the clock, focus the field, auto-play audio dictation
  // once per card; state resets live in the handlers that advance the deck.
  useEffect(() => {
    cardShownAt.current = Date.now();
    setTimeout(() => inputRef.current?.focus(), 60);
    if (dir === "audio" && cur?.card) speak(cur.card.en);
  }, [dir, cur]);

  const reveal = useCallback((right: boolean) => {
    setPhase("checked");
    setCorrect(right);
    gradeStats.current.n += 1;
    if (right) gradeStats.current.hit += 1;
  }, []);

  const check = useCallback(() => {
    if (!cur || phase !== "prompt") return;
    const v = judgeAnswer({ dir, isBank, audioMcq, card: cur.card, picked, tiles, choice, input });
    if (v === undefined) return;
    if (v === null) setPhase("reveal");
    else reveal(v);
  }, [cur, phase, dir, isBank, audioMcq, picked, tiles, choice, input, reveal]);

  // Grade bundle: identity tracks exactly the values runGrade reads.
  const gf = useMemo(() => ({ cur, idx, items, busy, dir, gradeStats, startedAt, onDone, setBusy, setItems, setDone, setInput, setChoice, setPicked, setPhase, setCorrect, setIdx }), [cur, idx, items, busy, dir, onDone]);
  const grade = useCallback((r: number) => void runGrade(gf, r), [gf]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => keyJudge(e, phase, check, grade);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [phase, check, grade]);

  if (loading) return <LoadingScreen />;
  if (loadErr) return <LoadErrorScreen error={loadErr} go={go} />;
  if (done) return <DoneScreen done={done} go={go} onMore={() => { setDone(null); gradeStats.current = { hit: 0, n: 0 }; startedAt.current = Date.now(); void load(); }} />;
  if (!cur) return <EmptyScreen go={go} />;

  return (
    <ReviewStage
      f={{
        cur, dir, c, audioMcq, needsTyping, isBank, tiles, choices, previews, phase, correct, input,
        choice, picked, busy, counts, idx, total: items.length, setInput, setChoice, setPicked, check, grade,
        textRef: inputRef as React.RefObject<HTMLInputElement>, areaRef: inputRef as React.RefObject<HTMLTextAreaElement>,
      }}
    />
  );
}
