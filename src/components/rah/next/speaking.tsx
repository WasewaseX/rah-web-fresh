"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SPEAK_PROMPTS } from "@/lib/content";
import { runCoachKind } from "./speaking/runCoach";
import { useSpeakingRecorder, saveSpeakingAttempt } from "./speaking/recorder";
import type { Attempt, Phase } from "./speaking/shared";
import { PickPhase, PrepPhase, RecordPhase } from "./speaking/Phases";
import { DiagnosePhase, AgainPhase } from "./speaking/Diagnose";

export default function SpeakingView({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>("pick");
  // Pick phase has two doors: the task-repetition studio and voice shadowing.
  const [pickMode, setPickMode] = useState<"tasks" | "shadow">("tasks");
  const [pid, setPid] = useState("");
  const [prompt, setPrompt] = useState<(typeof SPEAK_PROMPTS)[number] | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [recState, setRecState] = useState<"idle" | "recording" | "unavailable">("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioB64, setAudioB64] = useState<string | null>(null);
  const [ev, setEv] = useState({ grammar: "", vocab: "", pron: "", awkward: "" });
  const [micNote, setMicNote] = useState("");
  const [transcript, setTranscript] = useState("");
  const [heard, setHeard] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState("");
  const [typedMode, setTypedMode] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const coachedRef = useRef<string>("");

  const { startRecording, stopRecording } = useSpeakingRecorder({
    setMicNote, setRecState, setSeconds, setAudioUrl, setAudioB64, setPhase,
  });
  const saveAttempt = (logMinutes: boolean) => saveSpeakingAttempt(logMinutes, { prompt0, seconds, ev, onDone });

  const runCoach = useCallback(async (b64: string | null, typed: string) => {
    await runCoachKind(b64, typed, {
      setAiBusy, setAiErr, setTypedMode, setTranscript, setHeard, setEv,
      promptPrompt: prompt?.prompt ?? "", seconds,
    });
  }, [prompt, seconds]);

  // When the diagnose phase opens with a fresh recording, the coach runs
  // once automatically: transcribe, then build the four-slot repair plan.
  useEffect(() => {
    if (phase === "diagnose" && audioB64 && coachedRef.current !== audioB64) {
      coachedRef.current = audioB64;
      runCoach(audioB64, "");
    }
  }, [phase, audioB64, runCoach]);

  const prompt0 = SPEAK_PROMPTS.find((p) => p.id === pid);


  if (phase === "pick") {
    return <PickPhase pickMode={pickMode} setPickMode={setPickMode} onDone={onDone} setPid={setPid} setPrompt={setPrompt} setAttempts={setAttempts} setAudioUrl={setAudioUrl} setAudioB64={setAudioB64} setEv={setEv} setTranscript={setTranscript} setHeard={setHeard} setAiErr={setAiErr} setTypedMode={setTypedMode} coachedRef={coachedRef} setPhase={setPhase} />;
  }

  const header = (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="chip chip-accent">{prompt?.level}</span>
        <span className="chip">{prompt?.topic}</span>
        {attempts.length ? <span className="chip">attempt {attempts.length + 1}</span> : null}
      </div>
      <button className="text-[12.5px] font-semibold" style={{ color: "var(--muted)" }} onClick={() => setPhase("pick")}>
        change prompt
      </button>
    </div>
  );

  if (phase === "prep" && prompt) {
    return <PrepPhase header={header} prompt={prompt} setPhase={setPhase} startRecording={startRecording} />;
  }
  if (phase === "record" && prompt) {
    return <RecordPhase header={header} recState={recState} micNote={micNote} seconds={seconds} prompt={prompt} startRecording={startRecording} stopRecording={stopRecording} setSeconds={setSeconds} />;
  }
  if (phase === "diagnose" && prompt) {
    return <DiagnosePhase header={header} attempts={attempts} audioUrl={audioUrl} audioB64={audioB64} transcript={transcript} heard={heard} typedMode={typedMode} aiBusy={aiBusy} aiErr={aiErr} ev={ev} setEv={setEv} setTypedMode={setTypedMode} setTranscript={setTranscript} setAudioUrl={setAudioUrl} setAudioB64={setAudioB64} setHeard={setHeard} setAiErr={setAiErr} runCoach={runCoach} saveAttempt={saveAttempt} setPhase={setPhase} seconds={seconds} audioRef={audioRef} setAttempts={setAttempts} />;
  }
  if (phase === "again" && prompt) {
    return <AgainPhase header={header} attempts={attempts} startRecording={startRecording} saveAttempt={saveAttempt} setPhase={setPhase} />;
  }

  return null;
}
