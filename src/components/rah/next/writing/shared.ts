// P2 teaching quality (roadmap item 2): the register goal has conditioned the
// examiner since Task 85 (WRITING_GOALS in @/lib/ai), but the learner never
// saw the dial. Mirrored here as literals on purpose: @/lib/ai is server-side
// (env, SDK) and must not enter the client bundle. /api/writing re-validates
// the value, so this list can never drift into an invalid goal.
export type WritingGoal = "exam" | "work" | "casual";
export const REGISTER_DIAL: { id: WritingGoal; label: string; copy: string }[] = [
  {
    id: "exam",
    label: "Exam board",
    copy: "An exam board reads this: strict academic register, formal hedging, no contractions, discourse markers expected.",
  },
  {
    id: "work",
    label: "Workplace",
    copy: "A colleague reads this: concise professional register, clear asks and deadlines, polite directness.",
  },
  {
    id: "casual",
    label: "Casual",
    copy: "A friend reads this: natural rhythm and everyday idioms are a strength. Register is judged loosely; sound human.",
  },
];

// The repair cycle: write, get feedback, understand WHY, rewrite, then use
// the corrected structure twice in fresh sentences. Never copy, always repair.
export interface Feedback {
  level?: string;
  goal?: string | null;
  scores?: { task: number; organization: number; range: number; accuracy: number };
  verdict?: string;
  errors?: { bad: string; good: string; fa: string; type?: string }[];
  upgrades?: { plain: string; c1: string; fa?: string }[];
  next_focus?: string;
}
// Task 108: aligned to /api/writing GET's real `recent` row shape (the old
// Sample shape - promptId/aiFeedback/createdAt - never existed on the wire,
// so "Your last drafts" rendered empty forever).
export interface Sample {
  id: number;
  prompt: string;
  revision: number;
  parentId: number | null;
  result: { scores?: Record<string, number> } | null;
  at: string;
  text: string;
}
