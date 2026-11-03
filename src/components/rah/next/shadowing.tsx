"use client";

// Voice shadowing (ROADMAP §3.1): listen -> imitate -> word-level compare ->
// recurring errors become FSRS items. The score is the measured tier (server
// ASR + deterministic alignment) - the tier chip and note are load-bearing.
// Targets arrive weakest-focus-first from the route (Sound Lab error rates +
// this page's own miss ledger), so repetition aims at the learner's real
// trouble spots, not a fixed list order.

import { useEffect, useRef, useState } from "react";
import { SectionTitle, Note } from "./bits";
import { speak, stopSpeak } from "./speech";
import { clipToWav16kMono, WORD_STYLE } from "./record-wav";

interface ShadowTarget {
  id: string;
  text: string;
  focus: string;
  focusLabel: string;
}

interface Recurring {
  word: string;
  count: number;
  nearCount: number;
  lastHeard: string | null;
  focuses: string[];
  cardExists: boolean;
}

interface ShadowReport {
  accuracy: number;
  hits: number;
  near: number;
  misses: number;
  total: number;
  words: { target: string; heard: string | null; status: string }[];
  extra: string[];
  note: string;
}

interface ShadowResponse {
  ok: boolean;
  transcript: string;
  tier: string;
  report: ShadowReport;
  recurring: Recurring[];
  minted: string[];
  threshold: number;
}

export default function Shadowing({ onDone }: { onDone: () => void }) {
  const [targets, setTargets] = useState<ShadowTarget[]>([]);
  const [idx, setIdx] = useState(0);
  const [threshold, setThreshold] = useState(3);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [rate, setRate] = useState(0.85);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [res, setRes] = useState<ShadowResponse | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    fetch("/api/speak/shadow", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setTargets(Array.isArray(j.targets) ? j.targets : []);
        setThreshold(Number(j.threshold ?? 3));
        setRecurring(Array.isArray(j.recurring) ? j.recurring : []);
      })
      .catch(() => setTargets([]));
    return () => {
      try {
        recRef.current?.stream.getTracks().forEach((t) => t.stop());
      } catch {
        /* already gone */
      }
    };
  }, []);

  const target = targets[idx];

  const hear = async (slow = false) => {
    if (!target) return;
    await speak(target.text, slow ? 0.7 : rate);
  };

  const stop = () => {
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    setRecording(false);
  };

  const start = async () => {
    if (!target) return;
    setError("");
    setRes(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setBusy(true);
        try {
          const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
          const audio = await clipToWav16kMono(blob);
          const r = await fetch("/api/speak/shadow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ target: target.text, targetId: target.id, audio }),
          });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error ?? "Shadowing check failed.");
          setRes(j as ShadowResponse);
          if (Array.isArray(j.recurring)) setRecurring(j.recurring);
          onDone();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setError("Microphone unavailable - allow mic access and try again.");
    }
  };

  const next = () => {
    stopSpeak();
    setIdx((i) => (i + 1) % Math.max(1, targets.length));
    setRes(null);
    setError("");
  };

  const report = res?.report;
  const mintedSet = new Set(res?.minted ?? []);

  return (
    <div>
      <SectionTitle
        title="Voice shadowing"
        sub="Listen, imitate, compare word by word. The sentences you keep missing grow into review cards on their own."
      />
      {target ? (
        <div className="card-rah p-6 max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="chip chip-accent">{target.focusLabel}</span>
              <span className="chip">shadow {idx + 1}/{targets.length}</span>
            </div>
            <div className="text-[12.5px] font-semibold" style={{ color: "var(--muted)" }}>
              a word missed {threshold}× becomes a review card
            </div>
          </div>

          <p className="text-[16.5px] leading-relaxed font-semibold">{target.text}</p>

          <div className="flex gap-2 mt-4 flex-wrap items-center">
            <button className="btn-ghost text-[13px]" onClick={() => hear(false)}>
              Hear it {rate === 0.85 ? "(slow)" : "(natural)"}
            </button>
            <button className="btn-ghost text-[13px]" onClick={() => setRate((r) => (r === 0.85 ? 1 : 0.85))}>
              Speed: {rate === 0.85 ? "0.85x" : "1.0x"}
            </button>
          </div>

          <div className="flex gap-2 mt-5 flex-wrap items-center">
            {!recording ? (
              <button className="btn-primary" onClick={start} disabled={busy}>
                {res || error ? "Record again" : "Record your imitation"}
              </button>
            ) : (
              <button className="btn-primary" style={{ background: "var(--danger)" }} onClick={stop}>
                Stop
              </button>
            )}
            <button className="btn-ghost text-[13px]" onClick={next}>
              Next sentence
            </button>
            {recording ? <span className="chip" style={{ color: "var(--danger)" }}>recording…</span> : null}
          </div>

          {busy ? <div className="mt-4 text-[13px]" style={{ color: "var(--muted)" }}>Scoring your audio…</div> : null}
          {error ? <div className="mt-4"><Note tone="error">{error}</Note></div> : null}

          {report ? (
            <div className="mt-6">
              <div className="flex flex-wrap items-baseline gap-3">
                <div className="display text-[38px] font-bold leading-none">{report.accuracy}</div>
                <div className="text-[12.5px] font-semibold" style={{ color: "var(--muted)" }}>word accuracy</div>
                <span className="chip">measured: word-level (ASR alignment)</span>
              </div>
              <p className="mt-3 text-[13px]" style={{ color: "var(--muted)" }}>
                Heard: <i>{res?.transcript}</i>
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {report.words.map((w, i) => (
                  <span
                    key={i}
                    title={w.status === "hit" ? "matched" : `heard: ${w.heard ?? "(nothing)"}`}
                    className={`rounded-lg border px-2 py-1 text-xs font-bold ${WORD_STYLE[w.status] ?? WORD_STYLE.miss}`}
                  >
                    {w.target}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[12.5px]" style={{ color: "var(--muted)" }}>
                {report.near > 0 ? "Amber words were heard as something close (half credit). " : ""}
                {report.misses > 0 ? "Red words were not recognized. " : ""}
                {report.extra.length > 0 ? `Extra words heard: ${report.extra.join(", ")}.` : ""}
              </p>
              {res && res.minted.length > 0 ? (
                <div className="mt-4">
                  <Note tone="accent">
                    Recurring: “{res.minted.join("”, “")}” just crossed the {res.threshold}-miss line and is now in your review
                    queue with the sentence that exposed it.
                  </Note>
                </div>
              ) : null}
              <div className="mt-3">
                <Note>{report.note}</Note>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="card-rah p-6 max-w-2xl mx-auto text-[13.5px]" style={{ color: "var(--muted)" }}>
          Loading shadowing targets…
        </div>
      )}

      {recurring.length > 0 ? (
        <div className="card-rah p-6 max-w-2xl mx-auto mt-4">
          <div className="font-bold text-[14.5px] mb-1">Your recurring shadow misses</div>
          <p className="text-[12.5px] mb-3" style={{ color: "var(--muted)" }}>
            Every word the recognizer could not match, across all attempts. At {threshold} misses the word becomes a review card.
          </p>
          <div className="flex flex-wrap gap-2">
            {recurring.map((r) => (
              <span
                key={r.word}
                className={`rounded-lg border px-2.5 py-1.5 text-[12.5px] font-bold ${WORD_STYLE[r.count >= threshold ? "miss" : "near"]}`}
                title={r.lastHeard ? `last heard as "${r.lastHeard}"` : "not recognized"}
              >
                {r.word} ×{r.count}
                {r.cardExists ? " · card ✓" : ""}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
