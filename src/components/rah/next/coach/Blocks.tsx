"use client";

// Coach blocks: rich interactive cards rendered inside the chat transcript.
// ExamTaker (formal exam flow), DrillCard (instant-feedback practice),
// ResultCard (assessment), report cards (analysis family). All built from the
// shared Rah primitives. Each block lives in its own sibling module under
// Blocks/; this file keeps the original import surface stable.

export { SKILL_ICONS, isCorrect } from "./Blocks/shared";
export { ExamTaker } from "./Blocks/ExamTaker";
export { DrillCard } from "./Blocks/DrillCard";
export { ResultCard } from "./Blocks/ResultCard";
export { ReportCard } from "./Blocks/Reports";
