// PAIRS (DUOLINGO-RE D3): deterministic board, clamped grading, hostile id filtering.
import { check, type Ctx } from "./harness";

// ================= 6. PAIRS (DUOLINGO-RE D3) =================
export async function pairs(c: Ctx) {
  console.log("\n--- match-pairs sprint ---");
  const api = c.api;
  const pairsGet = await api("/api/arcade/pairs");
  check(pairsGet.status === 200 && Array.isArray(pairsGet.body?.left) && Array.isArray(pairsGet.body?.right), "pairs board shape", JSON.stringify(pairsGet.body).slice(0, 150));
  const boardL = pairsGet.body.left as { id: string; text: string }[];
  const boardR = pairsGet.body.right as { id: string; text: string }[];
  check(boardL.length === boardR.length && boardL.length >= 3, "board sides balanced", `${boardL.length} vs ${boardR.length}`);
  check(new Set(boardL.map((x) => x.id)).size === boardL.length, "no duplicate cards on the board", JSON.stringify(boardL.map((x) => x.id)));
  check(new Set(boardL.map((x) => x.id)).toString() === new Set(boardR.map((x) => x.id)).toString(), "left and right carry the same id set", "id sets differ");
  const pairsGet2 = await api("/api/arcade/pairs");
  check(JSON.stringify(pairsGet2.body?.left) === JSON.stringify(boardL), "board is deterministic within a day", "order moved between GETs");

  const pairsPost = await api("/api/arcade/pairs", { method: "POST", body: JSON.stringify({ matched: [boardL[0].id], missteps: 0, ms: 15000 }) });
  check(pairsPost.status === 200 && pairsPost.body?.graded === 1 && pairsPost.body?.clean === true, "pairs POST grades a matched card", JSON.stringify(pairsPost.body));
  check(pairsPost.body?.xpGain === 12, "clean single-pair bonus = 2 + 10", String(pairsPost.body?.xpGain));
  const pairsHostile = await api("/api/arcade/pairs", { method: "POST", body: JSON.stringify({ matched: ["../../etc/passwd", "<script>", "c-" + "x".repeat(500)], missteps: -5, ms: 1e9 }) });
  check(pairsHostile.status === 200 && pairsHostile.body?.graded === 0, "hostile pair ids are filtered, not stored", JSON.stringify(pairsHostile.body));
}
