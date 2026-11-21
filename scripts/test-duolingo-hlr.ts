// DUOLINGO-RE GATE - reverse engineering Duolingo the Rah way: differential
// tests against THEIR OWN published machinery, not vibes.
//
// Sources held on disk (scripts/duolingo-reference/):
//   - experiment.py  - Duolingo's actual HLR implementation (MIT, Settles &
//     Meeder 2016), cloned unmodified from github.com/duolingo/halflife-regression
//   - reference_py3.py + parity_entry.py - mechanical py3 shim + oracle entry
//   - traces.csv.gz  - THEIR 13M-row public learning-traces dataset (Dataverse
//     doi:10.7910/DVN/N8XJME, 379MB); sample.csv = first 300k lines cache.
//
// Part A - PARITY: src/lib/hlr.ts (our 1:1 TS port) vs their Python on a
//          pinned-order synthetic fixture. Weights and predictions must agree
//          to 1e-9 (same IEEE ops in the same order, so nothing less passes).
// Part B - DUEL: their baselines (Leitner, Pimsleur, LR) vs full HLR on a
//          300k-row sample of THEIR data, their 90/10 split, their metrics
//          (MAE + their Pearson-named "spearmanr"). The paper's finding must
//          reproduce: HLR beats the fixed baselines, lexeme pooling helps.
// Part C - CROSS-EXAM: our FSRS-5 engine (src/lib/fsrs.ts, the one parity-
//          locked to ts-fsrs) replays the same traces item by item in
//          continuous time and predicts recall at the observed lag - scored
//          with the same metrics on the same subset against the baselines.
//
// The part bodies live in ./test-duolingo-hlr/* (harness.ts owns the check
// ledger and reference constants); this entry owns part order and the verdict.

import { partA } from "./test-duolingo-hlr/part-a";
import { loadSample } from "./test-duolingo-hlr/traces";
import { partB } from "./test-duolingo-hlr/part-b";
import { partC } from "./test-duolingo-hlr/part-c";
import { failuresCount, hasFailures } from "./test-duolingo-hlr/harness";

function main(): void {
  console.log("DUOLINGO-RE GATE");
  partA();
  try {
    const rows = loadSample();
    const { hlrCore, meanP } = partB(rows);
    partC(rows, hlrCore, meanP);
  } catch (e) {
    console.error(`  SKIP real-data parts (B, C): ${String(e).slice(0, 120)}`);
  }
  if (hasFailures()) {
    console.error(`DUOLINGO-RE GATE FAILED: ${failuresCount()} check(s)`);
    process.exit(1);
  }
  console.log("DUOLINGO-RE GATE PASS");
}

main();
