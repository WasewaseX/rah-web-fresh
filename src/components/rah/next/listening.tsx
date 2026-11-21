"use client";

import { useEffect, useRef, useState } from "react";
import { PASSAGES, splitSentences } from "@/lib/content";
import { speak, stopSpeak } from "./speech";
import type { Phase } from "./listening/shared";
import { PickPhase, R1, R2, R3, R4, R5 } from "./listening/Phases";
import { QuizPhase, EndPhase } from "./listening/Quiz";

export default function ListeningView({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>("pick");
  const [pid, setPid] = useState<string>("");
  const [caught, setCaught] = useState("");
  const [misses, setMisses] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState("");
  const [repro, setRepro] = useState("");
  const [playing, setPlaying] = useState(false);
  const [noVoice, setNoVoice] = useState(false);
  const [lastRate, setLastRate] = useState(1);
  const [segPlaying, setSegPlaying] = useState(-1);
  const [addedVocab, setAddedVocab] = useState<Record<string, "loading" | "done" | "exists">>({});
  const [qIdx, setQIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  // Clock anchor stamped post-render (react purity: no Date.now() during
  // render); the mount effect runs before any handler can read it.
  const startRef = useRef(0);
  useEffect(() => {
    if (startRef.current === 0) startRef.current = Date.now();
  }, []);

  const passage = PASSAGES.find((p) => p.id === pid);
  const segments = passage ? splitSentences(passage.transcript) : [];

  const play = async (rate = 1) => {
    setLastRate(rate);
    if (!passage) return;
    setPlaying(true);
    const ok = await speak(passage.transcript, rate);
    setPlaying(false);
    if (!ok) setNoVoice(true);
  };

  const log = (round: number, missType = "", d = "") => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "listening", passageId: pid, round, missType, detail: d }),
    }).catch(() => undefined);
  };

  const playSegment = async (i: number, rate = 0.85) => {
    if (!segments[i]) return;
    setSegPlaying(i);
    const ok = await speak(segments[i], rate);
    setSegPlaying(-1);
    if (!ok) setNoVoice(true);
  };

  const addVocab = async (w: string, fa: string) => {
    if (!passage || addedVocab[w]) return;
    setAddedVocab((x) => ({ ...x, [w]: "loading" }));
    // The exact passage sentence that carries the word rides onto the card.
    const sentence = segments.find((s) => s.toLowerCase().includes(w.toLowerCase().split(" ")[0])) ?? "";
    try {
      const r = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "listenvocab", word: w, fa, passageId: passage.id, sentence }),
      });
      const j = await r.json();
      setAddedVocab((x) => ({ ...x, [w]: j.created ? "done" : "exists" }));
    } catch {
      setAddedVocab((x) => {
        const n = { ...x };
        delete n[w];
        return n;
      });
    }
  };

  const finish = () => {
    const mins = Math.max(1, Math.round((Date.now() - startRef.current) / 60000));
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "listening", minutes: mins, meta: { passageId: pid } }),
    }).then(onDone).catch(() => undefined);
    setQIdx(0);
    setPicked(null);
    setPhase("quiz");
  };

  if (phase === "pick") {
    return <PickPhase setPid={setPid} setPhase={setPhase} setNoVoice={setNoVoice} startRef={startRef} />;
  }

  if (!passage) return null;

  const header = (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="chip chip-accent">{passage.level}</span>
        <span className="chip">{passage.title}</span>
      </div>
      <button className="text-[12.5px] font-semibold" style={{ color: "var(--muted)" }} onClick={() => { stopSpeak(); setPhase("pick"); }}>
        change passage
      </button>
    </div>
  );

  if (phase === "r1") {
    return <R1 header={header} playing={playing} noVoice={noVoice} caught={caught} play={play} setCaught={setCaught} log={log} setPhase={setPhase} />;
  }
  if (phase === "r2") {
    return <R2 header={header} play={play} segments={segments} segPlaying={segPlaying} playSegment={playSegment} misses={misses} setMisses={setMisses} detail={detail} setDetail={setDetail} log={log} setPhase={setPhase} />;
  }
  if (phase === "r3") {
    return <R3 header={header} passage={passage} addedVocab={addedVocab} addVocab={addVocab} speakSlow={speakSlow} setPhase={setPhase} />;
  }
  if (phase === "r4") {
    return <R4 header={header} playing={playing} lastRate={lastRate} play={play} setPhase={setPhase} />;
  }
  if (phase === "r5") {
    return <R5 header={header} repro={repro} setRepro={setRepro} passage={passage} log={log} finish={finish} />;
  }
  if (phase === "quiz" && passage) {
    return <QuizPhase header={header} passage={passage} qIdx={qIdx} quizScore={quizScore} picked={picked} setPicked={setPicked} setQuizScore={setQuizScore} setQIdx={setQIdx} log={log} setPhase={setPhase} />;
  }

  return <EndPhase quizScore={quizScore} passage={passage} setQuizScore={setQuizScore} setPhase={setPhase} />;
}
