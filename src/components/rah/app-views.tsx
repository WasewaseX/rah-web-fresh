"use client";

// View-layer parts for the Rah app (App.tsx): the code-split view registry,
// the active-view switch, the boot splash, the desktop context row, the coach
// dock wiring and the trophy toasts. Pure render - every value arrives via
// props from the shell.

import dynamic from "next/dynamic";
import { Flame, Sparkles, Zap } from "lucide-react";
import { Chip } from "./ui";
import CoachSidebar from "./CoachSidebar";
import type { Boot } from "@/app/page";
import type { AppState } from "./App";
import type { ViewId } from "./app-parts";
import TodayView from "./next/today";
import NextReview from "./next/review";

// Round-3 bundle optimization (Task 91): the daily loop (Home, Review, Coach,
// Login gate) stays in the initial chunk so first paint and the core SRS action
// never wait on a lazy fetch; every other surface is code-split and fetched the
// first time its tab opens, with a layout-safe fallback in the gap.
const ViewFallback = () => (
  <div className="flex h-full min-h-[40vh] w-full items-center justify-center text-sm opacity-60">
    Loading&hellip;
  </div>
);
const ArcadeView = dynamic(() => import("./Arcade"), { ssr: false, loading: ViewFallback });
const NextPlacement = dynamic(() => import("./next/placement"), { ssr: false, loading: ViewFallback });
const NextWrite = dynamic(() => import("./next/writing"), { ssr: false, loading: ViewFallback });
const NextListen = dynamic(() => import("./next/listening"), { ssr: false, loading: ViewFallback });
const NextSpeak = dynamic(() => import("./next/speaking"), { ssr: false, loading: ViewFallback });
const NextRead = dynamic(() => import("./next/reading"), { ssr: false, loading: ViewFallback });
const NextProgress = dynamic(() => import("./next/progress"), { ssr: false, loading: ViewFallback });
const NextTutor = dynamic(() => import("./next/tutor"), { ssr: false, loading: ViewFallback });
const NextGrammar = dynamic(() => import("./next/grammar"), { ssr: false, loading: ViewFallback });
const NextSound = dynamic(() => import("./next/sound"), { ssr: false, loading: ViewFallback });
const NextCheckpoint = dynamic(() => import("./next/checkpoint"), { ssr: false, loading: ViewFallback });
const NextSettings = dynamic(() => import("./next/aisettings"), { ssr: false, loading: ViewFallback });

// Task 109: text-first loading (craft floor) - a bare spinner on a blank page
// reads as broken; naming the wait reads as honest.
export function BootSplash() {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#2a3242] border-t-[var(--rah-primary)]" />
      <span className="text-[13px] font-medium" style={{ color: "var(--muted-foreground)" }}>Laying out today&apos;s road...</span>
    </div>
  );
}

// The quiet learner-context line above the view. Task 109: this used to
// repeat every view's title as an h1 AND carry 4-5 stat chips - the title
// appeared twice (here + the view's own SectionTitle) and the pills were the
// "excessive chips" pattern the holder banned. Now: one quiet learner-context
// line; the view's own SectionTitle is the only title; the chain chip
// survives because it is a live signal.
export function DesktopContextRow({ state }: { state: AppState | null }) {
  if (!state) return null;
  return (
    <div className="rah-rise mb-6 hidden items-center justify-end gap-3 md:flex">
      {state.chain && state.chain.chain >= 5 && (
        <Chip tone="amber">
          <Flame className="h-3 w-3" /> {state.chain.chain}-chain · {state.chain.mult}x
        </Chip>
      )}
      <span className="inline-flex items-center gap-3 text-[12.5px] font-semibold" style={{ color: "var(--muted-foreground)" }}>
        <span>{state.game ? <>Lv {state.game.level.level} · {state.game.level.name}</> : "Rookie"}</span>
        <span className="inline-flex items-center gap-1">
          <Flame className="h-3.5 w-3.5 text-[#ffb02e]" />
          {state.learner.streak}-day streak
        </span>
        <span className="inline-flex items-center gap-1">
          <Zap className="h-3.5 w-3.5 text-[#7dd0fc]" />
          {state.today.xp} XP today
        </span>
      </span>
    </div>
  );
}

// The active view switch. Task 104: recovered next/ generation. Each branch
// is wrapped in .rah-next so the scoped recovered design tokens apply without
// touching the classic shell's look (arcade stays classic).
export function ActiveView({ view, state, boot, go, refresh }: { view: ViewId; state: AppState; boot: Boot; go: (id: string) => void; refresh: () => void }) {
  return (
    <div key={view} className="rah-rise">
      {view === "home" && (
        <div className="rah-next">
          <TodayView boot={boot} go={go} />
        </div>
      )}
      {view === "review" && (
        <div className="rah-next">
          <NextReview boot={boot} onDone={() => void refresh()} go={go} />
        </div>
      )}
      {view === "write" && (
        <div className="rah-next">
          <NextWrite boot={boot} onDone={() => void refresh()} />
        </div>
      )}
      {view === "speak" && (
        <div className="rah-next">
          <NextSpeak onDone={() => void refresh()} />
        </div>
      )}
      {view === "listen" && (
        <div className="rah-next">
          <NextListen onDone={() => void refresh()} />
        </div>
      )}
      {view === "read" && (
        <div className="rah-next">
          <NextRead boot={boot} onDone={() => void refresh()} />
        </div>
      )}
      {view === "tutor" && (
        <div className="rah-next">
          <NextTutor boot={boot} />
        </div>
      )}
      {view === "grammar" && (
        <div className="rah-next">
          <NextGrammar onDone={() => void refresh()} />
        </div>
      )}
      {view === "sound" && (
        <div className="rah-next">
          <NextSound onDone={() => void refresh()} />
        </div>
      )}
      {view === "placement" && (
        <div className="rah-next">
          <NextPlacement boot={boot} onDone={() => void refresh()} go={go} />
        </div>
      )}
      {view === "progress" && (
        <div className="rah-next">
          <NextProgress boot={boot} />
        </div>
      )}
      {view === "checkpoint" && (
        <div className="rah-next">
          <NextCheckpoint boot={boot} onDone={() => void refresh()} />
        </div>
      )}
      {view === "settings" && (
        <div className="rah-next">
          <NextSettings boot={boot} onDone={() => void refresh()} />
        </div>
      )}
      {view === "arcade" && <ArcadeView state={state} onChange={refresh} />}
    </div>
  );
}

// Coach sidebar wiring: the shell's state and actions passed straight through.
export function CoachDock({ shell }: {
  shell: {
    coachOpen: boolean;
    setCoachOpen: (v: boolean) => void;
    state: AppState | null;
    view: ViewId;
    go: (id: string) => void;
    refresh: () => void;
    toast: (t: { title: string; desc: string }) => void;
    onSignOut: () => void;
  };
}) {
  return (
    <CoachSidebar
      open={shell.coachOpen}
      onOpenChange={shell.setCoachOpen}
      state={shell.state}
      view={shell.view}
      go={shell.go}
      refresh={shell.refresh}
      toast={shell.toast}
      onSignOut={shell.onSignOut}
    />
  );
}

// Trophy fanfare toasts (above the coach FAB).
export function Toasts({ toasts }: { toasts: { key: string; title: string; desc: string; icon: string }[] }) {
  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-40 flex flex-col gap-2 md:bottom-24">
      {toasts.map((t) => (
        <div
          key={t.key}
          className="rah-pop flex items-center gap-3 rounded-2xl border border-[#ffb02e]/30 bg-gradient-to-br from-[#2a2312] to-[#1a1710] px-4 py-3 shadow-[0_16px_40px_-16px_rgba(255,176,46,.35)]"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ffb02e]/[0.18] text-[#ffd08a]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[12px] font-black uppercase tracking-[0.12em] text-[#ffd08a]">Achievement unlocked</div>
            <div className="text-sm font-extrabold text-[#f2f5fa]">{t.title}</div>
            <div className="text-[12px] text-[#a9b4c6]">{t.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
