"use client";

import { useEffect, useState } from "react";
import type { Boot } from "@/app/page";
import { SectionTitle, Stat, Bar } from "./bits";

interface ProgressData {
  accuracy: number;
  delta: number;
  reviewsThisWeek: number;
  reviewsPrevWeek: number;
  byDay: { day: number; count: number }[];
  strands: Record<string, number>;
  mastery: { new: number; young: number; mature: number; lapses: number };
  calendar: { day: number; active: boolean }[];
  dirs: Record<string, number>;
  checkpoints: { day: number; listeningPct: number; readingScore: number }[];
  totalReviews: number;
  deckTotal?: number;
}

// Task 106: this component used to render whatever JSON arrived - an auth
// error body ({error: "Sign in..."}) passed the truthy check and crashed on
// d.byDay.map. The fetch now validates the shape before it ever reaches the
// render, and an expired session gets an honest sign-in state instead of a
// stack trace.
function isProgressData(x: unknown): x is ProgressData {
  if (!x || typeof x !== "object") return false;
  const d = x as Partial<ProgressData>;
  return (
    Array.isArray(d.byDay) &&
    !!d.strands && typeof d.strands === "object" &&
    !!d.mastery && typeof d.mastery === "object" &&
    Array.isArray(d.calendar) &&
    !!d.dirs && typeof d.dirs === "object" &&
    Array.isArray(d.checkpoints) &&
    typeof d.totalReviews === "number"
  );
}

const STRAND_LABELS: Record<string, string> = {
  review: "Spaced retrieval",
  listening: "Listening",
  reading: "Reading",
  speaking: "Speaking",
  writing: "Writing",
  sound: "Pronunciation",
};

// The live retrieval directions (review/queue's directionsFor rotation).
// The old-generation labels (ef/sent) stay for historical rows.
const DIR_LABELS: Record<string, string> = {
  cloze: "Gap fill (type the word)",
  reverse: "Translate back (EN → FA)",
  fa2en: "Farsi → English (type it)",
  fae: "Produce English (FA → EN)",
  audio: "Audio dictation",
  bank: "Word-bank build",
  mcq_fa: "Meaning choice",
  pairs: "Pair match",
  ef: "English, recall meaning",
  sent: "Use in your own sentence",
};

export default function ProgressView({ boot }: { boot: Boot }) {
  const [d, setD] = useState<ProgressData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/progress", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (isProgressData(j)) setD(j);
        else if (j && typeof j.error === "string") setErr(j.error);
        else setErr("Progress data came back malformed.");
      })
      .catch(() => setErr("Could not reach the server."));
  }, []);

  if (err) {
    const auth = err.toLowerCase().includes("sign in");
    return (
      <div className="max-w-xl mx-auto text-center pt-16">
        <div className="display text-[26px] font-bold mb-2">Progress is resting.</div>
        <p className="text-[14px] mb-6 leading-relaxed" style={{ color: "var(--muted)" }}>
          {auth
            ? "Your session expired, so your history stays private. Sign in again from the Home screen and this page fills in."
            : err + " Give it a moment and reopen this page - nothing is lost."}
        </p>
      </div>
    );
  }

  if (!d) return <div className="py-20 text-center text-[14px]" style={{ color: "var(--muted)" }}>crunching your history...</div>;

  const deck = d.deckTotal ?? 218;
  const maxDay = Math.max(1, ...d.byDay.map((x) => x.count));
  const reviews14 = d.byDay.reduce((a, x) => a + x.count, 0);
  const bestDay = Math.max(0, ...d.byDay.map((x) => x.count));
  const totalStrandMin = Object.values(d.strands).reduce((a, b) => a + b, 0) || 1;
  const maturePct = Math.round((d.mastery.mature / Math.max(1, deck - d.mastery.new)) * 100);

  return (
    <div>
      <SectionTitle
        title="Progress"
        sub="Accuracy with a delta, the four-strands balance, and where every card sits in its forgetting curve."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <Stat value={`${d.accuracy}%`} label="recall this week" delta={d.delta} accent />
        <Stat value={d.reviewsThisWeek} label="retrievals this week" />
        <Stat value={d.totalReviews} label="retrievals all time" />
        <Stat value={`${boot.learner.streak}d`} label="current streak" />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-5">
        <div className="card-rah p-6">
          <div className="font-bold text-[14.5px] mb-4">Retrievals, last 14 days</div>
          <div className="flex items-end gap-1.5 h-36">
            {d.byDay.map((x) => (
              <div key={x.day} className="flex-1 flex flex-col items-center gap-1.5">
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{ height: `${(x.count / maxDay) * 100}%`, minHeight: x.count ? 4 : 2, background: x.count ? "var(--accent)" : "var(--rah-dot)" }}
                  title={`${x.count} retrievals`}
                />
                <span className="text-[9.5px]" style={{ color: "var(--muted)" }}>{x.day % 7 === 0 ? new Date(x.day * 86400000).toLocaleDateString("en", { weekday: "short" }).slice(0, 2) : ""}</span>
              </div>
            ))}
          </div>
          {reviews14 === 0 ? (
            <p className="text-[12px] mt-3" style={{ color: "var(--muted)" }}>A quiet fortnight. Every bar is a day; take a review session and the first bar lights up.</p>
          ) : (
            <p className="text-[12px] mt-3" style={{ color: "var(--muted)" }}>{reviews14} retrievals across the fortnight{bestDay >= 4 ? `, best day ${bestDay}` : ""}.</p>
          )}
        </div>

        <div className="card-rah p-6">
          <div className="font-bold text-[14.5px] mb-4">Four strands balance, last 7 days</div>
          {/* Task 109: the old condition keyed on totalReviews (all-time), so a
             learner with history but no logged minutes in the WINDOW rendered
             a card with a title and nothing under it. Key on the strands map
             itself - an empty map means nothing to show in this window. */}
          {!Object.keys(d.strands).length ? (
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>No strand time logged in the last 7 days. Review sessions, listening, reading, speaking and writing all land here as minutes.</p>
          ) : (
            <>
              <div className="flex h-4 rounded-full overflow-hidden mb-4">
                {Object.entries(d.strands).map(([k, v]) => (
                  <div key={k} style={{ width: `${(v / totalStrandMin) * 100}%`, background: k === "review" ? "var(--accent)" : k === "listening" ? "#3d9970" : k === "reading" ? "#2e8b74" : k === "speaking" ? "#57b28a" : k === "writing" ? "#7cc5a3" : "#a8d9c1" }} />
                ))}
              </div>
              {Object.entries(d.strands).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-1 text-[13px]">
                  <span className="font-semibold">{STRAND_LABELS[k] ?? k}</span>
                  <span style={{ color: "var(--muted)" }}>{v} min</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-5">
        <div className="card-rah p-6">
          <div className="font-bold text-[14.5px] mb-4">Memory state of the deck</div>
          {[
            { label: "new, not started yet", v: d.mastery.new, color: "#d9d7cd" },
            { label: "young, still fragile", v: d.mastery.young, color: "var(--gold)" },
            { label: "mature, 21+ day intervals", v: d.mastery.mature, color: "var(--accent)" },
          ].map((row) => (
            <div key={row.label} className="mb-3">
              <div className="flex justify-between text-[13px] mb-1">
                <span className="font-semibold">{row.label}</span>
                <span style={{ color: "var(--muted)" }}>{row.v} cards</span>
              </div>
              <Bar pct={(row.v / deck) * 100} color={row.color} />
            </div>
          ))}
          <div className="text-[12px] mt-3" style={{ color: "var(--muted)" }}>
            {maturePct}% of started cards are mature. {d.mastery.lapses} cards have lapsed at least once, they get tighter intervals automatically.
          </div>
        </div>

        <div className="card-rah p-6">
          <div className="font-bold text-[14.5px] mb-4">Accuracy by retrieval direction</div>
          {Object.keys(d.dirs).length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>Take a review session and your weakest direction shows up here.</p>
          ) : (
            Object.entries(DIR_LABELS).map(([k, label]) =>
              d.dirs[k] !== undefined ? (
                <div key={k} className="mb-3">
                  <div className="flex justify-between text-[13px] mb-1">
                    <span className="font-semibold">{label}</span>
                    <span style={{ color: "var(--muted)" }}>{d.dirs[k]}%</span>
                  </div>
                  <Bar pct={d.dirs[k]} color={d.dirs[k] >= 70 ? "var(--accent)" : "var(--gold)"} />
                </div>
              ) : null
            )
          )}
          <div className="text-[12px] mt-2" style={{ color: "var(--muted)" }}>
            Producing from Farsi is harder than recognizing English, so a lower fae score is normal. It is also the direction that makes speech possible.
          </div>
        </div>
      </div>

      <div className="card-rah p-6 mb-5">
        <div className="font-bold text-[14.5px] mb-4">Active days, last five weeks</div>
        <div className="flex gap-1.5 flex-wrap">
          {d.calendar.map((c) => (
            <div
              key={c.day}
              className="w-5 h-5 rounded"
              style={{ background: c.active ? "var(--accent)" : "var(--rah-dot)" }}
              title={new Date(c.day * 86400000).toLocaleDateString()}
            />
          ))}
        </div>
        <div className="text-[12px] mt-3" style={{ color: "var(--muted)" }}>
          Consistency beats intensity: distributed practice outperforms cramming at every skill level measured. Best streak so far: {boot.learner.bestStreak} days.
        </div>
      </div>

      {d.checkpoints.length ? (
        <div className="card-rah p-6">
          <div className="font-bold text-[14.5px] mb-4">Checkpoint scores over time</div>
          <div className="flex items-end gap-6 h-32">
            {d.checkpoints.map((c, i) => (
              <div key={i} className="flex-1 flex items-end gap-2">
                <div className="flex-1 flex flex-col justify-end">
                  <div className="rounded-t-md" style={{ height: `${c.listeningPct}%`, background: "var(--accent)", minHeight: 4 }} title={`listening ${c.listeningPct}%`} />
                </div>
                <div className="flex-1 flex flex-col justify-end">
                  <div className="rounded-t-md" style={{ height: `${c.readingScore}%`, background: "var(--gold)", minHeight: 4 }} title={`reading ${c.readingScore}%`} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-6 mt-2">
            <span className="text-[11.5px] flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "var(--accent)" }} /> listening</span>
            <span className="text-[11.5px] flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "var(--gold)" }} /> reading</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
