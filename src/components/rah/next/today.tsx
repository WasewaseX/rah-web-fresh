"use client";

import type { Boot } from "@/app/page";
import { SectionTitle, Bar, Note, Ring } from "./bits";

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
      <SectionTitle
        title={`Day ${boot.learner.streak > 0 ? boot.learner.streak : 1} of your B2 to C1 path`}
        sub="Ninety to one hundred twenty deliberate minutes. Exposure alone does not move the needle; retrieval does."
        right={
          <div className="hidden md:block">
            <Ring pct={pct} size={64} stroke={7}>
              <span className="text-[12px] font-bold">{boot.protocol.donePlanned}/{boot.protocol.totalPlanned}m</span>
            </Ring>
          </div>
        }
      />

      {!boot.learner.onboarded ? (
        <div className="card-rah p-8 mb-5 text-center">
          <div className="display text-[22px] font-bold mb-2">Start with measurement, not lessons</div>
          <p className="text-[14px] max-w-xl mx-auto leading-relaxed mb-5" style={{ color: "var(--muted)" }}>
            Fifteen minutes: 25 multiple choice questions and one short writing sample. Rah places you on the CEFR scale,
            finds your weakest strand, and bends the daily plan toward it. You cannot study wrong if you measure first.
          </p>
          <button className="btn-primary" onClick={() => go("placement")}>
            Take the placement test
          </button>
        </div>
      ) : (
        <>
          {weakest ? (
            <Note tone="accent">
              Your placement points to <b>{weakestLabel[weakest[0]] ?? weakest[0]}</b> as the current bottleneck, so today&apos;s
              plan gives it extra minutes. This rebalances every time you run a checkpoint.
            </Note>
          ) : (
            <Note>
              No diagnosis yet. Run a checkpoint from the Measure menu and the plan will start bending toward your weakest skill.
            </Note>
          )}
        </>
      )}

      {/* protocol plan */}
      <div className="grid md:grid-cols-2 gap-4 mt-5">
        {boot.plan.map((p) => {
          const done = boot.protocol.minutesByStrand[p.strand] ?? 0;
          const pctS = Math.min(100, Math.round((done / p.minutes) * 100));
          return (
            <button
              key={p.strand}
              onClick={() => go(p.view)}
              className="card-rah p-5 text-left transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[15px] font-bold">{p.label}</span>
                <span className="chip" style={pctS >= 100 ? { background: "var(--accent-dim)", color: "var(--accent-deep)", borderColor: "transparent" } : undefined}>
                  {pctS >= 100 ? "done" : `${done}/${p.minutes} min`}
                </span>
              </div>
              <p className="text-[13px] mb-3 leading-relaxed" style={{ color: "var(--muted)" }}>{p.note}</p>
              <Bar pct={pctS} />
            </button>
          );
        })}
      </div>

      {/* quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
        {[
          { label: "cards due now", value: boot.counts.due, view: "review" },
          { label: "new cards today", value: boot.newToday, view: "review" },
          { label: "grammar lessons done", value: `${boot.stats.grammarDone}/${boot.stats.grammarTotal}`, view: "grammar" },
          { label: "checkpoints taken", value: boot.stats.checkpointCount, view: "checkpoint" },
        ].map((s) => (
          <button key={s.label} onClick={() => go(s.view)} className="card-rah p-4 text-left hover:shadow-md transition-shadow">
            <div className="display text-[24px] font-bold">{s.value}</div>
            <div className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>{s.label}</div>
          </button>
        ))}
      </div>

      <div className="mt-5">
        <Note tone="warn">{tip}</Note>
      </div>

      <div className="card-rah p-5 mt-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="font-bold text-[14.5px]">
            Your AI coach is live {boot.ai.builtin ? "(built-in engine)" : `(${boot.ai.model})`}
          </div>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--muted)" }}>
            Talk to the tutor, get your writing graded against CEFR, turn any article into cards, record your voice and get
            a repair plan. No key needed, it all just works.
          </p>
        </div>
        <button className="btn-primary text-[13px]" onClick={() => go("tutor")}>
          Talk to the coach
        </button>
      </div>
    </div>
  );
}
