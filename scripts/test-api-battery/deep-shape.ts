// Deep shape pins for the core read routes, plus the header-auth fallback.
import { BASE, EMAIL, check, makeApi, type Ctx } from "./harness";

// ================= 4. DEEP SHAPE (what the UI leans on) =================
export async function deepShape(c: Ctx) {
  console.log("\n--- deep shape: core reads ---");
  const api = c.api;
  const cookie = c.cookie;
  const state = await api("/api/state");
  check(state.status === 200, "GET /api/state 200", String(state.status));
  check(Boolean(state.body?.learner) && typeof state.body?.due === "number", "state carries learner + due", JSON.stringify(state.body).slice(0, 150));

  const queue = await api("/api/review/queue");
  check(queue.status === 200 && Array.isArray(queue.body?.batch), "review queue returns a batch array", JSON.stringify(queue.body).slice(0, 120));

  const progress = await api("/api/progress");
  check(progress.status === 200 && Boolean(progress.body), "GET /api/progress 200", String(progress.status));

  const mistakes = await api("/api/mistakes");
  check(mistakes.status === 200, "GET /api/mistakes 200", String(mistakes.status));
  const goals0 = await api("/api/goals");
  check(goals0.status === 200 && Array.isArray(goals0.body?.active) && goals0.body?.plan?.dueForecast, "goal planner ships goals + deterministic plan", JSON.stringify(goals0.body).slice(0, 120));
  const goalsBad = await api("/api/goals", { method: "POST", body: JSON.stringify({ title: "ab" }) });
  check(goalsBad.status === 400, "goal with short title is 400 with a speakable error", JSON.stringify(goalsBad.body));

  const version = await api("/api/version");
  check(version.status === 200 && Boolean(version.body), "GET /api/version 200", String(version.status));

  const shop = await api("/api/shop");
  check(shop.status === 200 && typeof shop.body?.gems === "number" && Array.isArray(shop.body?.items), "GET /api/shop carries gems + items", JSON.stringify(shop.body).slice(0, 150));

  const arcade = await api("/api/arcade");
  check(arcade.status === 200 && Boolean(arcade.body), "GET /api/arcade 200", String(arcade.status));

  const chat = await api("/api/chat");
  check(chat.status === 200 && Array.isArray(chat.body?.messages), "GET /api/chat returns messages", JSON.stringify(chat.body).slice(0, 120));

  const ex = await fetch(`${BASE}/api/export`, { headers: { cookie } });
  const exText = await ex.text();
  let bundle: any = null;
  try {
    bundle = JSON.parse(exText);
  } catch {
    // a non-JSON export must fail the check below, not the harness
  }
  check(ex.status === 200 && bundle?.format === "rah.v1", "export is a rah.v1 bundle", exText.slice(0, 80));

  const badImport = await api("/api/import", { method: "POST", body: JSON.stringify({ dryRun: true, bundle: { format: "rah.v1", tables: { Learner: [{ id: "bogus" }] } } }) });
  check(badImport.status < 500, "import dry-run with a hostile bundle stays graceful", `status=${badImport.status}`);

  // coach-agent input validation (cheap, no model call)
  const noMsg = await api("/api/coach-agent", { method: "POST", body: JSON.stringify({}) });
  check(noMsg.status === 400, "coach-agent rejects an empty message with 400", `status=${noMsg.status}`);
}

// ================= 4b. HEADER AUTH: the embedded-context fallback =================
// Cookies can be dropped entirely (preview iframes, third-party-cookie
// blocking): the session must still resolve from the x-rah-token header.
export async function headerAuth(c: Ctx) {
  console.log("\n--- header auth: no-cookie requests ---");
  const loginToken = c.loginToken;
  check(loginToken.length >= 32, "verify response carries the body token", `len=${loginToken.length}`);
  const noCookie = (c.noCookie = makeApi(""));
  const hdrSession = await noCookie("/api/auth/session", { method: "GET", headers: { "x-rah-token": loginToken } });
  check(hdrSession.status === 200 && hdrSession.body?.user?.email === EMAIL, "session resolves from the header alone (no cookie)", JSON.stringify(hdrSession.body));
  const hdrAgent = await noCookie("/api/coach-agent", { method: "POST", headers: { "x-rah-token": loginToken }, body: JSON.stringify({}) });
  check(hdrAgent.status === 400, "coach-agent accepts header auth (400 on empty msg, NOT 401)", `status=${hdrAgent.status}`);
  const hdrNone = await noCookie("/api/auth/session", { method: "GET" });
  check(hdrNone.body?.user === null, "no cookie AND no header still resolves null", JSON.stringify(hdrNone.body));
}
