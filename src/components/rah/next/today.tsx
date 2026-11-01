"use client";

import type { Boot } from "@/app/page";
import { Bar, Note, Ring, StrandIcon, strandColors } from "./bits";
import { ArrowRight, CheckCircle2, Flame, Zap } from "lucide-react";

const TIPS = [
  "Feeling easy is not the same as learning. If retrieval feels hard, it is working.",
  "Sleep is part of studying. Your brain consolidates vocabulary after you close the app.",
  "Do not measure hours studied. Measure what you can understand and produce without help.",
  "One card, four directions: see it, recall its meaning, produce it, use it in a sentence.",
  "Rereading builds familiarity. Retrieval builds memory. They feel different and they are different.",
  "Collocations beat single words: make a decision, not do a decision.",
  "Speak the same task three times. The third version is the one that sticks.",
];

export default function TodayView({ boot, go }: { boot: Boot; go: (v: string) => void }) {
  const pct = boot.protocol.totalPlanned ? Math.round((boot.protocol.donePlanned / boot.protocol.totalPlanned) * 100) : 0;
  const tip = TIPS[new Date().getDate() % TIPS.length];
  const dx = boot.learner.diagnosis ?? {};
  const weakest = Object.entries(dx).sort((a, b) => a[1] - b[1])[0];
  const weakestLabel: Record<string, string> = {
    review: "spaced retrieval (grammar + vocabulary accuracy)",
    listening: "listening",
    reading: "reading",
    speaking: "speaking",
    writing: "writing",
    sound: "pronunciation perception",
  };

  return (
    <div>
      {/* Task 115: the hero. The old header was two gray text lines - honest
         but invisible. The day counter is now a solid-ink display headline on
         an ambient card, flanked by the two live signals a learner cares
         about: the streak flame and total XP. (Detector-driven amendments:
         no kicker above the heading, no gradient text, no chromatic halo -
         solid #cfe0ff ink, neutral breathe elevation.) */}
      <div className="card-rah rah-hero rah-rise mb-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="display text-[26px] font-black leading-tight text-[#cfe0ff] md:text-[32px]">
              Day {boot.learner.streak > 0 ? boot.learner.streak : 1} — keep the chain alive
            </h1>
            <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
              Ninety to one hundred twenty deliberate minutes. Exposure alone does not move the needle; retrieval does.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-extrabold"
                style={{ background: "rgba(255, 176, 46, 0.14)", color: "#ffd08a", border: "1px solid rgba(255, 176, 46, 0.28)" }}
                title="Current streak"
              >
                <span className="rah-flame">
                  <Flame className="h-3.5 w-3.5" />
                </span>
                {boot.learner.streak}-day streak
              </span>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-extrabold"
                style={{ background: "rgba(255, 255, 255, 0.045)", color: "var(--text-soft, #a0abbe)", border: "1px solid var(--line)" }}
                title="Total experience points"
              >
                <Zap className="h-3.5 w-3.5" style={{ color: "#ffd166" }} />
                {boot.learner.xp} XP
              </span>
              {boot.learner.bestStreak > 0 && (
                <span className="hidden items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-bold sm:inline-flex" style={{ background: "rgba(255, 255, 255, 0.045)", color: "var(--text-soft, #a0abbe)", border: "1px solid var(--line)" }}>
                  best {boot.learner.bestStreak}
                </span>
              )}
            </div>
          </div>
          <div className="hidden shrink-0 md:block">
            <Ring pct={pct} size={84} stroke={8}>
              <span className="text-[13px] font-black">
                {boot.protocol.donePlanned}/{boot.protocol.totalPlanned}m
              </span>
            </Ring>
          </div>
        </div>
      </div>

      {!boot.learner.onboarded ? (
        <div className="card-rah rah-lift mb-5 flex flex-wrap items-center gap-5 p-6">
          <StrandIcon strand="placement" size={56} radius={18} />
          <div className="min-w-[220px] flex-1">
            <div className="display mb-1 text-[20px] font-bold">Start with measurement, not lessons</div>
            <p className="text-[14px] leading-relaxed" style={{ color: "var(--muted)" }}>
              Fifteen minutes: 25 multiple choice questions and one short writing sample. Rah places you on the CEFR scale, finds your
              weakest strand, and bends the daily plan toward it. You cannot study wrong if you measure first.
            </p>
          </div>
          <button className="btn-primary" onClick={() => go("placement")}>
            Take the placement test
          </button>
        </div>
      ) : (
        <>
          {weakest ? (
            <Note tone="accent">
              Your placement points to <b>{weakestLabel[weakest[0]] ?? weakest[0]}</b> as the current bottleneck, so today&apos;s plan gives
              it extra minutes. This rebalances every time you run a checkpoint.
            </Note>
          ) : (
            <Note>
              No diagnosis yet. Run a checkpoint from the Measure menu and the plan will start bending toward your weakest skill.
            </Note>
          )}
        </>
      )}

      {/* protocol plan - each strand wears its own color now */}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {boot.plan.map((p, i) => {
          const done = boot.protocol.minutesByStrand[p.strand] ?? 0;
          const pctS = Math.min(100, Math.round((done / p.minutes) * 100));
          const c = strandColors(p.strand);
          return (
            <button
              key={p.strand}
              onClick={() => go(p.view)}
              className="card-rah rah-lift rah-rise p-5 text-left"
              style={{
                animationDelay: `${0.04 * i}s`,
                "--lift-glow": `${c.deep}59`,
                "--lift-tint": `${c.deep}26`,
              } as React.CSSProperties}
            >
              <div className="mb-3 flex items-center gap-3">
                <StrandIcon strand={p.strand} size={44} />
                <div className="min-w-0 flex-1">
                  <span className="block text-[15px] font-extrabold">{p.label}</span>
                  <span className="block text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
                    {pctS >= 100 ? "completed - nice" : `${p.minutes} planned today`}
                  </span>
                </div>
                {pctS >= 100 ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-extrabold"
                    style={{ background: "rgba(52, 211, 153, 0.12)", color: "#6ee7b7", border: "1px solid rgba(52, 211, 153, 0.3)" }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> done
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-extrabold"
                    style={{ background: `${c.deep}29`, color: c.bright, border: `1px solid ${c.deep}52` }}
                  >
                    {done}/{p.minutes} min
                  </span>
                )}
              </div>
              <p className="mb-3 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>{p.note}</p>
              <Bar pct={pctS} deep={c.deep} bright={c.bright} />
            </button>
          );
        })}
      </div>

      {/* quick stats - tiny strand tiles replace bare numbers */}
      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "cards due now", value: boot.counts.due, view: "review", strand: "review" },
          { label: "new cards today", value: boot.newToday ?? 0, view: "review", strand: "other" },
          { label: "grammar lessons done", value: `${boot.stats.grammarDone}/${boot.stats.grammarTotal}`, view: "grammar", strand: "grammar" },
          { label: "checkpoints taken", value: boot.stats.checkpointCount, view: "checkpoint", strand: "placement" },
        ].map((s, i) => (
          <button
            key={s.label}
            onClick={() => go(s.view)}
            className="card-rah rah-lift rah-rise flex items-center gap-3 p-4 text-left"
            style={{ animationDelay: `${0.04 * i}s` }}
          >
            <StrandIcon strand={s.strand} size={36} radius={12} />
            <div className="min-w-0">
              <div className="display truncate text-[22px] font-black leading-none">{s.value}</div>
              <div className="mt-1 text-[11.5px] font-semibold leading-tight" style={{ color: "var(--muted)" }}>{s.label}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-5">
        <Note tone="warn">{tip}</Note>
      </div>

      {/* coach card - the AI gets a face too */}
      <div className="card-rah rah-lift mt-5 flex flex-wrap items-center justify-between gap-4 p-5" style={{ "--lift-glow": "rgba(129, 140, 248, 0.4)" } as React.CSSProperties}>
        <div className="flex min-w-[240px] flex-1 items-center gap-4">
          <StrandIcon strand="tutor" size={44} />
          <div>
            <div className="text-[14.5px] font-extrabold">
              Your AI coach is live {boot.ai.builtin ? "(built-in engine)" : `(${boot.ai.model})`}
            </div>
            <p className="mt-0.5 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
              Talk to the tutor, get your writing graded against CEFR, turn any article into cards, record your voice and get a repair
              plan. No key needed, it all just works.
            </p>
          </div>
        </div>
        <button className="btn-primary text-[13px]" onClick={() => go("tutor")}>
          Talk to the coach <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
