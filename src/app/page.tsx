import RahApp from "@/components/rah/App";

// The bootstrap payload (GET /api/bootstrap) as the client components consume
// it. Task 102 reconstruction: the feature components import this type from
// the page module; the shape mirrors what the bootstrap route returns.
export interface Boot {
  learner: {
    name: string;
    level: string;
    streak: number;
    bestStreak: number;
    onboarded: boolean;
    diagnosis: unknown;
    xp: number;
  };
  counts: { due: number; fresh: number };
  plan: { strand: string; minutes: number; label: string; why?: string; note: string; view: string }[];
  protocol: { totalPlanned: number; donePlanned: number; minutesByStrand: Record<string, number> };
  placement: { level: string; strands: unknown; day: number } | null;
  ai: {
    builtin: boolean;
    model: string;
    label?: string;
    baseUrl?: string;
    preset?: string;
    keyMasked: string;
    keyset: boolean;
  };
  stats: Record<string, number>;
  newToday?: number;
  checkpoints?: unknown[];
  userCards?: unknown[];
  grammarDone?: unknown[];
  sessions?: unknown[];
}

export default function Page() {
  return <RahApp />;
}
