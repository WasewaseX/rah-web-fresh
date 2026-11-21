// Harness for the API battery: shared counters, the fetch client, the route
// map and the cross-section state bag. Every section file in this directory
// takes the ctx bag and calls check(); the entry (scripts/test-api-battery.ts)
// owns ordering, the crash guard and the final summary line.

// Isolated runs (scripts/test-isolated-battery.sh) point both at the throwaway
// stack; the default remains the local dev server.
export const BASE = process.env.BATTERY_BASE ?? "http://localhost:3000";

export const EMAIL = `battery-${Date.now()}@rah.test`;

export type ApiFn = (
  path: string,
  init?: RequestInit,
) => Promise<{ status: number; body: any; text: string; setCookie?: string }>;

// The snapshot shape from the app's own portability machinery.
type Bundle = Awaited<ReturnType<(typeof import("@/lib/portable"))["buildBundle"]>>;

// Cross-section state: sections that mint credentials or learn ids publish
// them here for the later sections that lean on them.
export const ctx = {
  anon: null as unknown as ApiFn,
  noCookie: null as unknown as ApiFn,
  api: null as unknown as ApiFn,
  cookie: "",
  loginToken: "",
  devCode: undefined as string | undefined,
  uid: "me",
  firstId: "",
  before: null as unknown as Bundle,
};
export type Ctx = typeof ctx;

let failures = 0;
let n = 0;
export function check(ok: boolean, what: string, detail = "") {
  n += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` -> ${detail}`}`);
}

// The crash guard in the entry counts one failure so the exit code stays honest.
export function crashBump() {
  failures += 1;
}

export function failuresCount() {
  return failures;
}

export function summaryLine() {
  return `\n=== API BATTERY: ${n - failures}/${n} ===`;
}

// ---------- helpers ----------
export function makeApi(cookie: string) {
  return async (path: string, init?: RequestInit): Promise<{ status: number; body: any; text: string; setCookie?: string }> => {
    const headers = new Headers(init?.headers);
    headers.set("content-type", "application/json");
    if (cookie) headers.set("cookie", cookie);
    const r = await fetch(`${BASE}${path}`, { ...init, headers, redirect: "manual" });
    const sc = r.headers.get("set-cookie");
    const text = await r.text();
    let body: any = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    return { status: r.status, body, text, setCookie: sc ?? undefined };
  };
}

// The full route/method map (grep-verified against src/app/api/**/route.ts).
export const ROUTES: { path: string; methods: string[] }[] = [
  { path: "/api", methods: ["GET"] },
  { path: "/api/account", methods: ["DELETE"] },
  { path: "/api/arcade", methods: ["GET"] },
  { path: "/api/arcade/boss", methods: ["GET", "POST"] },
  { path: "/api/arcade/duel", methods: ["GET", "POST"] },
  { path: "/api/arcade/dungeon", methods: ["GET", "POST"] },
  { path: "/api/arcade/gauntlet", methods: ["GET", "POST"] },
  { path: "/api/arcade/league", methods: ["GET"] },
  { path: "/api/arcade/perks", methods: ["GET", "POST"] },
  { path: "/api/arcade/speed", methods: ["GET", "POST"] },
  { path: "/api/arcade/pairs", methods: ["GET", "POST"] },
  { path: "/api/arena/voice", methods: ["GET", "POST"] },
  { path: "/api/auth/google/callback", methods: ["GET"] },
  { path: "/api/auth/google/start", methods: ["GET"] },
  { path: "/api/auth/request-code", methods: ["POST"] },
  { path: "/api/auth/session", methods: ["GET", "DELETE"] },
  { path: "/api/auth/verify", methods: ["POST"] },
  { path: "/api/curriculum", methods: ["GET"] },
  { path: "/api/chat", methods: ["GET", "POST", "DELETE"] },
  { path: "/api/coach-agent", methods: ["POST"] },
  { path: "/api/coach/briefing", methods: ["GET", "POST"] },
  { path: "/api/exam/grade", methods: ["POST"] },
  { path: "/api/exam/replay", methods: ["GET"] },
  { path: "/api/feedback", methods: ["GET", "POST"] },
  { path: "/api/export", methods: ["GET"] },
  { path: "/api/export/anki", methods: ["GET"] },
  { path: "/api/flow", methods: ["GET", "POST"] },
  { path: "/api/grammar-check", methods: ["POST"] },
  { path: "/api/import", methods: ["POST"] },
  { path: "/api/listen", methods: ["GET", "POST"] },
  { path: "/api/listen/dictation", methods: ["POST"] },
  { path: "/api/materials", methods: ["GET", "POST", "DELETE"] },
  { path: "/api/mistakes", methods: ["GET", "POST", "DELETE"] },
  { path: "/api/goals", methods: ["GET", "POST"] },
  { path: "/api/placement", methods: ["GET", "POST"] },
  { path: "/api/progress", methods: ["GET"] },
  { path: "/api/progress/outcomes", methods: ["GET"] },
  { path: "/api/quiz", methods: ["POST"] },
  { path: "/api/review/grade", methods: ["POST"] },
  { path: "/api/review/queue", methods: ["GET"] },
  { path: "/api/review/suspend", methods: ["POST"] },
  { path: "/api/review/undo", methods: ["POST"] },
  { path: "/api/settings", methods: ["POST"] },
  { path: "/api/shop", methods: ["GET", "POST"] },
  { path: "/api/speak", methods: ["GET", "POST"] },
  { path: "/api/speak/analytics", methods: ["GET"] },
  { path: "/api/speak/assess", methods: ["GET", "POST"] },
  { path: "/api/speak/conversation", methods: ["GET", "POST"] },
  { path: "/api/state", methods: ["GET"] },
  { path: "/api/theme", methods: ["GET", "POST"] },
  { path: "/api/version", methods: ["GET"] },
  { path: "/api/workspace", methods: ["GET"] },
  { path: "/api/workspace/file", methods: ["GET"] },
  { path: "/api/writing", methods: ["GET", "POST"] },
];

export const GATED = ["/api/coach-agent", "/api/shop", "/api/feedback"]; // 401 to anonymous by design
export const AUTH_ROUTES = ["/api/auth/request-code", "/api/auth/verify", "/api/auth/session", "/api/auth/google/start", "/api/auth/google/callback", "/api/account"]; // swept in the login/deletion sections - the authed sweep must NOT DELETE the main session's account
