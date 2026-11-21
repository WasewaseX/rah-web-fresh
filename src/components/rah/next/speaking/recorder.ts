"use client";

import { useEffect, useRef } from "react";

// Recorder + attempt-save core of SpeakingView, lifted into a hook so the
// component stays under the scanner function budget. Refs live here; every
// ref access happens inside callbacks, never during render. Behavior is
// verbatim from the pre-split handlers.
export function useSpeakingRecorder(opts: {
  setMicNote: (v: string) => void;
  setRecState: (v: "idle" | "recording" | "unavailable") => void;
  setSeconds: (v: number | ((s: number) => number)) => void;
  setAudioUrl: (v: string | null) => void;
  setAudioB64: (v: string | null) => void;
  setPhase: (v: "diagnose") => void;
}) {
  const { setMicNote, setRecState, setSeconds, setAudioUrl, setAudioB64, setPhase } = opts;
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
    };
  }, []);

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

  return { startRecording, stopRecording };
}

function blobToB64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result ?? ""));
    fr.readAsDataURL(blob);
  });
}

// Attempt logging (verbatim from the pre-split handler); ref-free so it
// stays a module function.
export async function saveSpeakingAttempt(
  logMinutes: boolean,
  deps: { prompt0: { id: string } | undefined; seconds: number; ev: { grammar: string; vocab: string; pron: string; awkward: string }; onDone: () => void },
) {
  const { prompt0, seconds, ev, onDone } = deps;
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
}
