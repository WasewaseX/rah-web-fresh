"use client";

// The login gate. Email + code (works for every address including gmail),
// plus Google OAuth when the deployment configured credentials. Dev delivery:
// with no SMTP configured the code is shown in a clearly-marked dev strip so
// the app is fully usable with zero setup.
// Task 109: owner access-code sign-in - a deterministic path for the holder
// that works even when the mail provider cannot deliver (sandbox 550s, SMTP
// outages). Offered only when the deployment armed RAH_ACCESS_CODE.

import { useEffect, useState } from "react";
import { Mail, ShieldCheck, KeyRound, Sparkles, ArrowLeft } from "lucide-react";
import { Btn } from "./ui";
import { LogoMark, StrandIcon } from "./next/bits";
import { storeRahToken, isEmbedded } from "@/lib/rah-fetch";

const LAST_EMAIL_KEY = "rah_last_email";
const GOOGLE_BLOCKED_MSG = "Google sign-in is not configured here. Enter your gmail address above - the code works the same.";

function rememberEmail(email: string): void {
  try {
    if (email) localStorage.setItem(LAST_EMAIL_KEY, email);
  } catch {
    // storage unavailable (private mode / quota) - the email simply is not remembered
  }
}

function recalledEmail(): string {
  try {
    return localStorage.getItem(LAST_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

interface SessionInfo {
  user: { email: string; name: string } | null;
  googleConfigured: boolean;
  accessCodeEnabled?: boolean;
}

// Setter controls handed to the module-level auth helpers (no hooks there).
type AuthCtl = {
  setBusy: (v: boolean) => void;
  setError: (s: string) => void;
  setStage: (s: "email" | "code" | "access") => void;
  setDevCode: (s: string) => void;
  setSentTo: (s: string) => void;
};

async function requestLoginCode(email: string, ctl: AuthCtl) {
  ctl.setBusy(true);
  ctl.setError("");
  ctl.setDevCode("");
  try {
    const r = await fetch("/api/auth/request-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await r.json()) as { error?: string; devCode?: string; via?: string };
    if (!r.ok) {
      ctl.setError(data.error ?? "Could not send the code.");
    } else {
      ctl.setStage("code");
      ctl.setSentTo(email.trim());
      if (data.devCode) ctl.setDevCode(data.devCode);
    }
  } catch {
    ctl.setError("Network hiccup - try once more.");
  } finally {
    ctl.setBusy(false);
  }
}

async function verifyLogin(email: string, code: string, onSignedIn: (u: { email: string; name: string }) => void, ctl: AuthCtl) {
  ctl.setBusy(true);
  ctl.setError("");
  try {
    const r = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = (await r.json()) as { error?: string; token?: string; user?: { email: string; name: string } };
    if (!r.ok || !data.user) {
      ctl.setError(data.error ?? "Verification failed.");
    } else {
      // Keep the token for contexts where cookies cannot persist (preview
      // iframes drop SameSite cookies entirely): the fetch wrapper attaches
      // it as x-rah-token on every /api call.
      storeRahToken(data.token);
      rememberEmail(email);
      onSignedIn(data.user);
    }
  } catch {
    ctl.setError("Network hiccup - try once more.");
  } finally {
    ctl.setBusy(false);
  }
}

function BootSplash() {
  // Contentful boot splash (Task 92): the SSR shell previously painted only a
  // bare spinner, and Chrome does not count a spinner as a contentful paint -
  // real-user FCP waited for full hydration (~2.6s on a throttled mobile
  // profile). Rendering the same wordmark block the sign-in view uses (static
  // markup, identical on the server and the client's first render, zero layout
  // shift on swap) lets the browser paint real text as soon as CSS lands.
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--rah-bg)] px-4">
      <div className="w-full max-w-sm text-center">
        <LogoMark size={64} />
        <h1 className="text-2xl font-black tracking-tight text-[#f2f5fa]">Rah</h1>
        <p className="mt-1 text-sm font-medium text-[#7d889c]">B2 to C1, your road. Sign in to continue.</p>
        <span className="mx-auto mt-6 block h-6 w-6 animate-spin rounded-full border-2 border-[#2a3242] border-t-[var(--rah-primary)]" />
      </div>
    </div>
  );
}

function SignInHeader() {
  return (
    <div className="mb-8 text-center">
      {/* Task 117: the first impression carries the real mark now. The
         breathing glow stays (sanctioned ambient); the CSS-text "R"
         tile is replaced by the actual logo geometry. */}
      <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center">
        <div aria-hidden className="absolute inset-0 scale-150 rounded-3xl bg-[var(--rah-primary)]/25 blur-xl" />
        <LogoMark size={64} />
      </div>
      <h1 className="text-3xl font-black tracking-tight text-[#cfe0ff]">Rah</h1>
      <p className="mt-1 text-sm font-medium text-[#7d889c]">B2 to C1, your road. Sign in to continue.</p>
      <div aria-hidden className="mt-4 flex justify-center gap-2">
        <StrandIcon strand="listening" size={28} radius={9} />
        <StrandIcon strand="reading" size={28} radius={9} />
        <StrandIcon strand="speaking" size={28} radius={9} />
        <StrandIcon strand="writing" size={28} radius={9} />
      </div>
    </div>
  );
}

function EmailStage({ email, setEmail, busy, googleOk, accessOk, onCode, onAccessStart, onGoogleBlocked }: {
  email: string;
  setEmail: (v: string) => void;
  busy: boolean;
  googleOk: boolean;
  accessOk: boolean;
  onCode: () => void;
  onAccessStart: () => void;
  onGoogleBlocked: () => void;
}) {
  return (
    <>
      <label htmlFor="login-email" className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7d889c]">Email</label>
      <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#141c2e] px-3 focus-within:border-[var(--rah-primary)]/50">
        <Mail className="h-4 w-4 shrink-0 text-[#5d6879]" />
        <input
          id="login-email"
          aria-label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && email.includes("@") && void onCode()}
          placeholder="you@gmail.com"
          className="min-h-12 w-full bg-transparent text-sm text-[#f2f5fa] outline-none placeholder:text-[#5d6879]"
        />
      </div>
      <Btn onClick={onCode} disabled={busy || !email.includes("@")} className="mt-3 w-full !min-h-12 justify-center">
        <KeyRound className="h-4 w-4" /> Send login code
      </Btn>

      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-white/[0.07]" />
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5d6879]">or</span>
        <span className="h-px flex-1 bg-white/[0.07]" />
      </div>

      <a
        href={googleOk ? "/api/auth/google/start" : undefined}
        onClick={googleOk ? undefined : (e) => { e.preventDefault(); onGoogleBlocked(); }}
        className="flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-white/[0.1] bg-white text-sm font-bold text-[#1a1f2b] transition-colors hover:bg-[#e8eaf0]"
      >
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5">
          <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.02.15 3.5 2.7.24.02c2.2-2.05 3.5-5.05 3.5-8.58z" />
          <path fill="#34A853" d="M12 24c3.2 0 5.9-1.07 7.9-2.9l-3.76-2.9c-1 .7-2.36 1.2-4.1 1.2-3.15 0-5.83-2.08-6.78-4.96l-.14.01-3.6 2.8-.05.13C3.43 21.3 7.4 24 12 24z" />
          <path fill="#FBBC05" d="M5.2 14.4c-.24-.72-.38-1.5-.38-2.4s.14-1.67.37-2.4l-.01-.16-3.65-2.83-.12.06C.5 8.3 0 10.1 0 12s.5 3.7 1.4 5.33l3.8-2.93z" />
          <path fill="#EA4335" d="M12 4.6c2.25 0 3.77.97 4.64 1.78l3.4-3.3C17.9 1.07 15.2 0 12 0 7.4 0 3.43 2.7 1.4 6.67l3.8 2.93C6.17 6.7 8.85 4.6 12 4.6z" />
        </svg>
        Continue with Gmail
      </a>

      {accessOk && (
        <>
          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-white/[0.07]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5d6879]">or</span>
            <span className="h-px flex-1 bg-white/[0.07]" />
          </div>
          <button
            onClick={onAccessStart}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-transparent text-[13px] font-bold text-[#8b96a9] transition-colors hover:border-white/[0.16] hover:text-[#dbe3f0]"
          >
            <KeyRound className="h-3.5 w-3.5" /> Sign in with your access code
          </button>
        </>
      )}
    </>
  );
}

function CodeStage({ sentTo, code, setCode, busy, devCode, accessOk, onVerify, onResend, onBack, onAccessStart }: {
  sentTo: string;
  code: string;
  setCode: (v: string) => void;
  busy: boolean;
  devCode: string;
  accessOk: boolean;
  onVerify: () => void;
  onResend: () => void;
  onBack: () => void;
  onAccessStart: () => void;
}) {
  return (
    <>
      <button onClick={onBack} className="mb-3 flex items-center gap-1 text-[11px] font-bold text-[#7d889c] hover:text-[#dbe3f0]">
        <ArrowLeft className="h-3 w-3" /> change email
      </button>
      <label className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7d889c]">
        Code sent to {sentTo}
      </label>
      <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#141c2e] px-3 focus-within:border-[var(--rah-primary)]/50">
        <ShieldCheck className="h-4 w-4 shrink-0 text-[#5d6879]" />
        <input
          aria-label="Login code"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && code.length === 6 && void onVerify()}
          placeholder="000000"
          className="min-h-12 w-full bg-transparent text-lg font-black tracking-[0.3em] text-[#f2f5fa] outline-none placeholder:text-[#3a4356]"
        />
      </div>
      {devCode && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#ffb02e]/25 bg-[#ffb02e]/[0.06] px-3 py-2.5">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ffd08a]" />
          <div className="text-[12px] leading-relaxed text-[#ffd08a]">
            <b>Dev inbox</b> (no SMTP configured): your code is{" "}
            <b className="tracking-[0.2em]">{devCode}</b>
          </div>
        </div>
      )}
      <Btn onClick={onVerify} disabled={busy || code.length !== 6} className="mt-3 w-full !min-h-12 justify-center">
        <ShieldCheck className="h-4 w-4" /> Verify and sign in
      </Btn>
      <button onClick={onResend} disabled={busy} className="mt-2 w-full text-center text-[11px] font-bold text-[#7d889c] hover:text-[#dbe3f0]">
        resend code
      </button>
      {accessOk && (
        <button onClick={onAccessStart} className="mt-3 w-full text-center text-[11px] font-bold text-[#8b96a9] hover:text-[#dbe3f0]">
          No email? Sign in with your access code instead
        </button>
      )}
    </>
  );
}

function AccessStage({ accessEmail, setAccessEmail, accessCode, setAccessCode, busy, onVerify, onBack }: {
  accessEmail: string;
  setAccessEmail: (v: string) => void;
  accessCode: string;
  setAccessCode: (v: string) => void;
  busy: boolean;
  onVerify: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <button onClick={onBack} className="mb-3 flex items-center gap-1 text-[11px] font-bold text-[#7d889c] hover:text-[#dbe3f0]">
        <ArrowLeft className="h-3 w-3" /> back to email sign-in
      </button>
      <label htmlFor="access-email" className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7d889c]">Owner email</label>
      <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#141c2e] px-3 focus-within:border-[var(--rah-primary)]/50">
        <Mail className="h-4 w-4 shrink-0 text-[#5d6879]" />
        <input
          id="access-email"
          aria-label="Owner email"
          type="email"
          value={accessEmail}
          onChange={(e) => setAccessEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@yourmail.com"
          className="min-h-12 w-full bg-transparent text-sm text-[#f2f5fa] outline-none placeholder:text-[#5d6879]"
        />
      </div>
      <label htmlFor="access-code" className="mt-4 block text-[11px] font-black uppercase tracking-[0.12em] text-[#7d889c]">Access code</label>
      <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#141c2e] px-3 focus-within:border-[var(--rah-primary)]/50">
        <ShieldCheck className="h-4 w-4 shrink-0 text-[#5d6879]" />
        <input
          id="access-code"
          aria-label="Access code"
          type="text"
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && accessEmail.includes("@") && accessCode.length >= 4 && void onVerify()}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="your private access code"
          className="min-h-12 w-full bg-transparent text-sm font-semibold tracking-wide text-[#f2f5fa] outline-none placeholder:text-[#5d6879]"
        />
      </div>
      <Btn onClick={onVerify} disabled={busy || !accessEmail.includes("@") || accessCode.length < 4} className="mt-3 w-full !min-h-12 justify-center">
        <ShieldCheck className="h-4 w-4" /> Sign in with access code
      </Btn>
    </>
  );
}

export default function Login({ onSignedIn }: { onSignedIn: (user: { email: string; name: string }) => void }) {
  const [checking, setChecking] = useState(true);
  // Keep-me-signed-in UX: the email used last time is seeded straight into
  // state (lazy initializers), so the owner only types the access code - no
  // setState inside the mount effect (cascading renders).
  const [email, setEmail] = useState(() => recalledEmail());
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code" | "access">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [googleOk, setGoogleOk] = useState(false);
  const [accessOk, setAccessOk] = useState(false);
  const [accessEmail, setAccessEmail] = useState(() => recalledEmail());
  const [accessCode, setAccessCode] = useState("");
  // Derived in render, not state: an embedded context cannot change while
  // the component is mounted, so there is nothing to re-render on.
  const framed = isEmbedded();

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((s: SessionInfo) => {
        setGoogleOk(s.googleConfigured);
        setAccessOk(Boolean(s.accessCodeEnabled));
        if (s.user) onSignedIn(s.user);
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [onSignedIn]);

  const ctl: AuthCtl = { setBusy, setError, setStage, setDevCode, setSentTo };
  const requestCode = () => void requestLoginCode(email, ctl);
  const verify = () => void verifyLogin(sentTo, code, onSignedIn, ctl);
  // Owner access-code sign-in: same verify endpoint, the server routes by
  // owner allowlist + secret match before the 6-digit path ever runs.
  const verifyAccess = () => void verifyLogin(accessEmail, accessCode, onSignedIn, ctl);
  const startAccess = (from: string) => {
    setAccessEmail(from);
    setStage("access");
  };

  if (checking) return <BootSplash />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--rah-bg)] px-4">
      <div className="w-full max-w-sm">
        <SignInHeader />
        <div className="rounded-3xl border border-white/[0.07] bg-[#0f1522] p-5 shadow-[0_24px_64px_-32px_rgba(0,0,0,.9)]">
          {stage === "email" ? (
            <EmailStage email={email} setEmail={setEmail} busy={busy} googleOk={googleOk} accessOk={accessOk}
              onCode={requestCode} onAccessStart={() => startAccess(email)} onGoogleBlocked={() => setError(GOOGLE_BLOCKED_MSG)} />
          ) : stage === "code" ? (
            <CodeStage sentTo={sentTo} code={code} setCode={setCode} busy={busy} devCode={devCode} accessOk={accessOk}
              onVerify={verify} onResend={requestCode} onBack={() => setStage("email")} onAccessStart={() => startAccess(sentTo)} />
          ) : (
            <AccessStage accessEmail={accessEmail} setAccessEmail={setAccessEmail} accessCode={accessCode} setAccessCode={setAccessCode}
              busy={busy} onVerify={verifyAccess} onBack={() => setStage("email")} />
          )}
          {error && <div className="mt-3 rounded-xl border border-[#ff6b6b]/25 bg-[#ff6b6b]/[0.08] px-3 py-2 text-[12px] font-semibold text-[#ffb3b3]">{error}</div>}
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-[#5d6879]">
          One account per learner. Codes expire in 10 minutes and work once.
        </p>
        {framed && (
          <p className="mx-auto mt-3 max-w-sm text-center text-[11px] leading-relaxed text-[#8b96a9]">
            You are viewing Rah inside a preview frame. If you keep getting signed out,
            open this page in its own browser tab - embedded frames can drop sign-in cookies.
          </p>
        )}
      </div>
    </div>
  );
}
