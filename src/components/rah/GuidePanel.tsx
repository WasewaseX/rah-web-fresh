"use client";

// B1-C1 Guide panel (Task 130 static map; Task 131 activates it): the map of
// English with Lucy's "The Ultimate Guide to B1 B2 C1 Grammar & Vocabulary"
// rendered per level, with the book's own method made interactive:
// - the self-rating checklist persists 3-box ratings (easy / some difficulty /
//   difficult) via /api/guide-checklist and computes a readiness verdict from
//   the real ratings - the book's "work out your current level" loop;
// - the derived 12-week plan (the app's derivation of the book's 3-month
//   method, built only from the level's real topic titles).
// Pure static map data - no fetch for the map itself, so it renders instantly
// and cannot drift from what the coach's study_guide tool serves.

import { useEffect, useState } from "react";
import { BookOpen, Play } from "lucide-react";
import { Card, Chip, Note } from "./ui";
import { GUIDE_META, GUIDE_LEVELS, CHECKLIST_LEGEND, studyPlan12Week, checklistReadiness, practiceCommand, difficultItemsCommand, weekCommand, type GuideLevelId } from "@/lib/b1c1-guide";
import { handCoach } from "@/lib/bus";

const LEVELS: GuideLevelId[] = ["B1", "B2", "C1"];
type Rating = number | null;
type RatingsMap = Record<GuideLevelId, Rating[] | null>;
type DrillMap = Record<string, { count: number; lastAt: string }>;
type DrillCoverage = Record<string, { grammar: string; vocabulary: string }>;
const RATING_MARKS = ["E", "!", "X"];

export default function GuidePanel() {
  const [level, setLevel] = useState<GuideLevelId>("B2");
  const [ratings, setRatings] = useState<RatingsMap>({ B1: null, B2: null, C1: null });
  const [drills, setDrills] = useState<DrillMap>({});
  const [coverage, setCoverage] = useState<DrillCoverage>({});
  const [saving, setSaving] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    fetch("/api/guide-checklist")
      .then((r) => r.json())
      .then((d: { levels?: Record<string, { ratings: Rating[] | null }> }) => {
        if (!d?.levels) return;
        setRatings({
          B1: d.levels.B1?.ratings ?? null,
          B2: d.levels.B2?.ratings ?? null,
          C1: d.levels.C1?.ratings ?? null,
        });
      })
      .catch(() => setOffline(true));
    fetch("/api/guide-practice")
      .then((r) => r.json())
      .then((d: { drills?: DrillMap; coverage?: DrillCoverage }) => {
        if (d?.drills) setDrills(d.drills);
        if (d?.coverage) setCoverage(d.coverage);
      })
      .catch(() => {}); // drill ledger is advisory - a failed load hides nothing critical
  }, []);

  const sec = GUIDE_LEVELS.find((s) => s.level === level) ?? GUIDE_LEVELS[1];
  const myRatings = ratings[level];
  const ratedCount = myRatings ? myRatings.filter((r) => r !== null).length : 0;
  const easyCount = myRatings ? myRatings.filter((r) => r === 0).length : 0;
  const midCount = myRatings ? myRatings.filter((r) => r === 1).length : 0;
  const hardCount = myRatings ? myRatings.filter((r) => r === 2).length : 0;
  const allRated = ratedCount === sec.checklist.items.length;
  const readiness = allRated && myRatings ? checklistReadiness(level, myRatings as number[]) : null;

  // Task 136: a drill REQUEST is recorded (a click = a request, never proof
  // of completion). Fire-and-forget: the handoff to the coach must not wait
  // on the ledger.
  function recordDrill(topicId: string) {
    fetch("/api/guide-practice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topicId }),
    })
      .then((r) => r.json())
      .then((d: { count?: number; coverage?: DrillCoverage }) => {
        if (typeof d?.count === "number") setDrills((prev) => ({ ...prev, [topicId]: { count: d.count as number, lastAt: new Date().toISOString() } }));
        if (d?.coverage) setCoverage(d.coverage);
      })
      .catch(() => {});
  }

  // Task 133: one-click practice. Every topic chip and every difficult-rated
  // checklist item hands the coach a targeted drill request via the pending
  // command bus (same route placement results and exam cards use).
  const difficultTexts = myRatings && sec.checklist.items
    ? sec.checklist.items.filter((_, i) => myRatings[i] === 2)
    : [];

  function rate(i: number, value: number) {
    const next: Rating[] = [...(myRatings ?? sec.checklist.items.map(() => null as Rating))];
    next[i] = value;
    setRatings((prev) => ({ ...prev, [level]: next }));
    setSaving(true);
    fetch("/api/guide-checklist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ level, ratings: next }),
    })
      .then(() => setSaving(false))
      .catch(() => {
        setSaving(false);
        setOffline(true);
      });
  }

  return (
    <div className="rah-rise">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-[#f2f5fa]">
              <BookOpen className="h-4 w-4 text-[#9dc0ff]" /> B1-C1 guide map
            </div>
            <Chip
              tone="slate"
              title={`Drill requests sent from this panel: ${coverage[level]?.grammar ?? `0/${sec.grammar.length}`} grammar, ${coverage[level]?.vocabulary ?? `0/${sec.vocabulary.length}`} vocabulary. A request is a click, not a completed session.`}
            >
              drilled {coverage[level]?.grammar ?? `0/${sec.grammar.length}`} grammar, {coverage[level]?.vocabulary ?? `0/${sec.vocabulary.length}`} vocab
            </Chip>
          </div>
          <div className="flex gap-1">
            {LEVELS.map((l) => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                  l === level ? "bg-[var(--rah-primary)] text-[#0b0e14]" : "bg-[#1a2130] text-[#a9b4c6] hover:text-[#e7ecf5]"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[#7d889c]">
          {GUIDE_META.title} - {GUIDE_META.author}, {GUIDE_META.pages} pages, {GUIDE_META.year}. {GUIDE_META.method}
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-[#7d889c]">
              Grammar - book pages {sec.grammar[0].page}-{sec.grammar[sec.grammar.length - 1].page}
            </div>
            <div className="flex flex-col gap-1.5">
              {sec.grammar.map((t) => (
                <div key={t.id} className="rounded-xl bg-[#171c28] px-3 py-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-bold text-[#e7ecf5]">{t.title}</span>
                    <span className="text-[10px] font-bold text-[#7d889c]">p.{t.page}</span>
                    {t.tags.slice(0, 2).map((tag) => (
                      <Chip key={tag} tone="slate">
                        {tag.replace(/_/g, " ")}
                      </Chip>
                    ))}
                    <button
                      onClick={() => {
                        recordDrill(t.id);
                        handCoach(practiceCommand(level, t.title, "grammar"));
                      }}
                      title={`Hand the coach a ${level} drill on ${t.title}`}
                      className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#1a2130] px-2.5 py-0.5 text-[10px] font-black text-[#9dc0ff] transition hover:bg-[var(--rah-primary)] hover:text-[#0b0e14]"
                    >
                      <Play className="h-2.5 w-2.5" /> practice
                    </button>
                    {(drills[t.id]?.count ?? 0) > 0 && (
                      <span className="rounded-full bg-[#173226] px-2 py-0.5 text-[10px] font-black text-[#7fd0a8]" title="Drill requests sent to the coach (a request, not a completed session)">
                        {drills[t.id]?.count}x
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#7d889c]">{t.hint}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-[#7d889c]">
                Vocabulary - book pages {sec.vocabulary[0].page}-{sec.vocabulary[sec.vocabulary.length - 1].page}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sec.vocabulary.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      recordDrill(t.id);
                      handCoach(practiceCommand(level, t.title, "vocabulary"));
                    }}
                    className="rounded-full bg-[#1a2130] px-3 py-1 text-xs font-bold text-[#c8d2e2] transition hover:bg-[#232c3e] hover:text-[#e7ecf5]"
                    title={`${t.hint} (p.${t.page}) - click to practice with the coach`}
                  >
                    {t.title} <span className="text-[10px] font-normal text-[#7d889c]">p.{t.page}</span>
                    {(drills[t.id]?.count ?? 0) > 0 && <span className="ml-1 text-[10px] font-black text-[#7fd0a8]">{drills[t.id]?.count}x</span>}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-[#7d889c]">Pronunciation - book pages {sec.pronunciation.pages}</div>
              <p className="text-xs leading-relaxed text-[#7d889c]">{sec.pronunciation.note}</p>
            </div>
            <div>
              <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-[#7d889c]">Study plan - book pages {sec.studyPlan.pages}</div>
              <p className="text-xs leading-relaxed text-[#7d889c]">{sec.studyPlan.note}</p>
              <details className="mt-1.5">
                <summary className="cursor-pointer text-[11px] font-bold text-[#9dc0ff]">Derived 12-week plan (the app's derivation of the book's 3-month method)</summary>
                <div className="mt-1.5 flex flex-col gap-1">
                  {studyPlan12Week(level).map((w) => (
                    <div key={w.week} className="rounded-xl bg-[#171c28] px-3 py-1.5 text-xs leading-relaxed text-[#c8d2e2]">
                      <div className="flex items-baseline gap-2">
                        <span className="font-black text-[#7d889c]">W{w.week}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#9dc0ff]">{w.phase}</span>
                        <button
                          onClick={() => handCoach(weekCommand(level, w))}
                          title={`Start week ${w.week} with the coach`}
                          className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#1a2130] px-2 py-0.5 text-[10px] font-black text-[#9dc0ff] transition hover:bg-[var(--rah-primary)] hover:text-[#0b0e14]"
                        >
                          <Play className="h-2.5 w-2.5" /> start
                        </button>
                      </div>
                      {w.grammar && <div>grammar: {w.grammar}</div>}
                      {w.vocabulary && <div>vocabulary: {w.vocabulary}</div>}
                      <div className="text-[#7d889c]">{w.action}</div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#7d889c]">Self-rating checklist - book pages {sec.checklist.pages}</span>
            <Chip tone={sec.checklist.source === "verbatim" ? "emerald" : "amber"}>{sec.checklist.source}</Chip>
            {ratedCount > 0 && <Chip tone="slate">{ratedCount}/{sec.checklist.items.length} rated</Chip>}
            {ratedCount > 0 && <Chip tone="emerald">{easyCount} easy</Chip>}
            {midCount > 0 && <Chip tone="slate">{midCount} some difficulty</Chip>}
            {hardCount > 0 && <Chip tone="amber">{hardCount} difficult</Chip>}
            {saving && <span className="text-[11px] text-[#7d889c]">saving...</span>}
            {offline && <span className="text-[11px] text-[#e0a0b0]">ratings not saved (offline)</span>}
            {difficultTexts.length > 0 && (
              <button
                onClick={() => handCoach(difficultItemsCommand(level, difficultTexts))}
                title="Hand the coach the difficult-rated items for diagnosis and drilling"
                className="inline-flex items-center gap-1 rounded-full bg-[#2a1a24] px-3 py-1 text-[11px] font-black text-[#e0a0b0] transition hover:bg-[#3a2230]"
              >
                <Play className="h-3 w-3" /> drill {difficultTexts.length} difficult item{difficultTexts.length > 1 ? "s" : ""}
              </button>
            )}
          </div>
          <div className="mb-2">
            <Note>
              {sec.checklist.note} Rate each: {CHECKLIST_LEGEND.join(" | ")}
              {readiness ? ` Verdict: ${readiness.verdict}` : ratedCount > 0 ? ` Verdict unlocks when all ${sec.checklist.items.length} items are rated.` : ""}
            </Note>
          </div>
          <ol className="flex flex-col gap-1">
            {sec.checklist.items.map((q, i) => (
              <li key={i} className="rounded-xl bg-[#171c28] px-3 py-1.5 text-xs leading-relaxed text-[#c8d2e2]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span>
                    <span className="mr-1.5 font-black text-[#7d889c]">{i + 1}.</span>
                    {q}
                  </span>
                  <span className="flex shrink-0 gap-1">
                    {[0, 1, 2].map((v) => (
                      <button
                        key={v}
                        onClick={() => rate(i, v)}
                        title={CHECKLIST_LEGEND[v]}
                        className={`h-6 w-6 rounded-full text-[10px] font-black transition ${
                          myRatings?.[i] === v ? "bg-[var(--rah-primary)] text-[#0b0e14]" : "bg-[#1a2130] text-[#a9b4c6] hover:text-[#e7ecf5]"
                        }`}
                      >
                        {RATING_MARKS[v]}
                      </button>
                    ))}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Card>
    </div>
  );
}
