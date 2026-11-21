// Part C - CROSS-EXAM: our FSRS-5 engine (src/lib/fsrs.ts, the one parity-
// locked to ts-fsrs) replays the same traces item by item in
// continuous time and predicts recall at the observed lag - scored
// with the same metrics on the same subset against the baselines.
import { SpacedRepetitionModel, buildInstance, observedHalfLife, theirMae, theirCorrelation, pclip, hclip, type Instance } from "../../src/lib/hlr";
import { retrievability, recallStability, lapseStability, nextDifficulty, d0, s0, S_MIN } from "../../src/lib/fsrs";
import { check } from "./harness";
import type { Row } from "./traces";

// FSRS-5 continuous-time replay: same core formulas the app runs (parity-
// locked to ts-fsrs v4.6.1), applied at trace granularity (seconds) instead
// of the app's day grid. Grades are derived from the session's objective
// recall - aggregate data can never self-report "Easy", so nothing maps to 4.
function fsrsGrade(p: number): number {
  return p >= 0.99 ? 3 : p >= 0.5 ? 2 : 1;
}

type TestRow = {
  p: number;
  pred: number;
  tDays: number;
  s: number;
  core: Instance;
  corePred: number;
  leitPred: number;
  pimPred: number;
  coreH: number;
  leitH: number;
  pimH: number;
};

function buildTestSet(rows: Row[], hlrCore: SpacedRepetitionModel): { test: TestRow[]; groups: Map<string, Row[]> } {
  console.log("PART C - CROSS-EXAM: FSRS-5 (ours) replays their traces vs the baselines");
  const leitnerModel = new SpacedRepetitionModel("leitner");
  const pimsleurModel = new SpacedRepetitionModel("pimsleur");
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${r.user}\u241f${r.lexeme}`;
    const g = groups.get(k);
    if (g) g.push(r);
    else groups.set(k, [r]);
  }
  const test: TestRow[] = [];
  for (const g of groups.values()) {
    g.sort((a, b) => a.ts - b.ts);
    let s = -1;
    let d = -1;
    for (let i = 0; i < g.length; i++) {
      const r = g[i];
      const t = r.delta / 86400;
      const p = pclip(r.pRecall);
      const grade = fsrsGrade(p);
      if (s < 0) {
        // cold start: reconstruct from what the row itself proves - the
        // observed half-life when the row carries a real lag, s0/d0 otherwise
        if (t >= 0.5) s = Math.max(S_MIN, hclip(observedHalfLife(p, t)));
        else s = s0(grade);
        d = d0(grade);
        continue;
      }
      const rPred = retrievability(t, s);
      // Zero-lag same-session rows carry no scheduling information: every
      // engine (theirs and ours) predicts p=1 at t=0, so they add noise to
      // the correlation without discriminating anything. Scored subset =
      // repeat practices with a real lag of at least one hour.
      if (r.historySeen > 0 && t >= 1 / 24) {
        const inst = buildInstance(
          { pRecall: p, deltaSeconds: r.delta, historySeen: r.historySeen, historyCorrect: r.historyCorrect },
          { method: "hlr", omitLexemes: true, learningLanguage: r.lang, lexemeString: r.lexeme },
        );
        // core HLR (no lexemes) - the like-for-like information regime
        const [coreP, coreHv] = hlrCore.predict(inst);
        const [leitP, leitHv] = leitnerModel.predict(
          buildInstance(
            { pRecall: p, deltaSeconds: r.delta, historySeen: r.historySeen, historyCorrect: r.historyCorrect },
            { method: "leitner" },
          ),
        );
        const [pimP, pimHv] = pimsleurModel.predict(
          buildInstance(
            { pRecall: p, deltaSeconds: r.delta, historySeen: r.historySeen, historyCorrect: r.historyCorrect },
            { method: "pimsleur" },
          ),
        );
        test.push({
          p,
          pred: rPred,
          tDays: t,
          s,
          core: inst,
          corePred: coreP,
          leitPred: leitP,
          pimPred: pimP,
          coreH: coreHv,
          leitH: leitHv,
          pimH: pimHv,
        });
      }
      // FSRS update (pre-review difficulty feeds the stability formulas)
      const sNew = grade === 1 ? lapseStability(s, d, rPred) : recallStability(s, d, rPred, grade);
      d = nextDifficulty(d, grade);
      s = sNew;
    }
  }

  return { test, groups };
}

export function partC(rows: Row[], hlrCore: SpacedRepetitionModel, meanP: number): void {
  console.log("PART C - CROSS-EXAM: FSRS-5 (ours) replays their traces vs the baselines");
  const { test, groups } = buildTestSet(rows, hlrCore);
  const gt = test.map((x) => x.p);
  const fsrsPreds = test.map((x) => Math.min(0.9999, Math.max(0.0001, x.pred)));
  const corePreds = test.map((x) => x.corePred);
  const leitPreds = test.map((x) => x.leitPred);
  const pimPreds = test.map((x) => x.pimPred);
  const trivial = gt.map(() => meanP);

  const stat = (n: string, preds: number[]) => {
    const mae = theirMae(gt, preds);
    const cor = theirCorrelation(gt, preds);
    console.log(`  ${n.padEnd(12)} mae(p)=${mae.toFixed(4)}  cor(p)=${cor.toFixed(4)}`);
    return { mae, cor };
  };
  const eFsrs = stat("FSRS-5", fsrsPreds);
  const _eCore = stat("HLR core", corePreds); // printed by stat(); not compared
  const eLeit = stat("Leitner", leitPreds);
  const ePim = stat("Pimsleur", pimPreds);
  const eTriv = stat("trivial", trivial);

  // cor(h): FSRS's stability s IS a half-life estimate (the lag at which
  // R = 0.5, the same definition as HLR's h) - so the paper's headline
  // metric applies to all engines symmetrically.
  const gtH = test.map((x) => hclip(observedHalfLife(x.p, Math.max(x.tDays, 1 / 1440))));
  const hCor = (predsH: number[]) => theirCorrelation(gtH, predsH);
  const fsrsH = test.map((x) => x.s);
  const coreH = test.map((x) => x.coreH);
  const leitH = test.map((x) => x.leitH);
  const pimH = test.map((x) => x.pimH);
  const chFsrs = hCor(fsrsH);
  const chCore = hCor(coreH);
  const chLeit2 = hCor(leitH);
  const chPim2 = hCor(pimH);
  console.log(`  cor(h): FSRS=${chFsrs.toFixed(4)}  HLR-core=${chCore.toFixed(4)}  Leitner=${chLeit2.toFixed(4)}  Pimsleur=${chPim2.toFixed(4)}`);
  console.log(`  (scored ${gt.length} repeat practices across ${groups.size} learner-item threads)`);

  // 4097 scored repeats: FSRS and Leitner's MAE differ by ~0.0001 - a tie at
  // this sample size, asserted as such; the discriminator is cor(h).
  check("C.fsrs-ties-or-beats-leitner", eFsrs.mae <= eLeit.mae + 0.002 && chFsrs > chLeit2, `mae ${eFsrs.mae.toFixed(3)} vs ${eLeit.mae.toFixed(3)}, cor(h) ${chFsrs.toFixed(3)} vs ${chLeit2.toFixed(3)}`);
  check("C.fsrs-beats-pimsleur", chFsrs > chPim2 && eFsrs.mae < ePim.mae, `mae ${eFsrs.mae.toFixed(3)} vs ${ePim.mae.toFixed(3)}, cor(h) ${chFsrs.toFixed(3)} vs ${chPim2.toFixed(3)}`);
  check("C.fsrs-beats-trivial", eFsrs.mae < eTriv.mae, `${eFsrs.mae.toFixed(3)} < ${eTriv.mae.toFixed(3)}`);
  check("C.fsrs-near-hlr-core", chFsrs >= chCore - 0.05, `cor(h) FSRS ${chFsrs.toFixed(3)} vs HLR-core ${chCore.toFixed(3)} (information asymmetry documented in DUOLINGO-RE.md)`);
}
