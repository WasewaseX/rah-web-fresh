"use client";

import type { ReactNode } from "react";
import { Note } from "../bits";
import { EMPTY_EV, type Attempt } from "./shared";

// Diagnose: the coach's four-slot repair plan, reviewable and editable.
export function DiagnosePhase(props: {
  header: ReactNode;
  attempts: Attempt[];
  audioUrl: string | null;
  audioB64: string | null;
  transcript: string;
  heard: string;
  typedMode: boolean;
  aiBusy: boolean;
  aiErr: string;
  ev: typeof EMPTY_EV;
  setEv: (v: typeof EMPTY_EV | ((x: typeof EMPTY_EV) => typeof EMPTY_EV)) => void;
  setTypedMode: (v: boolean) => void;
  setTranscript: (v: string) => void;
  setAudioUrl: (v: null) => void;
  setAudioB64: (v: null) => void;
  setHeard: (v: string) => void;
  setAiErr: (v: string) => void;
  runCoach: (b64: string | null, typed: string) => Promise<void>;
  saveAttempt: (logMinutes: boolean) => Promise<void>;
  setPhase: (v: "record" | "again") => void;
  seconds: number;
  audioRef: { current: HTMLAudioElement | null };
}) {
  const { header, attempts, audioUrl, audioB64, transcript, heard, typedMode, aiBusy, aiErr, ev, setEv, setTypedMode, setTranscript, setAudioUrl, setAudioB64, setHeard, setAiErr, runCoach, saveAttempt, setPhase, seconds, audioRef } = props;
  return (
    <div className="max-w-2xl mx-auto">
      {header}
      <div className="card-rah p-8">
        <div className="display text-[21px] font-bold mb-1">Your repair plan for attempt {attempts.length + 1}</div>
        <p className="text-[13.5px] mb-5" style={{ color: "var(--muted)" }}>
          The coach pre-fills one item per slot from what it heard. Review each line, fix anything it got wrong, make it yours.
        </p>
        {audioUrl ? (
          <div className="mb-5">
            <audio ref={audioRef} controls src={audioUrl}
                   aria-label="Your recording" className="w-full" style={{ maxHeight: 44 }}>
              <track kind="captions" />
            </audio>
          </div>
        ) : null}
        {transcript && heard ? (
          <div className="rounded-2xl p-4 mb-5" style={{ background: "var(--rah-callout)" }}>
            <div className="font-bold text-[12.5px] mb-1">{typedMode ? "What you typed" : "What the engine heard"}</div>
            <div className="text-[13.5px] leading-relaxed italic">{transcript}</div>
          </div>
        ) : null}
        {!transcript && !aiBusy && !typedMode && !audioB64 ? (
          <div className="mb-5">
            <button className="btn-ghost text-[13px]" onClick={() => setTypedMode(true)}>No recording? Type what you said and get the coach plan</button>
          </div>
        ) : null}
        {typedMode && !heard ? <TypedRecall transcript={transcript} setTranscript={setTranscript} aiBusy={aiBusy} runCoach={runCoach} /> : null}
        {aiBusy ? (
          <div className="text-[13px] mb-5" style={{ color: "var(--muted)" }}>
            {transcript ? "Coach is building your repair plan..." : "Transcribing your two minutes..."}
          </div>
        ) : null}
        {aiErr ? <div className="mb-5"><Note tone="error">{aiErr}</Note></div> : null}
        {heard ? <div className="mb-5"><Note tone="accent">{heard}</Note></div> : null}
        <RepairSlots ev={ev} setEv={setEv} />
        <div className="flex justify-between items-center mt-6 gap-2 flex-wrap">
          <button className="btn-ghost" onClick={() => setPhase("record")}>Re-record instead</button>
          <button
            className="btn-primary"
            onClick={async () => {
              const att: Attempt = { n: attempts.length + 1, seconds, eval: ev, transcript: transcript || undefined };
              const next = [...attempts, att];
              props.setAttempts(next);
              await saveAttempt(next.length % 2 === 0);
              setEv(EMPTY_EV);
              setAudioUrl(null);
              setAudioB64(null);
              setHeard("");
              setTranscript("");
              setTypedMode(false);
              setAiErr("");
              setPhase("again");
            }}
          >
            Save diagnosis
          </button>
        </div>
      </div>
    </div>
  );
}

// Attempt saved: the repair pass on the same prompt.
export function AgainPhase(props: {
  header: ReactNode;
  attempts: Attempt[];
  startRecording: () => void;
  saveAttempt: (logMinutes: boolean) => Promise<void>;
  setPhase: (v: "pick" | "record") => void;
}) {
  const { header, attempts, startRecording, saveAttempt, setPhase } = props;
  const last = attempts[attempts.length - 1];
  return (
    <div className="max-w-2xl mx-auto">
      {header}
      <div className="card-rah p-8">
        <div className="display text-[21px] font-bold mb-1">Attempt {attempts.length} saved. Now the repair pass.</div>
        <p className="text-[13.5px] mb-5" style={{ color: "var(--muted)" }}>
          Same prompt, same two minutes, with your diagnosis fixed. Task repetition measurably improves complexity,
          accuracy and fluency; one repetition does almost nothing, which is why this screen exists.
        </p>
        {last ? (
          <div className="rounded-2xl p-5 mb-6" style={{ background: "var(--rah-callout)" }}>
            <div className="font-bold text-[13px] mb-2">Your repair list</div>
            <ul className="text-[13.5px] leading-relaxed space-y-1">
              {last.eval.grammar ? <li>grammar: {last.eval.grammar}</li> : null}
              {last.eval.vocab ? <li>vocabulary: {last.eval.vocab}</li> : null}
              {last.eval.pron ? <li>pronunciation: {last.eval.pron}</li> : null}
              {last.eval.awkward ? <li>awkward: {last.eval.awkward}</li> : null}
            </ul>
          </div>
        ) : null}
        <div className="flex gap-2 flex-wrap">
          <button className="btn-primary" onClick={() => { setPhase("record"); startRecording(); }}>Record attempt {attempts.length + 1}</button>
          <button className="btn-ghost" onClick={async () => { await saveAttempt(true); setPhase("pick"); }}>Done for today, log the minutes</button>
        </div>
      </div>
    </div>
  );
}

// Typed fallback when the microphone is unavailable.
function TypedRecall(props: {
  transcript: string;
  setTranscript: (v: string) => void;
  aiBusy: boolean;
  runCoach: (b64: string | null, typed: string) => Promise<void>;
}) {
  const { transcript, setTranscript, aiBusy, runCoach } = props;
  return (
    <div className="mb-5">
      <label htmlFor="said-recall" className="text-[12.5px] font-bold block mb-1">What you said, as close as you remember</label>
      <textarea
        id="said-recall"
        value={transcript}
        aria-label="What you said"
        onChange={(e) => setTranscript(e.target.value)}
        rows={4}
        className="w-full rounded-xl border px-4 py-3 text-[14px]"
        style={{ borderColor: "var(--line)", background: "var(--rah-field)", outline: "none" }}
        placeholder="Type the sentences you remember saying. The coach works from this."
      />
      <div className="mt-2">
        <button className="btn-primary" disabled={aiBusy || !transcript.trim()} onClick={() => runCoach(null, transcript)}>
          {aiBusy ? "Coach thinking..." : "Get the coach plan"}
        </button>
      </div>
    </div>
  );
}

// The four repair-plan slots.
function RepairSlots(props: {
  ev: typeof EMPTY_EV;
  setEv: (v: typeof EMPTY_EV | ((x: typeof EMPTY_EV) => typeof EMPTY_EV)) => void;
}) {
  const { ev, setEv } = props;
  return (
    <>
      {([
        ["grammar", "1 grammar error I made and its correct form"],
        ["vocab", "1 vocabulary gap, in English if you can"],
        ["pron", "1 pronunciation or stress problem"],
        ["awkward", "1 sentence that came out awkward, rewritten"],
      ] as const).map(([k, label]) => (
        <div key={k} className="mb-3">
          <label className="text-[12.5px] font-bold block mb-1">{label}</label>
          <input
            value={ev[k]}
            aria-label={label}
            onChange={(e) => setEv((x) => ({ ...x, [k]: e.target.value }))}
            className="w-full rounded-xl border px-4 py-2.5 text-[14px]"
            style={{ borderColor: "var(--line)", background: "var(--rah-field)", outline: "none" }}
          />
        </div>
      ))}
    </>
  );
}
