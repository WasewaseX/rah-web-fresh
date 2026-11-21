// The speak family: analytics + outcomes (REA wave 2), the spoken
// conversation surface (6d) and the read-aloud assess tier gates (Task 64).
import { check, type Ctx } from "./harness";

// ================= 6b. REA WAVE 2 (the 7.4/10 review routes) =================
export async function speakAnalytics(c: Ctx) {
  console.log("\n--- REA wave 2: speak analytics + outcomes ---");
  const api = c.api;
  const noCookie = c.noCookie;
  const UID = c.uid;
  const { dayIndex } = await import("@/lib/fsrs");
  const { PrismaClient: PC2 } = await import("@prisma/client");
  const pr2 = new PC2();
  const speakDel = await pr2.speakSession.deleteMany({ where: { prompt: "battery-reseed prompt" } });
  void speakDel;
  await pr2.speakSession.createMany({
    data: [
      { prompt: "battery-reseed prompt", transcript: "battery seed round one", round: 1, result: JSON.stringify({ scores: { fluency: 5, range: 5, accuracy: 4, delivery: 6 }, errors: [] }) },
      { prompt: "battery-reseed prompt", transcript: "battery seed round two", round: 2, result: JSON.stringify({ scores: { fluency: 6, range: 6, accuracy: 7, delivery: 6 }, errors: [{ trap: "articles", bad: "a advice", good: "advice" }] }) },
    ],
  });
  const spAnon = await noCookie("/api/speak/analytics");
  check(spAnon.status === 401 || spAnon.status === 200, "speak analytics never 500 to anonymous", `status=${spAnon.status}`);
  const spA = await api("/api/speak/analytics");
  check(spA.status === 200 && Array.isArray(spA.body?.trend) && Array.isArray(spA.body?.deltas) && Array.isArray(spA.body?.traps) && spA.body?.totals, "speak analytics shape", JSON.stringify(spA.body).slice(0, 150));
  const spDelta = (spA.body?.deltas ?? []).find((d: { prompt: string }) => d.prompt === "battery-reseed prompt");
  check(spDelta && spDelta.r1 === 5 && spDelta.r2 === 6.3 && spDelta.overallDelta === 1.3, "round1->round2 delta math is exact (1dp engine rounding)", JSON.stringify(spDelta));
  check(spDelta && spDelta.accuracyDelta === 3, "accuracy delta = 7 - 4 = 3", String(spDelta?.accuracyDelta));

  const today2 = dayIndex();
  // Isolate the day: remove whatever logs the restored snapshot holds for it
  // (the final commitImport restore puts every row back), then seed exact
  // math. The assertion must never depend on ambient learner data.
  await pr2.reviewLog.deleteMany({ where: { userId: UID, day: today2 } });
  await pr2.reviewLog.createMany({
    data: [
      { userId: UID, cardId: "battery-outcome-1", grade: 5, ivl: 10, day: today2, source: "review" },
      { userId: UID, cardId: "battery-outcome-2", grade: 4, ivl: 6, day: today2, source: "review" },
      { userId: UID, cardId: "battery-outcome-3", grade: 1, ivl: 0, day: today2, source: "review" },
    ],
  });
  const ocAnon = await noCookie("/api/progress/outcomes");
  check(ocAnon.status === 401 || ocAnon.status === 200, "outcomes never 500 to anonymous", `status=${ocAnon.status}`);
  const oc = await api("/api/progress/outcomes");
  check(oc.status === 200 && Array.isArray(oc.body?.retention) && Array.isArray(oc.body?.stability) && oc.body?.memory && oc.body?.families && oc.body?.summary, "outcomes shape", JSON.stringify(oc.body).slice(0, 150));
  const ocToday = (oc.body?.retention ?? []).find((r: { day: number }) => r.day === today2);
  check(ocToday && ocToday.reviews === 3 && ocToday.goodRate === 66.7, "retention = 2 good of 3 = 66.7%", JSON.stringify(ocToday));
  const ocStab = (oc.body?.stability ?? []).find((r: { day: number }) => r.day === today2);
  check(ocStab && ocStab.medianIvl === 6, "median ivl of [10,6,0] = 6 (the honest middle)", JSON.stringify(ocStab));
  check(oc.body?.families && typeof oc.body.families.retirementRate === "number", "family retirement rate present", JSON.stringify(oc.body?.families));
  await pr2.reviewLog.deleteMany({ where: { cardId: { startsWith: "battery-outcome-" } } });
  await pr2.speakSession.deleteMany({ where: { prompt: "battery-reseed prompt" } });
  await pr2.$disconnect();
  console.log("rea-2 seeds removed");
}

// ================= 6d. TALK: SPOKEN CONVERSATION (SPEAK RE part 2) =================
export async function talk(c: Ctx) {
  console.log("\n--- talk: spoken conversation ---");
  const api = c.api;
  const noCookie = c.noCookie;
  const cvAnon = await noCookie("/api/speak/conversation");
  check(cvAnon.status === 401 || cvAnon.status === 200, "conversation GET never 500 to anonymous", `status=${cvAnon.status}`);
  const cv1 = await api("/api/speak/conversation");
  check(cv1.status === 200 && Array.isArray(cv1.body?.scenarios) && cv1.body?.scenarios?.length === 6 && cv1.body?.maxTurns === 6, "scenario bank shape (6 scenes, 6-turn cap)", JSON.stringify(cv1.body).slice(0, 120));
  const cv2 = await api("/api/speak/conversation");
  check(JSON.stringify(cv1.body?.scenarios) === JSON.stringify(cv2.body?.scenarios), "scenario order is deterministic per day", "order moved between GETs");
  check(cv1.body?.scenarios?.every?.((s: { id: string; opening: string; scene: string }) => s.id && s.opening && s.scene), "every scenario carries scene + opening", JSON.stringify(cv1.body?.scenarios?.[0]));
  const cvBad = await api("/api/speak/conversation", { method: "POST", body: JSON.stringify({ scenarioId: "<script>", turns: [] }) });
  check(cvBad.status === 400, "unknown scenario is 400, never 500", `status=${cvBad.status}`);
  const cvEmpty = await api("/api/speak/conversation", { method: "POST", body: JSON.stringify({ scenarioId: "complain", turns: [{ you: "   ", coach: "" }] }) });
  check(cvEmpty.status === 400, "empty transcript is 400 with a speakable error", JSON.stringify(cvEmpty.body));
  const cvOver = await api("/api/speak/conversation", { method: "POST", body: JSON.stringify({ scenarioId: "complain", turns: Array.from({ length: 20 }, (_, i) => ({ you: "line " + i, coach: "ok" })) }) });
  check(cvOver.status === 400 || cvOver.status === 502, "oversized history is clamped/400, never 500", `status=${cvOver.status}`);
}

// ================= 6f. READ-ALOUD ASSESS (Task 64, measured acoustic tier) =================
export async function assess(c: Ctx) {
  console.log("\n--- read-aloud assess: measured tier gates ---");
  const api = c.api;
  const noCookie = c.noCookie;
  const ra0 = await api("/api/speak/assess");
  check(ra0.status === 200 && Array.isArray(ra0.body?.targets) && ra0.body.targets.length >= 8, "read-aloud target bank ships 8+ sentences", JSON.stringify(ra0.body).slice(0, 120));
  const ra0b = await api("/api/speak/assess");
  check(JSON.stringify(ra0.body?.targets) === JSON.stringify(ra0b.body?.targets), "read-aloud targets are deterministic", "order moved between GETs");
  check(ra0.body?.azure === false, "azure tier reports dormant without env keys (honest chip)", String(ra0.body?.azure));
  const raAnon = await noCookie("/api/speak/assess");
  check(raAnon.status !== 500, "assess never 500s to anonymous", `status=${raAnon.status}`);
  // NOTE: every POST below must fail VALIDATION - the battery never spends a real ASR call.
  const raNoAudio = await api("/api/speak/assess", { method: "POST", body: JSON.stringify({ target: "Hello world today" }) });
  check(raNoAudio.status === 400, "assess without audio is 400 with a speakable error", JSON.stringify(raNoAudio.body));
  const raBadTarget = await api("/api/speak/assess", { method: "POST", body: JSON.stringify({ target: "x" }) });
  check(raBadTarget.status === 400, "assess with junk target is 400 before any audio work", JSON.stringify(raBadTarget.body));
  const raBig = await api("/api/speak/assess", { method: "POST", body: JSON.stringify({ target: "Hello world today", audio: "A".repeat(9_500_000) }) });
  check(raBig.status === 413, "oversized audio is 413, never 500", `status=${raBig.status}`);
}
