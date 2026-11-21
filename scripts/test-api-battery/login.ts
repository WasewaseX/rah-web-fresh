// Login, the auth hardening pins and the account deletion section.
import { EMAIL, check, makeApi, type Ctx } from "./harness";

// ================= 2. LOGIN =================
export async function login(c: Ctx) {
  console.log("\n--- login: battery user ---");
  const anon = c.anon;
  const req1 = await anon("/api/auth/request-code", { method: "POST", body: JSON.stringify({ email: EMAIL }) });
  const devCode = req1.body?.devCode as string | undefined;
  check(req1.status === 200 && /^\d{6}$/.test(devCode ?? ""), "request-code issues a code", JSON.stringify(req1.body));
  c.devCode = devCode;
  let cookie = "";
  let loginToken = "";
  {
    const api0 = makeApi("");
    // Embedded client (x-rah-embed: 1) - the only caller that receives the
    // no-cookie fallback credential in the response body.
    const good = await api0("/api/auth/verify", {
      method: "POST",
      headers: { "x-rah-embed": "1" },
      body: JSON.stringify({ email: EMAIL, code: devCode }),
    });
    check(good.status === 200, "verify mints a session", JSON.stringify(good.body));
    cookie = good.setCookie?.split(";")[0] ?? "";
    loginToken = String(good.body?.token ?? ""); // body token: the no-cookie fallback credential
  }
  check(cookie.includes("rah_session="), "session cookie captured", cookie.slice(0, 24));
  c.cookie = cookie;
  c.loginToken = loginToken;
  c.api = makeApi(cookie);

  // Task 67: every learning table is (userId, ...) keyed now - the direct-DB
  // seeds below must land on the SESSION user's rows, not the legacy singleton.
  const { PrismaClient: PCUid } = await import("@prisma/client");
  const prUid = new PCUid();
  c.uid = (await prUid.user.findUnique({ where: { email: EMAIL } }))?.id ?? "me";
  await prUid.$disconnect();
}

// --- auth hardening pins (P0-3/P0-4 wave) ---
export async function authHardening(c: Ctx) {
  console.log("\n--- auth hardening ---");
  const anon = c.anon;
  const devCode = c.devCode;
  {
    const api0 = makeApi("");
    // Single use: the consumed code cannot log in again, embed or not.
    const replay = await api0("/api/auth/verify", { method: "POST", headers: { "x-rah-embed": "1" }, body: JSON.stringify({ email: EMAIL, code: devCode }) });
    check(replay.status === 400, "consumed code replay refused (single-use)", `status=${replay.status}`);

    // Normal login (no embed marker) must leak NO browser-readable token.
    const email2 = `battery-plain-${Date.now()}@rah.test`;
    const req2 = await anon("/api/auth/request-code", { method: "POST", body: JSON.stringify({ email: email2 }) });
    const devCode2 = req2.body?.devCode as string | undefined;
    const plain = await api0("/api/auth/verify", { method: "POST", body: JSON.stringify({ email: email2, code: devCode2 }) });
    check(plain.status === 200 && plain.body?.token === undefined, "normal verify leaks NO body token", JSON.stringify(plain.body));
    check((plain.setCookie ?? "").includes("rah_session="), "normal verify still sets the httpOnly cookie", String(plain.setCookie).slice(0, 30));

    // Codes are hashed at rest: the DB row must NOT contain the plaintext.
    const { db } = await import("@/lib/db");
    const lc = await db.loginCode.findFirst({ where: { email: email2 }, orderBy: { id: "desc" } });
    check(
      !!lc && /^[0-9a-f]{64}$/.test(lc.code) && lc.code !== String(devCode2),
      "login code stored as sha256 hash, never plaintext",
      `len=${lc?.code.length ?? 0}`,
    );
    await db.$disconnect();

    // Resend invalidates: issuing a fresh code kills the previous unused one.
    const emailA = `battery-resend-${Date.now()}@rah.test`;
    const ra1 = await anon("/api/auth/request-code", { method: "POST", body: JSON.stringify({ email: emailA }) });
    const codeA1 = ra1.body?.devCode as string | undefined;
    const ra2 = await anon("/api/auth/request-code", { method: "POST", body: JSON.stringify({ email: emailA }) });
    const codeA2 = ra2.body?.devCode as string | undefined;
    const oldTry = await api0("/api/auth/verify", { method: "POST", body: JSON.stringify({ email: emailA, code: codeA1 }) });
    check(oldTry.status === 400, "resend invalidates the previous code", `status=${oldTry.status}`);
    const newTry = await api0("/api/auth/verify", { method: "POST", body: JSON.stringify({ email: emailA, code: codeA2 }) });
    check(newTry.status === 200, "the fresh code still works after resend", `status=${newTry.status}`);

    // Brute-force: 5 wrong guesses kill the code - even the CORRECT code dies.
    const emailB = `battery-brute-${Date.now()}@rah.test`;
    const rb = await anon("/api/auth/request-code", { method: "POST", body: JSON.stringify({ email: emailB }) });
    const codeB = rb.body?.devCode as string | undefined;
    const wrong = codeB === "000000" ? "000001" : "000000";
    let last = 0;
    for (let i = 0; i < 5; i++) {
      const g = await api0("/api/auth/verify", { method: "POST", body: JSON.stringify({ email: emailB, code: wrong }) });
      last = g.status;
    }
    check(last === 400, "wrong guesses rejected", `status=${last}`);
    const deadTry = await api0("/api/auth/verify", { method: "POST", body: JSON.stringify({ email: emailB, code: codeB }) });
    check(deadTry.status === 400, "code dead after 5 failed guesses (brute-force guard)", `status=${deadTry.status}`);

    // Cleanup the pin users/codes right here so restore stays simple.
    const { db: db2 } = await import("@/lib/db");
    await db2.user.deleteMany({ where: { email: { in: [email2, emailA, emailB] } } });
    await db2.loginCode.deleteMany({ where: { email: { startsWith: "battery-" } } });
    await db2.$disconnect();
  }
}

// --- account deletion (P1-9) ---
export async function accountDeletion(c: Ctx) {
  console.log("\n--- account deletion ---");
  const api = c.api;
  {
    const emailD = `battery-del-${Date.now()}@rah.test`;
    const apiD0 = makeApi("");
    const rd = await apiD0("/api/auth/request-code", { method: "POST", body: JSON.stringify({ email: emailD }) });
    const codeD = rd.body?.devCode as string | undefined;
    const verD = await apiD0("/api/auth/verify", { method: "POST", body: JSON.stringify({ email: emailD, code: codeD }) });
    check(verD.status === 200, "deletion setup: synthetic account registered", `status=${verD.status}`);
    const cookieD = verD.setCookie?.split(";")[0] ?? "";
    const apiD = makeApi(cookieD);
    const del = await apiD("/api/account", { method: "DELETE" });
    check(del.status === 200 && del.body?.ok === true, "DELETE /api/account removes the account", JSON.stringify(del.body).slice(0, 120));
    check(del.body?.removed?.account === true, "deletion reports the account row", JSON.stringify(del.body?.removed));
    check(typeof del.body?.notice === "string" && del.body.removed?.learnerState === false, "shared learner state honestly kept while other accounts remain", JSON.stringify(del.body?.notice).slice(0, 90));
    const after = await apiD("/api/auth/session", { method: "GET" });
    check(after.status === 200 && after.body?.user === null, "session dead after account deletion", JSON.stringify(after.body));
    const gone = await apiD0("/api/auth/verify", { method: "POST", body: JSON.stringify({ email: emailD, code: "000000" }) });
    check(gone.status === 400, "the deleted account's login codes are gone too", `status=${gone.status}`);

    // Isolation: deleting account D must NOT touch the battery user's session.
    const mainStill = await api("/api/auth/session", { method: "GET" });
    check(
      mainStill.status === 200 && mainStill.body?.user?.email === EMAIL,
      "another account's deletion leaves the main session alive",
      `status=${mainStill.status} user=${mainStill.body?.user?.email ?? "null"}`,
    );
    const { db: dbD } = await import("@/lib/db");
    await dbD.user.deleteMany({ where: { email: emailD } }).catch(() => undefined);
    await dbD.$disconnect();
  }
}
