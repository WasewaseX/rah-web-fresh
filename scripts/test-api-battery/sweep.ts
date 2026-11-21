// The two sweeps: anonymous (gate + no 500) and authed with hostile bodies.
import { AUTH_ROUTES, GATED, ROUTES, check, makeApi, type Ctx } from "./harness";

// ================= 1. ANONYMOUS SWEEP =================
export async function sweepAnon(c: Ctx) {
  console.log("\n--- sweep: anonymous (gate + no 500) ---");
  const anon = (c.anon = makeApi(""));
  for (const r of ROUTES) {
    for (const m of r.methods) {
      const res = await anon(r.path, { method: m, body: m === "GET" || m === "DELETE" ? undefined : JSON.stringify({}) });
      const ok = res.status < 500 || res.status === 501; // 501 = designed "not configured" signal (google/start)
      check(ok, `anon ${m} ${r.path} < 500`, `status=${res.status} ${res.text.slice(0, 120)}`);
      if (GATED.includes(r.path) && m !== "GET") {
        check(res.status === 401, `anon ${m} ${r.path} is 401-gated`, `status=${res.status}`);
      }
    }
  }
}

// ================= 3. AUTHED SWEEP (hostile input: no 500s) =================
export async function sweepAuthed(c: Ctx) {
  console.log("\n--- sweep: authed, hostile bodies (no 500) ---");
  const api = c.api;
  for (const r of ROUTES) {
    for (const m of r.methods) {
      if (AUTH_ROUTES.includes(r.path)) continue; // auth routes exercised above + rate limits
      const res = await api(r.path, { method: m, body: m === "GET" || m === "DELETE" ? undefined : JSON.stringify({}) });
      check(res.status < 500, `authed ${m} ${r.path} {} < 500`, `status=${res.status} ${res.text.slice(0, 120)}`);
    }
  }
  // Double-garbage pass: type-hostile payloads on the mutating routes.
  const mutators = ROUTES.filter((r) => r.methods.includes("POST") && !AUTH_ROUTES.includes(r.path));
  for (const r of mutators) {
    const res = await api(r.path, { method: "POST", body: JSON.stringify({ action: 42, items: "nope", data: { nested: [1, 2, { x: null }] } }) });
    check(res.status < 500, `authed POST ${r.path} garbage < 500`, `status=${res.status} ${res.text.slice(0, 120)}`);
  }
}
