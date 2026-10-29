import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { issueLoginCode } from "@/lib/auth";
import { sendLoginCode, smtpConfigured } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({ email: "" }));
  // Per-IP throttle on top of the per-email DB limit (proxy-aware best effort).
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim()
    || (req.headers.get("x-real-ip") ?? "");
  const issued = await issueLoginCode(String(email ?? ""), ip);
  if (!issued.ok) return NextResponse.json({ error: issued.error }, { status: 400 });

  // The plaintext code came back from issueLoginCode's memory; the DB only
  // ever saw its sha256 hash. Mail it immediately and let it go.
  //
  // Task 101: SMTP failures MUST NOT crash this route. sendLoginCode re-throws
  // provider rejections (2026-10-29 live: Resend sandbox 550 "You can only
  // send testing emails to your own email address"), and an unhandled throw
  // returns an HTML/empty 500 - the client's r.json() then throws and the
  // learner sees the useless "Network hiccup" instead of the real reason.
  // The ledger (MailLog) still records the failure before the throw.
  let mail;
  try {
    mail = await sendLoginCode(String(email).trim().toLowerCase(), issued.code!);
  } catch (e) {
    const detail = String((e as Error).message ?? e).replace(/\s+/g, " ").slice(0, 160);
    console.log(`[request-code] SMTP send failed for ${email}: ${detail}`);
    return NextResponse.json(
      { error: `The sign-in email could not be sent. Mail provider said: ${detail}` },
      { status: 503 },
    );
  }
  if (mail.via === "smtp" && !mail.delivered) {
    // Idempotent replay of a failed send (or a provider answer nodemailer
    // resolved without throwing): same honesty rule - say so, with status.
    return NextResponse.json(
      { error: "The sign-in email could not be delivered. The mail provider rejected the send - see the deployment's MailLog for the exact reason." },
      { status: 503 },
    );
  }
  return NextResponse.json({
    ok: true,
    email: String(email).trim().toLowerCase(),
    via: mail.via,
    smtpConfigured: smtpConfigured(),
    // Dev delivery only (no SMTP configured AND not production): the code is
    // returned so the login screen can show it in the clearly-marked dev
    // inbox. With SMTP set, or in production, this stays undefined.
    devCode: mail.devCode && process.env.NODE_ENV !== "production" ? mail.devCode : undefined,
  });
}
