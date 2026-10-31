"use client";

import { useRef, useState } from "react";
import { SectionTitle, Note, Fa } from "./bits";
import { PASSAGES, MISS_TYPES } from "@/lib/content";
import { speak, stopSpeak, speakSlow, overlapPct } from "./speech";

// The 5-round decoding cycle from the research base:
// blind listen, diagnose, transcript, re-listen, reproduce.
type Phase = "pick" | "r1" | "r2" | "r3" | "r4" | "r5" | "end";

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
  const startRef = useRef(Date.now());

  const passage = PASSAGES.find((p) => p.id === pid);

  const play = async (rate = 1) => {
    setLastRate(rate);
    if (!passage) return;
    setPlaying(true);
    const ok = await speak(passage.transcript, rate);
    setPlaying(false);
    if (!ok) setNoVoice(true);
  };

  const log = (round: number, missType = "", d = "") => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "listening", passageId: pid, round, missType, detail: d }),
    }).catch(() => undefined);
  };

  const finish = () => {
    const mins = Math.max(1, Math.round((Date.now() - startRef.current) / 60000));
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "listening", minutes: mins, meta: { passageId: pid } }),
    }).then(onDone).catch(() => undefined);
    setPhase("end");
  };

  if (phase === "pick") {
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
              <div className="flex items-center gap-2 mb-2">
                <span className="chip chip-accent">{p.level}</span>
                <span className="chip">~{p.seconds}s</span>
              </div>
              <div className="font-bold text-[15.5px]">{p.title}</div>
              <div className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>{p.vocab.length} target words, {p.features.length} sound features</div>
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

  if (!passage) return null;

  const header = (
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

  if (phase === "r1") {
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

  if (phase === "r2") {
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

  if (phase === "r3") {
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
                <Fa className="text-[13.5px]">{v.fa}</Fa>
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

  if (phase === "r4") {
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

  if (phase === "r5") {
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

  return (
    <div className="max-w-xl mx-auto text-center pt-10">
      <div className="display text-[30px] font-bold mb-2">Decoding cycle complete</div>
      <p className="text-[14px] mb-8 leading-relaxed" style={{ color: "var(--muted)" }}>
        Five rounds: blind, diagnose, transcript, clean listen, reproduce. Missed words live in the transcript round; the
        real score is how much more resolved round 4 sounded than round 1.
      </p>
      <div className="flex gap-3 justify-center">
        <button className="btn-primary" onClick={() => setPhase("pick")}>Another passage</button>
      </div>
    </div>
  );
}
