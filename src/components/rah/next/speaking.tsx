"use client";

import { useEffect, useRef, useState } from "react";
import { SectionTitle, Note } from "./bits";
import { SPEAK_PROMPTS } from "@/lib/content";

// Task repetition: record the same prompt, get a transcript from the
// built-in engine, let the coach pre-fill a four-slot repair plan (one
// grammar item, one vocab upgrade, one pronunciation risk, one awkward
// sentence), edit it, then record attempt two. Recognition is not
// production, so the learner still reviews every slot by hand.
type Phase = "pick" | "prep" | "record" | "diagnose" | "again";

interface Attempt {
  n: number;
  seconds: number;
  eval: { grammar: string; vocab: string; pron: string; awkward: string };
  transcript?: string;
}

const EMPTY_EV = { grammar: "", vocab: "", pron: "", awkward: "" };

export default function SpeakingView({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>("pick");
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

  // When the diagnose phase opens with a fresh recording, the coach runs
  // once automatically: transcribe, then build the four-slot repair plan.
  useEffect(() => {
    if (phase === "diagnose" && audioB64 && coachedRef.current !== audioB64) {
      coachedRef.current = audioB64;
      runCoach(audioB64, "");
    }
  }, [phase, audioB64]);

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

  // Transcript + coach evaluation. Works from a real recording or from
  // typed text when the microphone is unavailable.
  const runCoach = async (b64: string | null, typed: string) => {
    setAiBusy(true);
    setAiErr("");
    try {
      let said = typed;
      if (!said && b64) {
        const r = await fetch("/api/asr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: b64 }),
        });
        const j = await r.json();
        if (!j.ok) {
          setAiErr("Transcription failed here, so type what you remember saying and the coach will work from that.");
          setTypedMode(true);
          return;
        }
        said = String(j.text ?? "");
        setTranscript(said);
      }
      if (!said.trim()) {
        setAiErr("Nothing to evaluate yet: speak first, or type what you said.");
        return;
      }
      const r2 = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "speak_eval", transcript: said, prompt: prompt?.prompt ?? "", seconds }),
      });
      const j2 = await r2.json();
      if (!j2.ok || !j2.eval) {
        setAiErr(j2.error ?? "The coach could not evaluate this run. Fill the plan yourself.");
        return;
      }
      setHeard(String(j2.eval.heard ?? ""));
      setEv({
        grammar: String(j2.eval.grammar ?? ""),
        vocab: String(j2.eval.vocab ?? ""),
        pron: String(j2.eval.pron ?? ""),
        awkward: String(j2.eval.awkward ?? ""),
      });
    } catch {
      setAiErr("Network hiccup on the way to the coach. Fill the plan yourself or retry.");
    } finally {
      setAiBusy(false);
    }
  };

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
    return (
      <div>
        <SectionTitle
          title="Speaking studio"
          sub="Passive knowledge becomes usable English only through forced production. Same task, three passes, one repair per pass."
        />
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
      </div>
    );
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

  if (phase === "record" && prompt) {
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

  if (phase === "diagnose" && prompt) {
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
              <audio ref={audioRef} controls src={audioUrl} className="w-full" style={{ maxHeight: 44 }} />
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
          {typedMode && !heard ? (
            <div className="mb-5">
              <label className="text-[12.5px] font-bold block mb-1">What you said, as close as you remember</label>
              <textarea
                value={transcript}
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
          ) : null}
          {aiBusy ? (
            <div className="text-[13px] mb-5" style={{ color: "var(--muted)" }}>
              {transcript ? "Coach is building your repair plan..." : "Transcribing your two minutes..."}
            </div>
          ) : null}
          {aiErr ? <div className="mb-5"><Note tone="error">{aiErr}</Note></div> : null}
          {heard ? <div className="mb-5"><Note tone="accent">{heard}</Note></div> : null}
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
                onChange={(e) => setEv((x) => ({ ...x, [k]: e.target.value }))}
                className="w-full rounded-xl border px-4 py-2.5 text-[14px]"
                style={{ borderColor: "var(--line)", background: "var(--rah-field)", outline: "none" }}
              />
            </div>
          ))}
          <div className="flex justify-between items-center mt-6 gap-2 flex-wrap">
            <button className="btn-ghost" onClick={() => setPhase("record")}>Re-record instead</button>
            <button
              className="btn-primary"
              onClick={async () => {
                const att: Attempt = { n: attempts.length + 1, seconds, eval: ev, transcript: transcript || undefined };
                const next = [...attempts, att];
                setAttempts(next);
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

  if (phase === "again" && prompt) {
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

  return null;
}
