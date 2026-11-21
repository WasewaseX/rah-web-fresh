"use client";

import { loadWriteDraft, resolveDrafts, saveWriteDraft, type WriteDraft } from "@/lib/write-draft";
import type { WritingGoal } from "./shared";

// Draft resolution on mount: server draft vs this device's localStorage,
// last-write-wins on the save timestamp (pure seam, battery-pinned).
// Verbatim from the pre-split effect body of WritingView.
export async function syncDraftOnMount(
  cancelled: { v: boolean },
  setRestored: (v: WriteDraft | null) => void,
  setDraftNote: (v: string) => void,
) {
  const local = loadWriteDraft(window.localStorage);
  let remote: WriteDraft | null = null;
  try {
    const r = await fetch("/api/write-draft", { cache: "no-store" });
    const j = await r.json();
    remote = j.draft ?? null;
  } catch {
    /* offline: the local draft stands on its own */
  }
  if (cancelled.v) return;
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
}

// Debounced autosave payload: local first (instant), server second (same
// payload). Both are DRAFT caches - a submission clears both.
export function autosaveDraft(text: string, goal: WritingGoal) {
  const draft: WriteDraft = { text, goalSel: goal, revisingId: null, at: Date.now() };
  saveWriteDraft(draft, window.localStorage);
  void fetch("/api/write-draft", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  }).catch(() => undefined);
}
