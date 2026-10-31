/*
 * render-proof-tutor.mjs — Task 105 render proof for the recovered feature
 * layer's last unwired pieces, on the REAL production server:
 *   1. The Tutor hub renders with its 5 tabs (Chat/Plan/Diagnosis/Clinic/Exam).
 *   2. The Plan tab's empty state ("Build my 7-day plan") renders for a
 *      learner with no stored plan (GET /api/tutor/plan -> null).
 *   3. The Exam tab renders the exam center (kind/length chips + generate).
 *   4. The WebGL Backdrop element exists (.rah-backdrop) for a signed-in
 *      learner and the canvas attaches (or removes itself cleanly without
 *      WebGL - headless Chromium HAS WebGL, so presence is the pass path).
 * Session: RAH_SESSION env (rah_session=<token> cookie), minted by the caller,
 * deleted by the caller after the run. No writes to learner data: only GETs.
 */
import { chromium, devices } from "playwright";

const cookie = process.env.RAH_SESSION;
if (!cookie) { console.error("RAH_SESSION missing"); process.exit(2); }

const results = [];
const check = (ok, name, detail = "") =>
  results.push({ ok, name, detail: String(detail).slice(0, 160) });

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
await ctx.addCookies([
  { name: "rah_session", value: cookie.replace(/^rah_session=/, ""), url: "http://127.0.0.1:3000" },
]);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));

try {
  await page.goto("http://127.0.0.1:3000/#tutor", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(6000); // dev-throttle-free prod: boot + chunk + hydrate

  // 1. Tutor hub tabs
  const tabs = await page.getByRole("button", { name: /Chat|7-day plan|Diagnosis|Clinic|Exam/ }).count();
  check(tabs >= 5, "tutor hub renders 5 tabs", `count=${tabs}`);

  // 2. Plan tab empty state
  await page.getByRole("button", { name: "7-day plan" }).first().click();
  await page.waitForTimeout(2500);
  const planGen = await page.getByRole("button", { name: /Build my 7-day plan/ }).count();
  check(planGen >= 1, "plan tab empty state renders", `gen-buttons=${planGen}`);

  // 3. Exam center
  await page.getByRole("button", { name: "Exam" }).first().click();
  await page.waitForTimeout(2500);
  const examGen = await page.getByRole("button", { name: /Generate the exam/ }).count();
  const kindChips = await page.getByRole("button", { name: /Mock exam|Vocabulary|Grammar|Reading|Use of English/ }).count();
  check(examGen >= 1 && kindChips >= 5, "exam center renders with kind chips", `gen=${examGen} chips=${kindChips}`);

  // 4. Backdrop canvas present (signed-in shell)
  const backdrop = await page.locator(".rah-backdrop canvas").count();
  check(backdrop >= 1, "recovered Backdrop canvas attached", `canvas=${backdrop}`);

  check(errors.length === 0, "no page errors during the pass", errors.join(" | "));
} catch (e) {
  check(false, "probe crashed", String(e).slice(0, 200));
} finally {
  await browser.close();
}

let pass = 0;
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name} :: ${r.detail}`);
  if (r.ok) pass++;
}
console.log(`RENDER PROOF: ${pass}/${results.length} PASS`);
process.exit(pass === results.length ? 0 : 1);
