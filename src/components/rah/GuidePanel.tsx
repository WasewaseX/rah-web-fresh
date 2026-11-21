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
import { GUIDE_META, GUIDE_LEVELS, CHECKLIST_LEGEND, studyPlan12Week, checklistReadiness, practiceCommand, difficultItemsCommand, weekCommand, searchGuideTopics, type GuideLevelId, type GuideTopic, type GuideLevelSection, type TopicHit, type PlanWeek } from "@/lib/b1c1-guide";
import { staleTopics, coverageBarRows, type DrillMap as LedgerDrillMap, type StaleTopic, type CoverageBarRow } from "@/lib/guide-ledger";
import { handCoach } from "@/lib/bus";

const LEVELS: GuideLevelId[] = ["B1", "B2", "C1"];
const TOPIC_COUNT = GUIDE_LEVELS.reduce((a, s) => a + s.grammar.length + s.vocabulary.length, 0);
type Rating = number | null;
type RatingsMap = Record<GuideLevelId, Rating[] | null>;
type DrillMap = Record<string, { count: number; lastAt: string }>;
type DrillCoverage = Record<string, { grammar: string; vocabulary: string }>;
// Task 141: the 7-day drill-request view the panel's week chip renders.
type WeekUi = { windowDays: number; events: number; topicsTouched: number; perLevel: Record<string, number> };
const RATING_MARKS = ["E", "!", "X"];
type Setter<T> = (v: T | ((prev: T) => T)) => void;

function loadGuideData(o: {
  setRatings: Setter<RatingsMap>;
  setOffline: (v: boolean) => void;
  setDrills: Setter<DrillMap>;
  setCoverage: Setter<DrillCoverage>;
  setWeek: Setter<WeekUi | null>;
}) {
  fetch("/api/guide-checklist")
    .then((r) => r.json())
    .then((d: { levels?: Record<string, { ratings: Rating[] | null }> }) => {
      if (!d?.levels) return;
      o.setRatings({
        B1: d.levels.B1?.ratings ?? null,
        B2: d.levels.B2?.ratings ?? null,
        C1: d.levels.C1?.ratings ?? null,
      });
    })
    .catch(() => o.setOffline(true));
  fetch("/api/guide-practice")
    .then((r) => r.json())
    .then((d: { drills?: DrillMap; coverage?: DrillCoverage; week?: WeekUi }) => {
      if (d?.drills) o.setDrills(d.drills);
      if (d?.coverage) o.setCoverage(d.coverage);
      if (d?.week) o.setWeek(d.week);
    })
    .catch(() => {}); // drill ledger is advisory - a failed load hides nothing critical
}

// Task 136: a drill REQUEST is recorded (a click = a request, never proof
// of completion). Fire-and-forget: the handoff to the coach must not wait
// on the ledger.
function recordDrillRequest(topicId: string, setDrills: Setter<DrillMap>, setCoverage: Setter<DrillCoverage>, setWeek: Setter<WeekUi | null>) {
  fetch("/api/guide-practice", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ topicId }),
  })
    .then((r) => r.json())
    .then((d: { count?: number; coverage?: DrillCoverage; week?: WeekUi }) => {
      if (typeof d?.count === "number") setDrills((prev) => ({ ...prev, [topicId]: { count: d.count as number, lastAt: new Date().toISOString() } }));
      if (d?.coverage) setCoverage(d.coverage);
      if (d?.week) setWeek(d.week);
    })
    .catch(() => {});
}

// Persist one 3-box rating immediately; a failed save flips the offline flag.
function rateTopic(o: {
  level: GuideLevelId;
  i: number;
  value: number;
  base: Rating[];
  setRatings: Setter<RatingsMap>;
  setSaving: (v: boolean) => void;
  setOffline: (v: boolean) => void;
}) {
  const next: Rating[] = [...o.base];
  next[o.i] = o.value;
  o.setRatings((prev) => ({ ...prev, [o.level]: next }));
  o.setSaving(true);
  fetch("/api/guide-checklist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ level: o.level, ratings: next }),
  })
    .then(() => o.setSaving(false))
    .catch(() => {
      o.setSaving(false);
      o.setOffline(true);
    });
}

function GuideHeader({ level, setLevel, sec, coverage, week, stale }: {
  level: GuideLevelId;
  setLevel: (l: GuideLevelId) => void;
  sec: GuideLevelSection;
  coverage: DrillCoverage;
  week: WeekUi | null;
  stale: StaleTopic[];
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-[#f2f5fa]">
          <BookOpen className="h-4 w-4 text-[#9dc0ff]" /> B1-C1 guide map
        </div>
        <Chip tone="slate" title={`Drill requests sent from this panel: ${coverage[level]?.grammar ?? `0/${sec.grammar.length}`} grammar, ${coverage[level]?.vocabulary ?? `0/${sec.vocabulary.length}`} vocabulary. A request is a click, not a completed session.`}>
          drilled {coverage[level]?.grammar ?? `0/${sec.grammar.length}`} grammar, {coverage[level]?.vocabulary ?? `0/${sec.vocabulary.length}`} vocab
        </Chip>
        {week && (
          <Chip tone={(week.perLevel[level] ?? 0) > 0 ? "emerald" : "slate"} title={`Last ${week.windowDays} days across all levels: ${week.events} drill request(s) across ${week.topicsTouched} topic(s). A request is a click, not a completed session.`}>
            this week: {week.perLevel[level] ?? 0} requests
          </Chip>
        )}
        {stale.length > 0 && (
          <Chip tone="amber" title={`Topics whose last drill request is more than 14 days old: ${stale.map((s) => `${s.title} (${s.daysAgo}d ago)`).join(", ")}. A hint to re-drill - requests are not mastery, so nothing was "lost".`}>
            rusty (14d+): {stale.slice(0, 3).map((s) => s.title).join(", ")}
            {stale.length > 3 ? ` +${stale.length - 3} more` : ""}
          </Chip>
        )}
      </div>
      <div className="flex gap-1">
        {LEVELS.map((l) => (
          <button key={l} onClick={() => setLevel(l)} className={`rounded-full px-3 py-1 text-xs font-bold transition ${
            l === level ? "bg-[var(--rah-primary)] text-[#0b0e14]" : "bg-[#1a2130] text-[#a9b4c6] hover:text-[#e7ecf5]"
          }`}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

// Task 146: search across ALL levels - reach any of the book's topics
// without paging through three sections. Two chars minimum, so an
// empty box stays empty instead of dumping the whole guide.
function GuideSearch({ query, setQuery, hits, drills, onPick }: {
  query: string;
  setQuery: (q: string) => void;
  hits: TopicHit[];
  drills: DrillMap;
  onPick: (h: TopicHit) => void;
}) {
  return (
    <div className="mt-3">
      <input
        value={query}
        aria-label="Search guide topics"
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search all ${TOPIC_COUNT} topics (e.g. cleft, phrasal, travel)...`}
        className="w-full rounded-xl bg-[#171c28] px-3 py-2 text-xs text-[#e7ecf5] outline-none placeholder:text-[#5d687c] focus:ring-1 focus:ring-[var(--rah-primary)]"
      />
      {query.trim().length >= 2 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {hits.length === 0 ? (
            <span className="text-[11px] text-[#7d889c]">No topic matches "{query.trim()}".</span>
          ) : (
            hits.map((h) => (
              <button key={h.id} onClick={() => onPick(h)} className="rounded-full bg-[#1a2130] px-3 py-1 text-xs font-bold text-[#c8d2e2] transition hover:bg-[#232c3e] hover:text-[#e7ecf5]"
                title={`${h.hint} (${h.level} ${h.kind}, p.${h.page}) - click to practice with the coach`}>
                {h.title} <span className="text-[10px] font-normal text-[#7d889c]">{h.level} p.{h.page}</span>
                {(drills[h.id]?.count ?? 0) > 0 && <span className="ml-1 text-[10px] font-black text-[#7fd0a8]">{drills[h.id]?.count}x</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Task 147: per-level drill-request coverage bars. The fill comes
// from the real coverage map; the labeling stays honest - a request
// is a click, not a completed session.
function CoverageBars({ rows }: { rows: CoverageBarRow[] }) {
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <div className="text-[11px] font-black uppercase tracking-wider text-[#7d889c]">Drill-request coverage by level</div>
      {rows.map((r) => (
        <div key={r.level} className="flex items-center gap-2 text-[11px]">
          <span className="w-6 font-black text-[#a9b4c6]">{r.level}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#1a2130]">
            <div className="h-full rounded-full bg-[#7fd0a8]" style={{ width: `${r.grammarPct}%` }} title={`grammar ${r.grammarLabel}`} />
          </div>
          <span className="w-14 text-right text-[#7d889c]">g {r.grammarLabel}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#1a2130]">
            <div className="h-full rounded-full bg-[#9dc0ff]" style={{ width: `${r.vocabPct}%` }} title={`vocabulary ${r.vocabLabel}`} />
          </div>
          <span className="w-14 text-right text-[#7d889c]">v {r.vocabLabel}</span>
        </div>
      ))}
    </div>
  );
}

function GrammarColumn({ level, sec, drills, onPractice }: {
  level: GuideLevelId;
  sec: GuideLevelSection;
  drills: DrillMap;
  onPractice: (t: GuideTopic) => void;
}) {
  return (
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
              <button onClick={() => onPractice(t)} title={`Hand the coach a ${level} drill on ${t.title}`}
                className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#1a2130] px-2.5 py-0.5 text-[10px] font-black text-[#9dc0ff] transition hover:bg-[var(--rah-primary)] hover:text-[#0b0e14]">
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
  );
}

function SideColumn({ level, sec, drills, onPractice, onWeek }: {
  level: GuideLevelId;
  sec: GuideLevelSection;
  drills: DrillMap;
  onPractice: (t: GuideTopic) => void;
  onWeek: (w: PlanWeek) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-[#7d889c]">
          Vocabulary - book pages {sec.vocabulary[0].page}-{sec.vocabulary[sec.vocabulary.length - 1].page}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sec.vocabulary.map((t) => (
            <button key={t.id} onClick={() => onPractice(t)} className="rounded-full bg-[#1a2130] px-3 py-1 text-xs font-bold text-[#c8d2e2] transition hover:bg-[#232c3e] hover:text-[#e7ecf5]"
              title={`${t.hint} (p.${t.page}) - click to practice with the coach`}>
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
                  <button onClick={() => onWeek(w)} title={`Start week ${w.week} with the coach`}
                    className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#1a2130] px-2 py-0.5 text-[10px] font-black text-[#9dc0ff] transition hover:bg-[var(--rah-primary)] hover:text-[#0b0e14]">
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
  );
}

function ChecklistSection({ sec, myRatings, readiness, ratedCount, easyCount, midCount, hardCount, saving, offline, difficultTexts, onRate, onDrillDifficult }: {
  sec: GuideLevelSection;
  myRatings: Rating[] | null;
  readiness: { verdict: string } | null;
  ratedCount: number;
  easyCount: number;
  midCount: number;
  hardCount: number;
  saving: boolean;
  offline: boolean;
  difficultTexts: string[];
  onRate: (i: number, value: number) => void;
  onDrillDifficult: () => void;
}) {
  return (
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
          <button onClick={onDrillDifficult} title="Hand the coach the difficult-rated items for diagnosis and drilling"
            className="inline-flex items-center gap-1 rounded-full bg-[#2a1a24] px-3 py-1 text-[11px] font-black text-[#e0a0b0] transition hover:bg-[#3a2230]">
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
                  <button key={v} onClick={() => onRate(i, v)} title={CHECKLIST_LEGEND[v]}
                    className={`h-6 w-6 rounded-full text-[10px] font-black transition ${
                      myRatings?.[i] === v ? "bg-[var(--rah-primary)] text-[#0b0e14]" : "bg-[#1a2130] text-[#a9b4c6] hover:text-[#e7ecf5]"
                    }`}>
                    {RATING_MARKS[v]}
                  </button>
                ))}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function GuidePanel() {
  const [level, setLevel] = useState<GuideLevelId>("B2");
  const [ratings, setRatings] = useState<RatingsMap>({ B1: null, B2: null, C1: null });
  const [drills, setDrills] = useState<DrillMap>({});
  const [coverage, setCoverage] = useState<DrillCoverage>({});
  const [week, setWeek] = useState<WeekUi | null>(null);
  const [saving, setSaving] = useState(false);
  const [offline, setOffline] = useState(false);
  // Task 146: cross-level topic search; hits render as drill buttons.
  const [query, setQuery] = useState("");
  // Page-load clock: staleness is measured against the moment the panel
  // mounted (react purity - no Date.now() during render).
  const [now] = useState(() => Date.now());
  const hits = searchGuideTopics(query);
  // Task 147: per-level coverage bar rows from the real coverage map.
  const barRows = coverageBarRows(coverage);
  const sec = GUIDE_LEVELS.find((s) => s.level === level) ?? GUIDE_LEVELS[1];
  const myRatings = ratings[level];
  const ratedCount = myRatings ? myRatings.filter((r) => r !== null).length : 0;
  const easyCount = myRatings ? myRatings.filter((r) => r === 0).length : 0;
  const midCount = myRatings ? myRatings.filter((r) => r === 1).length : 0;
  const hardCount = myRatings ? myRatings.filter((r) => r === 2).length : 0;
  const allRated = ratedCount === sec.checklist.items.length;
  const readiness = allRated && myRatings ? checklistReadiness(level, myRatings as number[]) : null;
  // Task 145: drilled topics whose last request went stale (14d+). Honest
  // framing in the chip: a nudge to re-drill, never "you forgot X".
  const stale = staleTopics(drills as LedgerDrillMap, now).filter((s) => s.level === level);
  // Task 133: one-click practice. Every topic chip and every difficult-rated
  // checklist item hands the coach a targeted drill request via the pending
  // command bus (same route placement results and exam cards use).
  const difficultTexts = myRatings && sec.checklist.items
    ? sec.checklist.items.filter((_, i) => myRatings[i] === 2)
    : [];

  useEffect(() => {
    loadGuideData({ setRatings, setOffline, setDrills, setCoverage, setWeek });
  }, []);

  const drill = (topicId: string) => recordDrillRequest(topicId, setDrills, setCoverage, setWeek);
  const rate = (i: number, value: number) =>
    rateTopic({ level, i, value, base: myRatings ?? sec.checklist.items.map(() => null), setRatings, setSaving, setOffline });
  const pickHit = (h: TopicHit) => {
    drill(h.id);
    handCoach(practiceCommand(h.level, h.title, h.kind));
  };
  const practice = (t: GuideTopic, kind: "grammar" | "vocabulary") => {
    drill(t.id);
    handCoach(practiceCommand(level, t.title, kind));
  };
  const drillDifficult = () => handCoach(difficultItemsCommand(level, difficultTexts));

  return (
    <div className="rah-rise">
      <Card>
        <GuideHeader level={level} setLevel={setLevel} sec={sec} coverage={coverage} week={week} stale={stale} />
        <p className="mt-2 text-xs leading-relaxed text-[#7d889c]">
          {GUIDE_META.title} - {GUIDE_META.author}, {GUIDE_META.pages} pages, {GUIDE_META.year}. {GUIDE_META.method}
        </p>
        <GuideSearch query={query} setQuery={setQuery} hits={hits} drills={drills} onPick={pickHit} />
        <CoverageBars rows={barRows} />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <GrammarColumn level={level} sec={sec} drills={drills} onPractice={(t) => practice(t, "grammar")} />
          <SideColumn level={level} sec={sec} drills={drills} onPractice={(t) => practice(t, "vocabulary")} onWeek={(w) => handCoach(weekCommand(level, w))} />
        </div>
        <ChecklistSection
          sec={sec} myRatings={myRatings} readiness={readiness} ratedCount={ratedCount} easyCount={easyCount}
          midCount={midCount} hardCount={hardCount} saving={saving} offline={offline} difficultTexts={difficultTexts}
          onRate={rate} onDrillDifficult={drillDifficult}
        />
      </Card>
    </div>
  );
}
