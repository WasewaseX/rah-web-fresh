// ---------- case record (Postgres persistence) ----------

import type { ToolArgs, ToolResult } from "../tools";

function caseKey(id: string): string {
  return `re:case:${id.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64)}`;
}

async function reCaseRecord(args: ToolArgs): Promise<ToolResult> {
  const { db } = await import("@/lib/db");
  const action = String(args.action ?? "save").trim().toLowerCase();

  if (action === "list") {
    const rows = await db.setting.findMany({ where: { key: { startsWith: "re:case:" } }, orderBy: { updatedAt: "desc" }, take: 25 });
    if (rows.length === 0) return { ok: true, summary: "No RE cases recorded yet.", detail: "none" };
    const lines = rows.map((r) => {
      try {
        const j = JSON.parse(r.value) as { title?: string; at?: string };
        return `${r.key} - ${j.title ?? "(untitled)"} (updated ${r.updatedAt.toISOString()})`;
      } catch {
        return `${r.key} - (unparsable payload)`;
      }
    });
    return { ok: true, summary: `${rows.length} RE case(s) on record.`, detail: lines.join("\n").slice(0, 2500) };
  }

  if (action === "get" || action === "delete") {
    const key = caseKey(String(args.case_id ?? ""));
    if (key === "re:case:") return { ok: false, summary: "case_id required for get/delete" };
    if (action === "delete" && args._probe === true) {
      // Probe hygiene: delete is a destructive write - a battery run must not
      // remove real case records any more than it may create them.
      return { ok: true, summary: `Probe dry-run: delete of ${key} suppressed (probes never write).`, detail: "Real runs delete the row in Postgres." };
    }
    const row = await db.setting.findUnique({ where: { key } });
    if (!row) return { ok: false, summary: `No case ${key}` };
    if (action === "delete") {
      await db.setting.delete({ where: { key } });
      return { ok: true, summary: `Deleted case ${key}.` };
    }
    return { ok: true, summary: `Case ${key} loaded.`, detail: row.value.slice(0, 3500) };
  }

  if (action === "save" && args._probe === true) {
    // Evidence hygiene: probes never write cases. The consent gate note above
    // (Task 111) applies to every DB-writing tool surface.
    return { ok: true, summary: "Probe dry-run: case save suppressed (probes never write).", detail: "Real runs persist to Postgres." };
  }

  if (action === "save") {
    const rawId = String(args.case_id ?? "").trim();
    if (!rawId) return { ok: false, summary: "save needs a case_id (e.g. sample-1124e79d)" };
    const key = caseKey(rawId);
    const title = String(args.title ?? rawId).slice(0, 200);
    const payload = {
      id: key,
      title,
      data: typeof args.data === "string" ? args.data.slice(0, 6000) : JSON.stringify(args.data ?? {}).slice(0, 6000),
      at: new Date().toISOString(),
    };
    await db.setting.upsert({
      where: { key },
      update: { value: JSON.stringify(payload) },
      create: { key, value: JSON.stringify(payload) },
    });
    return { ok: true, summary: `Case ${key} saved ("${title}").`, detail: `Persisted to Postgres. Use action=get with case_id=${key.slice(8)} to reload it later, or action=list to see all cases.` };
  }

  return { ok: false, summary: "action must be save | get | list | delete" };
}

export { reCaseRecord };
