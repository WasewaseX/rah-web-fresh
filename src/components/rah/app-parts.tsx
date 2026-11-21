"use client";

// Shell navigation parts for the Rah app (App.tsx): the view registry, hash
// normalization, the pointerdown/idle prefetch machinery, the desktop rail
// and the mobile top bar / bottom tabs. Split out of App.tsx so both files
// stay inside the length budgets; every chunk is pure render over props.

import {
  Home,
  RotateCcw,
  Target,
  PenLine,
  Headphones,
  Mic,
  BookOpen,
  BarChart3,
  Flame,
  Gamepad2,
  MessageCircle,
  BookMarked,
  Volume2,
  GraduationCap,
  Settings as SettingsIcon,
} from "lucide-react";
import { Chip } from "./ui";
import { LogoMark } from "./next/bits";
import type { AppState } from "./App";

export const VIEWS = [
  { id: "home", label: "Today", icon: Home },
  { id: "review", label: "Review", icon: RotateCcw },
  { id: "write", label: "Writing", icon: PenLine },
  { id: "speak", label: "Speaking", icon: Mic },
  { id: "listen", label: "Listening", icon: Headphones },
  { id: "read", label: "Reading", icon: BookOpen },
  { id: "tutor", label: "Tutor", icon: MessageCircle },
  { id: "grammar", label: "Grammar", icon: BookMarked },
  { id: "sound", label: "Sound", icon: Volume2 },
  { id: "placement", label: "Placement", icon: Target },
  { id: "arcade", label: "Arcade", icon: Gamepad2 },
  { id: "progress", label: "Progress", icon: BarChart3 },
] as const;

export type ViewId = (typeof VIEWS)[number]["id"] | "checkpoint" | "settings";

// Task 104: the recovered generation navigates by STRAND names — "today",
// "writing", "listening", "reading" (the bootstrap plan's view ids) — while
// this shell's canonical ids are home/write/listen/read. normalizeView maps
// every recovered id onto the canonical set; unknown hashes fall back home.
const VIEW_ALIASES: Record<string, ViewId> = {
  today: "home",
  writing: "write",
  speaking: "speak",
  listening: "listen",
  reading: "read",
};
export function normalizeView(raw: string): ViewId {
  const alias = VIEW_ALIASES[raw];
  if (alias) return alias;
  if (VIEWS.some((v) => v.id === raw) || raw === "checkpoint" || raw === "settings") return raw as ViewId;
  return "home";
}

// Task 92-bis (mobile perf round 2, measured with scripts/interactivity-probe.mjs):
// a lazy view's first open pays a chunk fetch before its data fetches (measured:
// chunks landed 213-256ms into a tap on throttled mobile; content settled ~1300ms).
// Two zero-FCP-cost prefetches recover that: the chunk is requested at
// POINTERDOWN (fires ~100-300ms before click on touch - the chunk is usually
// already in flight when the click lands) and all lazy chunks prefetch during
// idle AFTER authenticated boot (network is idle; FCP unaffected). Duplicate
// import() calls dedupe to the same chunk - never a double download.
const LAZY_IMPORTS: Partial<Record<ViewId, () => Promise<unknown>>> = {
  placement: () => import("./next/placement"),
  write: () => import("./next/writing"),
  listen: () => import("./next/listening"),
  speak: () => import("./next/speaking"),
  read: () => import("./next/reading"),
  progress: () => import("./next/progress"),
  arcade: () => import("./Arcade"),
  tutor: () => import("./next/tutor"),
  grammar: () => import("./next/grammar"),
  sound: () => import("./next/sound"),
  checkpoint: () => import("./next/checkpoint"),
  settings: () => import("./next/aisettings"),
};
let idlePrefetchDone = false;
export function prefetchView(id: ViewId) {
  LAZY_IMPORTS[id]?.();
}
export function idlePrefetchAll() {
  if (idlePrefetchDone) return;
  idlePrefetchDone = true;
  const run = () => {
    for (const p of Object.values(LAZY_IMPORTS)) p();
  };
  if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 8000 });
  else setTimeout(run, 3000);
}

// The desktop rail: logo, view nav with the due badge, settings and coach
// entries, the signed-in line.
export function DesktopRail({ view, state, user, go, onCoach }: { view: ViewId; state: AppState | null; user: { email: string; name: string } | null; go: (id: string) => void; onCoach: () => void }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] bg-gradient-to-b from-[#0e1421] via-[#101725] to-[#0d1119] px-4 py-6 md:flex">
      <div className="mb-9 flex items-center gap-3 px-2">
        <LogoMark size={40} />
        <div>
          <div className="text-lg font-black tracking-tight text-[#f2f5fa]">Rah</div>
          <div className="text-[12px] font-semibold text-[#7d889c]">B2 to C1, your road</div>
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          const active = view === v.id;
          return (
            <button
              key={v.id}
              onClick={() => go(v.id)}
              onPointerDown={() => prefetchView(v.id)}
              className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all ${
                active
                  ? "bg-[var(--rah-primary)]/[0.12] text-[var(--rah-accent)]"
                  : "text-[#8b96a9] hover:bg-white/[0.04] hover:text-[#dbe3f0]"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[var(--rah-primary)]" />
              )}
              <Icon className="h-[18px] w-[18px]" />
              {v.label}
              {v.id === "review" && state && state.due > 0 && (
                <span className="ml-auto rounded-full bg-[var(--rah-primary-deep)] px-2 py-0.5 text-[12px] font-bold text-white shadow-[0_4px_10px_-2px_rgba(0,0,0,.5)]">
                  {state.due}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto space-y-2">
        <button
          onClick={() => go("settings")}
          className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-left transition-colors hover:border-white/[0.16]"
        >
          <SettingsIcon className="h-4 w-4 text-[#8b96a9]" />
          <div>
            <div className="text-xs font-bold text-[#dbe3f0]">AI engine</div>
            <p className="text-[12px] text-[#8b96a9]">Built-in engine or your own API — your choice.</p>
          </div>
        </button>
        <button
          onClick={onCoach}
          className="w-full rounded-2xl border border-[var(--rah-primary)]/20 bg-gradient-to-br from-[#16233e] to-[#131b2c] p-4 text-left transition-colors hover:border-[var(--rah-primary)]/45"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--rah-accent)]">
            <GraduationCap className="h-3.5 w-3.5" />
            Coach sidebar
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-[#8b96a9]">
            The agent rides along on every tab: reads your state, writes files, runs code, acts.
          </p>
        </button>
        {user && <div className="px-2 text-[12px] font-semibold text-[var(--muted-foreground)]">Signed in as {user.email}</div>}
      </div>
    </aside>
  );
}

// The mobile top bar: logo, level/streak chips, settings shortcut.
export function MobileTopBar({ state, go }: { state: AppState | null; go: (id: string) => void }) {
  if (!state) return null;
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-[var(--rah-bg)]/85 px-4 py-3 backdrop-blur-xl md:hidden">
      <div className="flex items-center gap-2.5">
        <LogoMark size={36} />
        <span className="text-lg font-black tracking-tight">Rah</span>
      </div>
      <div className="flex items-center gap-2">
        {state.learner.level !== "?" && <Chip tone="blue">{state.learner.level}</Chip>}
        <Chip tone="amber">
          <Flame className="h-3 w-3" /> {state.learner.streak}
        </Chip>
        <button
          onClick={() => go("settings")}
          aria-label="AI engine settings"
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-[#8b96a9]"
        >
          <SettingsIcon className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

// Mobile bottom tabs. Task 109: pr-16 keeps the tail tiles clear of the
// floating Arcade button that hovers above this rail's right edge. Task 119:
// twelve one-word labels cannot fit 390px without colliding ("Listening" is
// wider than any honest tile), so the rail is icon-first and the ACTIVE tab
// carries its label - no collisions, floor kept, snap points make the scroll
// deliberate.
export function MobileTabs({ view, go }: { view: ViewId; go: (id: string) => void }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-white/[0.06] bg-[#12161f]/90 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex snap-x snap-mandatory overflow-x-auto pl-2 pr-16 py-1.5">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          const active = view === v.id;
          return (
            <button
              key={v.id}
              onClick={() => go(v.id)}
              onPointerDown={() => prefetchView(v.id)}
              aria-label={v.label}
              className={`flex min-w-[48px] snap-start flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11.5px] font-bold transition-colors ${
                active ? "min-w-[72px] bg-[var(--rah-primary)]/[0.14] text-[var(--rah-accent)]" : "text-[#7d889c]"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {active ? v.label : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
