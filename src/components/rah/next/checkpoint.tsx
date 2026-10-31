"use client";

import { useEffect, useRef, useState } from "react";
import type { Boot } from "@/app/page";
import { SectionTitle, Note, Countdown } from "./bits";
import { CHECKPOINT_TEXTS } from "@/lib/content";
import { speak } from "./speech";

// Measure, do not study. Run this every two to four weeks: listening
// comprehension percent, reading score, a writing sample, speaking counts.
export default function CheckpointView({ boot, onDone }: { boot: Boot; onDone: () => void }) {
  const [stage, setStage] = useState<"intro" | "run" | "done">("intro");
  const [station, setStation] = useState(0); // 0 listening, 1 reading, 2 speaking, 3 writing
  const [lAnswers, setLAnswers] = useState<Record<number, number>>({});
  const [rAnswers, setRAnswers] = useState<Record<number, number>>({});
  const [speaking, setSpeaking] = useState({ pauses: "", errors: "", gaps: "", abstract: "" });
  const [writing, setWriting] = useState("");
  const [result, setResult] = useState<null | { listeningPct: number; readingScore: number }>(null);
  const [prev, setPrev] = useState<{ day: number; listeningPct: number; readingScore: number }[]>([]);
  const [played, setPlayed] = useState(false);
  const savedRef = useRef(false);

  useEffect(() => {
    fetch("/api/checkpoint")
      .then((r) => r.json())
      .then((j) => setPrev((j.checkpoints ?? []).slice(-6)))
      .catch(() => undefined);
  }, []);

  const lText = CHECKPOINT_TEXTS.find((t) => t.kind === "listening")!;
  const rText = CHECKPOINT_TEXTS.find((t) => t.kind === "reading")!;

  const listeningPct = Math.round((lText.questions.filter((q, i) => lAnswers[i] === q.a).length / lText.questions.length) * 100);
  const readingScore = Math.round((rText.questions.filter((q, i) => rAnswers[i] === q.a).length / rText.questions.length) * 100);

  const save = async () => {
    if (savedRef.current) return;
    savedRef.current = true;
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "checkpoint",
        listeningPct,
        readingScore,
        writingText: writing,
        speakingNotes: JSON.stringify(speaking),
        minutes: 40,
      }),
    }).catch(() => undefined);
    onDone();
    setResult({ listeningPct, readingScore });
    setStage("done");
  };

  if (stage === "intro") {
    return (
      <div className="max-w-2xl mx-auto">
        <SectionTitle
          title="Checkpoint: measure the real thing"
          sub="Lessons measure effort. This measures skill. Four stations, about 40 minutes, every two to four weeks."
        />
        <div className="grid sm:grid-cols-2 gap-4 mb-5">
          {[
            ["Listening", "One unseen passage, played once, four questions. Your score is a percentage, not a feeling."],
            ["Reading", "One unseen C1 text, four questions. No dictionary."],
            ["Speaking", "Five minutes on an unfamiliar topic. Count pauses, errors, gaps, abstract control."],
            ["Writing", "300 to 500 words, no assistance. Rah keeps every sample so you can compare with last month."],
          ].map(([t, d]) => (
            <div key={t} className="card-rah p-5">
              <div className="font-bold text-[15px] mb-1">{t}</div>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>{d}</p>
            </div>
          ))}
        </div>
        {prev.length ? (
          <div className="card-rah p-5 mb-5">
            <div className="font-bold text-[14px] mb-2">History</div>
            <div className="flex gap-3 flex-wrap">
              {prev.map((p, i) => (
                <span key={i} className="chip chip-accent">
                  run {i + 1}: listen {p.listeningPct}% · read {p.readingScore}%
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <button className="btn-primary text-[15px] px-8 py-3" onClick={() => setStage("run")}>
          Start checkpoint
        </button>
      </div>
    );
  }

  if (stage === "done" && result) {
    const lastPrev = prev.length ? prev[prev.length - 1] : null;
    return (
      <div className="max-w-2xl mx-auto text-center pt-8">
        <div className="display text-[32px] font-bold mb-2">Checkpoint recorded</div>
        <p className="text-[14px] mb-8" style={{ color: "var(--muted)" }}>
          The daily plan re-weights toward your weakest station. Compare with the previous run in four weeks, not four days.
        </p>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="card-rah p-6">
            <div className="display text-[30px] font-bold">{result.listeningPct}%</div>
            <div className="text-[12.5px]" style={{ color: "var(--muted)" }}>listening comprehension</div>
            {lastPrev ? <div className="text-[12px] mt-1 font-bold" style={{ color: result.listeningPct >= lastPrev.listeningPct ? "var(--accent-deep)" : "var(--danger)" }}>prev: {lastPrev.listeningPct}%</div> : null}
          </div>
          <div className="card-rah p-6">
            <div className="display text-[30px] font-bold">{result.readingScore}%</div>
            <div className="text-[12.5px]" style={{ color: "var(--muted)" }}>reading, unseen C1 text</div>
            {lastPrev ? <div className="text-[12px] mt-1 font-bold" style={{ color: result.readingScore >= lastPrev.readingScore ? "var(--accent-deep)" : "var(--danger)" }}>prev: {lastPrev.readingScore}%</div> : null}
          </div>
        </div>
        <Note tone="accent">
          The writing sample is stored with your history. In your next checkpoint, open it first: spotting your own old
          errors in new text is the fastest sign of real progress.
        </Note>
      </div>
    );
  }

  const stations = ["Listening", "Reading", "Speaking", "Writing"];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-5">
        {stations.map((s, i) => (
          <span
            key={s}
            className="text-[12.5px] font-bold rounded-full px-3.5 py-1.5"
            style={station === i ? { background: "var(--accent)", color: "#fff" } : station > i ? { background: "var(--accent-dim)", color: "var(--accent-deep)" } : { background: "var(--rah-field)", color: "var(--muted)", border: "1px solid var(--line)" }}
          >
            {i + 1}. {s}
          </span>
        ))}
      </div>

      {station === 0 && (
        <div className="card-rah p-8">
          <div className="display text-[20px] font-bold mb-1">Station 1: listening</div>
          <p className="text-[13.5px] mb-5" style={{ color: "var(--muted)" }}>Played once, like real life. No transcript.</p>
          <button
            className="btn-primary mb-6"
            disabled={played}
            onClick={async () => {
              setPlayed(true);
              const ok = await speak(lText.text, 1);
              if (!ok) setPlayed(false);
            }}
          >
            {played ? "played (one pass only)" : "Play the passage"}
          </button>
          {lText.questions.map((q, i) => (
            <div key={i} className="mb-5">
              <div className="text-[14.5px] font-semibold mb-2">{i + 1}. {q.q}</div>
              <div className="grid sm:grid-cols-2 gap-2">
                {q.choices.map((c, ci) => (
                  <button
                    key={ci}
                    onClick={() => setLAnswers((a) => ({ ...a, [i]: ci }))}
                    className="rounded-xl border px-4 py-2.5 text-left text-[13.5px]"
                    style={lAnswers[i] === ci ? { background: "var(--ink)", color: "#fff", borderColor: "transparent" } : { borderColor: "var(--line)" }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button className="btn-primary" disabled={Object.keys(lAnswers).length < 4} onClick={() => setStation(1)}>
            Station 2: reading
          </button>
        </div>
      )}

      {station === 1 && (
        <div className="card-rah p-8">
          <div className="display text-[20px] font-bold mb-1">Station 2: reading</div>
          <p className="text-[13.5px] mb-5" style={{ color: "var(--muted)" }}>Unseen C1 text. Read once, no dictionary, then answer.</p>
          <p className="text-[16px] leading-[1.85] rounded-2xl p-5 mb-5" style={{ background: "var(--rah-callout)" }}>{rText.text}</p>
          {rText.questions.map((q, i) => (
            <div key={i} className="mb-5">
              <div className="text-[14.5px] font-semibold mb-2">{i + 1}. {q.q}</div>
              <div className="grid sm:grid-cols-2 gap-2">
                {q.choices.map((c, ci) => (
                  <button
                    key={ci}
                    onClick={() => setRAnswers((a) => ({ ...a, [i]: ci }))}
                    className="rounded-xl border px-4 py-2.5 text-left text-[13.5px]"
                    style={rAnswers[i] === ci ? { background: "var(--ink)", color: "#fff", borderColor: "transparent" } : { borderColor: "var(--line)" }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button className="btn-primary" disabled={Object.keys(rAnswers).length < 4} onClick={() => setStation(2)}>
            Station 3: speaking
          </button>
        </div>
      )}

      {station === 2 && (
        <div className="card-rah p-8">
          <div className="display text-[20px] font-bold mb-1">Station 3: speaking</div>
          <p className="text-[13.5px] mb-5" style={{ color: "var(--muted)" }}>
            Talk for five minutes on: <b>Should social media companies be treated like publishers and held legally responsible for what spreads there?</b> Record yourself if you can, then count honestly.
          </p>
          <Countdown seconds={300} onDone={() => undefined} paused={station !== 2} />
          {([
            ["pauses", "Long pauses over 3 seconds (count)"],
            ["errors", "Obvious grammar errors you heard yourself make (count)"],
            ["gaps", "Moments where the word you needed did not come (count)"],
            ["abstract", "Could you explain an abstract idea, 1 to 10?"],
          ] as const).map(([k, label]) => (
            <div key={k} className="mb-3">
              <label className="text-[12.5px] font-bold block mb-1">{label}</label>
              <input
                value={speaking[k]}
                onChange={(e) => setSpeaking((x) => ({ ...x, [k]: e.target.value }))}
                className="w-full rounded-xl border px-4 py-2.5 text-[14px]"
                style={{ borderColor: "var(--line)", background: "var(--rah-field)", outline: "none" }}
              />
            </div>
          ))}
          <button className="btn-primary" onClick={() => setStation(3)}>Station 4: writing</button>
        </div>
      )}

      {station === 3 && (
        <div className="card-rah p-8">
          <div className="display text-[20px] font-bold mb-1">Station 4: writing</div>
          <p className="text-[13.5px] mb-5" style={{ color: "var(--muted)" }}>
            300 to 500 words, no assistance: <b>Is it ethical to use algorithmic systems to rank citizens by their behavior? Defend a position.</b>
          </p>
          <textarea
            value={writing}
            onChange={(e) => setWriting(e.target.value)}
            className="w-full rounded-2xl border p-5 min-h-[280px] text-[15px] leading-[1.8]"
            style={{ borderColor: "var(--line)", background: "var(--rah-field)", outline: "none" }}
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-[13px]" style={{ color: "var(--muted)" }}>{writing.split(/\s+/).filter(Boolean).length} words</span>
            <button className="btn-primary" disabled={writing.split(/\s+/).filter(Boolean).length < 80} onClick={save}>
              Finish checkpoint
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
