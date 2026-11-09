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
import { BookOpen } from "lucide-react";
import { Card, Chip, Note } from "./ui";
import { GUIDE_META, GUIDE_LEVELS, CHECKLIST_LEGEND, studyPlan12Week, checklistReadiness, type GuideLevelId } from "@/lib/b1c1-guide";

const LEVELS: GuideLevelId[] = ["B1", "B2", "C1"];
type Rating = number | null;
type RatingsMap = Record<GuideLevelId, Rating[] | null>;
const RATING_MARKS = ["E", "!", "X"];

export default function GuidePanel() {
  const [level, setLevel] = useState<GuideLevelId>("B2");
  const [ratings, setRatings] = useState<RatingsMap>({ B1: null, B2: null, C1: null });
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
  }, []);

  const sec = GUIDE_LEVELS.find((s) => s.level === level) ?? GUIDE_LEVELS[1];
  const myRatings = ratings[level];
  const ratedCount = myRatings ? myRatings.filter((r) => r !== null).length : 0;
  const easyCount = myRatings ? myRatings.filter((r) => r === 0).length : 0;
  const midCount = myRatings ? myRatings.filter((r) => r === 1).length : 0;
  const hardCount = myRatings ? myRatings.filter((r) => r === 2).length : 0;
  const allRated = ratedCount === sec.checklist.items.length;
  const readiness = allRated && myRatings ? checklistReadiness(level, myRatings as number[]) : null;

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
          <div className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-[#f2f5fa]">
            <BookOpen className="h-4 w-4 text-[#9dc0ff]" /> B1-C1 guide map
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
                  <span key={t.id} className="rounded-full bg-[#1a2130] px-3 py-1 text-xs font-bold text-[#c8d2e2]" title={`${t.hint} (p.${t.page})`}>
                    {t.title} <span className="text-[10px] font-normal text-[#7d889c]">p.{t.page}</span>
                  </span>
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
