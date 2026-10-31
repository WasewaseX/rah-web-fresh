"use client";

import { useEffect, useState } from "react";
import type { Boot } from "@/app/page";
import { SectionTitle, Note } from "./bits";
import { WRITE_PROMPTS } from "@/lib/content";
import { wordCount } from "@/lib/fsrs";

// The repair cycle: write, get feedback, understand WHY, rewrite, then use
// the corrected structure twice in fresh sentences. Never copy, always repair.
interface Feedback {
  level?: string;
  scores?: { task: number; organization: number; range: number; accuracy: number };
  verdict?: string;
  errors?: { bad: string; good: string; fa: string; type?: string }[];
  upgrades?: { plain: string; c1: string; fa?: string }[];
  next_focus?: string;
}
// Task 108: aligned to /api/writing GET's real `recent` row shape (the old
// Sample shape - promptId/aiFeedback/createdAt - never existed on the wire,
// so "Your last drafts" rendered empty forever).
interface Sample {
  id: number;
  prompt: string;
  revision: number;
  parentId: number | null;
  result: { scores?: Record<string, number> } | null;
  at: string;
  text: string;
}

export default function WritingView({ boot, onDone }: { boot: Boot; onDone: () => void }) {
  const [stage, setStage] = useState<"pick" | "write" | "repair" | "model">("pick");
  const [pid, setPid] = useState("");
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [fbState, setFbState] = useState<"idle" | "busy" | "err">("idle");
  const [fbMsg, setFbMsg] = useState("");
  const [repaired, setRepaired] = useState("");
  const [reuse, setReuse] = useState(["", ""]);
  const [showModel, setShowModel] = useState(false);
  const [selfCheck, setSelfCheck] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<Sample[]>([]);
  const [lastId, setLastId] = useState<number | null>(null);

  const prompt = WRITE_PROMPTS.find((p) => p.id === pid);

  useEffect(() => {
    fetch("/api/writing")
      .then((r) => r.json())
      .then((j) => setHistory(j.recent ?? []))
      .catch(() => undefined);
  }, []);

  const words = wordCount(text);
  const inRange = words >= (prompt?.minWords ?? 100) && words <= (prompt?.maxWords ?? 300) + 60;

  if (stage === "pick") {
    return (
      <div>
        <SectionTitle
          title="Writing workshop"
          sub="One hundred to two hundred fifty words a day. Feedback only counts when you repair the error and reuse the structure."
        />
        <div className="grid md:grid-cols-2 gap-4">
          {WRITE_PROMPTS.map((p) => (
            <button
              key={p.id}
              className="card-rah p-5 text-left hover:shadow-md transition-shadow"
              onClick={() => { setPid(p.id); setText(""); setFeedback(null); setShowModel(false); setStage("write"); }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="chip chip-accent">{p.minWords} to {p.maxWords} words</span>
                <span className="chip">model answer available</span>
              </div>
              <div className="text-[14.5px] font-semibold leading-relaxed">{p.prompt}</div>
            </button>
          ))}
        </div>
        {history.length ? (
          <div className="card-rah p-5 mt-5">
            <div className="font-bold text-[14px] mb-2">Your last drafts</div>
            {history.slice(0, 5).map((h) => (
              <div key={h.id} className="flex items-baseline justify-between gap-4 py-1.5 border-b last:border-0 text-[13px]" style={{ borderColor: "var(--line)" }}>
                <span className="truncate max-w-[60%]">{h.text.slice(0, 70)}...</span>
                <span style={{ color: "var(--muted)" }}>{wordCount(h.text)} words · rev {h.revision}{h.result ? " · graded" : ""}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const header = (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="chip chip-accent">{stage === "write" ? "draft" : stage === "repair" ? "repair" : "model"}</span>
        <span className="chip">{prompt?.minWords} to {prompt?.maxWords} words</span>
      </div>
      <button className="text-[12.5px] font-semibold" style={{ color: "var(--muted)" }} onClick={() => setStage("pick")}>back</button>
    </div>
  );

  if (stage === "write" && prompt) {
    return (
      <div className="max-w-3xl mx-auto">
        {header}
        <p className="text-[17px] leading-relaxed mb-5">{prompt.prompt}</p>
        <div className="card-rah p-6">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-2xl border p-5 min-h-[300px] text-[15.5px] leading-[1.8]"
            style={{ borderColor: "var(--line)", background: "#fff", outline: "none" }}
            placeholder="Answer the prompt with a position and two developed reasons. Collocations over loose pairs."
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-[13px] font-semibold" style={{ color: inRange ? "var(--accent-deep)" : "var(--muted)" }}>
              {words} words {inRange ? "· in range" : `· target ${prompt.minWords}+`}
            </span>
            <div className="flex gap-2">
              <button
                className="btn-primary"
                disabled={words < 40 || fbState === "busy"}
                onClick={async () => {
                  setFbState("busy");
                  setFbMsg("");
                  try {
                    const r = await fetch("/api/writing", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      // Task 108: the route reads {prompt, text, revisingId,
                      // goal} - the old promptId/action body graded the essay
                      // against an EMPTY prompt. r.ok + j.error, and the
                      // result arrives at the top level (no {ok,feedback}
                      // wrapper ever existed).
                      body: JSON.stringify({ prompt: prompt.prompt, text }),
                    });
                    const j = await r.json();
                    if (r.ok && j && !j.error) {
                      setFeedback(j);
                      if (typeof j.id === "number") setLastId(j.id);
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
                }}
              >
                {fbState === "busy" ? "The examiner is reading..." : "Submit for CEFR feedback"}
              </button>
            </div>
          </div>
          {fbMsg ? <div className="mt-3"><Note tone="warn">{fbMsg}. No problem: use the self-check rubric below, then repair from your own re-read. The rubric catches most of what the examiner would.</Note></div> : null}
          <div className="mt-5 rounded-2xl p-5" style={{ background: "#f4f3ec" }}>
            <div className="font-bold text-[13px] mb-2">Self-check rubric (no AI needed)</div>
            {[
              ["task", "I answered every part of the prompt with development, not just a position"],
              ["org", "Two or more paragraphs, each with one job, connected with discourse markers"],
              ["range", "At least five collocations or fixed expressions, one hedged claim"],
              ["accuracy", "I re-read for my trap list: articles, countability, prepositions, that-omission"],
            ].map(([k, label]) => (
              <label key={k} className="flex items-start gap-2.5 py-1.5 text-[13.5px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={selfCheck[k] ?? false}
                  onChange={(e) => setSelfCheck((x) => ({ ...x, [k]: e.target.checked }))}
                  className="mt-0.5"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (stage === "repair" && prompt) {
    return (
      <div className="max-w-3xl mx-auto">
        {header}
        {feedback ? (
          <>
            <div className="card-rah p-6 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="display text-[24px] font-bold" style={{ color: "var(--accent-deep)" }}>{feedback.level}</span>
                <span className="text-[13px]" style={{ color: "var(--muted)" }}>{feedback.verdict}</span>
              </div>
              {feedback.scores ? (
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {Object.entries(feedback.scores).map(([k, v]) => (
                    <div key={k} className="rounded-xl p-3 text-center" style={{ background: "#f4f3ec" }}>
                      <div className="display text-[20px] font-bold">{v}/10</div>
                      <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>{k}</div>
                    </div>
                  ))}
                </div>
              ) : null}
              {feedback.errors?.length ? (
                <>
                  <div className="font-bold text-[14px] mb-2">Corrections, with the why in Farsi</div>
                  {feedback.errors.map((e, i) => (
                    <div key={i} className="rounded-xl border p-4 mb-2" style={{ borderColor: "var(--line)" }}>
                      <div className="text-[14px]"><span style={{ color: "var(--danger)", textDecoration: "line-through" }}>{e.bad}</span> → <b>{e.good}</b></div>
                      <div dir="rtl" className="fa-text text-[13.5px] mt-1">{e.fa}</div>
                    </div>
                  ))}
                </>
              ) : null}
              {feedback.upgrades?.length ? (
                <>
                  <div className="font-bold text-[14px] mb-2 mt-4">B2 to C1 upgrades</div>
                  {feedback.upgrades.map((u, i) => (
                    <div key={i} className="rounded-xl p-4 mb-2" style={{ background: "var(--accent-dim)" }}>
                      <div className="text-[13.5px]"><span style={{ color: "var(--muted)" }}>{u.plain}</span> → <b>{u.c1}</b></div>
                      {u.fa ? <div dir="rtl" className="fa-text text-[12.5px] mt-1">{u.fa}</div> : null}
                    </div>
                  ))}
                </>
              ) : null}
              {feedback.next_focus ? <div className="mt-4 text-[13.5px] font-semibold">Next focus: {feedback.next_focus}</div> : null}
            </div>
          </>
        ) : (
          <div className="mb-4">
            <Note tone="warn">
              No AI examiner connected, so grade yourself: pick your single worst error from the draft and answer the two
              questions below honestly. The repair is the exercise, not the grading.
            </Note>
          </div>
        )}

        <div className="card-rah p-6 mb-4">
          <div className="display text-[19px] font-bold mb-2">The repair, where the learning happens</div>
          <label className="text-[12.5px] font-bold block mb-1 mt-3">1. The one error I keep making (worst one only)</label>
          <textarea
            value={repaired}
            onChange={(e) => setRepaired(e.target.value)}
            className="w-full rounded-2xl border p-4 min-h-[80px] text-[14.5px]"
            style={{ borderColor: "var(--line)", background: "#fff", outline: "none" }}
            placeholder='e.g. "I have seen him yesterday" needs past simple: I saw him yesterday. Time point means past tense.'
          />
          <label className="text-[12.5px] font-bold block mb-1 mt-4">2. Now use that corrected structure in two brand new sentences</label>
          {reuse.map((v, i) => (
            <input
              key={i}
              value={v}
              onChange={(e) => setReuse((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))}
              className="w-full rounded-xl border px-4 py-2.5 text-[14px] mb-2"
              style={{ borderColor: "var(--line)", background: "#fff", outline: "none" }}
              placeholder={i === 0 ? "New sentence one, different topic" : "New sentence two, different topic again"}
            />
          ))}
          <div className="flex justify-between items-center mt-4">
            <button className="text-[12.5px] font-semibold" style={{ color: "var(--muted)" }} onClick={() => setStage("write")}>back to draft</button>
            <button
              className="btn-primary"
              disabled={!repaired.trim() || !reuse[0].trim() || !reuse[1].trim()}
              onClick={async () => {
                // Task 108: action:"save" now hits the route's save-only leg
                // (stores the repair as the draft's revision - revision 2
                // when the graded draft's id is known - no AI call, no XP).
                await fetch("/api/writing", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ prompt: prompt.prompt, text: repaired + "\n\nReuse:\n" + reuse.filter(Boolean).join("\n"), revisingId: lastId ?? 0, action: "save" }),
                }).catch(() => undefined);
                setStage("model");
              }}
            >
              Save repair, compare with the model
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "model" && prompt) {
    return (
      <div className="max-w-3xl mx-auto">
        {header}
        <div className="card-rah p-8">
          <div className="display text-[19px] font-bold mb-2">The C1 model answer</div>
          <p className="text-[13.5px] mb-4" style={{ color: "var(--muted)" }}>
            Research on L2 writing keeps finding that studying high-quality models beats error correction alone. Read it as
            a builder, not a judge: how does it open, how does each paragraph earn its place, where does it concede?
          </p>
          <p className="text-[16px] leading-[1.9] rounded-2xl p-6 mb-5" style={{ background: "#f4f3ec" }}>{prompt.model}</p>
          <div className="font-bold text-[13.5px] mb-2">What makes it C1</div>
          <ul className="text-[14px] leading-relaxed list-disc pl-5 space-y-1.5">
            {prompt.modelNotes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
          <div className="mt-6 flex gap-2">
            <button className="btn-primary" onClick={() => setStage("pick")}>Another prompt</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
