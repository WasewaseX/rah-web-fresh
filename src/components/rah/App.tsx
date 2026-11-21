"use client";

// Rah shell: hash-routed single page app. One learner, one road to C1.
// Midnight shell: navy rail, glass bars, blue signal color. The render chunks
// (rail, top bar, tabs, view switch, toasts) live in ./app-parts.tsx and
// ./app-views.tsx; the component below owns the hooks and the wiring.

import { useCallback, useEffect, useRef, useState } from "react";
import { installRahFetch } from "@/lib/rah-fetch";
// Installs the x-rah-token fetch wrapper BEFORE any effect fires an /api call,
// so embedded contexts that drop cookies still authenticate every request.
installRahFetch();
import dynamic from "next/dynamic";
import PwaBootstrap from "./PwaBootstrap";
import OfflineBadge from "./OfflineBadge";
import LoginView from "./Login";
import type { Boot } from "@/app/page";
// Task 115: celebration layer - XP burst on any XP gain, confetti on level-up.
import { confetti, xpBurst } from "./next/celebrate";
// Task 105: the recovered WebGL light field (aurora/nebula/waves, tinted by
// --hue). Client-only canvas; rendered only for a signed-in learner so the
// login gate keeps its clean look. Honors motion-off and removes itself
// without WebGL; the prefers-reduced-motion media query hides it too.
const Backdrop = dynamic(() => import("./next/Backdrop"), { ssr: false });
import { applyTheme } from "@/lib/theme-bus";
import { loadAppearance, applyBackdropAttributes } from "@/lib/appearance";
import { installOfflineSync, flush } from "@/lib/offline";
import { idlePrefetchAll, normalizeView, type ViewId } from "./app-parts";
import { ActiveView, BootSplash, CoachDock, DesktopContextRow, Toasts } from "./app-views";
import { DesktopRail, MobileTabs, MobileTopBar } from "./app-parts";

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

type Toast = { key: string; title: string; desc: string; icon: string };
type SetToasts = (f: (t: Toast[]) => Toast[]) => void;

// Task 115: celebration triggers. The refresh loop diffs XP and level
// against the previous state; an XP gain floats "+n XP", a level-up
// rains confetti. First load only primes the baselines - never fires.
function celebrateDeltasOf(s: AppState, prevXp: { current: number | null }, prevLevel: { current: number | null }) {
  const xpNow = s.today?.xp ?? 0;
  if (prevXp.current !== null && xpNow > prevXp.current) xpBurst(xpNow - prevXp.current);
  prevXp.current = xpNow;
  const lvlNow = s.game?.level?.level ?? 1;
  if (prevLevel.current !== null && lvlNow > prevLevel.current) confetti();
  prevLevel.current = lvlNow;
}

// Trophy fanfare: recent unlocks surface once per session, then never again.
function announceUnlocks(setToasts: SetToasts, recent: Toast[]) {
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
}

// Coach/toast announcements from anywhere (agent commands, shop purchases, ...).
function pushToastTo(setToasts: SetToasts, t: { title: string; desc: string }) {
  const key = `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  setToasts((cur) => [...cur, { key, title: t.title, desc: t.desc, icon: "sparkles" }].slice(-3));
  setTimeout(() => setToasts((cur) => cur.filter((x) => x.key !== key)), 5000);
}

// Task 105: the recovered appearance layer drives the backdrop (hue + style
// + motion). Only the backdrop-relevant attributes are applied - the full
// applyAppearance would also set --accent/--radius/font-size inline and
// override the classic shell's @theme mapping. A stored appearance wins;
// with nothing stored, the OS reduced-motion preference decides.
function applyStoredBackdrop() {
  try {
    const stored = typeof window !== "undefined" && window.localStorage.getItem("rah.appearance.v1");
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const a = loadAppearance();
    applyBackdropAttributes(a, stored ? a.motion : !reduced);
  } catch {
    // appearance must never block boot
  }
}

// Auth gate: resolve the session once; the shell renders the login screen until signed in.
async function resolveSession(setUser: (u: { email: string; name: string } | null) => void) {
  try {
    const r = await fetch("/api/auth/session", { cache: "no-store" });
    const s = (await r.json()) as { user: { email: string; name: string } | null };
    if (s.user) setUser(s.user);
  } catch {
    // stay logged out; the gate handles it
  }
}

// Ctrl/Cmd+J toggles the coach sidebar.
function cmdJToggle(e: KeyboardEvent, toggle: (f: (v: boolean) => boolean) => void) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
    e.preventDefault();
    toggle((v) => !v);
  }
}

// Real offline sync (Task 68): install the reconnect-flush triggers once;
// the badge announces what is queued, the toast announces what synced.
function installSyncAndFlush(pushToast: (t: { title: string; desc: string }) => void, refresh: () => void) {
  installOfflineSync();
  void flush().then((r) => {
    if (r && r.sent > 0) {
      pushToast({ title: "Offline grades synced", desc: `${r.sent} grade${r.sent === 1 ? "" : "s"} from this device reached the server.` });
      void refresh();
    }
  });
}

// Hash routing: apply the current hash immediately (deferred one tick) and on
// history events; refresh on a 60s interval.
function installHashRouting(refresh: () => void, setView: (v: ViewId) => void): () => void {
  const applyHash = () => setView(normalizeView(window.location.hash.replace("#", "")));
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
}

// /api/state + /api/bootstrap refresh, shared by every onDone.
async function runRefresh(f: { setState: (s: AppState) => void; setBoot: (b: Boot) => void; celebrateDeltas: (s: AppState) => void; setToasts: SetToasts }): Promise<void> {
  try {
    const r = await fetch("/api/state", { cache: "no-store" });
    if (r.ok) {
      const s: AppState = await r.json();
      f.setState(s);
      // The theme plugin's choices survive reloads: paint on every state load.
      applyTheme(s.theme ?? null);
      announceUnlocks(f.setToasts, s.game?.recent ?? []);
      f.celebrateDeltas(s);
      // Authenticated boot: network is idle from here - prefetch every lazy
      // view chunk so the first tab open pays only its data fetches.
      idlePrefetchAll();
    }
    const rb = await fetch("/api/bootstrap", { cache: "no-store" });
    if (rb.ok) f.setBoot((await rb.json()) as Boot);
  } catch {
    // offline blip; keep last state
  }
}

export { VIEWS, type ViewId } from "./app-parts";

export default function RahApp() {
  const [view, setView] = useState<ViewId>("home");
  const [state, setState] = useState<AppState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [coachOpen, setCoachOpen] = useState(false);
  // Recovered-generation data layer: the /api/bootstrap payload (Boot).
  // Refreshed together with /api/state so every onDone keeps both views true.
  const [boot, setBoot] = useState<Boot | null>(null);
  // Task 115: celebration triggers (diff in celebrateDeltasOf above).
  const prevXpRef = useRef<number | null>(null);
  const prevLevelRef = useRef<number | null>(null);
  const celebrateDeltas = useCallback((s: AppState) => celebrateDeltasOf(s, prevXpRef, prevLevelRef), []);
  const pushToast = useCallback((t: { title: string; desc: string }) => pushToastTo(setToasts, t), []);

  useEffect(() => {
    applyStoredBackdrop();
  }, []);
  // Auth gate: resolve the session once.
  useEffect(() => {
    void resolveSession(setUser);
  }, []);
  // Ctrl/Cmd+J opens the coach sidebar from any tab.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => cmdJToggle(e, setCoachOpen);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const refresh = useCallback(() => runRefresh({ setState, setBoot, celebrateDeltas, setToasts }), [celebrateDeltas]);

  // Real offline sync (Task 68): install the reconnect-flush triggers once.
  useEffect(() => {
    installSyncAndFlush(pushToast, refresh);
  }, [pushToast, refresh]);
  useEffect(() => installHashRouting(refresh, setView), [refresh]);

  const go = (id: string) => {
    const v = normalizeView(id);
    window.history.pushState(null, "", `#${v}`);
    setView(v);
  };

  // Not signed in: the login gate owns the screen. After sign-in, load the app.
  if (!user) {
    return (
      <LoginView onSignedIn={(u) => { setUser(u); setTimeout(() => void refresh(), 150); }} />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--rah-bg)] md:flex-row">
      <Backdrop />
      <PwaBootstrap />
      <OfflineBadge onSynced={() => void refresh()} />
      {/* Desktop rail */}
      <DesktopRail view={view} state={state} user={user} go={go} onCoach={() => setCoachOpen(true)} />
      {/* Mobile top bar */}
      <MobileTopBar state={state} go={go} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-6 md:px-10 md:pb-12">
        <DesktopContextRow state={state} />
        {!state || !boot ? <BootSplash /> : <ActiveView view={view} state={state} boot={boot} go={go} refresh={refresh} />}
      </main>
      {/* Mobile bottom tabs */}
      <MobileTabs view={view} go={go} />
      {/* Coach sidebar: the agent, available on every tab */}
      <CoachDock
        shell={{
          coachOpen, setCoachOpen, state, view, go, refresh, toast: pushToast,
          onSignOut: () => { setUser(null); setState(null); },
        }}
      />
      {/* Trophy fanfare toasts (above the coach FAB) */}
      <Toasts toasts={toasts} />
    </div>
  );
}
