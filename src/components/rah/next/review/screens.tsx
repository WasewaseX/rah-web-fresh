"use client";

// The Review screens outside the card loop: loading, queue error, session
// summary, empty queue. Pure render - every value arrives via props.

import type { SessionDone } from "./shared";

export function LoadingScreen() {
  return <div className="py-20 text-center text-[14px]" style={{ color: "var(--muted)" }}>building today&apos;s queue...</div>;
}

export function LoadErrorScreen({ error, go }: { error: string; go: (v: string) => void }) {
  const auth = error.toLowerCase().includes("sign in");
  return (
    <div className="max-w-xl mx-auto text-center pt-16">
      <div className="display text-[30px] font-bold mb-2">The queue is not reachable right now.</div>
      <p className="text-[14px] mb-8 leading-relaxed" style={{ color: "var(--muted)" }}>
        {auth
          ? "Your session expired, so the schedule stays private. Sign in again from the Home screen and your cards are waiting."
          : error + " Nothing is lost - reopen Review in a moment."}
      </p>
      <button className="btn-primary" onClick={() => go("today")}>Back to today</button>
    </div>
  );
}

export function DoneScreen({ done, go, onMore }: { done: SessionDone; go: (v: string) => void; onMore: () => void }) {
  const acc = done.reveals ? Math.round((done.hit / done.reveals) * 100) : 0;
  return (
    <div className="max-w-xl mx-auto text-center pt-10">
      <div className="display text-[34px] font-bold mb-2">Session done</div>
      <p className="text-[14px] mb-8" style={{ color: "var(--muted)" }}>
        Retrieval is the workout. The schedule is already adjusted for what you found hard.
      </p>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card-rah p-5">
          <div className="display text-[26px] font-bold">{done.n}</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>cards retrieved</div>
        </div>
        <div className="card-rah p-5">
          <div className="display text-[26px] font-bold" style={{ color: "var(--accent)" }}>{acc}%</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>recalled without help</div>
        </div>
        <div className="card-rah p-5">
          <div className="display text-[26px] font-bold">{Math.floor(done.secs / 60)}:{String(done.secs % 60).padStart(2, "0")}</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>time on task</div>
        </div>
      </div>
      <div className="flex gap-3 justify-center">
        <button className="btn-primary" onClick={() => go("today")}>Back to today</button>
        <button className="btn-ghost" onClick={onMore}>More cards</button>
      </div>
    </div>
  );
}

export function EmptyScreen({ go }: { go: (v: string) => void }) {
  return (
    <div className="max-w-xl mx-auto text-center pt-16">
      <div className="display text-[30px] font-bold mb-2">Nothing is due. That is the schedule working.</div>
      <p className="text-[14px] mb-8 leading-relaxed" style={{ color: "var(--muted)" }}>
        FSRS-5 spaced the next retrievals into the future. Come back tomorrow, or train another strand now: listening
        decoding, speaking, writing repair. They all feed the same memory.
      </p>
      <button className="btn-primary" onClick={() => go("today")}>Back to today</button>
    </div>
  );
}
