"use client";

import type { ReactNode } from "react";
import { SectionTitle, Note, Fa } from "../bits";
import { PASSAGES, MISS_TYPES } from "@/lib/content";
import { overlapPct, speakSlow, stopSpeak } from "../speech";

import type { ListenPassage } from "@/content/listening";

// The pick screen: passage library grid.
export function PickPhase(props: {
  setPid: (v: string) => void;
  setPhase: (v: "r1") => void;
  setNoVoice: (v: boolean) => void;
  startRef: { current: number };
}) {
  const { setPid, setPhase, setNoVoice, startRef } = props;
  return (
    <div>
      <SectionTitle
        title="Listening lab"
        sub="The problem is rarely vocabulary. It is decoding: reductions, linking and speed. Five rounds fix what Netflix never will."
      />
      <div className="grid md:grid-cols-3 gap-4">
        {PASSAGES.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setPid(p.id);
              startRef.current = Date.now();
              setPhase("r1");
              setNoVoice(false);
            }}
            className="card-rah p-5 text-left hover:shadow-md transition-shadow"
          >
            {/* Task 109: level+length chips demoted to a quiet meta line. */}
            <div className="text-[12px] font-semibold mb-2" style={{ color: "var(--muted)" }}>
              {p.level} · ~{p.seconds}s
            </div>
            <div className="font-bold text-[15.5px]">{p.title}</div>
            <div className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>{p.vocab.length} target words, {p.features.length} sound features, {p.questions.length} questions</div>
          </button>
        ))}
      </div>
      <div className="mt-5">
        <Note>
          Use headphones. Round 1 is blind: you will hear the passage once at natural speed and write what you caught.
          No transcript yet, that is the point.
        </Note>
      </div>
    </div>
  );
}

// Round 1, blind listening: one natural-speed pass, write what you caught.
export function R1(props: {
  header: ReactNode;
  playing: boolean;
  noVoice: boolean;
  caught: string;
  play: (rate?: number) => Promise<void>;
  setCaught: (v: string) => void;
  log: (round: number, missType?: string, d?: string) => void;
  setPhase: (v: "r2") => void;
}) {
  const { header, playing, noVoice, caught, play, setCaught, log, setPhase } = props;
  return (
    <div className="max-w-2xl mx-auto">
      {header}
      <div className="card-rah p-8 text-center">
        <div className="display text-[22px] font-bold mb-1">Round 1, blind listening</div>
        <p className="text-[13.5px] mb-6" style={{ color: "var(--muted)" }}>One pass at natural speed. Write whatever you caught, fragments are fine.</p>
        <button className="btn-primary text-[15px] px-8 py-3" onClick={() => play(1)} disabled={playing}>
          {playing ? "playing..." : "Play the passage"}
        </button>
        {noVoice ? <div className="mt-4"><Note tone="warn">No system English voice found. Open Rah in your normal desktop browser (Chrome or Edge on Windows ships several voices) and audio will work. You can still do rounds 3 and 5 now.</Note></div> : null}
        <textarea
          value={caught}
          aria-label="What you caught"
          onChange={(e) => setCaught(e.target.value)}
          className="w-full rounded-2xl border p-4 min-h-[130px] text-[15px] mt-6 leading-relaxed"
          style={{ borderColor: "var(--line)", background: "var(--rah-field)", outline: "none" }}
          placeholder="What did I understand? Words, topics, half sentences, anything."
        />
        <div className="mt-4">
          <button className="btn-ghost" disabled={!playing && caught.trim() === "" && !noVoice} onClick={() => { log(1); setPhase("r2"); }}>
            I caught what I could, next round
          </button>
        </div>
      </div>
    </div>
  );
}

// Round 2, replay and diagnose: tag exactly what broke.
export function R2(props: {
  header: ReactNode;
  play: (rate?: number) => Promise<void>;
  segments: string[];
  segPlaying: number;
  playSegment: (i: number, rate?: number) => Promise<void>;
  misses: Record<string, boolean>;
  setMisses: (fn: (x: Record<string, boolean>) => Record<string, boolean>) => void;
  detail: string;
  setDetail: (v: string) => void;
  log: (round: number, missType?: string, d?: string) => void;
  setPhase: (v: "r3") => void;
}) {
  const { header, play, segments, segPlaying, playSegment, misses, setMisses, detail, setDetail, log, setPhase } = props;
  return (
    <div className="max-w-2xl mx-auto">
      {header}
      <div className="card-rah p-8">
        <div className="display text-[22px] font-bold mb-1">Round 2, replay and diagnose</div>
        <p className="text-[13.5px] mb-6" style={{ color: "var(--muted)" }}>
          Listen again, slower if you need it. Tag exactly what broke. The tag, not the sentence, is what trains your ear.
        </p>
        <div className="flex gap-2 justify-center mb-6 flex-wrap">
          <button className="btn-ghost text-[13px]" onClick={() => play(1)}>Play at 1.0x</button>
          <button className="btn-ghost text-[13px]" onClick={() => play(0.75)}>Play at 0.75x</button>
        </div>
        {segments.length > 1 ? (
          <div className="mb-5">
            <div className="text-[12.5px] font-bold mb-2" style={{ color: "var(--muted)" }}>Replay one segment at 0.85x — the exact spot that broke</div>
            <div className="flex flex-wrap gap-1.5">
              {segments.map((s, i) => (
                <button
                  key={i}
                  className="btn-ghost text-[12px] px-3 py-1.5"
                  title={s.length > 90 ? s.slice(0, 90) + "…" : s}
                  disabled={segPlaying >= 0}
                  onClick={() => playSegment(i)}
                >
                  {segPlaying === i ? "…" : `sentence ${i + 1}`}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="grid sm:grid-cols-2 gap-2 mb-5">
          {MISS_TYPES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMisses((x) => ({ ...x, [m.id]: !x[m.id] }))}
              className="rounded-2xl border px-4 py-3 text-left"
              style={misses[m.id] ? { background: "var(--accent-dim)", borderColor: "transparent" } : { borderColor: "var(--line)" }}
            >
              <div className="font-bold text-[14px]">{m.label}</div>
              <div className="text-[12px]" style={{ color: "var(--muted)" }}>{m.note}</div>
            </button>
          ))}
        </div>
        <textarea
          value={detail}
          aria-label="What you would say"
          onChange={(e) => setDetail(e.target.value)}
          className="w-full rounded-2xl border p-4 min-h-[80px] text-[14.5px]"
          style={{ borderColor: "var(--line)", background: "var(--rah-field)", outline: "none" }}
          placeholder="Optional: name one specific word or sound that fooled you."
        />
        <div className="mt-4 text-right">
          <button className="btn-primary" onClick={() => { Object.keys(misses).forEach((k) => misses[k] && log(2, k, detail)); setPhase("r3"); }}>
            Next: see the transcript
          </button>
        </div>
      </div>
    </div>
  );
}

// Round 3, the transcript: read it, mine the vocabulary and the features.
export function R3(props: {
  header: ReactNode;
  passage: ListenPassage;
  addedVocab: Record<string, "loading" | "done" | "exists">;
  addVocab: (w: string, fa: string) => Promise<void>;
  setPhase: (v: "r4") => void;
}) {
  const { header, passage, addedVocab, addVocab, setPhase } = props;
  return (
    <div className="max-w-2xl mx-auto">
      {header}
      <div className="card-rah p-8">
        <div className="display text-[22px] font-bold mb-1">Round 3, the transcript</div>
        <p className="text-[13.5px] mb-5" style={{ color: "var(--muted)" }}>
          Read it. Find the exact spots you missed. Note how the features below sound different from school English.
        </p>
        <p className="text-[17px] leading-loose mb-6">{passage.transcript}</p>

        <div className="rounded-2xl p-5 mb-4" style={{ background: "var(--rah-callout)" }}>
          <div className="font-bold text-[13.5px] mb-2">Target vocabulary</div>
          {passage.vocab.map((v) => (
            <div key={v.w} className="flex items-baseline justify-between gap-4 py-1.5 border-b last:border-0" style={{ borderColor: "var(--line)" }}>
              <span className="font-bold text-[14.5px]">{v.w}</span>
              <span className="flex items-baseline gap-3">
                <Fa className="text-[13.5px]">{v.fa}</Fa>
                <button
                  className="btn-ghost text-[11.5px] px-2.5 py-1 whitespace-nowrap"
                  disabled={addedVocab[v.w] === "loading"}
                  onClick={() => addVocab(v.w, v.fa)}
                >
                  {addedVocab[v.w] === "done" ? "in queue ✓" : addedVocab[v.w] === "exists" ? "already queued" : "+ review queue"}
                </button>
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-2xl p-5 mb-6" style={{ background: "var(--amber-dim)" }}>
          <div className="font-bold text-[13.5px] mb-2">How it actually sounds</div>
          {passage.features.map((f) => (
            <div key={f.say} className="py-1.5 text-[13.5px]">
              <b>{f.say}</b> <span style={{ color: "var(--muted)" }}>sounds like</span> <b>{f.sounds}</b>
              <span style={{ color: "var(--muted)" }}> · {f.note}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 justify-end">
          <button className="btn-ghost text-[13px]" onClick={() => speakSlow(passage.transcript)}>Hear it slowly once</button>
          <button className="btn-primary" onClick={() => setPhase("r4")}>Round 4</button>
        </div>
      </div>
    </div>
  );
}

// Round 4, listen clean: full speed, no transcript.
export function R4(props: {
  header: ReactNode;
  playing: boolean;
  lastRate: number;
  play: (rate?: number) => Promise<void>;
  setPhase: (v: "r5") => void;
}) {
  const { header, playing, lastRate, play, setPhase } = props;
  return (
    <div className="max-w-2xl mx-auto">
      {header}
      <div className="card-rah p-8 text-center">
        <div className="display text-[22px] font-bold mb-1">Round 4, listen clean</div>
        <p className="text-[13.5px] mb-6" style={{ color: "var(--muted)" }}>
          Full speed, no transcript. The spots you tagged in round 2 should now resolve into words. If they still blur, tag them again later.
        </p>
        <button className="btn-primary text-[15px] px-8 py-3" onClick={() => play(lastRate === 0.75 ? 1 : lastRate)}>
          {playing ? "playing..." : "Play at natural speed"}
        </button>
        <div className="mt-8">
          <button className="btn-primary" onClick={() => setPhase("r5")}>Round 5: reproduce</button>
        </div>
      </div>
    </div>
  );
}

// Round 5, reproduce from memory: type what you reconstructed.
export function R5(props: {
  header: ReactNode;
  repro: string;
  setRepro: (v: string) => void;
  passage: ListenPassage;
  log: (round: number, missType?: string, d?: string) => void;
  finish: () => void;
}) {
  const { header, repro, setRepro, passage, log, finish } = props;
  const pct = overlapPct(repro, passage.transcript);
  return (
    <div className="max-w-2xl mx-auto">
      {header}
      <div className="card-rah p-8">
        <div className="display text-[22px] font-bold mb-1">Round 5, reproduce from memory</div>
        <p className="text-[13.5px] mb-5" style={{ color: "var(--muted)" }}>
          Close your eyes, replay it in your head, then type as much as you can reconstruct. Production is what makes listening stick.
        </p>
        <textarea
          value={repro}
          aria-label="Reproduce from memory"
          onChange={(e) => setRepro(e.target.value)}
          className="w-full rounded-2xl border p-4 min-h-[140px] text-[15px] leading-relaxed"
          style={{ borderColor: "var(--line)", background: "var(--rah-field)", outline: "none" }}
          placeholder="Type the passage from memory. Approximations welcome."
        />
        {repro.trim() ? (
          <div className="mt-4">
            <div className="flex justify-between text-[13px] mb-1">
              <span className="font-semibold">Word overlap with the transcript</span>
              <span style={{ color: "var(--muted)" }}>{pct}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--rah-track)" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct > 70 ? "var(--accent)" : "var(--gold)" }} />
            </div>
          </div>
        ) : null}
        <div className="mt-5 text-right">
          <button className="btn-primary" disabled={!repro.trim()} onClick={() => { log(5, "", repro.slice(0, 500)); finish(); }}>
            Finish the cycle
          </button>
        </div>
      </div>
    </div>
  );
}

// Shared chip header for the in-passage rounds (verbatim from the parent).
export function ListeningHeader(props: { passage: ListenPassage; setPhase: (v: "pick") => void }) {
  const { passage, setPhase } = props;
  return (
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
}
