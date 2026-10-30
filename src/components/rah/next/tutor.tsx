"use client";

import { useEffect, useRef, useState } from "react";
import type { Boot } from "@/app/page";
import { SectionTitle } from "./bits";

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

export default function TutorView({ boot }: { boot: Boot }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setTurns([
      {
        role: "assistant",
        reply:
          "Salam! I am your retrieval coach. Tell me about your week, and I will push you to produce English, not just understand it. Two sentences to start.",
        fa_note: "چیزی که می‌نویسی مهم نیست، مهم این است که تولید کنی. شروع کن.",
      },
    ]);
  }, []);

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
      const j = await r.json();
      if (j.ok) {
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
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: "calc(100vh - 190px)" }}>
      <SectionTitle
        title="Tutor"
        sub="Socratic by contract: it makes you produce before it explains. Corrections carry the Farsi why."
        right={<span className="chip chip-accent">{boot.ai.builtin ? "built-in engine" : boot.ai.model}</span>}
      />
      <div ref={scroller} className="flex-1 overflow-y-auto pr-1 space-y-4">
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="rounded-3xl rounded-br-md px-5 py-3 max-w-[85%] text-[14.5px]" style={{ background: "var(--ink)", color: "#fff" }}>
                {t.text}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="card-rah px-5 py-4 max-w-[92%]">
                <div className="text-[14.5px] leading-relaxed whitespace-pre-wrap" style={t.error ? { color: "var(--danger)" } : undefined}>
                  {t.reply}
                </div>
                {t.corrections?.length ? (
                  <div className="mt-3 space-y-2">
                    {t.corrections.map((c, ci) => (
                      <div key={ci} className="rounded-xl p-3" style={{ background: "#f4f3ec" }}>
                        <div className="text-[13.5px]">
                          <span style={{ color: "var(--danger)", textDecoration: "line-through" }}>{c.wrong}</span>
                          {" → "}
                          <b style={{ color: "var(--accent-deep)" }}>{c.right}</b>
                        </div>
                        {c.fa ? <div dir="rtl" className="fa-text text-[13px] mt-1">{c.fa}</div> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {t.fa_note ? <div dir="rtl" className="fa-text text-[13px] mt-3 pt-3 border-t" style={{ borderColor: "var(--line)" }}>{t.fa_note}</div> : null}
              </div>
            </div>
          )
        )}
        {busy ? <div className="text-[13px]" style={{ color: "var(--muted)" }}>thinking...</div> : null}
      </div>
      <div className="pt-4">
        <div className="card-rah flex items-end gap-2 p-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            className="flex-1 resize-none rounded-2xl px-4 py-3 text-[14.5px] max-h-32"
            style={{ background: "transparent", border: "none", outline: "none" }}
            placeholder="Write in English. Mistakes welcome, that is the point."
            rows={1}
          />
          <button className="btn-primary text-[13.5px]" disabled={busy || !input.trim()} onClick={send}>
            Send
          </button>
        </div>
        <div className="text-[11.5px] mt-2 text-center" style={{ color: "var(--muted)" }}>
          Enter sends, Shift+Enter breaks a line. Powered by the built-in engine, no key required.
        </div>
      </div>
    </div>
  );
}
