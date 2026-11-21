"use client";

import type { ListenPassage } from "@/content/listening";

// Behavioral core of the listening view, lifted out of ListeningView so the
// component stays under the scanner function budget. All state flows through
// the ctx bundle; behavior is verbatim from the pre-split handlers.
export function makeListeningActions(ctx: {
  pid: string;
  passage: ListenPassage | undefined;
  segments: string[];
  addedVocab: Record<string, "loading" | "done" | "exists">;
  setAddedVocab: (fn: (x: Record<string, "loading" | "done" | "exists">) => Record<string, "loading" | "done" | "exists">) => void;
}) {
  const { pid, passage, segments, addedVocab, setAddedVocab } = ctx;

  const log = (round: number, missType = "", d = "") => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "listening", passageId: pid, round, missType, detail: d }),
    }).catch(() => undefined);
  };

  const addVocab = async (w: string, fa: string) => {
    if (!passage || addedVocab[w]) return;
    setAddedVocab((x) => ({ ...x, [w]: "loading" }));
    // The exact passage sentence that carries the word rides onto the card.
    const sentence = segments.find((s) => s.toLowerCase().includes(w.toLowerCase().split(" ")[0])) ?? "";
    try {
      const r = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "listenvocab", word: w, fa, passageId: passage.id, sentence }),
      });
      const j = await r.json();
      setAddedVocab((x) => ({ ...x, [w]: j.created ? "done" : "exists" }));
    } catch {
      setAddedVocab((x) => {
        const n = { ...x };
        delete n[w];
        return n;
      });
    }
  };

  const trackMinutes = (mins: number) => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "listening", minutes: mins, meta: { passageId: pid } }),
    }).catch(() => undefined);
  };

  return { log, addVocab, trackMinutes };
}
