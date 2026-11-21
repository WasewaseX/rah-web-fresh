import type * as React from "react";
import {
  BookOpen, SpellCheck, LayoutGrid, GraduationCap, Brain, Stethoscope, TrendingUp,
  Target, ListChecks, Shuffle, RotateCcw, PenLine, Mic, Headphones, CalendarDays,
} from "lucide-react";
import { fuzzyMatch } from "@/lib/tutor/grading";
import type { DrillItem, ExamItemResult } from "@/lib/tutor/types";

export const SKILL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  BookMarked: BookOpen, SpellCheck, Link2: LayoutGrid, BookOpen, GraduationCap, Brain,
  Stethoscope, TrendingUp, Target, Layers: ListChecks, Shuffle, Lightbulb: Brain,
  Repeat2: RotateCcw, Network: LayoutGrid, Type: SpellCheck, Puzzle: Target, Timer: Headphones,
  Scissors: PenLine, PenLine, Mic, Copy: PenLine, MessagesSquare: LayoutGrid,
  Languages: LayoutGrid, BookOpenCheck: BookOpen, CalendarDays, MessageCircle: LayoutGrid,
};

// local answer check (same fuzzy rules as the server grader: exact,
// acceptable variants, article tolerance, one-letter typo tolerance)
export function isCorrect(item: DrillItem | (ExamItemResult & { choices?: string[] }), given: string): boolean {
  const tier = fuzzyMatch(given ?? "", (item as DrillItem).answer, (item as DrillItem).acceptable ?? []);
  return tier === "exact" || tier === "typo" || tier === "accepted";
}
