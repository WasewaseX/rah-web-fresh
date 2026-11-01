"use client";

// Rah shell: hash-routed single page app. One learner, one road to C1.
// Midnight shell: navy rail, glass bars, blue signal color.

import { useCallback, useEffect, useState } from "react";
import { installRahFetch } from "@/lib/rah-fetch";
// Installs the x-rah-token fetch wrapper BEFORE any effect fires an /api call,
// so embedded contexts that drop cookies still authenticate every request.
installRahFetch();
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
  Sparkles,
  GraduationCap,
  Gamepad2,
  MessageCircle,
  BookMarked,
  Volume2,
  Settings as SettingsIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { Chip } from "./ui";
import PwaBootstrap from "./PwaBootstrap";
import OfflineBadge from "./OfflineBadge";
import CoachSidebar from "./CoachSidebar";
import LoginView from "./Login";
import type { Boot } from "@/app/page";
// Task 104 (feature-layer wiring): the recovered next/ generation now powers
// the surfaces. The daily loop (today + review) stays in the initial chunk so
// first paint and the core SRS action never wait on a lazy fetch; everything
// else is code-split exactly as the Task 91 bundle doctrine requires.
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
// Task 105: the recovered WebGL light field (aurora/nebula/waves, tinted by
// --hue). Client-only canvas; rendered only for a signed-in learner so the
// login gate keeps its clean look. Honors motion-off and removes itself
// without WebGL; the prefers-reduced-motion media query hides it too.
const Backdrop = dynamic(() => import("./next/Backdrop"), { ssr: false });
import { applyTheme } from "@/lib/theme-bus";
import { loadAppearance, applyBackdropAttributes } from "@/lib/appearance";
import { installOfflineSync, flush } from "@/lib/offline";

import type { GameView, RivalView, LeagueView } from "@/lib/arcade";

export interface QuestView {
  id: string;
  day: number;
  key: string;
  title: string;
  fa: string;
  target: number;
  progress: number;
  done: boolean;
  xp: number;
}

export interface AppState {
  learner: {
    level: string;
    streak: number;
    dailyGoal: number;
    retention: number;
    newPerDay: number;
    focusSkill: string;
    placementPhase: string;
    freezes: number;
    gems?: number;
    boostActive?: boolean;
  };
  theme: { primary?: string; primaryDeep?: string; bg?: string; surface?: string; accent?: string } | null;
  today: { reviews: number; correct: number; xp: number; spoken: number; written: number; listened: number };
  due: number;
  seen: number;
  chatCount: number;
  writes: number;
  speaks: number;
  deck: { total: number; byLevel: Record<string, number>; byUnit: Record<string, number> };
  diagnosis: { bySkill: { skill: string; lapseRate: number; due: number; reps: number }[]; advice: string[] };
  profile: { level: string; streak: number; focus: string; due: number; recentTraps: string[]; weakSkills: string[]; mistakes?: { tag: string; count: number; label: string }[]; mistakesHealed?: number };
  game: GameView;
  rival: RivalView;
  quests: QuestView[];
  league?: LeagueView;
  chain?: { chain: number; mult: number; label: string };
  mastery?: {
    tags: { tag: string; samples: number; ok: number; no: number; raw: number; ewma: number; wilson: number; trend: string; status: string }[];
    danger: string[];
    fragile: string[];
    solid: string[];
    summary: string;
  };
  nextBest?: { action: string; target: string; reason: string; urgency: number; command: string }[];
}

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
function normalizeView(raw: string): ViewId {
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
function prefetchView(id: ViewId) {
  LAZY_IMPORTS[id]?.();
}
function idlePrefetchAll() {
  if (idlePrefetchDone) return;
  idlePrefetchDone = true;
  const run = () => {
    for (const p of Object.values(LAZY_IMPORTS)) p();
  };
  if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 8000 });
  else setTimeout(run, 3000);
}

export default function RahApp() {
  const [view, setView] = useState<ViewId>("home");
  const [state, setState] = useState<AppState | null>(null);
  const [toasts, setToasts] = useState<{ key: string; title: string; desc: string; icon: string }[]>([]);
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [coachOpen, setCoachOpen] = useState(false);
  // Recovered-generation data layer: the /api/bootstrap payload (Boot).
  // Refreshed together with /api/state so every onDone keeps both views true.
  const [boot, setBoot] = useState<Boot | null>(null);

  // Trophy fanfare: recent unlocks surface once per session, then never again.
  const announceUnlocks = (recent: { key: string; title: string; desc: string; icon: string }[]) => {
    if (recent.length === 0) return;
    let seen: string[] = [];
    try {
      seen = JSON.parse(sessionStorage.getItem("rah.seenAch") ?? "[]");
    } catch {
      seen = [];
    }
    const fresh = recent.filter((a) => !seen.includes(a.key));
    if (fresh.length === 0) return;
    sessionStorage.setItem("rah.seenAch", JSON.stringify([...seen, ...fresh.map((a) => a.key)]));
    setToasts((t) => [...t, ...fresh].slice(-3));
    for (const a of fresh) {
      setTimeout(() => setToasts((t) => t.filter((x) => x.key !== a.key)), 6500);
    }
  };

  // Coach/toast announcements from anywhere (agent commands, shop purchases, ...).
  const pushToast = useCallback((t: { title: string; desc: string }) => {
    const key = `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    setToasts((cur) => [...cur, { key, title: t.title, desc: t.desc, icon: "sparkles" }].slice(-3));
    setTimeout(() => setToasts((cur) => cur.filter((x) => x.key !== key)), 5000);
  }, []);

  // Task 105: the recovered appearance layer drives the backdrop (hue + style
  // + motion). Only the backdrop-relevant attributes are applied - the full
  // applyAppearance would also set --accent/--radius/font-size inline and
  // override the classic shell's @theme mapping. A stored appearance wins;
  // with nothing stored, the OS reduced-motion preference decides.
  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" && window.localStorage.getItem("rah.appearance.v1");
      const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const a = loadAppearance();
      applyBackdropAttributes(a, stored ? a.motion : !reduced);
    } catch {
      // appearance must never block boot
    }
  }, []);

  // Auth gate: resolve the session once; the shell renders the login screen until signed in.
  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((s: { user: { email: string; name: string } | null }) => {
        if (s.user) setUser(s.user);
      })
      .catch(() => undefined);
  }, []);

  // Ctrl/Cmd+J opens the coach sidebar from any tab.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setCoachOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/state", { cache: "no-store" });
      if (r.ok) {
        const s: AppState = await r.json();
        setState(s);
        // The theme plugin's choices survive reloads: paint on every state load.
        applyTheme(s.theme ?? null);
        announceUnlocks(s.game?.recent ?? []);
        // Authenticated boot: network is idle from here - prefetch every lazy
        // view chunk so the first tab open pays only its data fetches.
        idlePrefetchAll();
      }
      const rb = await fetch("/api/bootstrap", { cache: "no-store" });
      if (rb.ok) setBoot((await rb.json()) as Boot);
    } catch {
      // offline blip; keep last state
    }
  }, []);

  // Real offline sync (Task 68): install the reconnect-flush triggers once;
  // the badge announces what is queued, the toast announces what synced.
  useEffect(() => {
    installOfflineSync();
    void flush().then((r) => {
      if (r && r.sent > 0) {
        pushToast({ title: "Offline grades synced", desc: `${r.sent} grade${r.sent === 1 ? "" : "s"} from this device reached the server.` });
        void refresh();
      }
    });
  }, [pushToast, refresh]);

  useEffect(() => {
    const applyHash = () => {
      const h = window.location.hash.replace("#", "");
      setView(normalizeView(h));
    };
    const t0 = setTimeout(applyHash, 0);
    const t1 = setTimeout(refresh, 0);
    window.addEventListener("hashchange", applyHash);
    window.addEventListener("popstate", applyHash);
    const t = setInterval(refresh, 60000);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      window.removeEventListener("hashchange", applyHash);
      window.removeEventListener("popstate", applyHash);
      clearInterval(t);
    };
  }, [refresh]);

  const go = (id: string) => {
    const v = normalizeView(id);
    window.history.pushState(null, "", `#${v}`);
    setView(v);
  };

  // Not signed in: the login gate owns the screen. After sign-in, load the app.
  if (!user) {
    return (
      <LoginView
        onSignedIn={(u) => {
          setUser(u);
          setTimeout(() => void refresh(), 150);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--rah-bg)] md:flex-row">
      <Backdrop />
      <PwaBootstrap />
      <OfflineBadge onSynced={() => void refresh()} />
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] bg-gradient-to-b from-[#0e1421] via-[#101725] to-[#0d1119] px-4 py-6 md:flex">
        <div className="mb-9 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--rah-primary)] to-[#2f62c4] text-lg font-black text-white shadow-[0_8px_20px_-6px_rgba(78,140,255,.55)]">
            R
          </div>
          <div>
            <div className="text-lg font-black tracking-tight text-[#f2f5fa]">Rah</div>
            <div className="text-[11px] font-semibold text-[#7d889c]">B2 to C1, your road</div>
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
                    ? "bg-[var(--rah-primary)]/[0.12] text-[#9dc0ff]"
                    : "text-[#8b96a9] hover:bg-white/[0.04] hover:text-[#dbe3f0]"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[var(--rah-primary)]" />
                )}
                <Icon className="h-[18px] w-[18px]" />
                {v.label}
                {v.id === "review" && state && state.due > 0 && (
                  <span className="ml-auto rounded-full bg-[var(--rah-primary)] px-2 py-0.5 text-[11px] font-bold text-white shadow-[0_4px_10px_-2px_rgba(78,140,255,.6)]">
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
              <p className="text-[11px] text-[#8b96a9]">Built-in engine or your own API — your choice.</p>
            </div>
          </button>
          <button
            onClick={() => setCoachOpen(true)}
            className="w-full rounded-2xl border border-[var(--rah-primary)]/20 bg-gradient-to-br from-[#16233e] to-[#131b2c] p-4 text-left transition-colors hover:border-[var(--rah-primary)]/45"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-[#9dc0ff]">
              <GraduationCap className="h-3.5 w-3.5" />
              Coach sidebar
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[#8b96a9]">
              The agent rides along on every tab: reads your state, writes files, runs code, acts.
            </p>
          </button>
          {user && <div className="px-2 text-[10px] font-semibold text-[#5d6879]">Signed in as {user.email}</div>}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-[var(--rah-bg)]/85 px-4 py-3 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--rah-primary)] to-[#2f62c4] text-base font-black text-white">
            R
          </div>
          <span className="text-lg font-black tracking-tight">Rah</span>
        </div>
        {state && (
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
        )}
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-6 md:px-10 md:pb-12">
        {/* Desktop header row. Task 109: this used to repeat every view's
           title as an h1 AND carry 4-5 stat chips - the title appeared twice
           (here + the view's own SectionTitle) and the pills were the
           "excessive chips" pattern the holder banned. Now: one quiet
           learner-context line; the view's own SectionTitle is the only
           title; the chain chip survives because it is a live signal. */}
        {state && (
          <div className="rah-rise mb-6 hidden items-center justify-end gap-3 md:flex">
            {state.chain && state.chain.chain >= 5 && (
              <Chip tone="amber">
                <Flame className="h-3 w-3" /> {state.chain.chain}-chain · {state.chain.mult}x
              </Chip>
            )}
            <span className="text-[12.5px] font-semibold" style={{ color: "var(--muted)" }}>
              {state.game ? <>Lv {state.game.level.level} · {state.game.level.name}</> : "Rookie"} · {state.learner.streak}-day streak · {state.today.xp} XP today
            </span>
          </div>
        )}

        {!state || !boot ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#2a3242] border-t-[var(--rah-primary)]" />
            {/* Task 109: text-first loading (craft floor) - a bare spinner on a
               blank page reads as broken; naming the wait reads as honest. */}
            <span className="text-[13px] font-medium" style={{ color: "var(--muted)" }}>Laying out today's road...</span>
          </div>
        ) : (
          <div key={view} className="rah-rise">
            {/* Task 104: recovered next/ generation. Each branch is wrapped in
               .rah-next so the scoped recovered design tokens apply without
               touching the classic shell's look (arcade stays classic). */}
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
        )}
      </main>

      {/* Mobile bottom tabs */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-white/[0.06] bg-[#12161f]/90 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Task 109: pr-16 keeps the tail labels clear of the floating Arcade
           button that hovers above this rail's right edge. */}
        <div className="flex overflow-x-auto pl-2 pr-16 py-1.5">
          {VIEWS.map((v) => {
            const Icon = v.icon;
            const active = view === v.id;
            return (
              <button
                key={v.id}
                onClick={() => go(v.id)}
                onPointerDown={() => prefetchView(v.id)}
                className={`flex min-w-[64px] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-bold transition-colors ${
                  active ? "bg-[var(--rah-primary)]/[0.14] text-[#9dc0ff]" : "text-[#6e7a8e]"
                }`}
              >
                <Icon className="h-5 w-5" />
                {v.label}
              </button>
            );
          })}
        </div>
      </nav>
      {/* Coach sidebar: the agent, available on every tab */}
      <CoachSidebar
        open={coachOpen}
        onOpenChange={setCoachOpen}
        state={state}
        view={view}
        go={go}
        refresh={refresh}
        toast={pushToast}
        onSignOut={() => {
          setUser(null);
          setState(null);
        }}
      />

      {/* Trophy fanfare toasts (above the coach FAB) */}
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
              <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#ffd08a]">Achievement unlocked</div>
              <div className="text-sm font-extrabold text-[#f2f5fa]">{t.title}</div>
              <div className="text-[11px] text-[#a9b4c6]">{t.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
