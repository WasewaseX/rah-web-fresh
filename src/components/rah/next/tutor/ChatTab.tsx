"use client";

// ---------- Chat (the Task 104 surface, unchanged contract) ----------
// Socratic production coach over /api/ai. Split out of tutor.tsx: the
// component owns the hooks, the module helpers own the request and the
// per-turn rendering.

import { useEffect, useRef, useState } from "react";
import { applyTheme, type RahTheme } from "@/lib/theme-bus";

interface Correction {
  wrong: string;
  right: string;
  fa: string;
  trap?: string;
}
interface Turn {
  role: "user" | "assistant";
  text?: string;
  reply?: string;
  corrections?: Correction[];
  fa_note?: string;
  error?: boolean;
}

// POST /api/ai with the rolling history. The history summary keeps the
// payload small: user turns are placeholders, assistant turns carry the reply.
async function requestTutorReply(turns: Turn[], text: string) {
  const history = [
    ...turns.map((t) => ({
      role: t.role,
      content: t.role === "user" ? "(user message)" : JSON.stringify({ reply: t.reply }),
    })),
    { role: "user", content: text },
  ];
  const r = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "tutor", history }),
  });
  return r.json();
}

// One thread turn: the learner's bubble, or the coach bubble with the
// correction cards and the Farsi note.
function TurnBubble({ turn }: { turn: Turn }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="rounded-3xl rounded-br-md px-5 py-3 max-w-[85%] text-[14.5px] break-words whitespace-pre-wrap [overflow-wrap:anywhere]" style={{ background: "var(--ink)", color: "#fff" }}>
          {turn.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="card-rah px-5 py-4 max-w-[92%]">
        <div className="text-[14.5px] leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]" style={turn.error ? { color: "var(--danger)" } : undefined}>
          {turn.reply}
        </div>
        {turn.corrections?.length ? (
          <div className="mt-3 space-y-2">
            {turn.corrections.map((c, ci) => (
              <div key={ci} className="rounded-xl p-3" style={{ background: "var(--rah-callout)" }}>
                <div className="text-[13.5px] break-words [overflow-wrap:anywhere]">
                  <span style={{ color: "var(--danger)", textDecoration: "line-through" }}>{c.wrong}</span>
                  {" → "}
                  <b style={{ color: "var(--accent-deep)" }}>{c.right}</b>
                </div>
                {c.fa ? <div dir="rtl" className="fa-text text-[13px] mt-1 break-words [overflow-wrap:anywhere]">{c.fa}</div> : null}
              </div>
            ))}
          </div>
        ) : null}
        {turn.fa_note ? <div dir="rtl" className="fa-text text-[13px] mt-3 pt-3 border-t break-words [overflow-wrap:anywhere]" style={{ borderColor: "var(--line)" }}>{turn.fa_note}</div> : null}
      </div>
    </div>
  );
}

// The message composer: Enter sends, Shift+Enter breaks a line.
function Composer({ input, setInput, busy, onSend }: { input: string; setInput: (v: string) => void; busy: boolean; onSend: () => void }) {
  return (
    <div className="pt-4">
      <div className="card-rah flex items-end gap-2 p-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Message the tutor"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          className="min-h-[72px] flex-1 resize-none rounded-2xl px-4 py-3 text-[14.5px] max-h-32"
          style={{ background: "transparent", border: "none", outline: "none" }}
          placeholder="Write in English. Mistakes welcome, that is the point."
          rows={1}
        />
        <button className="btn-primary text-[13.5px]" disabled={busy || !input.trim()} onClick={onSend}>
          Send
        </button>
      </div>
      <div className="text-[12px] mt-2 text-center" style={{ color: "var(--muted)" }}>
        Enter sends, Shift+Enter breaks a line. Powered by the built-in engine, no key required.
      </div>
    </div>
  );
}

export function ChatTab() {
  // Greeting is the initial state - no setState inside a mount effect
  // (cascading render).
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "assistant",
      reply:
        "Salam! I am your retrieval coach. Tell me about your week, and I will push you to produce English, not just understand it. Two sentences to start.",
      fa_note: "چیزی که می‌نویسی مهم نیست، مهم این است که تولید کنی. شروع کن.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setTurns((t) => [...t, { role: "user", text }]);
    setBusy(true);
    try {
      const j = await requestTutorReply(turns, text);
      if (j.ok) {
        // Task 119: the theme intent returns real tokens - paint them NOW so
        // "make the UI theme green" visibly repaints the app in the same turn.
        if (j.turn?.theme !== undefined) applyTheme((j.turn.theme ?? null) as RahTheme | null);
        setTurns((t) => [
          ...t,
          { role: "assistant", reply: j.turn.reply, corrections: j.turn.corrections ?? [], fa_note: j.turn.fa_note },
        ]);
      } else {
        setTurns((t) => [
          ...t,
          { role: "assistant", reply: j.error ?? "The provider call failed.", error: true },
        ]);
      }
    } catch {
      setTurns((t) => [...t, { role: "assistant", reply: "Network error. Check your connection and try again.", error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    /* Task 109: calc(100vh - 260px) let the chat exceed the visible viewport
       (title + tabs stack above it), so the page scrolled and the input sat
       below the fold under a void. Capped to a viewport-aware min. */
    <div className="flex flex-col" style={{ height: "min(58vh, 620px)", minHeight: 340 }}>
      <div ref={scroller} className="flex-1 overflow-y-auto pr-1 space-y-4">
        {turns.map((t, i) => (
          <TurnBubble key={i} turn={t} />
        ))}
        {busy ? <div className="text-[13px]" style={{ color: "var(--muted)" }}>thinking...</div> : null}
      </div>
      <Composer input={input} setInput={setInput} busy={busy} onSend={() => void send()} />
    </div>
  );
}
