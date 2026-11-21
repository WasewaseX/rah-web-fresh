// Agent control + content flags (7.4 wave C) and the interop/triage follow-up
// (anki tsv export + flag triage tool).
import { check, type Ctx } from "./harness";

// ================= 6c. AGENT CONTROL + CONTENT FLAGS (7.4 wave C) =================
export async function agentFlags(c: Ctx) {
  console.log("\n--- stop-the-agent + content flags ---");
  const api = c.api;
  const noCookie = c.noCookie;
  const { stoppedReply } = await import("@/lib/coach-agent/loop");
  const sr0 = stoppedReply([]);
  check(sr0.startsWith("Stopped before I got going"), "stopped reply with zero steps is honest", sr0);
  const sr2 = stoppedReply([{ label: "read_state" }, { label: "write_file" }, { label: "Mode: roleplay" }, { label: "Unknown tool: x" }]);
  check(sr2.includes("read_state, write_file") && !sr2.includes("Mode: roleplay") && !sr2.includes("Unknown tool"), "stopped reply names the real work, drops noise", sr2);
  const { isStateQuestion } = await import("@/lib/coach-agent/loop");
  check(isStateQuestion("what is my streak and due count?") && isStateQuestion("What should I do right now") && isStateQuestion("how am i doing"), "state-question detector catches the real asks", "missed a state question");
  check(!isStateQuestion("what is the answer of this question") && !isStateQuestion("make me a PDF of collocations"), "screen/work questions do NOT trigger the read_state enforcement", "false positive");

  const fbAnon = await noCookie("/api/feedback", { method: "POST", body: JSON.stringify({ kind: "typo", note: "anon" }) });
  check(fbAnon.status === 401, "feedback POST is 401 to anonymous", `status=${fbAnon.status}`);
  const fbGetAnon = await noCookie("/api/feedback");
  check(fbGetAnon.status === 401, "feedback GET is 401 to anonymous", `status=${fbGetAnon.status}`);
  const fbHostile = await api("/api/feedback", { method: "POST", body: JSON.stringify({ kind: "<script>inject", note: "battery-hostile-" + Date.now() + "x".repeat(400), cardId: "c-" + "y".repeat(500) }) });
  check(fbHostile.status === 200 && fbHostile.body?.kind === "other", "hostile kind clamps to other", JSON.stringify(fbHostile.body));
  const fbOk = await api("/api/feedback", { method: "POST", body: JSON.stringify({ cardId: "battery-flag-card", kind: "wrong_answer", note: "battery flag note" }) });
  check(fbOk.status === 200 && fbOk.body?.ok === true, "feedback POST lands", JSON.stringify(fbOk.body));
  const fbDup = await api("/api/feedback", { method: "POST", body: JSON.stringify({ cardId: "battery-flag-card", kind: "wrong_answer", note: "battery flag note" }) });
  check(fbDup.status === 200 && fbDup.body?.duplicate === true, "exact duplicate of an open flag is refused honestly", JSON.stringify(fbDup.body));
  const fbList = await api("/api/feedback");
  check(fbList.status === 200 && typeof fbList.body?.open === "number" && Array.isArray(fbList.body?.recent), "feedback GET shape", JSON.stringify(fbList.body).slice(0, 120));
  check((fbList.body?.recent ?? []).some((f: { cardId: string }) => f.cardId === "battery-flag-card"), "flag is in the queue the coach sees", JSON.stringify(fbList.body?.recent)?.slice(0, 150));
  const { PrismaClient: PC3 } = await import("@prisma/client");
  const pr3 = new PC3();
  await pr3.contentFlag.deleteMany({ where: { OR: [{ cardId: "battery-flag-card" }, { note: { startsWith: "battery-hostile-" } }] } });
  await pr3.$disconnect();
  console.log("flag seeds removed");
}

// ================= 6e. INTEROP + TRIAGE (7.4 wave C follow) =================
export async function interopTriage(c: Ctx) {
  console.log("\n--- anki tsv export + flag triage tool ---");
  const api = c.api;
  const anki = await api("/api/export/anki");
  const ankiLines = anki.text.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
  check(anki.status === 200 && anki.text.startsWith("#separator:tab"), "anki export carries the anki header", anki.text.slice(0, 60));
  check(ankiLines.length >= 200, "every deck card exports", `${ankiLines.length} rows`);
  check(ankiLines.every((l) => l.split("\t").length === 3), "every row is exactly front<TAB>back<TAB>tags", ankiLines[0]?.slice(0, 80) ?? "empty");
  check(ankiLines.every((l) => !l.includes("\n")), "no embedded newlines inside cells (TSV-safe)", "newline in cell");
  check(anki.text.includes("does NOT round-trip"), "the header says scheduling does not round-trip (honest)", "missing disclaimer");
  const { toolByName: toolByName2 } = await import("@/lib/coach-agent/tools");
  const tri = toolByName2("triage_flags");
  check(Boolean(tri), "triage_flags tool is registered", "missing");
  if (tri) {
    const badStatus = await tri.run({ action: "resolve", id: 999999, status: "<script>" });
    check(badStatus.ok === false && /fixed or wontfix/i.test(badStatus.summary), "resolve rejects a hostile status", badStatus.summary);
    const badId = await tri.run({ action: "resolve", id: "drop table", status: "fixed" });
    check(badId.ok === false && /numeric/i.test(badId.summary), "resolve rejects a non-numeric id", badId.summary);
    const emptyList = await tri.run({ action: "list" });
    check(emptyList.ok === true, "list works on an empty queue", emptyList.summary);
  }
}
