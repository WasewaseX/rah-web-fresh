// B1-C1 guide battery (Task 130). Run:
//   export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | cut -d= -f2-)" && bun scripts/b1c1-guide-test.ts
// Pins the embedded guide map (English with Lucy, The Ultimate Guide to B1 B2
// C1 Grammar & Vocabulary): structure counts, page sanity, checklist
// provenance, curriculum cross-links, prompt memory, study_guide tool.
import { GUIDE_META, GUIDE_LEVELS, CHECKLIST_LEGEND, guideAllTopics, guideSection, guideMapForPrompt, guideTopicsForNode, guideMemoryBody, studyPlan12Week, checklistReadiness } from "../src/lib/b1c1-guide";
import { CURRICULUM } from "../src/lib/curriculum";
import { toolByName, TOOL_TIERS } from "../src/lib/coach-agent/tools";
import { tutorSystem } from "../src/lib/prompts";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name} ${extra}`);
  }
}

async function main() {
  // ---------- book structure: counts match the printed TOC ----------
  console.log("-- structure");
  check("meta: 92 pages, 2023, author named", GUIDE_META.pages === 92 && GUIDE_META.year === 2023 && GUIDE_META.author.includes("Lucy"));
  check("three levels B1 B2 C1", GUIDE_LEVELS.map((s) => s.level).join(",") === "B1,B2,C1");
  const counts = GUIDE_LEVELS.map((s) => `${s.grammar.length}/${s.vocabulary.length}`).join(" ");
  check("grammar/vocab counts 12/10 14/10 12/10", counts === "12/10 14/10 12/10", counts);
  check("38 grammar + 30 vocabulary topics total", guideAllTopics().length === 68);

  // ---------- pages: every topic page inside the book, sections ordered ----------
  console.log("-- pages");
  let pagesOk = true;
  let orderOk = true;
  for (const s of GUIDE_LEVELS) {
    for (const t of [...s.grammar, ...s.vocabulary]) {
      if (!Number.isInteger(t.page) || t.page < 6 || t.page > 92) pagesOk = false;
    }
    const seq = [...s.grammar, ...s.vocabulary].map((t) => t.page);
    if (seq.some((p, i) => i > 0 && p < seq[i - 1])) orderOk = false; // TOC order is monotonic
  }
  check("all topic pages within 6..92", pagesOk);
  check("topic pages non-decreasing per level (TOC order)", orderOk);
  check("B2 pronunciation page 54 with typo note", GUIDE_LEVELS[1].pronunciation.pages === "54" && GUIDE_LEVELS[1].pronunciation.note.includes("typo"));

  // ---------- checklists: provenance labels are honest ----------
  console.log("-- checklists");
  const b1 = guideSection("B1");
  const b2 = guideSection("B2");
  const c1 = guideSection("C1");
  check("B2 checklist verbatim, 10 items", b2.checklist.source === "verbatim" && b2.checklist.items.length === 10);
  check("C1 checklist verbatim, 10 items", c1.checklist.source === "verbatim" && c1.checklist.items.length === 10);
  check("B1 checklist labeled derived (honest provenance)", b1.checklist.source === "derived" && b1.checklist.items.length === 10);
  check("verbatim checklists quote real book strings", b2.checklist.items[0].includes("doomscroll") && c1.checklist.items[4].includes("Rarely have I seen"));
  check("rating legend is the book's 3 boxes", CHECKLIST_LEGEND.length === 3 && CHECKLIST_LEGEND[2] === "It is difficult for me.");
  check("study plans: 3 months each", GUIDE_LEVELS.every((s) => s.studyPlan.months === 3));

  // ---------- topic ids + curriculum cross-links ----------
  console.log("-- cross-links");
  const ids = guideAllTopics().map((t) => t.id);
  check("topic ids unique", new Set(ids).size === ids.length);
  const nodeIds = new Set(CURRICULUM.map((n) => n.id));
  const linked = guideAllTopics().filter((t) => t.node);
  check("every t.node points at a real curriculum node", linked.every((t) => nodeIds.has(t.node!)), linked.filter((t) => !nodeIds.has(t.node!)).map((t) => t.id).join(","));
  const tags = new Set(CURRICULUM.flatMap((n) => n.tags));
  check("topic tags reference real trap-tag vocabulary", guideAllTopics().flatMap((t) => t.tags).every((tag) => tags.has(tag)));
  check("guideTopicsForNode(b2p_hedging) = hedging & boosting", guideTopicsForNode("b2p_hedging").some((t) => t.id === "c1.hedging_boosting"));
  check("guideTopicsForNode(b2_prepositions) = prepositions", guideTopicsForNode("b2_prepositions").some((t) => t.id === "b1.prepositions"));

  // ---------- AI memory: the map is in both prompt surfaces ----------
  console.log("-- ai memory");
  const map = guideMapForPrompt();
  const tsys = tutorSystem({});
  check("prompt map covers all three levels", map.includes("B1 grammar:") && map.includes("B2 grammar:") && map.includes("C1 grammar:"));
  check("tutor rule 14 present", tsys.includes("14. Level contents follow the embedded B1-C1 guide map"));
  check("tutor memory: cleft sentences pinned to B2", tsys.includes("cleft sentences, the causative and mixed conditionals are B2 material"));
  check("tutor memory: negative inversion pinned to C1", tsys.includes("negative inversion, get-passives, hedging and boosting are C1 material"));
  check("no em dash anywhere in the tutor system prompt", !tsys.includes("\u2014"));
  const loop = await import("../src/lib/coach-agent/loop");
  check("loop rule 1 mandates study_guide", typeof loop.systemPrompt === "function" ? loop.systemPrompt().includes("REQUIRES study_guide") : false);
  check("capability line includes level mapping", typeof loop.systemPrompt === "function" ? loop.systemPrompt().includes("map exactly what B1, B2 or C1 demands") : false);

  // ---------- study_guide tool ----------
  console.log("-- study_guide tool");
  const tool = toolByName("study_guide");
  check("tool registered", Boolean(tool));
  check("tier is read (pure data, no db)", tool ? TOOL_TIERS[tool.name] === "read" : false);
  const bad = await tool!.run({ level: "A2" });
  check("unknown level refused", bad.ok === false && (bad.detail ?? "").includes("valid: B1, B2, C1"));
  const all = await tool!.run({ level: "B2" });
  check("B2 all-sections: summary counts", all.ok === true && all.summary.includes("14 grammar + 10 vocabulary") && all.summary.includes("3-month"));
  check("B2 detail: verbatim checklist present", (all.detail ?? "").includes("doomscroll") && (all.detail ?? "").includes("Cleft Sentences"));
  const gram = await tool!.run({ level: "C1", section: "grammar" });
  check("C1 grammar section only", gram.ok === true && (gram.detail ?? "").includes("Negative Inversion") && !(gram.detail ?? "").includes("Freelancing"));
  const chk = await tool!.run({ level: "B1", section: "checklist" });
  check("B1 checklist section with derived label", chk.ok === true && (chk.detail ?? "").includes("derived") && (chk.detail ?? "").includes("present perfect"));
  check("detail respects the 4000-char loop cap", (all.detail ?? "").length <= 4000 && (gram.detail ?? "").length <= 4000);

  // ---------- Task 131: the map is activated ----------
  console.log("-- task 131: activated map");
  const body = guideMemoryBody();
  check("memory body carries the shared map", body.includes("B1 grammar:") && body.includes("C1 grammar:") && body.includes("negative inversion, get-passives, hedging and boosting are C1 material"));
  const aiTwin = (await import("../src/lib/ai")).tutorSystem({ level: "B2", streak: 0, focus: "grammar", due: 0, recentTraps: [], weakSkills: [], mistakes: [], mistakesHealed: 0 });
  check("ai.ts twin embeds the same map (no drift)", aiTwin.includes("The Ultimate Guide to B1 B2 C1") && aiTwin.includes("negative inversion, get-passives, hedging and boosting are C1 material"));
  check("ai.ts twin is em-dash free", !aiTwin.includes("\u2014"));
  const plan = studyPlan12Week("B2");
  check("12-week plan: 12 weeks, 4 phases", plan.length === 12 && new Set(plan.map((w) => w.phase)).size === 4);
  const titles = new Set(guideAllTopics().map((t) => t.title));
  const cited = plan.flatMap((w) => [...w.grammar.split(" + "), ...w.vocabulary.split(" + ")]).filter((c) => c.length > 0);
  check("plan cites only real book topics", cited.every((c) => titles.has(c)), cited.filter((c) => !titles.has(c)).join(" | "));
  check("every level has a 12-week plan", (["B1", "B2", "C1"] as const).every((l) => studyPlan12Week(l).length === 12));
  const sp = await toolByName("study_guide")!.run({ level: "C1", section: "study_plan" });
  check("study_guide study_plan: 12 weeks + derived label", sp.ok === true && (sp.detail ?? "").includes("Week 12") && (sp.detail ?? "").includes("app's derivation"));
  const rPerfect = checklistReadiness("B2", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const rHard = checklistReadiness("B2", [0, 0, 0, 0, 0, 2, 2, 2, 2, 2]);
  const rTrack = checklistReadiness("B2", [0, 0, 0, 0, 0, 0, 0, 1, 1, 1]);
  const rPartial = checklistReadiness("B2", [0, 0, 0, 0, 0, 0, 0]);
  check("readiness: perfect score claims the level", rPerfect.verdict.includes("claim B2"));
  check("readiness: half hard is not yet", rHard.verdict.includes("not yet"));
  check("readiness: 7 easy on track", rTrack.verdict.includes("on track"));
  check("readiness: partial ratings withhold the verdict", rPartial.verdict.includes("unlocks when all 10"));
  const { POST: gPost } = await import("../src/app/api/guide-checklist/route");
  const badRes = await gPost(new Request("http://localhost/api/guide-checklist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ level: "A2", ratings: [] }) }));
  check("checklist api rejects unknown level", badRes.status === 400);
  const lenRes = await gPost(new Request("http://localhost/api/guide-checklist", { method: "POST", headers: { "x-rah-probe": "1", "content-type": "application/json" }, body: JSON.stringify({ level: "B1", ratings: [0, 0] }) }));
  check("checklist api rejects wrong rating count", lenRes.status === 400);
  const dryRes = await gPost(new Request("http://localhost/api/guide-checklist", { method: "POST", headers: { "x-rah-probe": "1", "content-type": "application/json" }, body: JSON.stringify({ level: "B2", ratings: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }) }));
  check("probe POST is a dry run", dryRes.headers.get("x-rah-probe-dry") === "1");
  const dryJson = (await dryRes.json()) as { readiness?: { easy?: number } };
  check("probe POST computes readiness without writing", dryJson?.readiness?.easy === 10);

  console.log(`\nb1c1-guide: ${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error("battery crashed:", e);
    process.exit(1);
  });
