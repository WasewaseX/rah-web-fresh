"use client";

// B1-C1 Guide panel (Task 130): the embedded map of English with Lucy's
// "The Ultimate Guide to B1 B2 C1 Grammar & Vocabulary" rendered per level:
// grammar topics, vocabulary topics, pronunciation, self-rating checklist,
// 3-month study plan. Pure static data - no fetch, no db - so it renders
// instantly and cannot drift from what the coach's study_guide tool serves.

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { Card, Chip, Note } from "./ui";
import { GUIDE_META, GUIDE_LEVELS, CHECKLIST_LEGEND, type GuideLevelId } from "@/lib/b1c1-guide";

const LEVELS: GuideLevelId[] = ["B1", "B2", "C1"];

export default function GuidePanel() {
  const [level, setLevel] = useState<GuideLevelId>("B2");
  const sec = GUIDE_LEVELS.find((s) => s.level === level) ?? GUIDE_LEVELS[1];
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
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#7d889c]">Self-rating checklist - book pages {sec.checklist.pages}</span>
            <Chip tone={sec.checklist.source === "verbatim" ? "emerald" : "amber"}>{sec.checklist.source}</Chip>
          </div>
          <div className="mb-2">
            <Note>{sec.checklist.note} Rate each: {CHECKLIST_LEGEND.join(" | ")}</Note>
          </div>
          <ol className="flex flex-col gap-1">
            {sec.checklist.items.map((q, i) => (
              <li key={i} className="rounded-xl bg-[#171c28] px-3 py-1.5 text-xs leading-relaxed text-[#c8d2e2]">
                <span className="mr-1.5 font-black text-[#7d889c]">{i + 1}.</span>
                {q}
              </li>
            ))}
          </ol>
        </div>
      </Card>
    </div>
  );
}
