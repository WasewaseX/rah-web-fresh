"use client";

import { useEffect, useState } from "react";
import type { Boot } from "@/app/page";
import { WRITE_PROMPTS } from "@/lib/content";
import { wordCount } from "@/lib/fsrs";
import { loadWriteDraft, saveWriteDraft, clearWriteDraft, resolveDrafts, type WriteDraft } from "@/lib/write-draft";
import type { Feedback, Sample, WritingGoal } from "./writing/shared";
import { PickStage, ModelStage } from "./writing/Stages";
import { WriteStage } from "./writing/WriteStage";
import { RepairStage } from "./writing/RepairStage";

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
    let cancelled = false;
    void (async () => {
      const local = loadWriteDraft(window.localStorage);
      let remote: WriteDraft | null = null;
      try {
        const r = await fetch("/api/write-draft", { cache: "no-store" });
        const j = await r.json();
        remote = j.draft ?? null;
      } catch {
        /* offline: the local draft stands on its own */
      }
      if (cancelled) return;
      const { draft, source } = resolveDrafts(local, remote);
      if (draft && source === "remote") {
        setRestored(draft);
        const when = draft.at ? new Date(draft.at).toLocaleString() : "an earlier session";
        setDraftNote(`An unsent draft from ${when} is waiting - open any prompt and it loads there. It was newer than this device's copy.`);
      } else if (draft && source === "local") {
        // This device holds the newest copy: push it up so the server carries it too.
        void fetch("/api/write-draft", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        }).catch(() => undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced autosave while drafting: local first (instant), server second
  // (same payload). Both are DRAFT caches - a submission clears both.
  useEffect(() => {
    if (stage !== "write" || !text.trim()) return;
    const t = setTimeout(() => {
      const draft: WriteDraft = { text, goalSel: goal, revisingId: null, at: Date.now() };
      saveWriteDraft(draft, window.localStorage);
      void fetch("/api/write-draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      }).catch(() => undefined);
    }, 2500);
    return () => clearTimeout(t);
  }, [text, goal, stage]);

  const words = wordCount(text);
  const inRange = words >= (prompt?.minWords ?? 100) && words <= (prompt?.maxWords ?? 300) + 60;

  // The examiner call. Body shape and the result wiring are battery-pinned
  // (Task 108); a submission ends the draft's life on BOTH halves.
  const submitForFeedback = async () => {
    if (!prompt) return;
    setFbState("busy");
    setFbMsg("");
    try {
      const r = await fetch("/api/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.prompt, text, goal }),
      });
      const j = await r.json();
      if (r.ok && j && !j.error) {
        setFeedback(j);
        if (typeof j.id === "number") setLastId(j.id);
        clearWriteDraft(window.localStorage);
        void fetch("/api/write-draft", { method: "DELETE" }).catch(() => undefined);
        setDraftNote("");
        await fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "writing", minutes: 10, meta: { promptId: pid } }),
        }).catch(() => undefined);
        onDone();
        setStage("repair");
      } else {
        setFbState("err");
        setFbMsg(j.error ?? "no AI configured");
        setStage("repair");
      }
    } catch {
      setFbState("err");
      setFbMsg("network error");
      setStage("repair");
    } finally {
      setFbState("idle");
    }
  };

  const setSelfCheckAt = (fn: (x: Record<string, boolean>) => Record<string, boolean>, k: string, v: boolean) => {
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
    return <WriteStage header={header} prompt={prompt} text={text} setText={setText} goal={goal} setGoal={setGoal} words={words} inRange={inRange} fbState={fbState} fbMsg={fbMsg} submit={submitForFeedback} selfCheck={selfCheck} setSelfCheck={setSelfCheckAt} />;
  }
  if (stage === "repair" && prompt) {
    return <RepairStage header={header} feedback={feedback} prompt={prompt} repaired={repaired} setRepaired={setRepaired} reuse={reuse} setReuse={setReuse} lastId={lastId} setStage={setStage} />;
  }
  if (stage === "model" && prompt) {
    return <ModelStage header={header} prompt={prompt} setStage={setStage} />;
  }

  return null;
}
