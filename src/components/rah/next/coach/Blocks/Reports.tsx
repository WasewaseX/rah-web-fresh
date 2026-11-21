"use client";

import {
  BookOpen, CalendarDays, GraduationCap, Headphones, Mic, PenLine, RotateCcw,
  Stethoscope, Target, TrendingUp,
} from "lucide-react";
import type * as React from "react";
import { Bar, Chip, FA } from "../../../ui";
import type { DeepLevelReport, DiagnosisReport, ForecastReport, PlanReport } from "@/lib/tutor/types";

// ============================ REPORT CARDS ============================

export function ReportCard({ report }: { report: NonNullable<import("@/lib/tutor/types").CoachEnvelope["report"]> }) {
  if ("skills" in report) return <DeepLevelCard report={report as DeepLevelReport} />;
  if ("patterns" in report) return <DiagnosisCard report={report as DiagnosisReport} />;
  if ("eta_weeks" in report) return <ForecastCard report={report as ForecastReport} />;
  return <PlanCard report={report as PlanReport} />;
}

function DeepLevelCard({ report }: { report: DeepLevelReport }) {
  return (
    <div className="rah-pop rounded-3xl border border-(--accent)/20 bg-gradient-to-b from-[#1a2233] to-[var(--rah-surface)] p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-(--accent-dim)">Deep level analysis</div>
        <Chip tone={report.confidence === "high" ? "emerald" : report.confidence === "medium" ? "amber" : "slate"}>confidence: {report.confidence}</Chip>
        {report.source === "mechanical" && <Chip tone="slate">offline mode</Chip>}
      </div>
      <div className="mt-2 flex items-end gap-3">
        <div className="text-4xl font-black leading-none text-[#f2f5fa]">{report.overall}</div>
        <div className="pb-1 text-xs text-[#8b96a9]">overall band (provisional until you take exams)</div>
      </div>

      <div className="mt-5 flex flex-col gap-2.5">
        {report.skills.map((s) => (
          <div key={s.name} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs font-bold text-[#a9b4c6]">{s.name}</span>
            <Bar value={s.score} max={100} tone={s.score >= 72 ? "emerald" : s.score >= 50 ? "blue" : "amber"} />
            <Chip tone="slate">{s.band}</Chip>
            <span dir="ltr" className="hidden w-44 shrink-0 truncate text-[11px] text-[#6e7a8e] sm:block">{s.note}</span>
          </div>
        ))}
      </div>

      {report.evidence?.length > 0 && (
        <div className="mt-5 rounded-2xl border border-white/[0.06] bg-[#141924] p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-(--accent-dim)">Evidence</div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {report.evidence.map((e, i) => (
              <li key={i} dir="ltr" className="text-xs leading-relaxed text-[#b7c1d3]">· {e}</li>
            ))}
          </ul>
        </div>
      )}

      {report.leaks?.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {report.leaks.map((l, i) => (
            <div key={i} className="rounded-2xl border border-[#ffb02e]/20 bg-[#ffb02e]/[0.05] p-3 text-sm">
              <span className="font-bold text-[#ffd08a]">{String(l.trap).replace(/_/g, " ")}</span>
              <FA className="mt-0.5 block text-xs leading-loose">{l.fa}</FA>
            </div>
          ))}
        </div>
      )}

      {report.plan?.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-(--accent-dim)">7-day plan</div>
          <div className="mt-2 flex flex-col gap-2">
            {report.plan.map((p, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-2xl bg-white/[0.03] p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--accent)/15 text-xs font-black text-(--accent-soft)">{i + 1}</span>
                <div>
                  <div dir="ltr" className="text-[13px] font-semibold text-[#e7ecf5]">{p.step}</div>
                  <FA className="mt-0.5 block text-xs leading-loose">{p.fa}</FA>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DiagnosisCard({ report }: { report: DiagnosisReport }) {
  return (
    <div className="rah-pop rounded-3xl border border-white/[0.08] bg-[var(--rah-surface)] p-5">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-(--accent-dim)">
        <Stethoscope className="h-4 w-4" /> Error pattern diagnosis
      </div>
      <div dir="ltr" className="mt-2 text-sm font-bold text-[#f2f5fa]">{report.headline}</div>
      <div className="mt-4 flex flex-col gap-2.5">
        {report.patterns.map((p, i) => (
          <div key={i} className="rounded-2xl border border-[#ffb02e]/20 bg-[#ffb02e]/[0.05] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span dir="ltr" className="text-sm font-black text-[#ffd08a]">{p.title || p.trap.replace(/_/g, " ")}</span>
              <Chip tone="amber">×{p.count}</Chip>
            </div>
            <FA className="mt-1 block text-xs leading-loose">{p.fa}</FA>
            {p.fix && <div dir="ltr" className="mt-1 text-xs leading-relaxed text-[#b7c1d3]">Fix: {p.fix}</div>}
          </div>
        ))}
      </div>
      <div dir="ltr" className="mt-3 text-xs leading-relaxed text-[#a9b4c6]">{report.verdict}</div>
    </div>
  );
}

function ForecastCard({ report }: { report: ForecastReport }) {
  return (
    <div className="rah-pop rounded-3xl border border-white/[0.08] bg-[var(--rah-surface)] p-5">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-(--accent-dim)">
        <TrendingUp className="h-4 w-4" /> Progress forecast
      </div>
      <div dir="ltr" className="mt-2 text-sm font-bold text-[#f2f5fa]">{report.headline}</div>
      {report.pace && <div dir="ltr" className="mt-1 text-xs text-[#8b96a9]">{report.pace}</div>}
      {report.moves?.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {report.moves.map((m, i) => (
            <div key={i} className="flex items-start gap-2.5 rounded-2xl bg-white/[0.03] p-3">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-(--accent-soft)" />
              <div dir="ltr">
                <div className="text-[13px] font-semibold text-[#e7ecf5]">{m.move}</div>
                <div className="text-xs text-[#8b96a9]">{m.effect}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PLAN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  review: RotateCcw, drill: Target, exam: GraduationCap, write: PenLine, speak: Mic, listen: Headphones, read: BookOpen,
};

function PlanCard({ report }: { report: PlanReport }) {
  return (
    <div className="rah-pop rounded-3xl border border-white/[0.08] bg-[var(--rah-surface)] p-5">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-(--accent-dim)">
        <CalendarDays className="h-4 w-4" /> Today's plan
      </div>
      <div dir="ltr" className="mt-2 text-sm font-bold text-[#f2f5fa]">{report.headline}</div>
      <div className="mt-4 flex flex-col gap-2">
        {report.blocks.map((b, i) => {
          const Icon = PLAN_ICONS[b.icon] ?? Target;
          return (
            <div key={i} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--accent)/12 text-(--accent-soft)">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <div dir="ltr" className="text-[13px] font-bold text-[#e7ecf5]">{b.title}</div>
                <FA className="block text-xs leading-loose">{b.why}</FA>
              </div>
              <Chip tone="cyan">{b.minutes}m</Chip>
            </div>
          );
        })}
      </div>
    </div>
  );
}
