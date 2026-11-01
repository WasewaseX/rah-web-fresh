"use client";

import { useState } from "react";
import type { Boot } from "@/app/page";
import { SectionTitle, Note, Fa } from "./bits";
import { READINGS } from "@/lib/content";

type Mode = "pick" | "extensive" | "intensive" | "import";

export default function ReadingView({ boot, onDone }: { boot: Boot; onDone: () => void }) {
  const [mode, setMode] = useState<Mode>("pick");
  const [rid, setRid] = useState("");
  const [reading, setReading] = useState(0);
  const [gloss, setGloss] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);
  const [paraIdx, setParaIdx] = useState(0);
  const [recon, setRecon] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importState, setImportState] = useState<"idle" | "busy" | "done" | "err">("idle");
  const [importMsg, setImportMsg] = useState("");

  const r = READINGS.find((x) => x.id === rid);
  const paragraphs = (r?.text ?? "").split("\n").filter(Boolean);

  const logMinutes = async (mins: number, meta: Record<string, unknown> = {}) => {
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "reading", minutes: mins, meta }),
    }).catch(() => undefined);
    onDone();
  };

  if (mode === "pick") {
    return (
      <div>
        <SectionTitle
          title="Reading room"
          sub="Two modes, on purpose. Extensive builds fluency and vocabulary through volume. Intensive builds precision. Most of your minutes belong to the first."
        />
        <div className="grid md:grid-cols-3 gap-4">
          {READINGS.map((x) => (
            <div key={x.id} className="card-rah p-5 flex flex-col">
              {/* Task 109: level+minutes chips demoted to a quiet meta line;
                 the two mode buttons become one segmented control. */}
              <div className="text-[12px] font-semibold mb-2" style={{ color: "var(--muted)" }}>
                {x.level} · {x.minutes} min
              </div>
              <div className="font-bold text-[15.5px] mb-1">{x.title}</div>
              <div className="text-[13px] mb-4" style={{ color: "var(--muted)" }}>{x.glossary.length} glossed words · {x.questions.length} checks</div>
              {/* Task 112 (One Light Rule): these two are direct actions, not a
                 selected state - nine simultaneous blue fills fought the view's
                 one primary CTA. Both segments go quiet; hover raises. */}
              <div className="mt-auto flex gap-2">
                <button
                  className="seg-quiet"
                  onClick={() => { setRid(x.id); setMode("extensive"); setReading(0); setGloss({}); setAnswers({}); setChecked(false); }}
                >
                  Extensive
                </button>
                <button
                  className="seg-quiet"
                  onClick={() => { setRid(x.id); setMode("intensive"); setParaIdx(0); setRecon(""); setShowOriginal(false); }}
                >
                  Intensive
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="card-rah p-6 mt-5">
          <div className="font-bold text-[15px] mb-1">Turn anything you read into cards</div>
          <p className="max-w-[65ch] text-[13px] mb-4 leading-relaxed" style={{ color: "var(--muted)" }}>
            Paste an article, a Reddit thread, a newsletter. The built-in engine pulls the 6 to 12 most
            valuable B2/C1 items out of it and adds them to your review deck with Farsi glosses. Anything you read becomes
            study material in one click.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            className="w-full rounded-2xl border p-4 min-h-[100px] text-[14px] placeholder:text-[#98a2b3]"
            style={{ borderColor: "var(--line)", background: "var(--rah-field)", outline: "none" }}
            placeholder="Paste English text here, two paragraphs or more."
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              className="btn-primary text-[13px]"
              disabled={importState === "busy" || importText.trim().length < 80}
              onClick={async () => {
                setImportState("busy");
                try {
                  const res = await fetch("/api/ai", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "import", text: importText }),
                  });
                  const j = await res.json();
                  if (j.ok) {
                    setImportState("done");
                    setImportMsg(`${j.created} cards added to your deck. They will appear in review sessions.`);
                    onDone();
                  } else {
                    setImportState("err");
                    setImportMsg(j.error ?? "something went wrong");
                  }
                } catch {
                  setImportState("err");
                  setImportMsg("network error");
                }
              }}
            >
              {importState === "busy" ? "Reading..." : "Extract cards with AI"}
            </button>
            {importMsg ? <span className="text-[12.5px]" style={{ color: importState === "err" ? "var(--danger)" : "var(--accent-deep)" }}>{importMsg}</span> : null}
          </div>
        </div>
      </div>
    );
  }

  if (mode === "extensive" && r) {
    const done = checked;
    return (
      <div className="max-w-[72ch] mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="chip chip-accent">{r.level}</span>
            <span className="chip">extensive · {r.minutes} min</span>
          </div>
          <button className="text-[12.5px] font-semibold" style={{ color: "var(--muted)" }} onClick={() => setMode("pick")}>
            back
          </button>
        </div>
        <h2 className="display text-[28px] font-bold mb-4">{r.title}</h2>
        <div className="card-rah p-8 mb-4">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-[17px] leading-[1.85] mb-4 last:mb-0">
              {p.split(/\b/).map((w, j) => {
                const g = r.glossary.find((x) => x.w.toLowerCase() === w.toLowerCase().replace(/[.,!?;:]/g, ""));
                if (!g) return <span key={j}>{w}</span>;
                return (
                  <span
                    key={j}
                    onClick={() => setGloss((x) => ({ ...x, [g.w]: !x[g.w] }))}
                    className="cursor-pointer underline decoration-dotted decoration-2 underline-offset-4"
                    style={{ textDecorationColor: "var(--accent)" }}
                  >
                    {w}
                  </span>
                );
              })}
            </p>
          ))}
        </div>
        {Object.keys(gloss).length ? (
          <div className="card-rah p-5 mb-4">
            <div className="font-bold text-[13.5px] mb-2">Peeked words ({Object.keys(gloss).length})</div>
            {Object.entries(gloss).filter(([, v]) => v).map(([w]) => (
              <div key={w} className="flex items-baseline justify-between gap-4 py-1">
                <span className="font-bold text-[14px]">{w}</span>
                <Fa className="text-[13.5px]">{r.glossary.find((g) => g.w === w)?.fa ?? ""}</Fa>
              </div>
            ))}
            <p className="text-[12px] mt-2" style={{ color: "var(--muted)" }}>
              Looking up is fine. Just do not look up every word: your brain needs to meet vocabulary inside meaning, repeatedly.
            </p>
          </div>
        ) : null}

        {done ? (
          <div className="card-rah p-6">
            <div className="font-bold text-[15px] mb-3">Comprehension check</div>
            {r.questions.map((q, qi) => (
              <div key={qi} className="mb-5">
                <div className="text-[14.5px] font-semibold mb-2">{qi + 1}. {q.q}</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {q.choices.map((c, ci) => {
                    const chosen = answers[qi] === ci;
                    const isRight = ci === q.a;
                    return (
                      <button
                        key={ci}
                        disabled={answers[qi] !== undefined}
                        onClick={() => setAnswers((a) => ({ ...a, [qi]: ci }))}
                        className="rounded-xl border px-4 py-2.5 text-left text-[13.5px]"
                        style={
                          answers[qi] !== undefined && isRight
                            ? { background: "var(--accent-dim)", borderColor: "transparent", color: "var(--accent-deep)", fontWeight: 700 }
                            : chosen && !isRight
                            ? { background: "var(--danger-dim)", borderColor: "transparent", color: "var(--danger)" }
                            : { borderColor: "var(--line)" }
                        }
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex justify-between items-center">
              <span className="text-[13px]" style={{ color: "var(--muted)" }}>
                {Object.entries(answers).filter(([, v]) => v === r.questions[Number(Object.keys(answers)[Object.values(answers).length - 1] ?? 0)]?.a).length ? "" : ""}
              </span>
              <button className="btn-primary" onClick={() => logMinutes(r.minutes, { readingId: r.id })}>
                Log {r.minutes} minutes
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <Note>Read for meaning, not for words. When you reach the end, the check takes one minute.</Note>
            <button className="btn-primary shrink-0" onClick={() => setChecked(true)}>I finished it</button>
          </div>
        )}
      </div>
    );
  }

  if (mode === "intensive" && r) {
    const para = paragraphs[paraIdx] ?? "";
    const last = paraIdx >= paragraphs.length - 1;
    return (
      <div className="max-w-[72ch] mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="chip chip-accent">{r.level}</span>
            <span className="chip">intensive · paragraph {paraIdx + 1}/{paragraphs.length}</span>
          </div>
          <button className="text-[12.5px] font-semibold" style={{ color: "var(--muted)" }} onClick={() => setMode("pick")}>back</button>
        </div>
        <h2 className="display text-[28px] font-bold mb-4">{r.title}</h2>

        {!showOriginal ? (
          <div className="card-rah p-8 mb-4">
            <p className="text-[17.5px] leading-[1.9]">{para}</p>
            <div className="mt-5 text-[13px]" style={{ color: "var(--muted)" }}>
              Dissect it: the grammar spine, the collocations worth stealing, the discourse move, then close the text.
            </div>
            <div className="mt-4 flex gap-2 flex-wrap">
              {r.glossary.map((g) => para.toLowerCase().includes(g.w.toLowerCase()) ? (
                <span key={g.w} className="chip">{g.w} <span dir="rtl" className="text-[12px]">{g.fa}</span></span>
              ) : null)}
            </div>
            <button className="btn-primary mt-5" onClick={() => setShowOriginal(true)}>
              Close the text, reconstruct
            </button>
          </div>
        ) : (
          <div className="card-rah p-8 mb-4">
            <div className="display text-[19px] font-bold mb-2">Rebuild the idea, without looking</div>
            <p className="text-[13px] mb-4" style={{ color: "var(--muted)" }}>
              Write the paragraph&apos;s core idea in your own English. Two or three sentences. Then compare.
            </p>
            <textarea
              value={recon}
              onChange={(e) => setRecon(e.target.value)}
              className="w-full rounded-2xl border p-4 min-h-[110px] text-[15px]"
              style={{ borderColor: "var(--line)", background: "var(--rah-field)", outline: "none" }}
              placeholder="The author's point here is..."
            />
            {recon.trim() ? (
              <div className="mt-4">
                <div className="font-bold text-[13.5px] mb-2">Original, for comparison</div>
                <p className="text-[15.5px] leading-[1.8] rounded-2xl p-4" style={{ background: "var(--rah-callout)" }}>{para}</p>
              </div>
            ) : null}
            <div className="mt-5 flex gap-2">
              {recon.trim() ? (
                <button className="btn-primary" onClick={() => { logMinutes(4, { readingId: r.id, mode: "intensive" }); if (last) { setMode("pick"); } else { setParaIdx((x) => x + 1); setRecon(""); setShowOriginal(false); } }}>
                  {last ? "Done, log 4 minutes" : "Next paragraph"}
                </button>
              ) : null}
              <button className="btn-ghost" onClick={() => setShowOriginal(false)}>Back to the text</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
