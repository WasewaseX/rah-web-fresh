"use client";

import { useCallback, useEffect, useState } from "react";
import type { Boot } from "@/app/page";
import { Bar, Note, Ring, StrandIcon } from "./bits";
import { confetti, xpBurst } from "./celebrate";
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

type MissionStep = { id: string; label: string; progress: string; done: boolean; view: string };
type RecapItem = { id: string; label: string; now: number; prev: number; delta: number; unit: string };
type MissionState = {
  day: number;
  due: number;
  xp: number;
  steps: MissionStep[];
  allDone: boolean;
  claimed: boolean;
  reward: number;
  recap?: { weekStart: number; items: RecapItem[] };
  restart?: { show: boolean; awayDays?: number; due?: number; message?: string; steps?: string[] };
};

// The Daily English Mission (roadmap §9): four connected actions computed
// server-side from the learner's real state, one XP reward per day, claimable
// only when every step is measured as done. Styling follows the Task 117
// doctrine: neutral surfaces, the single accent owns progress, green stays
// semantic (done), gold stays XP.
function MissionCard({ go }: { go: (v: string) => void }) {
  const [m, setM] = useState<MissionState | null>(null);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/mission", { cache: "no-store" });
      if (!r.ok) return;
      setM((await r.json()) as MissionState);
    } catch {
      /* offline: the card stays quiet; the outbox still covers learning actions */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const claim = useCallback(async () => {
    setClaiming(true);
    try {
      const r = await fetch("/api/mission", { method: "POST" });
      const j = (await r.json()) as { ok?: boolean; reward?: number };
      if (j.ok && (j.reward ?? 0) > 0) {
        xpBurst(j.reward as number);
        confetti(40);
      }
      await load();
    } catch {
      /* keep state; the learner can retry */
    } finally {
      setClaiming(false);
    }
  }, [load]);

  if (!m) return null;
  const doneCount = m.steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / m.steps.length) * 100);

  return (
    <div className="card-rah rah-lift rah-rise p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="display text-[19px] font-black">Today&apos;s English mission</div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-extrabold"
          style={{ background: "rgba(255, 176, 46, 0.14)", color: "#ffd08a", border: "1px solid rgba(255, 176, 46, 0.28)" }}
          title="Banked once all four steps are measured as done"
        >
          <Zap className="h-3.5 w-3.5" />
          +{m.reward} XP
        </span>
      </div>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
        One connected session, built from your due queue and today&apos;s real activity. The reward lands only when the work is measured as
        done - not for opening the app.
      </p>

      <div className="mt-4 grid gap-2">
        {m.steps.map((s, i) => (
          <button
            key={s.id}
            onClick={() => go(s.view)}
            className="flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]"
          >
            {s.done ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: "#6ee7b7" }} />
            ) : (
              <span
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
                style={{ border: "1.5px solid var(--line)", color: "var(--muted)" }}
              >
                {i + 1}
              </span>
            )}
            <span className="min-w-0 flex-1">
              {/* Task 119 fix: truncate (nowrap) inside a grid item made the
                 grid's min-content the full label width - the card blew past
                 the 390px viewport and the whole page scrolled sideways. Wrap
                 instead: nothing is lost, nothing overflows. */}
              <span className={`block text-[13.5px] font-bold leading-snug ${s.done ? "line-through opacity-60" : ""}`}>{s.label}</span>
              <span className="block text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>
                {s.progress}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0" style={{ color: "var(--muted)" }} />
          </button>
        ))}
      </div>

      <div className="mt-4">
        <Bar pct={pct} color="var(--rah-primary-action)" />
      </div>

      {/* §9: missed day -> supportive restart plan. No guilt, no fake streak:
          the queue held the learner's place and the plan is shorter on purpose. */}
      {m.restart?.show ? (
        <div className="mt-4 rounded-2xl p-4" style={{ background: "var(--rah-callout)" }}>
          <div className="text-[13px] font-bold mb-1">Back after {m.restart.awayDays} quiet days</div>
          <p className="text-[12.5px] mb-2" style={{ color: "var(--muted)" }}>{m.restart.message}</p>
          <ul className="text-[12.5px] leading-relaxed space-y-0.5">
            {(m.restart.steps ?? []).map((s, i) => (
              <li key={i}>{i + 1}. {s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* §9: weekly recap - what measurably improved, this week vs last, zero AI.
          A line renders only when both windows have data to compare. */}
      {m.recap && m.recap.items.length > 0 ? (
        <div className="mt-4">
          <div className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            This week vs last
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
            {m.recap.items.map((it) => (
              <span key={it.id} className="text-[12.5px] font-semibold" title={`previous 7 days: ${it.prev}${it.unit}`}>
                {it.label}: {it.now}{it.unit}
                <span style={{ color: it.delta >= 0 ? "#6ee7b7" : "#ffb02e", marginInlineStart: 4 }}>
                  {it.delta >= 0 ? "\u25b2" : "\u25bc"} {Math.abs(it.delta)}{it.unit}
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {m.claimed ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-extrabold"
            style={{ background: "rgba(52, 211, 153, 0.12)", color: "#6ee7b7", border: "1px solid rgba(52, 211, 153, 0.3)" }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> mission complete - +{m.reward} XP banked
          </span>
        ) : m.allDone ? (
          <button className="btn-primary text-[13px]" onClick={() => void claim()} disabled={claiming}>
            {claiming ? "Banking…" : `Claim +${m.reward} XP`}
          </button>
        ) : (
          <span className="text-[12.5px] font-semibold" style={{ color: "var(--muted)" }}>
            {doneCount}/{m.steps.length} done - the +{m.reward} XP unlocks when all four land.
          </span>
        )}
      </div>
    </div>
  );
}

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

      <MissionCard go={go} />

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

      {/* protocol plan - one professional system: identity by glyph, the
         single accent owns progress, color stays semantic (done = green). */}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {boot.plan.map((p, i) => {
          const done = boot.protocol.minutesByStrand[p.strand] ?? 0;
          const pctS = Math.min(100, Math.round((done / p.minutes) * 100));
          return (
            <button
              key={p.strand}
              onClick={() => go(p.view)}
              className="card-rah rah-lift rah-rise p-5 text-left"
              style={{ animationDelay: `${0.04 * i}s` }}
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
                    style={{ background: "rgba(255, 255, 255, 0.045)", color: "var(--text-soft, #a0abbe)", border: "1px solid var(--line)" }}
                  >
                    {done}/{p.minutes} min
                  </span>
                )}
              </div>
              <p className="mb-3 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>{p.note}</p>
              <Bar pct={pctS} color="var(--rah-primary-action)" />
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
      <div className="card-rah rah-lift mt-5 flex flex-wrap items-center justify-between gap-4 p-5">
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
