import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLearner, getSettings } from "@/lib/server";
import { chat, smartChat, effectiveProfile, extractJson, listModels, presets, isBuiltin, BUILTIN_PROFILE } from "@/lib/ai";
import { tutorSystem, quizSystem, importSystem, speakEvalSystem } from "@/lib/prompts";
import { matchThemeIntent, themeTokensFor, matchExamDispute, examDisputeReply } from "@/lib/tutor-intents";
import { itemAnswerable } from "@/lib/agent/exam-gate";
import { contentUserId } from "@/lib/scope";

// Task 119: post-filter for the generic tutor path. The holder caught the
// tutor claiming "I've reviewed the grammar exam and answer key" when nothing
// had been reviewed - a fabricated capability claim. The LLM prompt now bans
// it; this filter is the belt under the braces: any review/check/verify claim
// in a reply that the route did not ground with real data gets replaced by an
// honest admission.
function stripFabricatedClaims(s: string): string {
  return String(s ?? "").replace(
    /I\s*(?:'ve|have|'d|just)\s*(?:already\s*)?(?:reviewed|checked|verified|examined|double-checked|looked\s*(?:at|through|into))[^.!?!\n]{0,140}[.!?]/gi,
    "I can't re-check that from here, so let's look at it together."
  );
}

// POST /api/ai  { action: "discover" | "test" | "tutor" | "quiz" | "import" | "speak_eval" }
// Every action runs on the built-in engine by default. A configured BYO
// provider takes the wheel and silently falls back to the engine if it fails.
export async function POST(req: Request) {
  const body = await req.json();
  const action: string = body.action ?? "";

  if (action === "discover") {
    const p = await effectiveProfile();
    if (isBuiltin(p)) {
      return NextResponse.json({ ok: true, models: [BUILTIN_PROFILE.model], managed: true, error: "" });
    }
    const out = await listModels(p);
    if (out.ok) {
      const s = await getSettings();
      await db.aiSettings.update({
        where: { id: "main" },
        data: { discovered: JSON.stringify(out.models.slice(0, 200)) },
      });
    }
    return NextResponse.json(out);
  }

  if (action === "test") {
    const p = await effectiveProfile();
    const started = Date.now();
    const out = await chat(p, "Reply with the single word: ready", [{ role: "user", content: "ping" }], 10);
    const ms = Date.now() - started;
    const result = { ok: out.ok, ms, error: out.error, at: new Date().toISOString() };
    if (!isBuiltin(p)) {
      await db.aiSettings.update({ where: { id: "main" }, data: { lastTest: JSON.stringify(result) } });
    }
    return NextResponse.json(result);
  }

  if (action === "tutor") {
    const learner = await getLearner();
    const history = (body.history ?? []).slice(-12);
    const lastUser = [...history].reverse().find((m) => m?.role === "user")?.content ?? "";

    // Intent 1 - theme repaint. The capability always existed (theme presets,
    // /api/theme, the agent's theme-control skill); the tutor chat just never
    // reached it and answered "I don't have the ability" - a factual lie. The
    // intent applies the preset for real and returns the tokens so the client
    // repaints in place.
    const themeHit = matchThemeIntent(lastUser);
    if (themeHit) {
      const stored = themeTokensFor(themeHit);
      await db.learner.update({ where: { id: learner.id }, data: { theme: stored ?? "" } });
      return NextResponse.json({
        ok: true,
        turn: { reply: themeHit.reply, corrections: [], fa_note: themeHit.fa, praised: false, theme: themeHit.reset ? null : themeHit.tokens },
      });
    }

    // Intent 2 - exam dispute. Grounded honesty instead of a fabricated
    // review: pull the exam actually stored in Rah, run every item through
    // the REAL deterministic answerability gate, and quote the results. Every
    // claim in the reply is backed by a run that actually happened.
    if (matchExamDispute(lastUser)) {
      const row = await db.exam.findFirst({ orderBy: { createdAt: "desc" } });
      if (row) {
        let items: { id: string; type: string; q: string; a: string; choices?: string[] }[] = [];
        try {
          items = JSON.parse(row.items);
        } catch {
          items = [];
        }
        const brokenIds = items
          .filter((it) => !itemAnswerable({ type: it.type, q: it.q, a: it.a, choices: it.choices }).ok)
          .map((it) => it.id);
        const d = examDisputeReply({ title: row.title, items }, brokenIds);
        return NextResponse.json({
          ok: true,
          turn: { reply: d.reply, corrections: [], fa_note: d.fa, praised: false },
        });
      }
      const d = examDisputeReply(null, []);
      return NextResponse.json({ ok: true, turn: { reply: d.reply, corrections: [], fa_note: d.fa, praised: false } });
    }

    // Context assembly (the assessment's #1 ask): the tutor now sees the live
    // due queue and the top recurring mistake family - room-reading data, not
    // just the last message. Same canonical due filter as /api/mission.
    const u = await contentUserId().catch(() => learner.id);
    const day = Math.floor(Date.now() / 86400000);
    const [states, fam] = await Promise.all([
      db.cardState.findMany({ where: { learnerId: learner.id }, select: { due: true, state: true, suspended: true } }),
      db.mistakeFamily.findFirst({
        where: { userId: u, resolvedAt: null },
        orderBy: [{ count: "desc" }, { lastSeen: "desc" }],
        select: { tag: true, label: true, count: true },
      }),
    ]);
    const due = states.filter((s) => !s.suspended && s.state !== "new" && s.due <= day).length;

    const out = await smartChat(
      tutorSystem({
        level: learner.level,
        diagnosis: JSON.parse(learner.diagnosis || "{}"),
        streak: learner.streak,
        due,
        focus: "vocabulary",
        mistakes: fam ? [{ tag: fam.tag, count: fam.count, label: fam.label }] : [],
      }),
      history,
      900,
      true
    );
    if (!out.ok) return NextResponse.json({ ok: false, error: out.error, fallback: true });
    const parsed = extractJson(out.text);
    if (!parsed) {
      return NextResponse.json({ ok: false, error: "the engine did not return the expected JSON envelope", fallback: true, raw: out.text.slice(0, 500) });
    }
    // Audit P1 (typed output validation): a turn without a reply string must
    // degrade to the client's fallback, not flow through as ok:true.
    if (typeof parsed.reply !== "string") {
      return NextResponse.json({ ok: false, error: "the engine returned a turn without a reply field", fallback: true, raw: out.text.slice(0, 500) });
    }
    parsed.reply = stripFabricatedClaims(parsed.reply);
    return NextResponse.json({ ok: true, turn: parsed });
  }

  if (action === "speak_eval") {
    const learner = await getLearner();
    const transcript: string = String(body.transcript ?? "").slice(0, 4000);
    const prompt: string = String(body.prompt ?? "").slice(0, 600);
    const seconds: number = Number(body.seconds ?? 0);
    if (!transcript.trim()) {
      return NextResponse.json({ ok: false, error: "nothing to evaluate", fallback: true });
    }
    const out = await smartChat(
      speakEvalSystem({
        level: learner.level,
        diagnosis: JSON.parse(learner.diagnosis || "{}"),
        streak: learner.streak,
      }),
      [{ role: "user", content: `Speaking prompt: ${prompt}\nSpoken for about ${Math.round(seconds)} seconds.\nTranscript (speech-to-text, punctuation is approximate):\n\n${transcript}` }],
      1200,
      true
    );
    if (!out.ok) return NextResponse.json({ ok: false, error: out.error, fallback: true });
    const parsed = extractJson(out.text);
    if (!parsed) return NextResponse.json({ ok: false, error: "the engine returned an unreadable evaluation", fallback: true });
    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ ok: false, error: "the engine returned an evaluation with the wrong shape", fallback: true });
    }
    return NextResponse.json({ ok: true, eval: parsed });
  }

  if (action === "quiz") {
    const learner = await getLearner();
    const text = String(body.text ?? "").slice(0, 12000);
    const out = await smartChat(quizSystem(learner.level), [{ role: "user", content: text }], 2000, true);
    if (!out.ok) return NextResponse.json({ ok: false, error: out.error, fallback: true });
    const parsed = extractJson(out.text);
    if (!parsed) return NextResponse.json({ ok: false, error: "the engine returned invalid JSON", fallback: true });
    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ ok: false, error: "the engine returned a quiz with the wrong shape", fallback: true });
    }
    return NextResponse.json({ ok: true, quiz: parsed });
  }

  if (action === "import") {
    const learner = await getLearner();
    const text = String(body.text ?? "").slice(0, 12000);
    const out = await smartChat(importSystem(learner.level), [{ role: "user", content: text }], 2000, true);
    if (!out.ok) return NextResponse.json({ ok: false, error: out.error, fallback: true });
    const parsed = extractJson(out.text);
    if (!parsed) return NextResponse.json({ ok: false, error: "the engine returned invalid JSON", fallback: true });
    const cards = Array.isArray(parsed.cards) ? (parsed.cards as Record<string, string>[]) : [];
    const created: string[] = [];
    for (const c of cards.slice(0, 12)) {
      if (!c.prompt || !c.answer) continue;
      const uc = await db.userCard.create({
        data: {
          learnerId: learner.id,
          kind: c.kind === "ef" || c.kind === "fae" ? c.kind : "cloze",
          prompt: String(c.prompt),
          answer: String(c.answer),
          en: String(c.en ?? c.answer),
          fa: String(c.fa ?? ""),
          note: String(c.note ?? ""),
          level: c.level === "C1" ? "C1" : learner.level,
        },
      });
      created.push("u_" + uc.id);
    }
    return NextResponse.json({ ok: true, created: created.length, cards });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
