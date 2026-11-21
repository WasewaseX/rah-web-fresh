"use client";

import type { ReactNode } from "react";
import { SectionTitle } from "../bits";
import { SPEAK_PROMPTS } from "@/lib/content";
import Shadowing from "../shadowing";
import { EMPTY_EV } from "./shared";

// The pick screen: two doors - task-repetition studio and voice shadowing.
export function PickPhase(props: {
  pickMode: string;
  setPickMode: (v: "tasks" | "shadow") => void;
  onDone: () => void;
  setPid: (v: string) => void;
  setPrompt: (p: (typeof SPEAK_PROMPTS)[number]) => void;
  setAttempts: (v: []) => void;
  setAudioUrl: (v: null) => void;
  setAudioB64: (v: null) => void;
  setEv: (v: typeof EMPTY_EV) => void;
  setTranscript: (v: string) => void;
  setHeard: (v: string) => void;
  setAiErr: (v: string) => void;
  setTypedMode: (v: boolean) => void;
  coachedRef: { current: string };
  setPhase: (v: "prep") => void;
}) {
  const { pickMode, setPickMode, onDone, setPid, setPrompt, setAttempts, setAudioUrl, setAudioB64, setEv, setTranscript, setHeard, setAiErr, setTypedMode, coachedRef, setPhase } = props;
  return (
    <div>
      <SectionTitle
        title="Speaking studio"
        sub="Passive knowledge becomes usable English only through forced production. Same task, three passes, one repair per pass."
      />
      <div className="flex gap-2 mb-5">
        <button
          className="btn-ghost text-[13px]"
          style={pickMode === "tasks" ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}
          onClick={() => setPickMode("tasks")}
        >
          Task repetition
        </button>
        <button
          className="btn-ghost text-[13px]"
          style={pickMode === "shadow" ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}
          onClick={() => setPickMode("shadow")}
        >
          Voice shadowing
        </button>
      </div>
      {pickMode === "shadow" ? <Shadowing onDone={onDone} /> : null}
      {pickMode === "tasks" ? (
      <div className="grid md:grid-cols-2 gap-4">
        {SPEAK_PROMPTS.map((p) => (
          <button
            key={p.id}
            className="card-rah p-5 text-left hover:shadow-md transition-shadow"
            onClick={() => {
              setPid(p.id);
              setPrompt(p);
              setAttempts([]);
              setAudioUrl(null);
              setAudioB64(null);
              setEv(EMPTY_EV);
              setTranscript("");
              setHeard("");
              setAiErr("");
              setTypedMode(false);
              setAudioB64(null);
              coachedRef.current = "";
              setPhase("prep");
            }}
          >
            {/* Task 109: level+topic chips demoted to a quiet meta line. */}
            <div className="text-[12px] font-semibold mb-2" style={{ color: "var(--muted)" }}>
              {p.level} · {p.topic}
            </div>
            <div className="text-[14.5px] font-semibold leading-relaxed">{p.prompt}</div>
          </button>
        ))}
      </div>
      ) : null}
    </div>
  );
}

// Prep, one minute: decide position and three beats, no script.
export function PrepPhase(props: {
  header: ReactNode;
  prompt: { prompt: string; useful: string[] };
  setPhase: (v: "record") => void;
  startRecording: () => void;
}) {
  const { header, prompt, setPhase, startRecording } = props;
  return (
    <div className="max-w-2xl mx-auto">
      {header}
      <div className="card-rah p-8">
        <div className="display text-[21px] font-bold mb-1">Prep, one minute</div>
        <p className="text-[13.5px] mb-5" style={{ color: "var(--muted)" }}>Decide your position and three beats: claim, reason, example. Do not write a script.</p>
        <p className="text-[17.5px] leading-relaxed mb-5">{prompt.prompt}</p>
        <div className="rounded-2xl p-4 mb-6" style={{ background: "var(--rah-callout)" }}>
          <div className="font-bold text-[13px] mb-2">Chunks worth landing</div>
          <div className="flex flex-wrap gap-2">
            {prompt.useful.map((u) => <span key={u} className="chip chip-accent">{u}</span>)}
          </div>
        </div>
        <button className="btn-primary" onClick={() => { setPhase("record"); startRecording(); }}>
          I am ready, record two minutes
        </button>
      </div>
    </div>
  );
}

// Record: the timer, the level bar, stop / retry controls.
export function RecordPhase(props: {
  header: ReactNode;
  recState: string;
  micNote: string;
  seconds: number;
  prompt: { prompt: string };
  startRecording: () => void;
  stopRecording: () => void;
  setSeconds: (v: number) => void;
}) {
  const { header, recState, micNote, seconds, prompt, startRecording, stopRecording, setSeconds } = props;
  const pct = Math.min(100, (seconds / 120) * 100);
  return (
    <div className="max-w-2xl mx-auto">
      {header}
      <div className="card-rah p-8 text-center">
        <div className="display text-[21px] font-bold mb-1">{recState === "recording" ? "Recording" : "Microphone off"}</div>
        <p className="text-[13.5px] mb-6 max-w-md mx-auto" style={{ color: "var(--muted)" }}>
          {recState === "recording" ? "Keep talking past the awkward part. Fluency lives after second twenty." : micNote}
        </p>
        <div className="text-[42px] display font-bold mb-1">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</div>
        <div className="h-2 rounded-full overflow-hidden max-w-xs mx-auto mb-8" style={{ background: "var(--rah-track)" }}>
          <div className="h-full transition-all" style={{ width: `${pct}%`, background: seconds >= 120 ? "var(--accent)" : "var(--danger)" }} />
        </div>
        <p className="text-[15.5px] leading-relaxed max-w-lg mx-auto mb-8">{prompt.prompt}</p>
        {recState === "recording" ? (
          <button className="btn-primary" style={{ background: "var(--danger)" }} onClick={stopRecording}>
            Stop ({seconds < 20 ? "keep going" : "stop when done"})
          </button>
        ) : recState === "unavailable" ? (
          <div className="flex gap-2 justify-center">
            <button className="btn-primary" onClick={stopRecording}>Done speaking, diagnose</button>
            <button className="btn-ghost" onClick={() => setSeconds(0)}>Restart the timer</button>
          </div>
        ) : (
          <button className="btn-primary" onClick={startRecording}>Try again from the top</button>
        )}
      </div>
    </div>
  );
}
