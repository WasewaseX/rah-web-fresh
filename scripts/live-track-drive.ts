// Live drive for the authentic exam tracks (Task 61): real model builds of an
// IELTS Reading and a TOEFL Reading training exam through the coach chat,
// on the throwaway stack. Validates what the battery cannot: that the real
// generator produces a passage-anchored, gate-passing, task-typed exam.
const BASE = process.env.DRIVE_BASE ?? "http://localhost:3101";
const EMAIL = `trackdrive-${Date.now()}@rah.test`;

let failures = 0;
let n = 0;
function check(ok: boolean, what: string, detail = "") {
  n += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` -> ${detail}`}`);
}

async function api(path: string, init?: RequestInit, cookie?: string) {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);
  const r = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await r.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: r.status, body, text, setCookie: r.headers.get("set-cookie") ?? undefined };
}

try {
  // Login (open registration is exported by the drive script's shell).
  const req1 = await api("/api/auth/request-code", { method: "POST", body: JSON.stringify({ email: EMAIL }) });
  const devCode = req1.body?.devCode as string;
  check(req1.status === 200 && /^\d{6}$/.test(devCode ?? ""), "drive: dev code issued", JSON.stringify(req1.body).slice(0, 80));
  const good = await api("/api/auth/verify", {
    method: "POST",
    headers: { "x-rah-embed": "1" },
    body: JSON.stringify({ email: EMAIL, code: devCode }),
  });
  const cookie = (good.setCookie ?? "").split(";")[0];
  check(cookie.includes("rah_session="), "drive: session cookie captured", cookie.slice(0, 24));

  const { trackById } = await import("@/lib/exam-tracks");

  async function driveTrack(message: string, trackId: string) {
    const track = trackById(trackId)!;
    console.log(`\n--- live build: ${track.shortLabel} ---`);
    const t0 = Date.now();
    const r = await api("/api/chat", { method: "POST", body: JSON.stringify({ message }) }, cookie);
    check(r.status === 200, "chat POST answers 200", r.text.slice(0, 140));
    const exam = r.body?.exam;
    check(!!exam, "the envelope carries an exam", JSON.stringify(r.body ?? {}).slice(0, 140));
    if (!exam) return;
    check(exam.spec?.track === trackId, `spec.track is ${trackId}`, String(exam.spec?.track));
    check(exam.spec?.minutes === Math.max(6, Math.ceil(exam.count * track.minutesPerItem)), "spec.minutes follows authentic pacing", `${exam.spec?.minutes} for ${exam.count} items`);
    const caveatSaid = typeof r.body?.reply === "string" && r.body.reply.includes("not an official band");
    check(caveatSaid, "the coach's reply carries the honest caveat", String(r.body?.reply ?? "").slice(0, 160));
    const passage = exam.passages?.[0];
    const words = passage ? passage.text.split(/\s+/).filter(Boolean).length : 0;
    check(!!passage && words >= track.passageMinWords, `the passage is real (${words} words >= ${track.passageMinWords})`, passage?.title ?? "none");
    const typeIds = track.taskTypes.map((t) => t.id);
    const allTyped = (exam.items ?? []).every((it: { taskId?: string; skill?: string }) => typeIds.includes(it.taskId ?? "") && it.skill === "reading");
    check(allTyped && (exam.items ?? []).length > 0, "every item is reading + a real task type", JSON.stringify((exam.items ?? []).map((i: { taskId?: string }) => i.taskId)));
    const dist: Record<string, number> = {};
    for (const it of exam.items ?? []) dist[it.taskId] = (dist[it.taskId] ?? 0) + 1;
    console.log(`   delivered ${exam.count} items in ${(Date.now() - t0) / 1000 | 0}s · task mix: ${JSON.stringify(dist)}`);
    console.log(`   passage: "${passage?.title}" · first item: ${String(exam.items?.[0]?.q ?? "").slice(0, 90)}`);
  }

  const which = process.env.DRIVE_TRACKS ?? "both";
  if (which === "ielts" || which === "both") await driveTrack("Build me an IELTS reading training exam with 6 questions.", "ielts_reading");
  if (which === "toefl" || which === "both") await driveTrack("Build me a TOEFL reading training exam with 8 questions.", "toefl_reading");
} catch (e) {
  console.error("DRIVE CRASH:", e);
  failures += 1;
}

console.log(`\n=== LIVE TRACK DRIVE: ${n - failures}/${n} ===`);
if (failures > 0) process.exit(1);

export {};
