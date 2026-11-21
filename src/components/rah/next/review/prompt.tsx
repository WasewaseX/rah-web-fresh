"use client";

// The per-direction prompt block (the top half of the card face): what the
// learner sees before answering. Pure render over props; the two audio play
// buttons share one component with two visual variants.

import { Fa } from "../bits";
import type { CardView } from "./shared";
import { speak } from "./shared";

function Cloze({ text }: { text: string }) {
  const parts = text.split("___");
  return (
    <p className="text-[22px] leading-relaxed">
      {parts.map((p, i, arr) => (
        <span key={i}>
          {p}
          {i < arr.length - 1 ? <span className="inline-block w-24 border-b-2 mx-1" style={{ borderColor: "var(--accent)" }} /> : null}
        </span>
      ))}
    </p>
  );
}

// The two audio variants: the big dictation play button and the small replay
// button inside the audio-as-MCQ prompt.
function AudioButton({ en, big }: { en: string; big?: boolean }) {
  return big ? (
    <button
      onClick={() => speak(en)}
      className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white transition-transform hover:scale-105 active:scale-95"
      style={{ background: "var(--accent)" }}
      aria-label="Play audio"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>
    </button>
  ) : (
    <button
      onClick={() => speak(en)}
      className="mx-auto mt-3 flex h-10 w-10 items-center justify-center rounded-full text-white"
      style={{ background: "var(--accent)" }}
      aria-label="Play audio"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
    </button>
  );
}

export function PromptBlock({ dir, c, audioMcq, isBank }: { dir: string; c: CardView; audioMcq: boolean; isBank: boolean }) {
  return (
    <>
      {/* ---- prompt per direction ---- */}
      {dir === "cloze" && <Cloze text={c.prompt} />}

      {dir === "reverse" && (
        <>
          <p className="text-[26px] display font-bold">{c.en}</p>
          <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>type the key chunk, in Farsi</p>
        </>
      )}

      {(dir === "fae" || dir === "fa2en") && (
        <>
          <p className="fa-text text-[24px] font-bold leading-relaxed">{c.fa}</p>
          <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>{dir === "fa2en" ? "type the whole English phrase" : "produce the English chunk"}</p>
        </>
      )}

      {dir === "audio" && !audioMcq && (
        <>
          <AudioButton en={c.en} big />
          <p className="text-[13px] mt-4 text-center" style={{ color: "var(--muted)" }}>listen, then type what fills the gap</p>
        </>
      )}

      {isBank && (
        <>
          <p className="fa-text text-[24px] font-bold leading-relaxed text-center">{c.fa}</p>
          <p className="text-[13px] mt-1 text-center" style={{ color: "var(--muted)" }}>tap the words in order</p>
        </>
      )}

      {(dir === "mcq_fa" || audioMcq) && (
        <>
          <p className="text-[26px] display font-bold">{c.en}</p>
          {audioMcq && <AudioButton en={c.en} />}
        </>
      )}

      {dir === "ef" && (
        <>
          <p className="text-[26px] display font-bold">{c.en}</p>
          {c.prompt && c.prompt !== c.en && c.kind === "ef" ? <p className="text-[13.5px] mt-1" style={{ color: "var(--muted)" }}>from: {c.prompt.replace("___", c.answer)}</p> : null}
        </>
      )}

      {dir === "sent" && (
        <>
          <p className="text-[24px] display font-bold">{c.en}</p>
          <p className="text-[13.5px] mt-1" style={{ color: "var(--muted)" }}>{c.fa ? <Fa>{c.fa}</Fa> : null}</p>
        </>
      )}
    </>
  );
}
