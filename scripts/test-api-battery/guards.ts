// Guard rails: the AI abuse limiter and the agent tool permission matrix.
import { check } from "./harness";

// --- AI abuse limiter (P1-6) ---
export async function aiLimiter() {
  console.log("\n--- ai rate limit ---");
  {
    const { aiRateLimit } = await import("@/lib/rate-limit");
    const mk = (ip: string) => new Request("http://localhost:3000/api/quiz", { headers: ip ? { "x-forwarded-for": ip } : {} });
    // loopback + direct local access exempt (battery/toolchain doctrine)
    check(aiRateLimit(mk("")).ok === true, "limiter: direct local access exempt", "");
    check(aiRateLimit(mk("127.0.0.1")).ok === true, "limiter: loopback exempt", "");
    // real IP: 15 anonymous calls pass, 16th is a 429 with Retry-After
    let last: ReturnType<typeof aiRateLimit> | null = null;
    for (let i = 0; i < 16; i++) last = aiRateLimit(mk("203.0.113.7"));
    check(last!.ok === false && last!.response!.status === 429, "limiter: 16th anonymous call in a minute is 429", String(last!.response?.status));
    check((last!.response!.headers.get("retry-after") ?? "") !== "", "limiter: 429 carries Retry-After", "");
    // a different IP is untouched (per-IP buckets)
    check(aiRateLimit(mk("203.0.113.8")).ok === true, "limiter: per-IP isolation", "");
    // signed-in budget is separate and higher (40/min)
    let signedOk = true;
    for (let i = 0; i < 40; i++) signedOk = signedOk && aiRateLimit(mk("203.0.113.9"), "user-x").ok;
    const signed41 = aiRateLimit(mk("203.0.113.9"), "user-x");
    check(signedOk && signed41.ok === false, "limiter: signed-in budget 40/min then 429", String(signed41.response?.status));
  }
}

// --- agent tool permission matrix (P1-8) ---
export async function toolPermissions() {
  console.log("\n--- tool permissions ---");
  {
    const { TOOLS, TOOL_TIERS, toolTier, TIER_BUDGETS, UNTRUSTED_FRAME } = await import("@/lib/coach-agent/tools");
    check(TOOLS.every((t: { name: string }) => TOOL_TIERS[t.name] !== undefined), "permission matrix covers every registered tool", JSON.stringify(TOOLS.filter((t: { name: string }) => TOOL_TIERS[t.name] === undefined).map((t: { name: string }) => t.name)));
    check(toolTier("nonexistent_tool") === "state", "unknown tools default to the most dangerous tier", toolTier("nonexistent_tool"));
    check(TIER_BUDGETS.state === 2 && TIER_BUDGETS.exec === 2 && TIER_BUDGETS.network === 4, "per-run budgets: state 2, exec 2, network 4", JSON.stringify(TIER_BUDGETS));
    check(
      UNTRUSTED_FRAME.head.includes("UNTRUSTED WEB CONTENT") && UNTRUSTED_FRAME.head.includes("not instructions"),
      "prompt-injection frame marks web content as data",
      UNTRUSTED_FRAME.head.slice(0, 60),
    );
  }
}
