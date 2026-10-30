// /api/settings - the learner's own settings, one place.
//
// GET  -> { settings: profileView, presets } for the AI settings page
//         (which engine is live, which BYO presets exist; never the key).
// POST { newPerDay }                                     -> daily pace (audit polish #1)
// POST { presetId, baseUrl, apiKey, model }              -> BYO provider save (Task 102 reconstruction)
// POST { clearProvider: true }                           -> back to the built-in engine
//
// The API key is stored server-side only (AiSettings table) and never sent
// back to the client - profileView exposes hasKey, not the key.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLearner, getSettings } from "@/lib/server";
import { presets, profileView } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({
    settings: profileView(settings),
    presets,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  // BYO provider save / clear (AI settings page).
  if (body.clearProvider || body.presetId !== undefined) {
    if (body.clearProvider) {
      await db.aiSettings.upsert({
        where: { id: "main" },
        create: { id: "main" },
        update: { provider: "", baseUrl: "", apiKey: "", model: "", discovered: "", lastTest: "" },
      });
      return NextResponse.json({ ok: true, settings: profileView(null) });
    }
    const baseUrl = String(body.baseUrl ?? "").trim().replace(/\/+$/, "");
    const model = String(body.model ?? "").trim();
    const apiKey = String(body.apiKey ?? "").trim();
    const provider = String(body.presetId ?? "custom").trim();
    if (baseUrl && !/^https?:\/\//.test(baseUrl)) {
      return NextResponse.json({ error: "baseUrl must start with http(s)://" }, { status: 400 });
    }
    const row = await db.aiSettings.upsert({
      where: { id: "main" },
      create: { id: "main", provider, baseUrl, apiKey, model },
      update: { provider, baseUrl, apiKey, model },
    });
    // A new endpoint invalidates the previous discovery + test results.
    await db.aiSettings.update({
      where: { id: "main" },
      data: { discovered: "", lastTest: "" },
    });
    return NextResponse.json({ ok: true, settings: profileView(row) });
  }

  // Daily pace.
  const n = Math.round(Number(body.newPerDay));
  if (!Number.isFinite(n)) return NextResponse.json({ error: "newPerDay must be a number" }, { status: 400 });
  const clamped = Math.min(30, Math.max(3, n));
  await db.learner.update({ where: { id: "me" }, data: { newPerDay: clamped } });
  const l = await getLearner();
  return NextResponse.json({ ok: true, newPerDay: l.newPerDay, clamped: clamped !== n });
}
