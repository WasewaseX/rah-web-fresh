// API battery: every single route in src/app/api, live, over the running app.
//
// The Task 35 claim set (user: "check all apis ... check everything"):
//  1. FULL SWEEP: all 39 routes x their real methods, anonymously AND authed -
//     nothing may answer 500. Ever. Under garbage input either.
//  2. GATING: the auth-gated surfaces reject anonymous callers.
//  3. DEEP SHAPE: the core read routes return the data shapes the UI relies on.
//  4. LOOP UNITS: the JSON-repair logic that used to leak raw JSON into the
//     coach chat is pinned against the EXACT payloads seen in the wild
//     (the user's chat log), plus prose/fence/thought-only/truncated cases.
//  5. WORKSPACE + PDF: the coach's file deliverables - listing, sandboxed
//     download, make_pdf tool guards, a REAL %PDF byte check.
//  6. PAIRS (DUOLINGO-RE D3): deterministic board, clamped grading, hostile
//     id filtering.
// Full state restore in finally via the app's own portability machinery.
//
// The section bodies live in ./test-api-battery/* (harness.ts owns the shared
// counters, client and route map); this entry owns section order, the crash
// guard and the exit code.

process.env.DATABASE_URL ||= "file:/home/z/my-project/db/custom.db";

import { ctx, crashBump, failuresCount, summaryLine } from "./test-api-battery/harness";
import { sweepAnon, sweepAuthed } from "./test-api-battery/sweep";
import { login, authHardening, accountDeletion } from "./test-api-battery/login";
import { aiLimiter, toolPermissions } from "./test-api-battery/guards";
import { deepShape, headerAuth } from "./test-api-battery/deep-shape";
import { loopUnits } from "./test-api-battery/loop-units";
import { workspacePdf } from "./test-api-battery/workspace-pdf";
import { pairs } from "./test-api-battery/pairs";
import { speakAnalytics, talk, assess } from "./test-api-battery/speak";
import { agentFlags, interopTriage } from "./test-api-battery/agent-flags";
import { soundLab } from "./test-api-battery/sound-lab";
import { reviewQueue } from "./test-api-battery/review-queue";
import { offlineGidReceipts, arcadeGidReceipts } from "./test-api-battery/offline-sync";
import { runMaterials } from "./test-api-battery/materials";
import { grammarlyPin } from "./test-api-battery/grammarly";
import { antiFarm } from "./test-api-battery/anti-farm";
import { restoreSnapshot } from "./test-api-battery/restore";

// ---------- snapshot for restore (the app's own 20-table machinery) ----------
const { buildBundle } = await import("@/lib/portable");
ctx.before = await buildBundle();

try {
  await sweepAnon(ctx); // 1. anonymous sweep
  await login(ctx); // 2. login
  await authHardening(ctx); // auth hardening pins
  await accountDeletion(ctx); // account deletion
  await aiLimiter(); // AI abuse limiter
  await toolPermissions(); // agent tool permission matrix
  await sweepAuthed(ctx); // 3. authed sweep, hostile bodies
  await deepShape(ctx); // 4. deep shape
  await headerAuth(ctx); // 4b. header auth fallback
  await loopUnits(); // 5. loop units (JSON-repair wall)
  await workspacePdf(ctx); // workspace + PDF
  await pairs(ctx); // 6. match-pairs
  await speakAnalytics(ctx); // 6b. speak analytics + outcomes
  await agentFlags(ctx); // 6c. stop-the-agent + content flags
  await talk(ctx); // 6d. spoken conversation
  await assess(ctx); // 6f. read-aloud assess
  await interopTriage(ctx); // 6e. interop + triage
  await soundLab(ctx); // 6f. sound lab + arena voice
  await reviewQueue(ctx); // 6g. review queue
  await offlineGidReceipts(ctx); // offline sync: gid receipts
  await arcadeGidReceipts(ctx); // offline sync: arcade gid receipts
  await runMaterials(ctx); // 6h. BYO materials (+csv/apkg/suspend/degraded/curriculum)
  await grammarlyPin(ctx); // Grammarly RE pre-flight contract
  await antiFarm(ctx); // 6i. anti-farming XP caps
  await restoreSnapshot(ctx); // 7. restore
} catch (e) {
  console.error("BATTERY CRASH:", e);
  crashBump();
}

console.log(summaryLine());
if (failuresCount() > 0) process.exit(1);
