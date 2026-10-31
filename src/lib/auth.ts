// Auth core: email-code login, sessions, cookie handling.
// Flow: POST /api/auth/request-code {email} -> 6-digit code emailed (10 min TTL, single use,
// rate limited) -> POST /api/auth/verify {email, code} -> User row (created on first login)
// + Session row + httpOnly cookie. getSessionUser(req) resolves the cookie for every route.
// Gmail: the same code flow covers gmail addresses; Google OAuth is optional extras in
// /api/auth/google/* (active only when GOOGLE_CLIENT_ID/SECRET are configured).

import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "rah_session";
export const EMBED_COOKIE = "rah_session_embed";
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000; // 30 days
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CODES_PER_WINDOW = 5;
const CODE_WINDOW_MS = 15 * 60 * 1000;
const MAX_CODES_PER_IP_WINDOW = 10; // per-IP throttle on top of per-email
const MAX_CODE_ATTEMPTS = 5; // failed guesses before a code self-invalidates
const MAX_ACCESS_ATTEMPTS = 10; // failed owner access-code guesses per IP window

// Task 109 (live incident 2026-10-31): the deployment lock refused the HOLDER
// himself - he signed in with geministudent@atomicmail.io, the code arrived
// (Resend only delivers to the account owner's own address), verify consumed
// it, and THEN the lock fired: "private and already claimed". The lock's job
// is keeping STRANGERS out, never the owner. Two mechanisms fix the class:
//
// 1. RAH_OWNER_EMAILS - comma-separated allowlist. Owner emails are ALIASES
//    of one canonical identity: session issuance resolves them to the oldest
//    existing owner User row (or creates it on first login), so content
//    scoping (contentUserId -> session user id) can never split across
//    addresses. The lock bypasses them by definition.
// 2. RAH_ACCESS_CODE - deterministic owner login that survives any mail
//    outage (the same incident: the registered filixah964@aravites.com could
//    NEVER receive codes - Resend sandbox 550 - so email-only login was a
//    deadlock). Env-provisioned secret, never committed; timing-safe compare;
//    per-IP throttle on failed attempts.
const LOCK_MESSAGE =
  "This Rah deployment is private and already claimed. New sign-ups are disabled by the owner.";

export function ownerEmails(): string[] {
  return (process.env.RAH_OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => normalizeEmail(e))
    .filter(Boolean);
}

export function isOwnerEmail(email: string): boolean {
  const list = ownerEmails();
  return list.length > 0 && list.includes(normalizeEmail(email));
}

export function accessCodeConfigured(): boolean {
  return Boolean((process.env.RAH_ACCESS_CODE ?? "").trim());
}

// Timing-safe string compare. Both sides are hashed first so length
// differences never leak and the digest comparison is constant-time.
export function safeEqualStr(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

// In-memory failed-attempt throttle for the access-code path (single node;
// loopback exempt exactly like ipRateLimited - local batteries share 127.0.0.1).
const accessFailures = new Map<string, number[]>();
export function accessAttemptFailed(ip: string): boolean {
  if (!ip || ip === "::1" || ip === "::ffff:127.0.0.1" || ip.startsWith("127.") || ip.startsWith("::ffff:127.")) return false;
  const now = Date.now();
  const hits = (accessFailures.get(ip) ?? []).filter((t) => now - t < CODE_WINDOW_MS);
  hits.push(now);
  accessFailures.set(ip, hits);
  if (accessFailures.size > 5000) {
    for (const [k, v] of accessFailures) {
      if (v.every((t) => now - t >= CODE_WINDOW_MS)) accessFailures.delete(k);
    }
  }
  return hits.length > MAX_ACCESS_ATTEMPTS;
}

// Login codes are stored HASHED (a DB leak must not leak usable codes); the
// plaintext lives only in memory between issuance and the email. Verify is
// ATOMIC (updateMany guard) and a code dies after 5 failed guesses, so the
// 6-digit space cannot be brute-forced inside its 10-minute TTL.
export function hashCode(code: string): string {
  return createHash("sha256").update(String(code)).digest("hex");
}

// In-memory per-IP throttle for code issuance (single-node deployment; codes
// are also per-email limited in the DB). Best-effort: a restart clears it.
// Loopback IPs are EXEMPT: in dev/everything-local all traffic shares 127.0.0.1
// and the limit would lock out the battery and E2E runs; abuse protection on
// localhost is meaningless anyway. Production proxies pass real client IPs.
const ipCodeRequests = new Map<string, number[]>();
export function ipRateLimited(ip: string, max = MAX_CODES_PER_IP_WINDOW, windowMs = CODE_WINDOW_MS): boolean {
  if (!ip || ip === "::1" || ip === "::ffff:127.0.0.1" || ip.startsWith("127.") || ip.startsWith("::ffff:127.")) return false;
  const now = Date.now();
  const hits = (ipCodeRequests.get(ip) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  ipCodeRequests.set(ip, hits);
  if (ipCodeRequests.size > 5000) {
    // opportunistic GC so the map cannot grow unbounded
    for (const [k, v] of ipCodeRequests) {
      if (v.every((t) => now - t >= windowMs)) ipCodeRequests.delete(k);
    }
  }
  return hits.length > max;
}

export function normalizeEmail(email: string): string {
  return String(email ?? "").trim().toLowerCase();
}

export function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export interface RequestCodeResult {
  ok: boolean;
  error?: string;
  code?: string; // plaintext, in-memory only - the route emails it, the DB stores the hash
}

export async function issueLoginCode(rawEmail: string, ip = ""): Promise<RequestCodeResult> {
  const email = normalizeEmail(rawEmail);
  if (!validEmail(email)) return { ok: false, error: "That does not look like an email address." };

  // Rate limit: 5 codes per email per 15 minutes (DB), 10 per IP per 15 minutes
  // (memory). Honest limits, no lockout games.
  const windowStart = new Date(Date.now() - CODE_WINDOW_MS);
  const recent = await db.loginCode.count({ where: { email, createdAt: { gte: windowStart } } });
  if (recent >= MAX_CODES_PER_WINDOW) {
    return { ok: false, error: "Too many codes requested. Wait a few minutes and try again." };
  }
  if (ipRateLimited(ip)) {
    return { ok: false, error: "Too many codes requested from this network. Wait a few minutes." };
  }

  // Resend invalidates: any earlier unused code for this email is dead the
  // moment a fresh one is issued.
  await db.loginCode.updateMany({ where: { email, usedAt: null }, data: { usedAt: new Date() } });

  const code = newCode();
  await db.loginCode.create({
    data: { email, code: hashCode(code), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
  });
  return { ok: true, code };
}

export interface VerifyResult {
  ok: boolean
  error?: string;
  token?: string;
  user?: { id: string; email: string; name: string; provider: string; isNew: boolean };
}

// DEPLOYMENT LOCK (data isolation, P0-1): the learning state is a singleton
// (Learner id "me") - two accounts would share one brain. Until the per-user
// scoping mega-update lands, the audit's sanctioned alternative applies: the
// deployment is private and single-user. The FIRST account to register claims
// it; further registrations are refused unless RAH_OPEN_REGISTRATION=1 is set
// explicitly (multi-user is then ON but learner state is shared - documented).
export async function registrationLocked(): Promise<boolean> {
  if (process.env.RAH_OPEN_REGISTRATION === "1") return false;
  const users = await db.user.count();
  return users >= 1;
}

export async function verifyLoginCode(rawEmail: string, rawCode: string, ip = ""): Promise<VerifyResult> {
  const email = normalizeEmail(rawEmail);
  const code = String(rawCode ?? "").trim();
  if (!email) return { ok: false, error: "Enter your email address first." };

  // Owner access-code path (Task 109): runs BEFORE the 6-digit gate. A match
  // issues a session immediately - no LoginCode row needed, works with the
  // mail provider fully down. A miss records the failure (IP-throttled); a
  // 6-digit miss still falls through to the emailed-code path below, since
  // the owner may simply be typing an emailed code.
  if (accessCodeConfigured() && isOwnerEmail(email)) {
    if (safeEqualStr(code, (process.env.RAH_ACCESS_CODE ?? "").trim())) {
      return issueSessionFor(email);
    }
    if (accessAttemptFailed(ip)) {
      return { ok: false, error: "Too many attempts. Wait a few minutes and try again." };
    }
    if (!/^\d{6}$/.test(code)) {
      return { ok: false, error: "That access code is not right. Check it and try again, or request an email code." };
    }
  }

  if (!/^\d{6}$/.test(code)) return { ok: false, error: "Enter the 6-digit code from your email." };

  // The newest unused, unexpired code for this email is the only valid one
  // (resend invalidates older rows). We look it up first so failed guesses
  // can be counted against it.
  const row = await db.loginCode.findFirst({
    where: { email, usedAt: null, expiresAt: { gte: new Date() } },
    orderBy: { id: "desc" },
  });
  if (!row) return { ok: false, error: "That code is wrong, used, or expired. Request a fresh one." };

  if (row.code !== hashCode(code)) {
    // Wrong guess: count it. MAX_CODE_ATTEMPTS strikes and the code dies, so
    // the 1,000,000-combination space cannot be walked inside 10 minutes.
    const attempts = row.attempts + 1;
    await db.loginCode.update({
      where: { id: row.id },
      data: { attempts, usedAt: attempts >= MAX_CODE_ATTEMPTS ? new Date() : null },
    });
    return { ok: false, error: "That code is wrong, used, or expired. Request a fresh one." };
  }

  // ATOMIC single-use consume: updateMany guards on usedAt: null, so two
  // racing verifies cannot both win - exactly one gets count === 1.
  const consumed = await db.loginCode.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (consumed.count !== 1) {
    return { ok: false, error: "That code is wrong, used, or expired. Request a fresh one." };
  }

  return issueSessionFor(email);
}

// Session issuance with owner-identity unification (Task 109): owner emails
// resolve to the OLDEST existing owner User row, so logging in from any
// alias lands on the same identity - same user id, same content scope, same
// history. Non-owner emails keep exact-match semantics. The deployment lock
// fires only for a NEW non-owner registration.
async function issueSessionFor(email: string): Promise<VerifyResult> {
  const owners = ownerEmails();
  let user = isOwnerEmail(email)
    ? await db.user.findFirst({ where: { email: { in: owners } }, orderBy: { createdAt: "asc" } })
    : await db.user.findUnique({ where: { email } });
  const isNew = !user;
  if (!user) {
    // Deployment lock: once one account exists, no second one may register
    // (the learner state is a singleton). Existing accounts re-logging in are
    // unaffected - the gate only fires on FIRST registration.
    if (await registrationLocked() && !isOwnerEmail(email)) {
      return { ok: false, error: LOCK_MESSAGE };
    }
    user = await db.user.create({ data: { email, name: email.split("@")[0], provider: "email" } });
  }

  const token = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      token: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return { ok: true, token, user: { id: user.id, email: user.email, name: user.name, provider: user.provider, isNew } };
}

// Tokens are stored hashed: a DB leak must not leak live sessions.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  provider: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return resolveToken(token);
}

// Embedded contexts (preview iframes, third-party-cookie-blocked browsers)
// drop SameSite cookies entirely: the verify POST succeeds and the dashboard
// renders from its response body, but no cookie is ever stored, so every
// later call arrives cookie-less. Defense-in-depth ladder, resolved in order:
//   1. rah_session (httpOnly, SameSite=Lax) - the normal path.
//   2. rah_session_embed (SameSite=None+Partitioned in prod) - ONLY honored
//      when the request carries our custom x-rah-embed header, which cross-
//      site forms cannot forge (CSRF guard for the looser cookie).
//   3. x-rah-token header - last resort for browsers that drop even
//      partitioned cookies; the client keeps the token in sessionStorage
//      (dies with the tab) ONLY when the server confirms cookie loss.
export async function getSessionUserWithRequest(req: Request): Promise<SessionUser | null> {
  const jar = await cookies();
  const cookieToken = jar.get(SESSION_COOKIE)?.value;
  if (cookieToken) {
    const fromCookie = await resolveToken(cookieToken);
    if (fromCookie) return fromCookie;
  }
  const wantsEmbed = req.headers.get("x-rah-embed") === "1";
  if (wantsEmbed) {
    const embedToken = jar.get(EMBED_COOKIE)?.value;
    if (embedToken) {
      const fromEmbed = await resolveToken(embedToken);
      if (fromEmbed) return fromEmbed;
    }
  }
  const headerToken = req.headers.get("x-rah-token");
  return resolveToken(headerToken);
}

export async function resolveToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { token: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return { id: session.user.id, email: session.user.email, name: session.user.name, provider: session.user.provider };
}

export function sessionCookieOptions(embed = false) {
  return embed
    ? {
        httpOnly: true,
        sameSite: "none" as const,
        secure: true, // SameSite=None is rejected by browsers without Secure
        partitioned: true, // CHIPS: the embed cookie is partitioned per embedder
        path: "/",
        maxAge: SESSION_TTL_MS / 1000,
      }
    : {
        httpOnly: true,
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: SESSION_TTL_MS / 1000,
      };
}

// The verify response carries the raw login token in the body ONLY for
// embedded callers (x-rah-embed: 1) that provably need the header fallback;
// normal logins get no browser-readable credential at all.
export function callerWantsEmbedFallback(req: Request): boolean {
  return req.headers.get("x-rah-embed") === "1";
}

export async function destroySession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await db.session.deleteMany({ where: { token: hashToken(token) } }).catch(() => undefined);
}

// --- Google OAuth (optional: only active with GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET) ---

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface GoogleProfile {
  email: string;
  name: string;
}

export async function exchangeGoogleCode(code: string, origin: string): Promise<GoogleProfile | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: `${origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) return null;
  const tokens = (await res.json()) as { access_token?: string };
  if (!tokens.access_token) return null;
  const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  if (!info.ok) return null;
  const profile = (await info.json()) as { email?: string; name?: string };
  if (!profile.email) return null;
  return { email: profile.email, name: profile.name ?? profile.email.split("@")[0] };
}

export async function upsertGoogleUser(profile: GoogleProfile): Promise<{ id: string; email: string; name: string }> {
  const email = normalizeEmail(profile.email);
  // Owner emails unify onto the canonical owner row, same as the code path.
  let user = isOwnerEmail(email)
    ? await db.user.findFirst({ where: { email: { in: ownerEmails() } }, orderBy: { createdAt: "asc" } })
    : await db.user.findUnique({ where: { email } });
  if (!user) {
    // Same deployment lock as the email-code path (single-user enforcement).
    if (await registrationLocked() && !isOwnerEmail(email)) {
      throw new Error(LOCK_MESSAGE);
    }
    user = await db.user.create({ data: { email, name: profile.name, provider: "google" } });
  }
  return { id: user.id, email: user.email, name: user.name };
}
