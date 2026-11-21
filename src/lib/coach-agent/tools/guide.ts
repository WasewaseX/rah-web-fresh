// ---------- study_guide: the embedded B1-C1 guide map (Task 130) ----------

import type { ToolArgs, ToolResult } from "./types";

async function studyGuide(args: ToolArgs): Promise<ToolResult> {
  const { GUIDE_LEVELS, guideSection, GUIDE_META, CHECKLIST_LEGEND } = await import("@/lib/b1c1-guide");
  const level = String(args.level ?? "").trim().toUpperCase();
  const section = String(args.section ?? "all").trim().toLowerCase();
  if (!GUIDE_LEVELS.some((s) => s.level === level)) {
    return { ok: false, summary: "level must be B1, B2 or C1", detail: `got level=${level || "(empty)"}; valid: B1, B2, C1` };
  }
  const sec = guideSection(level as "B1" | "B2" | "C1");
  const want = (s: string) => section === "all" || section === s;
  const lines: string[] = [
    `${GUIDE_META.title} (${GUIDE_META.author}, ${GUIDE_META.pages} pages) - ${sec.level} section:`,
  ];
  if (want("grammar")) {
    lines.push("", `GRAMMAR (book pages ${sec.grammar[0].page}-${sec.grammar[sec.grammar.length - 1].page}):`);
    for (const t of sec.grammar) lines.push(`- ${t.title} (p.${t.page}): ${t.hint}`);
  }
  if (want("vocabulary")) {
    lines.push("", `VOCABULARY (book pages ${sec.vocabulary[0].page}-${sec.vocabulary[sec.vocabulary.length - 1].page}):`);
    for (const t of sec.vocabulary) lines.push(`- ${t.title} (p.${t.page}): ${t.hint}`);
  }
  if (want("pronunciation")) lines.push("", `PRONUNCIATION (book pages ${sec.pronunciation.pages}): ${sec.pronunciation.note}`);
  if (want("checklist")) {
    lines.push("", `CHECKLIST (book pages ${sec.checklist.pages}, ${sec.checklist.source}): ${sec.checklist.note}`, `Rating: ${CHECKLIST_LEGEND.join(" | ")}`);
    sec.checklist.items.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
  }
  if (want("study_plan")) {
    lines.push("", `STUDY PLAN (book pages ${sec.studyPlan.pages}): ${sec.studyPlan.note}`);
    if (section === "study_plan") {
      const { studyPlan12Week } = await import("@/lib/b1c1-guide");
      for (const w of studyPlan12Week(sec.level)) {
        lines.push(`Week ${w.week} [${w.phase}] grammar: ${w.grammar || "-"} | vocabulary: ${w.vocabulary || "-"} | ${w.action}`);
      }
      lines.push("(weeks 1-12 are the app's derivation of the book's 3-month method; the book's printed plan pages are not in the public extract)");
    }
  }
  if (section === "all") {
    lines.push("", `OVERVIEW (p.${sec.overview.page}): ${sec.overview.text}`);
    const curriculumFeed = [...sec.grammar, ...sec.vocabulary].filter((t) => t.node);
    if (curriculumFeed.length > 0) {
      lines.push(`Your app curriculum gates these topics: ${curriculumFeed.map((t) => `${t.title} -> ${t.node}`).join("; ")}.`);
    }
  }
  const detail = lines.join("\n");
  // Probe hygiene: a probe may pass _probe - the tool is a pure read, so the
  // response is identical either way (no db, no writes, no network).
  return {
    ok: true,
    summary: `${sec.level} guide: ${sec.grammar.length} grammar + ${sec.vocabulary.length} vocabulary topics, checklist ${sec.checklist.source}, ${sec.studyPlan.months}-month plan${section !== "all" ? ` (${section})` : ""}`,
    detail: detail.slice(0, 4000),
  };
}

export { studyGuide };
