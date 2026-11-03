import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bumpDaily, touchStreak } from "@/lib/server";
import { awardXp } from "@/lib/arcade";
import { contentScope } from "@/lib/scope";
import { aiRateLimit } from "@/lib/rate-limit";
import { transcribeAudio, MAX_AUDIO_BASE64_CHARS } from "@/lib/asr";
import { scorePronunciation } from "@/lib/pronunciation";
import {
  SHADOW_TARGETS,
  missesOf,
  tallyMisses,
  wordsNeedingCards,
  shadowCardFor,
  rankWeakFocuses,
  orderTargets,
  CARD_THRESHOLD,
} from "@/lib/shadowing";

export const dynamic = "force-dynamic";

// Goal-bound voice shadowing (ROADMAP §3.1): listen -> imitate -> word-level
// compare -> recurring errors become FSRS items. The measured tier is the
// same machinery as read-aloud (ASR + deterministic alignment); what is new
// is the CROSS-ATTEMPT ledger: the same word missed again and again crosses
// CARD_THRESHOLD and mints exactly one review card (note marker dedupes).
//
// Probe doctrine (Task 111/122 class): with x-rah-probe: 1 the route still
// computes the full report but writes NOTHING and awards NOTHING - batteries
// can drive the live path without touching the learner ledger.

const SHADOW_PREFIX = "shadow:";

interface StoredWords {
  assessment?: { words?: { target: string; heard: string | null; status: string }[] };
}

function probeMode(req: Request): boolean {
  return req.headers.get("x-rah-probe") === "1";
}

async function loadHistory(userId: string) {
  const rows = await db.speakSession.findMany({
    where: { userId, prompt: { startsWith: SHADOW_PREFIX } },
    orderBy: { id: "asc" },
    take: 200,
  });
  return rows.map((r) => {
    let parsed: StoredWords = {};
    try {
      parsed = JSON.parse(r.result) as StoredWords;
    } catch {
      parsed = {};
    }
    const words = parsed.assessment?.words ?? [];
    const misses = words
      .filter((w) => w.status === "near" || w.status === "miss")
      .map((w) => ({ word: w.target, heard: w.heard, near: w.status === "near" }));
    const targetId = r.prompt.split(" ")[1] ?? ""; // "shadow: <targetId> <text...>"
    const acc = (parsed.assessment as { accuracy?: number } | undefined)?.accuracy;
    return { targetId, misses, accuracy: typeof acc === "number" ? acc : null, at: r.at };
  });
}

async function existingCardMarkers(userId: string) {
  const cards = await db.userCard.findMany({
    where: { learnerId: userId, note: { startsWith: "shadow-miss:" } },
    select: { note: true },
  });
  return new Set(cards.map((c) => c.note.split(" ")[0]));
}

export async function GET(req: Request) {
  const scope = await contentScope(req);
  const history = await loadHistory(scope.userId);
  const [sound, cards] = await Promise.all([
    db.soundLog.findMany({ where: { learnerId: scope.userId }, select: { focus: true, correct: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    existingCardMarkers(scope.userId),
  ]);

  const missFocuses = history.flatMap((h) => {
    const t = SHADOW_TARGETS.find((x) => x.id === h.targetId);
    return t && h.misses.length > 0 ? [t.focus] : [];
  });
  const weak = rankWeakFocuses(sound, missFocuses);
  const tallies = tallyMisses(
    history.map((h) => ({ focus: SHADOW_TARGETS.find((x) => x.id === h.targetId)?.focus ?? "", misses: h.misses })),
  );

  return NextResponse.json({
    targets: orderTargets(SHADOW_TARGETS, weak),
    threshold: CARD_THRESHOLD,
    recurring: Array.from(tallies.values())
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
      .map((t) => ({ ...t, cardExists: cards.has(`shadow-miss:${t.word}`) })),
    recent: history
      .slice(-8)
      .reverse()
      .map((h) => ({ targetId: h.targetId, accuracy: h.accuracy, missed: h.misses.length, at: h.at })),
  });
}

export async function POST(req: Request) {
  // The ASR call is metered exactly like every other engine call.
  const rl = aiRateLimit(req);
  if (!rl.ok) return rl.response!;

  const body = await req.json().catch(() => null);
  const target = String(body?.target ?? "").trim();
  const targetId = String(body?.targetId ?? "").trim();
  const audio = String(body?.audio ?? "");
  const probe = probeMode(req);

  if (target.length < 3 || target.length > 400) {
    return NextResponse.json({ error: "Shadow one of the listed sentences (3-400 characters)." }, { status: 400 });
  }
  if (!audio) {
    return NextResponse.json({ error: "No audio reached the server - record your imitation of the sentence." }, { status: 400 });
  }
  if (audio.length > MAX_AUDIO_BASE64_CHARS) {
    return NextResponse.json({ error: "Audio clip too large (9MB ceiling) - shadow one sentence at a time." }, { status: 413 });
  }

  let transcript = "";
  let report: ReturnType<typeof scorePronunciation>;
  try {
    const tr = await transcribeAudio(audio);
    transcript = tr.text;
    report = scorePronunciation(target, transcript);
  } catch (e) {
    return NextResponse.json({ error: `Speech service unreachable: ${(e as Error).message}` }, { status: 502 });
  }

  const scope = await contentScope(req);
  const history = probe ? [] : await loadHistory(scope.userId);
  const priorMisses = history.map((h) => ({
    focus: SHADOW_TARGETS.find((x) => x.id === h.targetId)?.focus ?? "",
    misses: h.misses,
  }));
  const thisFocus = SHADOW_TARGETS.find((x) => x.id === targetId)?.focus ?? "";
  const tallies = tallyMisses([...priorMisses, { focus: thisFocus, misses: missesOf(report) }]);
  const markers = probe ? new Set<string>() : await existingCardMarkers(scope.userId);
  const needing = wordsNeedingCards(tallies, markers);

  // Mint one card per newly-recurring word (the note marker is the dedupe key).
  const minted: string[] = [];
  if (!probe) {
    for (const word of needing) {
      const t = tallies.get(word);
      if (!t) continue;
      await db.userCard.create({
        data: { learnerId: scope.userId, ...shadowCardFor(word, t, target) },
      });
      minted.push(word);
    }
  }

  if (!probe) {
    await db.speakSession.create({
      data: {
        prompt: `${SHADOW_PREFIX}${targetId || "unknown"} ${target.slice(0, 200)}`,
        transcript: transcript.slice(0, 5000),
        round: 0,
        result: JSON.stringify({ assessment: report, tier: "measured:asr-alignment" }),
        ...scope,
      },
    });
    await bumpDaily("spoken");
    await awardXp(8, { chainHit: true });
    await touchStreak();
  }

  const recurring = Array.from(tallies.values())
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
    .map((t) => ({ ...t, cardExists: minted.includes(t.word) || markers.has(`shadow-miss:${t.word}`) }));

  return NextResponse.json({
    ok: true,
    target,
    transcript,
    tier: report.tier,
    report,
    recurring,
    minted,
    threshold: CARD_THRESHOLD,
    probe,
  });
}
