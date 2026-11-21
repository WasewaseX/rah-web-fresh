// Review flow choreography: the queue intake, the grade commit and the
// keyboard decision, split out of review.tsx so the component stays inside
// the function-length budget. ReviewView owns the hooks; these module
// functions receive the setters and refs through explicit bundles.

import type { Dispatch, SetStateAction } from "react";
import { answerEq } from "@/lib/fsrs";
import { submitGrade } from "@/lib/offline";
import type { QueueItem, ReviewPhase, SessionDone } from "./shared";
import { acceptable } from "./shared";

// Queue intake setters, all stable useState setters (load keeps the original
// [] deps contract).
interface LoadFlow {
  setLoading: Dispatch<SetStateAction<boolean>>;
  setLoadErr: Dispatch<SetStateAction<string | null>>;
  setItems: Dispatch<SetStateAction<QueueItem[]>>;
  setCounts: Dispatch<SetStateAction<{ due: number; fresh: number } | null>>;
  setIdx: Dispatch<SetStateAction<number>>;
  setInput: Dispatch<SetStateAction<string>>;
  setChoice: Dispatch<SetStateAction<string | null>>;
  setPicked: Dispatch<SetStateAction<number[]>>;
  setPhase: Dispatch<SetStateAction<ReviewPhase>>;
  setCorrect: Dispatch<SetStateAction<boolean>>;
}

// /api/review/queue intake: either a real batch (rest the session) or a
// malformed/error shape.
export async function runLoad(f: LoadFlow): Promise<void> {
  f.setLoading(true);
  f.setLoadErr(null);
  try {
    const r = await fetch("/api/review/queue", { cache: "no-store" });
    const j = await r.json();
    if (Array.isArray(j.batch)) {
      f.setItems(j.batch as QueueItem[]);
      f.setCounts(j.counts ?? null);
      f.setIdx(0);
      f.setInput("");
      f.setChoice(null);
      f.setPicked([]);
      f.setPhase("prompt");
      f.setCorrect(false);
    } else {
      f.setLoadErr(typeof j.error === "string" ? j.error : "The queue came back malformed.");
    }
  } catch {
    f.setLoadErr("Could not reach the server.");
  } finally {
    f.setLoading(false);
  }
}

// The grade flow's reads and writes, grouped as one bundle. Values are the
// render-time reads; setters are the useState setters; refs are passed as
// refs and stamped inside (the completion path reads startedAt).
interface GradeFlow {
  cur: QueueItem;
  idx: number;
  items: QueueItem[];
  busy: boolean;
  dir: string;
  gradeStats: { current: { hit: number; n: number } };
  startedAt: { current: number };
  onDone: () => void;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setItems: Dispatch<SetStateAction<QueueItem[]>>;
  setDone: Dispatch<SetStateAction<SessionDone | null>>;
  setInput: Dispatch<SetStateAction<string>>;
  setChoice: Dispatch<SetStateAction<string | null>>;
  setPicked: Dispatch<SetStateAction<number[]>>;
  setPhase: Dispatch<SetStateAction<ReviewPhase>>;
  setCorrect: Dispatch<SetStateAction<boolean>>;
  setIdx: Dispatch<SetStateAction<number>>;
}

// Grade commit + deck advance: offline sync (Task 68 doctrine), the "Again"
// requeue, session completion, advance resets.
export async function runGrade(f: GradeFlow, r: number): Promise<void> {
  if (!f.cur || f.busy) return;
  f.setBusy(true);
  // Real offline sync (Task 68 doctrine): submitGrade stamps a gid, and on
  // network loss the grade lands in the local outbox for the reconnect
  // flush - the server's gid receipt makes replays idempotent.
  await submitGrade(f.cur.card.id, r, f.dir).catch(() => undefined);
  f.setBusy(false);
  // requeue "Again" inside this session after 5 cards
  if (r === 1) {
    f.setItems((xs) => {
      const copy = xs.slice();
      const relearn = { ...f.cur, tiles: [], ahead: f.cur.ahead };
      const at = Math.min(copy.length, f.idx + 6);
      copy.splice(at, 0, relearn);
      return copy;
    });
  }
  if (f.idx + 1 >= f.items.length) {
    const secs = Math.round((Date.now() - f.startedAt.current) / 1000);
    const mins = Math.max(1, Math.min(30, Math.round(secs / 60)));
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "review", minutes: mins }),
    }).then(f.onDone).catch(() => f.onDone());
    f.setDone({ n: f.items.length, reveals: f.gradeStats.current.n, hit: f.gradeStats.current.hit, secs });
  } else {
    // Deck advance: reset the answer surface here, in the event that
    // changes idx - not in an effect watching idx (cascading renders).
    f.setInput("");
    f.setChoice(null);
    f.setPicked([]);
    f.setPhase("prompt");
    f.setCorrect(false);
    f.setIdx((i) => i + 1);
  }
}

// The per-direction correctness decision, ported from the proven
// implementation. Returns:
//   boolean    -> grade the answer (reveal(true/false))
//   null       -> self-graded recall (ef/sent): skip straight to reveal
//   undefined  -> nothing to check yet (empty pick / no choice)
export function judgeAnswer(a: {
  dir: string;
  isBank: boolean;
  audioMcq: boolean;
  card: QueueItem["card"];
  picked: number[];
  tiles: string[];
  choice: string | null;
  input: string;
}): boolean | null | undefined {
  if (a.isBank) {
    if (a.picked.length === 0) return undefined;
    return acceptable(a.card, a.picked.map((i) => a.tiles[i]).join(" "), "fa2en");
  }
  if (a.dir === "mcq_fa" || a.audioMcq) {
    if (!a.choice) return undefined;
    return a.choice === a.card.fa;
  }
  if (a.dir === "ef" || a.dir === "sent") return null; // self-graded recall
  if (a.dir === "cloze") return answerEq(a.input, a.card.answer, a.card.alt);
  if (a.dir === "fae" || a.dir === "fa2en") return answerEq(a.input, a.card.answer, [...a.card.alt, a.card.en]);
  if (a.dir === "reverse") return acceptable(a.card, a.input, "reverse");
  if (a.dir === "audio") return acceptable(a.card, a.input, "audio");
  return null;
}

// Enter checks, 1-4 grades when the answer is out.
export function keyJudge(e: KeyboardEvent, phase: ReviewPhase, check: () => void, grade: (r: number) => void) {
  if (phase === "prompt" && e.key === "Enter") {
    e.preventDefault();
    check();
  } else if ((phase === "checked" || phase === "reveal") && ["1", "2", "3", "4"].includes(e.key)) {
    e.preventDefault();
    grade(Number(e.key));
  }
}
