"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SPEAK_PROMPTS } from "@/lib/content";
import { runCoachKind } from "./speaking/shared";
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
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const coachedRef = useRef<string>("");

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

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
    };
  }, []);

  const blobToB64 = (blob: Blob): Promise<string> =>
    new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result ?? ""));
      fr.readAsDataURL(blob);
    });

  const startRecording = async () => {
    setMicNote("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        if (blob.size > 1000) setAudioB64(await blobToB64(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.current = rec;
      rec.start();
      setRecState("recording");
      setSeconds(0);
      timer.current = setInterval(() => setSeconds((s) => {
        if (s >= 120) { stopRecording(); return 120; }
        return s + 1;
      }), 1000);
    } catch {
      setRecState("unavailable");
      setMicNote("Microphone unavailable here. The timer still runs: speak out loud next to the clock, then type what you said for the coach.");
      setSeconds(0);
      timer.current = setInterval(() => setSeconds((s) => {
        if (s >= 120) { stopRecording(); return 120; }
        return s + 1;
      }), 1000);
    }
  };

  const stopRecording = () => {
    if (timer.current) clearInterval(timer.current);
    if (recorder.current?.state === "recording") {
      // onstop fires after MediaRecorder flushes the last chunk; a short
      // delay makes sure audioB64 is set before the coach runs.
      recorder.current.stop();
      setTimeout(() => setRecState("idle"), 250);
    } else {
      setRecState("idle");
    }
    setPhase("diagnose");
  };

  const saveAttempt = async (logMinutes: boolean) => {
    if (!prompt0) return;
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "speaking", promptId: prompt0.id, seconds, selfEval: ev }),
    }).catch(() => undefined);
    if (logMinutes) {
      await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "speaking", minutes: 10, meta: { promptId: prompt0.id } }),
      }).catch(() => undefined);
      onDone();
    }
  };

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
