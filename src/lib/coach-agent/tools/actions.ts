// ---------- coach_skill, make_pdf, set_theme, triage_flags ----------
// The state-tier actions: they run the skill engine, produce real PDF
// deliverables, repaint the app, or mutate the content-flag queue.

import { existsSync } from "fs";
import { mkdir, readFile, writeFile, stat } from "fs/promises";
import { dirname } from "path";
import { safePath } from "./workspace";
import type { ToolArgs, ToolResult } from "./types";

// ---------- coach_skill: the whole existing skill engine, reachable ----------

async function coachSkill(args: ToolArgs): Promise<ToolResult> {
  const text = String(args.message ?? "").trim();
  if (!text) return { ok: false, summary: "coach_skill needs a message to route" };
  const { runCoach } = await import("@/lib/agent/run");
  // The loop donates the last turns (loop.ts injects _history) so skill
  // routing sees the conversation instead of routing cold.
  const donated = Array.isArray(args._history)
    ? (args._history as { role: string; content: string }[]).map((h) => ({ role: h.role, content: String(h.content ?? "") }))
    : [];
  const envelope = await runCoach(text, donated, undefined);
  const steps = (envelope.steps ?? []).map((s) => s.label + (s.detail ? `: ${s.detail}` : "")).join(" | ");
  return {
    ok: true,
    summary: `Skill ${envelope.skill} ran (${steps.slice(0, 90)})`,
    detail: `skill: ${envelope.skill}\nreply: ${envelope.reply}\ncorrections: ${JSON.stringify(envelope.corrections ?? [])}`.slice(0, 4000),
  };
}

// ---------- make_pdf: real PDF deliverables ----------

async function makePdf(args: ToolArgs): Promise<ToolResult> {
  const out = String(args.out ?? args.path ?? "").trim();
  const p = safePath(out);
  if (!p || !out) return { ok: false, summary: "make_pdf needs an output path inside the workspace (e.g. report.pdf)" };
  if (!/\.pdf$/i.test(out)) return { ok: false, summary: "make_pdf writes .pdf files only (out must end in .pdf)" };

  let md = "";
  const src = String(args.source_md ?? "").trim();
  if (src) {
    const sp = safePath(src);
    if (!sp || !existsSync(sp) || !(await stat(sp)).isFile()) {
      return { ok: false, summary: `source_md not found: ${src} - write it first with write_file` };
    }
    md = await readFile(sp, "utf8");
  } else if (typeof args.markdown === "string" && args.markdown.trim().length > 0) {
    md = args.markdown;
  } else {
    return { ok: false, summary: "make_pdf needs source_md (a workspace .md file) or inline markdown" };
  }

  try {
    const { markdownToPdf } = await import("../pdf");
    const { bytes, pages } = await markdownToPdf(md);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, bytes);
    const kb = (bytes.length / 1024).toFixed(1);
    return {
      ok: true,
      summary: `PDF created: ${out} (${pages} page${pages > 1 ? "s" : ""}, ${kb} KB)`,
      detail: `data/coach-workspace/${out}\nThe learner can open/download it from the Workspace panel in this sidebar. Mention the file by name in your final reply.`,
    };
  } catch (e) {
    return { ok: false, summary: `make_pdf failed: ${(e as Error).message}` };
  }
}

// ---------- set_theme: repaint the app for real ----------

// Audit 2026-11-03 + holder transcript ("make the Ui theme green" answered
// with "I don't have the ability"): the live agent loop had NO theme surface.
// This tool resolves the request through the same validated parser the theme
// skill and the tutor intent use, persists the tokens on Learner.theme (the
// exact column /api/theme and the tutor path write), and returns them as
// structured data - the loop converts a successful run into a set_theme
// command the sidebar executes, so the repaint is INSTANT and real. Never
// claim a repaint without this tool's ok result.
async function setTheme(args: ToolArgs): Promise<ToolResult> {
  const wanted = String(args.theme ?? args.preset ?? args.color ?? "").trim();
  if (!wanted) return { ok: false, summary: "set_theme needs a theme, color, or 'reset'" };
  const { parseThemeRequest, presetById, PRESETS } = await import("@/lib/agent/theme");
  const req = parseThemeRequest(wanted);
  const preset = req.preset ? presetById(req.preset) : undefined;
  const tokens = req.tokens ?? preset?.tokens;
  if (!tokens) {
    return {
      ok: false,
      summary: `No theme matched "${wanted}"`,
      detail: `Presets: ${PRESETS.map((p) => p.id).join(", ")}. Ask the learner for one of those, a plain color word (green, blue, sunset, violet, rose), or hex codes.`,
    };
  }
  // Probe hygiene: the battery drives theme repaints in probe mode. The parse
  // and the validated tokens are still produced (the loop turns them into a
  // client-side set_theme command, which paints nothing persistent), but the
  // Learner.theme row is NOT written - probes never persist state.
  if (args._probe === true) {
    return {
      ok: true,
      summary: `Theme resolved (probe dry-run): ${preset?.name ?? "custom palette"} - nothing persisted.`,
      detail: "Probe mode: tokens validated, Learner.theme write suppressed. Real runs persist the choice.",
      data: { tokens, preset: preset?.id ?? null },
    };
  }
  const { db } = await import("@/lib/db");
  await db.learner.update({ where: { id: "me" }, data: { theme: JSON.stringify(tokens) } });
  const name = preset?.name ?? "your custom palette";
  return {
    ok: true,
    summary: `Theme applied: ${name} - the whole app repaints now and it survives reloads`,
    detail: `Persisted to the learner profile. The client received the validated tokens and repaints immediately. Tell the learner it is done in plain words; do not repeat hex codes at them.`,
    data: { tokens, preset: preset?.id ?? null },
  };
}

async function triageFlags(args: ToolArgs): Promise<ToolResult> {
  const { db } = await import("@/lib/db");
  const action = String(args.action ?? "list");
  if (action === "list") {
    const flags = await db.contentFlag.findMany({ where: { status: "open" }, orderBy: { id: "desc" }, take: 20 });
    if (flags.length === 0) return { ok: true, summary: "Flag queue is empty - nothing reported.", detail: "no open content flags" };
    return {
      ok: true,
      summary: `${flags.length} open content flag(s).`,
      detail: flags.map((f) => `#${f.id} [${f.kind}] card=${f.cardId || "(general)"}: ${f.note}`).join("\n").slice(0, 3000),
    };
  }
  if (action === "resolve") {
    const id = Number(args.id);
    const status = String(args.status ?? "fixed");
    if (!Number.isInteger(id) || id <= 0) return { ok: false, summary: "resolve needs a numeric flag id", detail: `got id=${String(args.id)}` };
    if (status !== "fixed" && status !== "wontfix") return { ok: false, summary: "status must be fixed or wontfix", detail: `got ${status}` };
    if (args._probe === true) {
      // Probe hygiene: resolve mutates the flag queue - probes get the verdict
      // path verified, the row untouched.
      return { ok: true, summary: `Probe dry-run: flag #${id} would be marked ${status} (nothing written).`, detail: "Real runs update the ContentFlag row." };
    }
    const existing = await db.contentFlag.findUnique({ where: { id } });
    if (!existing) return { ok: false, summary: `Flag #${id} does not exist`, detail: "unknown id" };
    await db.contentFlag.update({ where: { id }, data: { status } });
    return { ok: true, summary: `Flag #${id} marked ${status}.`, detail: `card=${existing.cardId} kind=${existing.kind} note=${existing.note.slice(0, 120)}` };
  }
  return { ok: false, summary: "action must be list or resolve", detail: `got ${action}` };
}

export { coachSkill, makePdf, setTheme, triageFlags };
