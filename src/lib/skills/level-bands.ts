// ---------- level bands (per-skill assessment) ----------

import { db } from "@/lib/db";
import { aiJson, type ProfileJson } from "@/lib/ai";
import type { BandRow } from "./run-types";

const BANDS = ["grammar", "vocabulary", "writing", "speaking", "reading", "listening"] as const;

function levelFromScore(s: number): string {
  if (s >= 88) return "C1";
  if (s >= 76) return "B2+";
  if (s >= 60) return "B2";
  if (s >= 45) return "B1+";
  if (s >= 30) return "B1";
  return "A2";
}

async function persistBands(bands: BandRow[]): Promise<void> {
  for (const b of bands) {
    await db.skillBand.upsert({
      where: { band: b.band },
      create: { band: b.band, level: b.level, score: b.score, evidence: JSON.stringify([b.evidence]) },
      update: { level: b.level, score: b.score, evidence: JSON.stringify([b.evidence]) },
    });
  }
}

// Learner evidence digest: real data from the app, not invented numbers.
async function buildDigest(): Promise<string> {
  const l = await db.learner.findUnique({ where: { id: "me" } });
  const [writes, speaks, corrections, stats, states] = await Promise.all([
    db.writingSub.findMany({ orderBy: { id: "desc" }, take: 4 }),
    db.speakSession.findMany({ orderBy: { id: "desc" }, take: 3 }),
    db.chatMsg.findMany({ where: { role: "coach" }, orderBy: { id: "desc" }, take: 12 }),
    db.dailyStat.findMany({ orderBy: { day: "desc" }, take: 14 }),
    db.cardState.findMany(),
  ]);
  const totalReps = states.reduce((a, s) => a + s.reps, 0);
  const totalLapses = states.reduce((a, s) => a + s.lapses, 0);
  const days = stats.length;
  const xp = stats.reduce((a, s) => a + s.xp, 0);
  const parts = [
    l ? `Placement level: ${l.level}. Streak: ${l.streak} days. Days active (last 2 weeks): ${days}. XP in that window: ${xp}.` : "",
    `Card deck: ${states.length} cards touched, ${totalReps} reviews, ${totalLapses} lapses (${totalReps ? Math.round((totalLapses / totalReps) * 100) : 0}% lapse rate).`,
    writes.length
      ? `Recent writing samples (newest first):\n${writes.map((w) => `- prompt: ${w.prompt.slice(0, 90)} | essay: ${w.text.slice(0, 700)} | previous grading: ${w.result.slice(0, 400)}`).join("\n")}`
      : "No writing samples yet.",
    speaks.length
      ? `Recent speaking transcripts:\n${speaks.map((s) => `- ${s.transcript.slice(0, 600)} | previous grading: ${s.result.slice(0, 300)}`).join("\n")}`
      : "No speaking sessions yet.",
    corrections.length
      ? `Recent coach correction envelopes (they contain the learner's recurring errors):\n${corrections.map((c) => c.content.slice(0, 350)).join("\n")}`
      : "No chat corrections yet.",
  ];
  return parts.filter(Boolean).join("\n\n");
}

interface BandsRaw {
  bands: { band: string; score: number; evidence: string }[];
  verdict?: string;
}

async function assessBands(deep: boolean, profile: ProfileJson, extra?: string): Promise<{ bands: BandRow[]; verdict: string }> {
  const digest = await buildDigest();
  const sys = `You are the assessment engine of Rah, an English app for Farsi speakers. You assign a CEFR band per skill, based ONLY on the evidence provided. Do not invent performance that the evidence does not show; where evidence is missing, score conservatively around the placement level and say so in the evidence.

Skills to band: grammar, vocabulary, writing, speaking, reading, listening. Then compute "overall" as your best judgment of the learner's working level across all skills (not a plain average: weight productive skills at B2-to-C1 goal higher).
Score each 0 to 100 on a scale where 60 = solid B2, 76 = B2+, 88 = C1. Evidence is ONE English sentence citing the actual signal you used (a mistake pattern, a writing trait, absence of data).
Never use the em dash character.

Output ONE JSON object, nothing else:
{"bands": [{"band": "grammar", "score": 0, "evidence": ""}], "verdict": "two English sentences"}`;

  const user = `Learner profile: ${JSON.stringify(profile)}
${extra ? `Extra probe result: ${extra}` : ""}
Evidence digest:
${digest}`;

  const raw0 = await aiJson<BandsRaw>(sys, [{ role: "user", content: user }], undefined, { think: deep });
  // Deep pass: a second, adversarial verifier reviews and revises every band.
  let raw = raw0;
  if (deep) {
    try {
      raw = await aiJson<BandsRaw>(
        `You are the verification pass of the Rah assessment engine. A first pass produced these bands. Review them against the same evidence: challenge any score that looks inflated or unfairly low, sharpen the evidence lines to cite the concrete signal, and return the FINAL bands. Same scale (60 = solid B2, 76 = B2+, 88 = C1). Keep the same JSON shape, all seven bands present.
Output ONE JSON object, nothing else:
{"bands": [{"band": "grammar", "score": 0, "evidence": ""}], "verdict": "two English sentences"}
Never use the em dash character.`,
        [
          { role: "user", content: user },
          { role: "assistant", content: JSON.stringify(raw0) },
          { role: "user", content: "Verify and return the final bands." },
        ],
        undefined,
        { think: true },
      );
    } catch {
      raw = raw0; // verifier failed; first pass stands
    }
  }
  const rows = (raw.bands ?? [])
    .filter((b) => b && typeof b.band === "string")
    .map((b) => {
      const score = Math.max(0, Math.min(100, Math.round(Number(b.score) || 0)));
      const band = (BANDS as readonly string[]).includes(b.band) ? b.band : b.band.toLowerCase();
      return { band, level: levelFromScore(score), score, evidence: String(b.evidence ?? "").slice(0, 220) };
    });
  const known = rows.filter((r) => (BANDS as readonly string[]).includes(r.band) || r.band === "overall");
  if (!known.find((r) => r.band === "overall")) {
    const avg = known.length ? Math.round(known.reduce((a, r) => a + r.score, 0) / known.length) : 55;
    known.push({ band: "overall", level: levelFromScore(avg), score: avg, evidence: "Derived from the per-skill scores above." });
  }
  await persistBands(known);
  return { bands: known, verdict: String(raw.verdict ?? "").trim() };
}

export { assessBands };
