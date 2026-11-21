"use client";

import { useEffect, useRef, useState } from "react";
import { PASSAGES, splitSentences } from "@/lib/content";
import { speak } from "./speech";
import type { Phase } from "./listening/shared";
import { PickPhase, ListeningHeader, R1, R2, R3, R4, R5 } from "./listening/Phases";
import { QuizPhase, EndPhase } from "./listening/Quiz";
import { makeListeningActions } from "./listening/flow";

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

  const { log, addVocab, trackMinutes } = makeListeningActions({
    pid, passage, segments, addedVocab, setAddedVocab,
  });


  const play = async (rate = 1) => {
    setLastRate(rate);
    if (!passage) return;
    setPlaying(true);
    const ok = await speak(passage.transcript, rate);
    setPlaying(false);
    if (!ok) setNoVoice(true);
  };

  const playSegment = async (i: number, rate = 0.85) => {
    if (!segments[i]) return;
    setSegPlaying(i);
    const ok = await speak(segments[i], rate);
    setSegPlaying(-1);
    if (!ok) setNoVoice(true);
  };

  const finish = () => {
    const mins = Math.max(1, Math.round((Date.now() - startRef.current) / 60000));
    trackMinutes(mins);
    onDone();
    setQIdx(0);
    setPicked(null);
    setPhase("quiz");
  };

  if (phase === "pick") {
    return <PickPhase setPid={setPid} setPhase={setPhase} setNoVoice={setNoVoice} startRef={startRef} />;
  }

  if (!passage) return null;

  const header = <ListeningHeader passage={passage} setPhase={setPhase} />;

  if (phase === "r1") {
    return <R1 header={header} playing={playing} noVoice={noVoice} caught={caught} play={play} setCaught={setCaught} log={log} setPhase={setPhase} />;
  }
  if (phase === "r2") {
    return <R2 header={header} play={play} segments={segments} segPlaying={segPlaying} playSegment={playSegment} misses={misses} setMisses={setMisses} detail={detail} setDetail={setDetail} log={log} setPhase={setPhase} />;
  }
  if (phase === "r3") {
    return <R3 header={header} passage={passage} addedVocab={addedVocab} addVocab={addVocab} setPhase={setPhase} />;
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
