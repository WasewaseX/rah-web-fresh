"use client";

// Task 105: the Tutor hub. The Task 104 shell wired the recovered chat view
// (Socratic production coach over /api/ai). This pass lights up the rest of
// the recovered tutor system, whose server half has been live since Task 102
// with zero UI consumers:
//
//   Plan    GET/POST /api/tutor/plan        -> TutorReport(kind=plan)  7-day plan
//   Scan    GET/POST /api/tutor/scan        -> TutorReport(kind=scan)  band diagnostic
//   Clinic  GET/POST /api/tutor/clinic      -> TutorReport(kind=clinic) patterns + drill
//   Exam    POST /api/tutor/exam            -> ExamRun (answers stay server-side)
//           POST /api/tutor/exam/submit     -> mechanical grade + AI assessment (+20 XP)
//           GET  /api/tutor/exam            -> history / one run for review
//   Event   POST /api/tutor/event           -> drill outcome recorded, pays XP
//
// The interactive cards come from the recovered coach/Blocks.tsx: ExamTaker,
// DrillCard, ResultCard. Adapters in tutor/shared.tsx translate the routes'
// exact shapes onto the Blocks contracts (tutor/types) - nothing in Blocks
// changes. Each tab lives in its own sibling module under tutor/.

import type * as React from "react";
import { useState } from "react";
import { CalendarDays, Crosshair, GraduationCap, MessageCircle, Stethoscope } from "lucide-react";
import type { Boot } from "@/app/page";
import { SectionTitle } from "./bits";
import { ChatTab } from "./tutor/ChatTab";
import { ClinicTab } from "./tutor/ClinicTab";
import { ExamTab } from "./tutor/ExamTab";
import { PlanTab } from "./tutor/PlanTab";
import { ScanTab } from "./tutor/ScanTab";

// ---------- the hub ----------

type Tab = "chat" | "plan" | "scan" | "clinic" | "exam";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "plan", label: "7-day plan", icon: CalendarDays },
  { id: "scan", label: "Diagnosis", icon: Stethoscope },
  { id: "clinic", label: "Clinic", icon: Crosshair },
  { id: "exam", label: "Exam", icon: GraduationCap },
];

export default function TutorView({ boot }: { boot: Boot }) {
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <div className="max-w-2xl mx-auto">
      <SectionTitle
        title="Tutor"
        sub="Socratic by contract: it makes you produce before it explains. Corrections carry the Farsi why."
        right={<span className="chip chip-accent">{boot.ai.builtin ? "built-in engine" : boot.ai.model}</span>}
      />
      <div className="mb-5 flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-all ${
                tab === t.id
                  ? "border-[var(--accent)] bg-[var(--accent)]/[0.14] text-[var(--accent-deep)]"
                  : "border-white/[0.08] text-[var(--muted)]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>
      {tab === "chat" && <ChatTab />}
      {tab === "plan" && <PlanTab />}
      {tab === "scan" && <ScanTab />}
      {tab === "clinic" && <ClinicTab />}
      {tab === "exam" && <ExamTab />}
    </div>
  );
}
