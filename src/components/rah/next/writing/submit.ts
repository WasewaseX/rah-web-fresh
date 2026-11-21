"use client";

import { clearWriteDraft } from "@/lib/write-draft";
import type { Feedback, WritingGoal } from "./shared";

// The examiner call of WritingView, lifted verbatim so the component stays
// under the scanner function budget. Body shape and the result wiring are
// battery-pinned (Task 108); a submission ends the draft's life on BOTH halves.
export async function submitForFeedback(ctx: {
  prompt: { prompt: string } | undefined;
  text: string;
  goal: WritingGoal;
  pid: string;
  setFbState: (v: "idle" | "busy" | "err") => void;
  setFbMsg: (v: string) => void;
  setFeedback: (v: Feedback | null) => void;
  setLastId: (v: number | null) => void;
  setDraftNote: (v: string) => void;
  setStage: (v: "pick" | "write" | "repair" | "model") => void;
  onDone: () => void;
}) {
  const { prompt, text, goal, pid, setFbState, setFbMsg, setFeedback, setLastId, setDraftNote, setStage, onDone } = ctx;
  if (!prompt) return;

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
