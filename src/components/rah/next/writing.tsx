"use client";

import { useEffect, useState } from "react";
import type { Boot } from "@/app/page";
import { WRITE_PROMPTS } from "@/lib/content";
import { wordCount } from "@/lib/fsrs";
import type { WriteDraft } from "@/lib/write-draft";
import type { Feedback, Sample, WritingGoal } from "./writing/shared";
import { PickStage, ModelStage } from "./writing/Stages";
import { WriteStage } from "./writing/WriteStage";
import { RepairStage } from "./writing/RepairStage";
import { submitForFeedback } from "./writing/submit";
import { syncDraftOnMount, autosaveDraft } from "./writing/draft";

export default function WritingView({ onDone }: { boot: Boot; onDone: () => void }) {
  const [stage, setStage] = useState<"pick" | "write" | "repair" | "model">("pick");
  const [pid, setPid] = useState("");
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [fbState, setFbState] = useState<"idle" | "busy" | "err">("idle");
  const [fbMsg, setFbMsg] = useState("");
  const [repaired, setRepaired] = useState("");
  const [reuse, setReuse] = useState(["", ""]);
  const [selfCheck, setSelfCheck] = useState<Record<string, boolean>>({});
  const [goal, setGoal] = useState<WritingGoal>("exam");
  const [history, setHistory] = useState<Sample[]>([]);
  const [lastId, setLastId] = useState<number | null>(null);
  // Cross-device draft sync (§3.3): the Task 94 autosave gains a server half.
  const [restored, setRestored] = useState<WriteDraft | null>(null);
  const [draftNote, setDraftNote] = useState("");

  const prompt = WRITE_PROMPTS.find((p) => p.id === pid);

  useEffect(() => {
    fetch("/api/writing")
      .then((r) => r.json())
      .then((j) => setHistory(j.recent ?? []))
      .catch(() => undefined);
  }, []);



  // Draft resolution on mount: server draft vs this device's localStorage,
  // last-write-wins on the save timestamp (pure seam, battery-pinned).
  useEffect(() => {
    const cancelled = { v: false };
    void syncDraftOnMount(cancelled, setRestored, setDraftNote);
    return () => {
      cancelled.v = true;
    };
  }, []);

  // Debounced autosave while drafting: local first (instant), server second
  // (same payload). Both are DRAFT caches - a submission clears both.
  useEffect(() => {
    if (stage !== "write" || !text.trim()) return;
    const t = setTimeout(() => autosaveDraft(text, goal), 2500);
    return () => clearTimeout(t);
  }, [text, goal, stage]);

  // The examiner call. Body shape and the result wiring are battery-pinned
  // (Task 108); a submission ends the draft's life on BOTH halves.
  const submit = () => submitForFeedback({
    prompt, text, goal, pid, setFbState, setFbMsg, setFeedback, setLastId, setDraftNote, setStage, onDone,
  });

  const words = wordCount(text);
  const inRange = words >= (prompt?.minWords ?? 100) && words <= (prompt?.maxWords ?? 300) + 60;

  // The examiner call. Body shape and the result wiring are battery-pinned
  // (Task 108); a submission ends the draft's life on BOTH halves.
  const setSelfCheckAt = (fn: (x: Record<string, boolean>) => Record<string, boolean>, _k: string, v: boolean) => {
    void v;
    setSelfCheck(fn);
  };

  const header = (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="chip chip-accent">{stage === "write" ? "draft" : stage === "repair" ? "repair" : "model"}</span>
        <span className="chip">{prompt?.minWords} to {prompt?.maxWords} words</span>
      </div>
      <button className="text-[12.5px] font-semibold" style={{ color: "var(--muted)" }} onClick={() => setStage("pick")}>back</button>
    </div>
  );

  if (stage === "pick") {
    return <PickStage draftNote={draftNote} history={history} restored={restored} setPid={setPid} setText={setText} setGoal={setGoal} setRestored={setRestored} setFeedback={setFeedback} setStage={setStage} />;
  }
  if (stage === "write" && prompt) {
    return <WriteStage header={header} prompt={prompt} text={text} setText={setText} goal={goal} setGoal={setGoal} words={words} inRange={inRange} fbState={fbState} fbMsg={fbMsg} submit={submit} selfCheck={selfCheck} setSelfCheck={setSelfCheckAt} />;
  }
  if (stage === "repair" && prompt) {
    return <RepairStage header={header} feedback={feedback} prompt={prompt} repaired={repaired} setRepaired={setRepaired} reuse={reuse} setReuse={setReuse} lastId={lastId} setStage={setStage} />;
  }
  if (stage === "model" && prompt) {
    return <ModelStage header={header} prompt={prompt} setStage={setStage} />;
  }

  return null;
}
