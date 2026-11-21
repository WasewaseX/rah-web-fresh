// BYO MATERIALS (Stage 03 #1): the contract pins (honest 502 on short text,
// shared-budget queue integration, FSRS grading of mat cards, deletion
// without orphans) plus the CSV/TSV and .apkg import routes, suspend/pace,
// degraded honesty and the CEFR curriculum graph pins.
import { check, type Ctx } from "./harness";

export async function runMaterials(c: Ctx) {
  console.log("\n--- materials ---");
  const api = c.api;
  const UID = c.uid;
  {
    // Deterministic section: the AI extraction path is exercised by live E2E;
    // here we pin the CONTRACT - honest 502 on short text, the shared-budget
    // queue integration (mat cards first in the new pool), FSRS grading of
    // mat cards, and full deletion without orphans.
    const apiM = api;
    const short = await apiM("/api/materials", { method: "POST", body: JSON.stringify({ title: "too short", text: "Only a couple of words here." }) });
    check(short.status === 400 && typeof short.body?.error === "string", "materials: short text refused honestly (400, no fabricated cards)", JSON.stringify(short.body).slice(0, 100));

    const { PrismaClient: PC6 } = await import("@prisma/client");
    const prM = new PC6();
    // Fresh budget: earlier sections may have spent today's introductions.
    await prM.learner.update({ where: { id: "me" }, data: { newPerDay: 10 } });
    await prM.cardState.deleteMany({ where: { userId: UID, last: Math.floor(Date.now() / 86400000), reps: 1 } });

    const matId = `m_battery${Date.now()}`;
    const c1 = `mat:batt${Date.now()}a`;
    const c2 = `mat:batt${Date.now()}b`;
    const todayM = Math.floor(Date.now() / 86400000);
    await prM.material.create({
      data: {
        id: matId,
        userId: UID,
        title: "battery material",
        source: "battery",
        text: "The engineer decided to implement the proposal ahead of the deadline. She took the criticism on the chin and kept the momentum going.",
        words: 26,
      },
    });
    await prM.materialCard.create({ data: { id: c1, materialId: matId, front: "The engineer decided to ___ the proposal ahead of the deadline.", answer: "implement", context: "The engineer decided to implement the proposal ahead of the deadline.", note: "to put a plan into action" } });
    await prM.materialCard.create({ data: { id: c2, materialId: matId, front: "She took the ___ on the chin and kept going.", answer: "criticism", context: "She took the criticism on the chin and kept the momentum going.", note: "to accept blame without complaining" } });
    await prM.cardState.create({ data: { userId: UID, cardId: c1, due: todayM } });
    await prM.cardState.create({ data: { userId: UID, cardId: c2, due: todayM } });
    await prM.$disconnect();

    const q1 = await api("/api/review/queue");
    const batch1 = q1.body?.batch ?? [];
    check(q1.status === 200 && batch1.length > 0, "materials: queue serves after import", `len=${batch1.length}`);
    const matEntry = batch1.find((e: { card?: { unit?: string; kind?: string; prompt?: string } }) => e.card?.unit === "material");
    check(
      !!matEntry && matEntry.card?.kind === "mat" && String(matEntry.card?.prompt ?? "").includes("___"),
      "materials: BYO card is in the batch, kind mat, cloze prompt",
      JSON.stringify(matEntry?.card ?? batch1[0]?.card ?? {}).slice(0, 120),
    );
    check(
      typeof matEntry?.state?.due === "number" && matEntry.state.state === "new",
      "materials: mat card state enters FSRS as new, due today",
      JSON.stringify(matEntry?.state ?? {}),
    );
    // badge truth: newLeft counts mat cards (deckUnseen + matNew, budget-capped)
    const cnts = q1.body?.counts ?? {};
    check(
      typeof cnts.newLeft === "number" && cnts.newLeft >= 2,
      "materials: badge newLeft includes mat cards",
      JSON.stringify(cnts).slice(0, 120),
    );
    // grade one mat card through the SAME FSRS route
    const gr = await api("/api/review/grade", { method: "POST", body: JSON.stringify({ cardId: c1, grade: 3, dir: "cloze" }) });
    check(gr.status === 200 && typeof gr.body?.ivl === "number" && gr.body.ivl >= 1, "materials: mat card grades through the normal FSRS route", JSON.stringify(gr.body).slice(0, 100));
    // detail + inspect-the-source surface
    const det = await api(`/api/materials?id=${matId}`);
    check(
      det.status === 200 && det.body?.cards?.length === 2 && det.body.cards.every((cd: { context: string; answer: string }) => cd.context.toLowerCase().includes(cd.answer.toLowerCase())),
      "materials: detail view carries source context for every card",
      JSON.stringify(det.body?.cards?.[0] ?? {}).slice(0, 120),
    );
    // deletion removes cards AND their schedule state
    const del = await api(`/api/materials?id=${matId}`, { method: "DELETE" });
    check(del.status === 200 && del.body?.removed === 2, "materials: deletion reports removed cards", JSON.stringify(del.body));
    const { db: dbM } = await import("@/lib/db");
    const orphanStates = await dbM.cardState.count({ where: { cardId: { in: [c1, c2] } } });
    check(orphanStates === 0, "materials: no orphan CardState rows after deletion", String(orphanStates));
    await dbM.$disconnect();

    await csvImport(c);
    await apkgImport(c);
    await suspendPace(c);
    await degradedHonesty(c);
    await curriculumPins(c);
  }
}

// --- CSV/TSV deck import (feature #4) ---
async function csvImport(c: Ctx) {
  console.log("\n--- csv import ---");
  const api = c.api;
  {
    const { parseDeckCsv } = await import("@/lib/csv-cards");
    const tsv = "#separator:tab\n#html:false\ndog\tperro\nthe implementation___\tto put a plan into action\nheavy rain\tstrong rainfall\n\ndog\tperro again\norphan-row";
    const pr = parseDeckCsv(tsv);
    check(pr.cards.length === 3 && pr.skipped === 2, "csv: parses 3 rows, skips header+empty+dup+incomplete", JSON.stringify(pr.cards.length));
    check(pr.cards[0].front === "dog" && pr.cards[0].answer === "perro", "csv: plain front-back row", JSON.stringify(pr.cards[0]));
    check(pr.cards[1].front.includes("___") && pr.cards[1].answer === "to put a plan into action", "csv: pre-blanked cloze row passes through", JSON.stringify(pr.cards[1]));
    check(pr.cards[2].front === "heavy rain" && pr.cards[2].answer === "strong rainfall", "csv: tab separation", JSON.stringify(pr.cards[2]));
    const comma = parseDeckCsv('a b c,"x, y"\n"say ""hi""","greet"');
    check(comma.separator === "comma" && comma.cards.length === 2 && comma.cards[0].answer === "x, y" && comma.cards[1].front === 'say "hi"', "csv: quoted comma cells survive", JSON.stringify(comma.cards));
    // route: import -> queue has an fb card -> delete clean
    const imp = await api("/api/materials", { method: "POST", body: JSON.stringify({ title: "battery csv", mode: "csv", text: tsv }) });
    check(imp.status === 200 && imp.body?.created === 3, "csv: import route creates 3 cards", JSON.stringify(imp.body).slice(0, 120));
    const q2 = await api("/api/review/queue");
    const fbEntry = (q2.body?.batch ?? []).find((e: { card?: { unit?: string; prompt?: string } }) => e.card?.unit === "material" && e.card?.prompt === "heavy rain");
    check(!!fbEntry, "csv: front-back card reachable in the queue", JSON.stringify((q2.body?.batch ?? []).slice(0, 1)).slice(0, 100));
    const del2 = await api(`/api/materials?id=${imp.body.materialId}`, { method: "DELETE" });
    check(del2.status === 200 && del2.body?.removed === 3, "csv: deletion removes all imported cards", JSON.stringify(del2.body));
    const empty = await api("/api/materials", { method: "POST", body: JSON.stringify({ title: "x", mode: "csv", text: "# only a header" }) });
    check(empty.status === 400, "csv: header-only import refused honestly", JSON.stringify(empty.body).slice(0, 100));
  }
}

// --- Anki .apkg import (feature #4 v2) ---
async function apkgImport(c: Ctx) {
  console.log("\n--- apkg import ---");
  const api = c.api;
  {
    // Build a REAL Anki collection in-memory with bun:sqlite, wrap it in a
    // stored-entry ZIP via the lib's own writer - a byte-true .apkg fixture.
    const { buildZip } = await import("@/lib/apkg");
    const { Database } = await import("bun:sqlite");
    const { mkdtemp, readFile, rm } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dir = await mkdtemp(join(tmpdir(), "battery-apkg-"));
    const dbPath = join(dir, "collection.anki2");
    const sq = new Database(dbPath);
    sq.run("CREATE TABLE notes (id INTEGER PRIMARY KEY, flds TEXT)");
    const ins = sq.query("INSERT INTO notes (flds) VALUES (?)");
    ins.run("What is the capital of France?\x1fParis");
    ins.run("to <b>implement</b>\x1fto put a plan into action [sound:na.mp3]");
    ins.run("{{c1::implement}} the plan\x1f"); // cloze: front blanked, back = the answer
    ins.run("only one field"); // no back -> skipped
    ins.run("dup\x1fone"); // valid: the FIRST dup row is a real card
    ins.run("dup\x1ftwo"); // duplicate front -> skipped
    sq.close();
    const coll = new Uint8Array(await readFile(dbPath));
    const zipBytes = buildZip([
      { name: "collection.anki2", data: coll },
      { name: "media", data: new TextEncoder().encode("{}") },
    ]);
    const b64 = Buffer.from(zipBytes).toString("base64");
    const enc = new TextEncoder();

    const imp = await api("/api/materials", { method: "POST", body: JSON.stringify({ title: "battery apkg", mode: "apkg", dataB64: b64 }) });
    check(imp.status === 200 && imp.body?.created === 4, "apkg: import creates 4 cards (plain, html, cloze, first-dup)", JSON.stringify(imp.body).slice(0, 140));
    check(String(imp.body?.reason ?? "").includes("2 note(s) skipped"), "apkg: skipped count is honest (1-field + duplicate)", JSON.stringify(imp.body?.reason));
    check(String(imp.body?.reason ?? "").includes("media ref"), "apkg: media refs are counted and reported, not silently dropped", JSON.stringify(imp.body?.reason));

    const detail = await api(`/api/materials?id=${imp.body.materialId}`);
    const cards = detail.body?.cards ?? [];
    const plain = cards.find((cd: { front: string }) => cd.front === "What is the capital of France?");
    const htmlCard = cards.find((cd: { front: string }) => cd.front === "to implement");
    const cloze = cards.find((cd: { front: string }) => String(cd.front).includes("___"));
    check(!!plain && plain.answer === "Paris", "apkg: plain front/back survives", JSON.stringify(plain));
    check(!!htmlCard && htmlCard.answer === "to put a plan into action" && !htmlCard.front.includes("<b>"), "apkg: HTML stripped from the face", JSON.stringify(htmlCard));
    check(!!cloze && cloze.front === "___ the plan" && cloze.answer === "implement", "apkg: cloze note becomes a blanked card", JSON.stringify(cloze));
    const qA = await api("/api/review/queue");
    const apkgEntry = (qA.body?.batch ?? []).find((e: { card?: { unit?: string; prompt?: string } }) => e.card?.unit === "material" && e.card?.prompt === "What is the capital of France?");
    check(!!apkgEntry, "apkg: imported card is reachable in the review queue");
    const delA = await api(`/api/materials?id=${imp.body.materialId}`, { method: "DELETE" });
    check(delA.status === 200 && delA.body?.removed === 4, "apkg: deletion removes all imported cards", JSON.stringify(delA.body));

    const garbage = await api("/api/materials", { method: "POST", body: JSON.stringify({ title: "x", mode: "apkg", dataB64: Buffer.from("not a zip at all").toString("base64") }) });
    check(garbage.status === 400 && String(garbage.body?.error ?? "").includes("not a valid .apkg"), "apkg: garbage bytes refused honestly", JSON.stringify(garbage.body).slice(0, 100));
    const noColl = await api("/api/materials", { method: "POST", body: JSON.stringify({ title: "x", mode: "apkg", dataB64: Buffer.from(buildZip([{ name: "readme.txt", data: enc.encode("hi") }])).toString("base64") }) });
    check(noColl.status === 400 && String(noColl.body?.error ?? "").includes("No Anki collection"), "apkg: zip without a collection refused honestly", JSON.stringify(noColl.body).slice(0, 100));
    const missing = await api("/api/materials", { method: "POST", body: JSON.stringify({ title: "x", mode: "apkg" }) });
    check(missing.status === 400, "apkg: missing file data refused", JSON.stringify(missing.body).slice(0, 80));
    await rm(dir, { recursive: true, force: true });
  }
}

// --- suspend + daily pace (polish #1 completion) ---
async function suspendPace(c: Ctx) {
  console.log("\n--- suspend + pace ---");
  const api = c.api;
  const UID = c.uid;
  {
    const { PrismaClient: PC7 } = await import("@prisma/client");
    const prS = new PC7();
    const todayS = Math.floor(Date.now() / 86400000);
    const sid = "col001";
    await prS.cardState.upsert({
      where: { userId_cardId: { userId: UID, cardId: sid } },
      create: { userId: UID, cardId: sid, s: 2, d: 5, due: todayS, last: todayS - 2, lapses: 0, reps: 2, state: "review", lastivl: 2 },
      update: { suspended: false, due: todayS, state: "review" },
    });
    await prS.$disconnect();
    const qA = await api("/api/review/queue");
    const inA = (qA.body?.batch ?? []).some((e: { card?: { id?: string } }) => e.card?.id === sid);
    check(inA, "pace: seeded due card is in the queue", JSON.stringify(qA.body?.batch?.slice(0, 1)?.[0]?.card?.id));
    const sup = await api("/api/review/suspend", { method: "POST", body: JSON.stringify({ cardId: sid, suspended: true }) });
    check(sup.status === 200 && sup.body?.suspended === true, "suspend: route accepts", JSON.stringify(sup.body));
    const qB = await api("/api/review/queue");
    const inB = (qB.body?.batch ?? []).some((e: { card?: { id?: string } }) => e.card?.id === sid);
    check(!inB, "suspend: suspended card leaves the queue", String(inB));
    const uns = await api("/api/review/suspend", { method: "POST", body: JSON.stringify({ cardId: sid, suspended: false }) });
    check(uns.status === 200 && uns.body?.suspended === false, "unsuspend: route accepts", JSON.stringify(uns.body));
    const qC = await api("/api/review/queue");
    const inC = (qC.body?.batch ?? []).some((e: { card?: { id?: string } }) => e.card?.id === sid);
    check(inC, "unsuspend: card returns with its schedule intact", String(inC));
    // daily pace clamp + queueCounts inheritance
    const hi = await api("/api/settings", { method: "POST", body: JSON.stringify({ newPerDay: 999 }) });
    check(hi.status === 200 && hi.body?.newPerDay === 30 && hi.body?.clamped === true, "pace: 999 clamps to 30", JSON.stringify(hi.body));
    const stHi = await api("/api/review/queue");
    check(stHi.body?.counts?.newPerDay === 30, "pace: queueCounts reads the new budget", String(stHi.body?.counts?.newPerDay));
    const lo = await api("/api/settings", { method: "POST", body: JSON.stringify({ newPerDay: 0 }) });
    check(lo.status === 200 && lo.body?.newPerDay === 3 && lo.body?.clamped === true, "pace: 0 clamps to 3", JSON.stringify(lo.body));
    const bad = await api("/api/settings", { method: "POST", body: JSON.stringify({ newPerDay: "banana" }) });
    check(bad.status === 400, "pace: non-numeric refused", JSON.stringify(bad.body));
    const mid = await api("/api/settings", { method: "POST", body: JSON.stringify({ newPerDay: 10 }) });
    check(mid.status === 200 && mid.body?.newPerDay === 10 && mid.body?.clamped === false, "pace: 10 stays 10, no clamp flag", JSON.stringify(mid.body));
  }
}

// --- degraded honesty (audit P1-7 close-out) ---
async function degradedHonesty(c: Ctx) {
  console.log("\n--- degraded honesty ---");
  const api = c.api;
  {
    const { fallbackBrief, DEGRADED_CONVERSATION_LINE, degradedTurnPayload } = await import("@/lib/degraded");
    // engine-plan wording: the AI Director only ever re-voices the engine,
    // so the offline fallback must carry the engine's REAL moves.
    const fb = fallbackBrief(["Clear 12 due cards (biggest leak: articles)", "Write one paragraph in Writing (weak: organization)", "Run a Speak round (delivery dipped)"], "drill");
    check(fb.degraded === true && typeof fb.degradedNotice === "string" && fb.degradedNotice.includes("unreachable"), "degraded: fallback brief is labeled with an honest notice", JSON.stringify(fb.degradedNotice).slice(0, 100));
    check(fb.priority.includes("Clear 12 due cards"), "degraded: priority comes from the engine's #1 move, not invented", fb.priority);
    check(fb.plan.length === 3 && fb.plan[0].includes("Clear 12 due cards") && fb.plan[1].includes("Writing"), "degraded: 3 plan items follow the engine plan", JSON.stringify(fb.plan));
    check(fb.pep.length > 0 && !fb.pep.includes("\u2014"), "degraded: persona pep present, no em dash", fb.pep);
    const fbBare = fallbackBrief([], "zen");
    check(fbBare.plan.length === 3 && fbBare.plan.every((s: string) => s.length > 0) && fbBare.degraded === true, "degraded: empty engine plan still yields 3 honest default moves", JSON.stringify(fbBare.plan));
    const fbWeird = fallbackBrief(["Just one move (only reason)"], undefined);
    check(fbWeird.plan.length === 3 && !fbWeird.plan.some((s: string) => s.includes("(")), "degraded: single move padded to 3, parenthetical reasons stripped", JSON.stringify(fbWeird.plan));
    // conversation placeholder: speakable, in-scene, honest
    check(DEGRADED_CONVERSATION_LINE.length > 10 && !DEGRADED_CONVERSATION_LINE.includes("\u2014"), "degraded: conversation placeholder line is speakable, no em dash", DEGRADED_CONVERSATION_LINE);
    const dp = degradedTurnPayload();
    check(dp.degraded === true && dp.degradedNotice.includes("placeholder") && dp.degradedNotice.includes("honest"), "degraded: conversation payload carries the honest banner text", JSON.stringify(dp.degradedNotice).slice(0, 100));
    // route: briefing always answers with the degraded flag present (the
    // outage path itself is provider-dependent; the CONTRACT is pinned here)
    const br = await api("/api/coach/briefing");
    check(br.status === 200 && typeof br.body?.brief?.priority === "string" && typeof br.body?.degraded === "boolean", "degraded: briefing route answers with brief + degraded flag", JSON.stringify(br.body).slice(0, 120));
    check(Array.isArray(br.body?.brief?.plan) && br.body.brief.plan.length === 3, "degraded: briefing plan is exactly 3 moves", JSON.stringify(br.body?.brief?.plan).slice(0, 100));
    if (br.body?.degraded === true) {
      check(typeof br.body.brief.degradedNotice === "string" && br.body.brief.degradedNotice.length > 20, "degraded: cached degraded brief carries its notice into the response", JSON.stringify(br.body?.brief?.degradedNotice ?? "").slice(0, 100));
    }
  }
}

// --- CEFR curriculum graph (feature #2) ---
async function curriculumPins(c: Ctx) {
  console.log("\n--- curriculum ---");
  const api = c.api;
  {
    const { computeCurriculum, CURRICULUM } = await import("@/lib/curriculum");
    check(CURRICULUM.length >= 16 && CURRICULUM.some((n: { band: string }) => n.band === "B2") && CURRICULUM.some((n: { band: string }) => n.band === "B2+") && CURRICULUM.some((n: { band: string }) => n.band === "C1"), "curriculum: graph spans B2/B2+/C1 with a real node count", String(CURRICULUM.length));

    // Gate honesty: 2/2 lucky answers are NOT mastery (Wilson bound).
    const lucky = computeCurriculum([{ tag: "articles", ok: 2, no: 0, ewma: 1 }], []);
    const luckyNode = lucky.nodes.find((n) => n.node.id === "b2_articles")!;
    check(luckyNode.status === "in_progress" && luckyNode.gateMet === false, "curriculum: 2/2 correct is NOT mastery (in_progress, gate unmet)", JSON.stringify(luckyNode.status));
    check(luckyNode.evidence[0].detail.includes("34%"), "curriculum: Wilson bound honestly caps 2/2 at ~34%", luckyNode.evidence[0].detail);

    // Proven gate: 10/10 crosses Wilson 0.7 over 8+ samples.
    const proven = computeCurriculum([{ tag: "articles", ok: 10, no: 0, ewma: 1 }], []);
    const provenNode = proven.nodes.find((n) => n.node.id === "b2_articles")!;
    check(provenNode.status === "mastered" && provenNode.evidence[0].proven === true, "curriculum: 10/10 proves the articles gate", JSON.stringify(provenNode.status));

    // Weak record never proves: 6/4 over 10 samples = 60% raw, Wilson < 0.7.
    const shaky = computeCurriculum([{ tag: "articles", ok: 6, no: 4, ewma: 0.6 }], []);
    check(shaky.nodes.find((n) => n.node.id === "b2_articles")!.status !== "mastered", "curriculum: a 60% record never passes the 70% proven gate", "ok=6 no=4");

    // Prerequisites: collocations requires sentence_shape (adjectives+word_choice).
    const mid = computeCurriculum([{ tag: "word_choice", ok: 9, no: 1, ewma: 0.9 }, { tag: "adjectives", ok: 9, no: 1, ewma: 0.9 }], []);
    const colloc = mid.nodes.find((n) => n.node.id === "b2p_collocations")!;
    check(colloc.status === "locked" && colloc.blockers.includes("Sentence shape"), "curriculum: unproven prerequisite locks the downstream node", JSON.stringify(colloc.blockers));
    const full = computeCurriculum(
      ["articles", "countability", "plurals", "copula", "statives", "prepositions", "perfect", "question_order", "that_omission", "adjectives", "word_choice", "th_sounds", "w_v", "clusters", "ng", "stress"].map((tag) => ({ tag, ok: 10, no: 0, ewma: 1 })),
      [],
    );
    const collocOpen = full.nodes.find((n) => n.node.id === "b2p_collocations")!;
    check(collocOpen.status !== "locked", "curriculum: proven prerequisites open the B2+ node", JSON.stringify(collocOpen.status));
    // The frontier moved into B2+ once the whole B2 row is proven.
    check(full.summary.frontier?.node.band === "B2+", "curriculum: frontier climbs to B2+ when B2 gates prove", String(full.summary.frontier?.node.band));
    // Skill gate: 0.8 over 5 samples proves; 0.8 over 2 does not.
    const withSkill = computeCurriculum(
      ["articles", "countability", "plurals", "copula", "statives", "prepositions", "perfect", "question_order", "that_omission", "adjectives", "word_choice", "register"].map((tag) => ({ tag, ok: 10, no: 0, ewma: 1 })),
      [{ skill: "writing", score: 0.8, samples: 2 }],
    );
    const reg = withSkill.nodes.find((n) => n.node.id === "b2p_register")!;
    check(reg.status !== "mastered" && reg.evidence.some((e) => e.detail.includes("2 sample")), "curriculum: skill gate needs 5+ measured samples, 2 is not proof", JSON.stringify(reg.evidence.map((e) => e.detail)));

    // Empty ledger: B2 nodes open, C1 locked, frontier = the first B2 node.
    const fresh = computeCurriculum([], []);
    check(fresh.nodes.filter((n) => n.node.band === "B2").every((n) => n.status === "available"), "curriculum: fresh learner sees open B2 gates", JSON.stringify(fresh.nodes.filter((n) => n.node.band === "B2").map((n) => n.status)));
    check(fresh.nodes.filter((n) => n.node.band === "C1").every((n) => n.status === "locked"), "curriculum: C1 is locked for a fresh learner", "C1 locked");
    check(fresh.summary.frontier?.node.id === "b2_articles" && fresh.summary.line.includes("Next gate"), "curriculum: frontier starts at the first B2 node with an honest line", fresh.summary.line);

    // Route: the live graph answers from the real ledger.
    const cur = await api("/api/curriculum");
    check(cur.status === 200 && Array.isArray(cur.body?.nodes) && cur.body.nodes.length === CURRICULUM.length, "curriculum: route serves the full graph", `nodes=${cur.body?.nodes?.length}`);
    const valid = ["locked", "available", "in_progress", "mastered"];
    check(cur.body?.nodes?.every((n: { status: string }) => valid.includes(n.status)), "curriculum: every node status is valid", JSON.stringify([...new Set((cur.body?.nodes ?? []).map((n: { status: string }) => n.status))]));
    check(typeof cur.body?.summary?.mastered === "number" && typeof cur.body?.summary?.line === "string", "curriculum: summary counts + line present", JSON.stringify(cur.body?.summary?.line ?? "").slice(0, 80));
    // The unlock action rides the state the coach reads.
    const st = await api("/api/state");
    const hasShape = (st.body?.nextBest ?? []).every((a: { action: string }) => ["review", "drill", "test", "teach", "unlock"].includes(a.action));
    check(st.status === 200 && hasShape, "curriculum: state nextBest actions carry the unlock kind when present", JSON.stringify((st.body?.nextBest ?? []).map((a: { action: string }) => a.action)));
  }
}
