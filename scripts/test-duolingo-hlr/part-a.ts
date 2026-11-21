// Part A - PARITY: src/lib/hlr.ts (our 1:1 TS port) vs their Python on a
// pinned-order synthetic fixture. Weights and predictions must agree
// to 1e-9 (same IEEE ops in the same order, so nothing less passes).
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SpacedRepetitionModel, buildInstance, pclip, type Instance } from "../../src/lib/hlr";
import { REF_DIR, check } from "./harness";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function partA(): void {
  console.log("PART A - PARITY: our TS port vs their Python (pinned order)");
  const rng = mulberry32(0xd0d0);
  const LEXEMES = 40;
  const mk = (): Instance => {
    const right = Math.floor(rng() * rng() * 60);
    const wrong = Math.floor(rng() * 30);
    // log-uniform lag from 15 minutes to ~200 days
    const t = Math.pow(2, -4.585 + rng() * 13.6); // 2^-4.585d ~= 15min, 2^9.015d ~= 200d... keep inside clips
    const acc = (right + 1.5) / (right + wrong + 3);
    const p = pclip(Math.min(0.999, Math.max(0.001, acc + (rng() - 0.5) * 0.3)));
    return buildInstance(
      { pRecall: p, deltaSeconds: t * 86400, historySeen: right + wrong, historyCorrect: right },
      { method: "hlr", learningLanguage: "en", lexemeString: `duo/word/${Math.floor(rng() * LEXEMES)}` },
    );
  };
  const train: Instance[] = [];
  const test: Instance[] = [];
  for (let i = 0; i < 2500; i++) train.push(mk());
  for (let i = 0; i < 250; i++) test.push(mk());

  const fixture = {
    train: train.map((i) => ({ p: i.p, t: i.t, fv: i.fv, h: i.h })),
    test: test.map((i) => ({ p: i.p, t: i.t, fv: i.fv, h: i.h })),
  };
  const fixPath = path.join(REF_DIR, "parity_fixture.json");
  const outPath = path.join(REF_DIR, "parity_ref_out.json");
  writeFileSync(fixPath, JSON.stringify(fixture));

  const ours = new SpacedRepetitionModel("hlr");
  ours.train(train);

  const py = spawnSync("python3", [path.join(REF_DIR, "parity_entry.py"), fixPath, outPath], {
    timeout: 120000,
  });
  if (py.error || py.status !== 0) {
    check("A.python-oracle", false, `status=${py.status} err=${String(py.stderr).slice(0, 200)}`);
    return;
  }
  const ref = JSON.parse(readFileSync(outPath, "utf8")) as {
    weights: Record<string, number>;
    preds: Array<[number, number]>;
  };

  let maxW = 0;
  let maxWKey = "";
  const keys = new Set([...Object.keys(ref.weights), ...ours.weights.keys()]);
  for (const k of keys) {
    const a = ours.weights.get(k) ?? 0;
    const b = ref.weights[k] ?? 0;
    const d = Math.abs(a - b);
    if (d > maxW) {
      maxW = d;
      maxWKey = k;
    }
  }
  check("A.weights", maxW < 1e-9, `max |dw|=${maxW.toExponential(2)} @ ${maxWKey} over ${keys.size} features`);

  let maxP = 0;
  let maxH = 0;
  for (let i = 0; i < test.length; i++) {
    const [pO, hO] = ours.predict(test[i]);
    const [pR, hR] = ref.preds[i];
    maxP = Math.max(maxP, Math.abs(pO - pR));
    maxH = Math.max(maxH, Math.abs(hO - hR));
  }
  check("A.predictions", maxP < 1e-9 && maxH < 1e-9, `max |dp|=${maxP.toExponential(2)} max |dh|=${maxH.toExponential(2)} over ${test.length} preds`);
}
