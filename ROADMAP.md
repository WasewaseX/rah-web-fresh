# Rah — Roadmap

*Checkbox ledger, rewritten 2026-11-03 (Task 118) from the holder's full product assessment (2026-11-02, sections 1–10), updated through Task 120. **How to read:** a ticked box was verified against the tree and the live runtime before ticking (rule 4) — the line names its evidence. An unticked box is genuinely open, with the already-built basis named. **Overall completion vs the original goal: ~72–76%** (first assessment: 68–72%; second assessment, 2026-11-03: 72–76%).*

Live preview: `https://preview-chat-d027ce73-8b7f-4fc0-910a-b2c665a663c0.space-z.ai` — single-learner deployment; the access code lives in `.env` only and is never committed.

---

## 1 · Original-goal ledger (assessment section 1)

- [x] **Adaptive vocabulary + FSRS** — `CardState`/`UserCard`/`ReviewLog`/`GradeAck`, review view with four directions; collocation-specific directions not yet targeted (→ §Teaching-quality #3).
- [x] **B2–C1 curriculum + mastery** — `/api/curriculum`, `SkillLevel`/`SkillBand`/`TagMastery`, mastery surface.
- [x] **Reading from learner-provided material** — `/api/materials`, `Material`/`MaterialCard`, reading view.
- [x] **Anki import/export** — `/api/import` + `/api/export`.
- [x] **Writing correction + revision history** — `/api/writing`, `WritingSub`; register dial shipped 2026-11-02 (Task 116): exam/work/casual examiner conditioning, echoed in feedback.
- [x] **AI coach + learner memory** — `/api/coach` + `/api/coach-agent`, `ChatMsg`, `MistakeFamily`; greeting/small-talk misroute fixed and verified live (Task 167 gate: "hi" → chat skill, 19-word reply).
- [x] **Exam practice** — `/api/exam`, `Exam`/`ExamRun`/`QuizItem`. *Caveat: scoring not human-calibrated (§4 C-5).*
- [x] **Speaking + pronunciation, word-level measured** — `/api/speak` + `/api/asr`, `SpeakSession`/`SpeakingAttempt`/`SoundLog`. *Caveat: word-level tier only; phoneme scoring deliberately out (validation doc).*
- [x] **Offline review + sync** — outbox (`lib/offline.ts`, `OfflineBadge`), idempotent grade receipts. *Caveat: real-phone validation outstanding (§2.3, holder-blocked).*
- [x] **Progress, XP, quests, goals** — `DailyStat`/`Quest`/`Goal`/`Achievement`/`GameStat`/`League`/`Rival`; `/api/progress` aggregates reviews+writing+speaking+listening (verified in route source).
- [x] **PostgreSQL + recovery** — 43 models at 127.0.0.1:5433; restore-tested through two real recycles (Tasks 114, 116) with learner data intact.
- [x] **Monitoring + deployment recovery** — `/api/version`, ensure-server chunk-integrity staleness check, 6-road deploy gate.
- [ ] **Reliable production email login** — **holder-blocked** (domain decision; $0 rule bars purchase without consent). Access-code login is the working path (`LoginCode`/`Session`); Resend integration + `MailLog` exist but sandbox restricts recipients.
- [ ] **Multi-week proof of learning improvement** — time-gated; evidence timeline accumulates honestly (`PILOT-PROTOCOL.md`).

## 2 · Three critical fixes (assessment section 2)

### 2.1 Authentication + account security (P0)
- [x] Working login path: access-code, sessioned (`Session`), registration locked (single-learner by design).
- [x] GitHub PAT rotated; runbook exists (`CREDENTIAL-ROTATION-RUNBOOK.md`); new PAT active, old revoke consent-gated.
- [ ] Resend key rotation **finished** — runbook + `MailLog` + `EMAIL-OPERATIONS.md` exist; the final rotation/delivery step is open.
- [ ] Real email delivery to the learner's address — **blocked** (holder domain decision).

### 2.2 Privacy + deployment integrity (P0)
- [x] New repo clean; credentials server-only; artifact secret gate in place.
- [x] Exact validated production build restores after a recycle — proven twice (Tasks 114, 116): git pull → artifact tar → BUILD_ID → chunk integrity.
- [x] No learner data or secrets in public artifacts (evidence hygiene rule + secret gate).
- [ ] Old archived repository exposure — monitored only; any change needs holder approval (consent gate).

### 2.3 End-to-end learner reliability (P1)
- [x] All 12 learning surfaces tested together — DOM sweeps at desktop 1440 + mobile 390, 12/12 views, 0 anti-patterns (Tasks 116, 117).
- [x] Production build + real-browser regression — deploy-gate road 4 **fails** on any client-side exception.
- [x] Writing/speaking/listening activity reaches progress reports — `/api/progress` aggregates all strands (verified).
- [ ] Seven physical-phone offline scenarios — **holder-blocked**; checklists ready (`DEVICE-TEST-CHECKLIST.md`, `OFFLINE-TEST-PROTOCOL.md`).

## 3 · Three critical features to add (assessment section 3 — the next builds)

- [x] **Goal-bound voice shadowing** — listen → imitate → word-level compare → recurring errors become FSRS items. **SHIPPED 2026-11-03**: Speaking studio gained a shadowing door (`next/shadowing.tsx` + `/api/speak/shadow`) — 12 curated targets tagged by interference focus (w/v, th, ae/e, i/ee, o/oo, linking, stress), ordered weakest-first from real ledgers (SoundLog error rates + the page's own miss history), TTS model audio at 0.85/1.0, measured ASR-alignment word chips, and a cross-attempt miss ledger: a word missed 3× mints exactly ONE review card (note marker `shadow-miss:<word>` dedupes, sentence rides as context). Batteries: `test-shadowing.ts` 31/31, live TTS→ASR roundtrip 100/100, probe mode writes nothing.
- [x] **Structured B2–C1 listening library** — graded clips, transcripts, replayable segments, comprehension questions, vocabulary extraction. **SHIPPED 2026-11-03**: 9 passages B2→C1 now carry 3 authored comprehension questions each (27 total, every answer key spread across positions, every evidence line a verbatim transcript quote — battery-pinned), sentence-level replay segments at 0.85x in round 2, and per-word "+ review queue" buttons that mint fae cards from the passage (marker `listen-vocab:<passage>:<word>`, dedupe live-verified). Accents stay honest: one built-in TTS voice — no accent claim is made. Battery `test-listening-lib.ts` 23/23.
- [x] **Cross-device writing + improvement history** — server-saved drafts + conflict resolution (rubric deltas shipped Task 77). **SHIPPED 2026-11-03**: `/api/write-draft` (GET/PUT/DELETE on one Setting row per learner, no migration) + the pure `resolveDrafts` seam — last-write-wins on the save timestamp, identical text never claims a conflict, a restore banner names when/where the newer copy came from, autosave pushes local up, a submission clears both halves, probe mode refuses writes. Battery `test-write-draft-sync.ts` 17/17 + live round-trip.

## 4 · Ten polish items (assessment section 4 = C-1…C-10 in `TASK-95-BACKLOG.md`)

- [ ] **C-1 Review queue** — FSRS queue live; "why due now" explanation, new-vs-revision distinction, scheduling confidence open.
- [ ] **C-2 Talk conversation** — talk mode live; mic recovery, interruption handling, mobile-browser behavior, typed fallback open.
- [ ] **C-3 Sound Lab** — word-level measured tier live; measured-vs-inferred separation, confidence display, replayable examples open.
- [ ] **C-4 AI coach evidence** — capability honesty + no-undeliverable-offers shipped (Task 117, rules 7–9 + verifier strip); **Task 119 extended it to the tutor hub chat**: honesty rules in the prompt, a post-filter that strips unverifiable "I've reviewed/checked" claims, and grounded exam disputes. Full evidence panel (tools ran, what changed, resume) still open.
- [ ] **C-5 Exam generation/grading** — exam loop live; distractor-plausibility tests + rubric calibration vs human-rated answers open.
- [ ] **C-6 CEFR placement** — placement + `PlacementResult` history live; skill-specific sample counts + explicit uncertainty display open.
- [x] **C-7 Mistake memory** — `MistakeFamily` + forgiveness live; **decline-over-time surfaced 2026-11-03**: Mind Reader now has a face on Progress (`next/mindreader.tsx`) — every family with its state line (worsening / active / cooling / healed, quiet-days + heal-bar arithmetic in `lib/mistake-trend.ts`, 12/12 battery), the learner's two Task-65 correction powers wired to the same view (correct text, forget with tombstone), and honest boundaries (the trend describes current state; no per-day history exists so none is invented).
- [ ] **C-8 XP/gems/quests/games** — economy live; anti-farming battery + reward-tied-to-measured-practice audit open (Mission §9 adopts this rule by design).
- [ ] **C-9 Writing workspace** — revisions live; cross-device drafts (→ §3.3) + rubric score explanations + before/after deltas open.
- [ ] **C-10 Progress dashboard honesty** — unit honesty + durable checkpoints done (Task 111 / A-4); activity-vs-test separation + explicit "insufficient evidence" states open.

## 5 · Competitor mechanics → Rah adaptations (assessment section 5; research docs exist)

- **Duolingo** (`DUOLINGO-RE.md`): [x] streaks · [x] quests · [x] leagues · [x] rival · [ ] daily mission connecting systems (→ §9) · [ ] streak protection + missed-day restart plan.
- **ELSA Speak** (`ELSA-SPEAK-RE.md`, `ELSA-PLAN.md`): [x] word-level measured pronunciation with honest labels · [x] repeated attempts + error capture (`SoundLog`) · [ ] guided exercise loop with categorized recurring-error retry (→ §3.1 shadowing).
- **LingQ** (`LINGQ-RE.md`): [x] import real content · [x] save vocabulary from material (`Material`/`MaterialCard`) · [ ] every saved expression auto-connected to the review queue + curriculum.

## 6 · Data domains (assessment section 6 — one PostgreSQL, 43 models, `PG-DECISION.md`)

- [x] **Mastery + review history** — `CardState`, `UserCard`, `ReviewLog`, `GradeAck`, `SkillLevel`, `DailyStat`, `PlacementResult`.
- [x] **Mistake memory + content** — `MistakeFamily`, `TagMastery`, `MistakeForgiven`, `WritingSub`, `QuizItem`, `Exam`, `Material`, `MaterialCard`, `ContentFlag`.
- [x] **Durable activity history** — `SpeakSession`, `SpeakingAttempt`, `ListeningLog`, `Checkpoint`, `Quest`, `Achievement`, `SessionLog`, `RunState`, `Briefing`, `TutorReport`.
- [x] Redis/Valkey correctly absent (single-instance ADR); object storage only if durable audio outgrows current arrangement (watch item).

## 7 · API capabilities (assessment section 7 — server routes only, no secrets in browser)

- [x] **Structured LLM** — coach/agent/writing/exam/tutor behind routes; register-goal conditioning (`WRITING_GOALS`); JSON validation on writing feedback. *Open: daily cost caps + evaluation harness.*
- [x] **Speech assessment** — `/api/asr` word-level with confidence, honest measurement labels (`PRONUNCIATION-VALIDATION.md`).
- [ ] **Transactional email** — Resend + `MailLog` exist; sandbox recipient restriction unresolved (blocked with §2.1).

## 8 · Optimization ledger (assessment section 8 — no Redis, no big models, $0)

- [x] Lazy-load secondary surfaces — `dynamic()` imports for Arcade/Placement/Writing/Listening/Speaking/Reading (verified in `App.tsx`).
- [x] Shared shell, persistent state, instant transitions — single `App.tsx` shell.
- [x] Offline: bounded outbox, idempotent sync, visible pending state (`OfflineBadge`).
- [x] Dashboard aggregates instead of per-event queries — `DailyStat` + strand aggregation.
- [x] Deployment avoids rebuilds on recycle — validated-artifact restore doctrine.
- [x] Security: credentials server-only, artifact secret gate.
- [ ] DB slow-query sweep + targeted indexes — not yet audited (data volume still small; revisit at growth).
- [ ] AI response caching for safe deterministic results.
- [x] Audio upload server-side duration caps (§8, **verified+enforced 2026-11-03**): WAV headers are parsed server-side (`wavDurationSeconds` in `lib/asr.ts`, zero decode) and both ASR funnels (`/api/asr`, `transcribeAudio`) refuse > 180s with an honest 413 — live-proven with a synthetic 200s clip; 120s passes. Non-WAV payloads keep the byte-ceiling proxy. Client compression stays open (the client already encodes 16k-mono WAV).
- [ ] Real-device microphone/keyboard/touch-target pass (→ §2.3).

## 9 · Retention hook — The Daily English Mission (assessment section 9, its #1 recommendation)

**Rule: XP is awarded only when the learning action is measured as done.** No new currencies, no superficial rewards.

- [x] Today opens on a mission built from real weak spots + due reviews — **SHIPPED 2026-11-03 (Task 118)**: mission card on Today, four steps computed server-side from the FSRS due queue (canonical due filter, target = min(due, 8)), today's ListeningLog / SpeakSession / WritingSub counts, and the top open MistakeFamily for the speaking step.
- [x] Step 1 · clear the due review queue (FSRS). Step 2 · one listening round. Step 3 · one speaking attempt aimed at a recurring error. Step 4 · one short writing applying today's expressions.
- [x] Completion → +50 XP once per day — **SHIPPED**: claim is atomic (the `Setting` row `mission:<day>` primary key is the ledger; double-submit rolls back, zero XP); honest 400 refusal while incomplete; verified live with XP unchanged on the negative path.
- [x] Weekly recap: what measurably improved — **SHIPPED 2026-11-03**: the mission route computes this-week-vs-last from the same tables and conventions Progress uses (DailyStat reviews/correct/xp, per-strand counts from the content tables); a line renders only when BOTH windows have data; zero AI. Rendered on the mission card as deltas.
- [x] Streak protection — already live (freeze banking absorbs one missed day; `touchStreak`).
- [x] Missed day → supportive restart plan — **SHIPPED 2026-11-03**: fires only after TWO quiet days (one rest day is not a lapse), names how long the learner was away without guilt or fake-streak talk, and proposes a shorter come-back list; the queue is stated as holding the learner's place.
- Basis live: Today plan cards, hero signals, `DailyStat` per-strand counters, FSRS due queue, `MistakeFamily`, XP/streak engine.

## 10 · Execution order (assessment section 10, merged with Rah's P1→P3 history)

| # | Phase | Status |
|---|---|---|
| 1 | Email, credential, privacy blockers | [x] done except holder-blocked email delivery (§2.1) |
| 2 | Full end-to-end test of all existing surfaces | [x] emulated complete; real-device open (§2.3) |
| 3 | **Daily English Mission** (§9) | [x] v1 SHIPPED 2026-11-03 (Task 118); recap + restart SHIPPED same day |
| 4 | Voice shadowing (§3.1) | **SHIPPED 2026-11-03** (shadowing door in Speaking, measured tier, recurring→FSRS) |
| 5 | Listening library (§3.2) | **SHIPPED 2026-11-03** (27 grounded questions, segments, vocab→queue; accents honestly absent: one TTS voice) |
| 6 | Writing draft sync + improvement history (§3.3) | **SHIPPED 2026-11-03** (server drafts + LWW resolve; rubric deltas were Task 77) |
| 7 | Polish the ten (§4, C-1…C-10) | in progress; C-7 closed 2026-11-03 (Mind Reader decline surface) |
| 8 | Real-device offline + multi-week validation | ongoing, time-gated, holder-blocked |

### 10b · AI tutor-agent workstream (second assessment's #1 priority, 2026-11-03)

The assessment's verdict: the AI must stop being "a chatbot that blindly answers the latest sentence" — it needs context, real tools, action verification, and room-reading. What shipped in Task 119 (all verified live):

- [x] **Honesty floor in the tutor chat** — the holder caught the tutor fabricating "I've reviewed the grammar exam and answer key" (it had reviewed nothing and invented a topic list matching no real question). Prompt rules 7–10 now ban fabricated review/action claims; a post-filter strips unverifiable review/check claims from any generic-path reply.
- [x] **Grounded exam disputes** — "many of the answers were wrong" now pulls the exam actually stored in Rah, runs every item through the REAL deterministic answerability gate, quotes the actual questions + keys, and names mechanically broken items as the generator's fault. Verified live against the holder's own exam.
- [x] **Real capability, honestly answered** — "make the Ui theme green" used to get "I don't have the ability" (false: Rah has six theme presets + a paint system). A deterministic theme intent now applies the preset for real (Forest green verified live, tokens persist, client repaints in the same turn).
- [x] **Room-reading context v1** — every tutor turn now carries the live due-queue count and the top open mistake family, not just level/streak.
- [x] **Exam generation hardened** — new gate rule (f) stem-key contradiction (the holder's broken MCQ class: "which sentence uses the definite article" keyed to an article-less sentence), vet retry on failure, and the broken stored item replaced.
- [ ] Restore the parked coach payload components (13 types) as interactive action cards the learner can act on.
- [x] **Expand the typed skill registry and wire it into the live path** — resolved by the 2026-11-03 third audit (Task 120): the registry was ALREADY reachable from the live loop via the `coach_skill` tool, and `set_theme` joined as a first-class tool with server-validated tokens.
- [x] **Controlled multi-step agent loop: tool budget, chained calls, failure recovery, verification** — Task 120 confirmed the live loop already had all of it (MAX_STEPS=6, per-tier budgets, JSON salvage, read_state enforcement, honest failure replies) and made one chain stronger: a successful `set_theme` is converted into a client command BY THE LOOP from the tool's own validated data — the model triggers it, it cannot fake it (Task 120 battery case 4 proves the command carries the real Forest tokens).
- [x] **Conversational regression suite v1** — SHIPPED (Task 120): `scripts/agent-regression-120.sh` drives the live loop in probe mode through the acceptance table (greeting → no tools; direct question → direct answer; state question → read_state enforced; theme repaint → tool + server-verified command; probe hygiene → history untouched). Unit pins for routing/history/verifier/theme live in `scripts/test-router.ts` (23 checks). 6/6 live, 23/23 unit, all green.

### 10c · Third audit (2026-11-03, code-level): agent consolidation — claims vs code, then fixes

The auditor read the public source and flagged two competing agent implementations, duplicated history, a rigid Socratic persona, a 4×300 planner window, and a Persian-deleting verifier. Verified against the tree first (rule 4), then fixed:

- [x] **"Two competing agents" — TRUE but understated**: three stacks existed (`skills/agent.ts` behind /api/coach, `agent/run.ts` behind /api/chat, `coach-agent/loop.ts` behind /api/coach-agent). The auditor missed that the live sidebar loop already composed the registry via the `coach_skill` tool. **Fixed**: `skills/agent.ts` (+ its orphaned helpers `assess.ts`, `theme.ts`) deleted; `/api/coach` POST is now an explicitly deprecated alias executing the ONE canonical loop (`coach-agent/serve.ts`, shared with /api/coach-agent, announces `x-rah-deprecated`); `scripts/test-router.ts` repointed to canonical machinery. No third architecture built.
- [x] **Duplicated current-message history — TRUE in the dead path only**: the live surfaces load history BEFORE persisting the turn. The consolidation keeps that property structurally (`loadCoachHistory` documented in `coach-agent/history.ts`).
- [x] **Raw envelopes as assistant history — TRUE in the live path**: fixed by shared `loadCoachHistory`/`flattenCoach` (envelope JSON → spoken text) used by /api/chat and /api/coach-agent alike.
- [x] **Rigid Socratic persona — TRUE**: `basePersona` ("answer questions with a question", 80-word cap), the loop's STUDY MODE, and both `tutorSystem`s now ship an adaptive response policy: direct questions get direct answers first; practice stays Socratic; frustration changes the approach; length matches the ask.
- [x] **Planner 4×300 window — TRUE**: widened to 8×400 plus a confidence field; below 0.5 the turn routes to chat (which clarifies) instead of confidently launching the wrong lesson.
- [x] **Verifier deleting Persian sentences — TRUE**: it now MOVES Persian sentences into `fa_note` (the dedicated Farsi channel) and never drops content; length caps per field.
- [x] **aiJson per-type validation**: new `validate` option (contract violation = retry with the contract reminder, fallback only after the budget); wired into the coach turn (reply must be a non-empty string). The planner confidence rides the same option implicitly.
- [x] **Theme action through the live loop** — the holder's original demand ("it had ui changing ability before?!!"): `set_theme` tool (state tier, budgeted) resolves through the same parser the theme skill and tutor intent use, persists on `Learner.theme`, and the loop merges a server-verified `set_theme` command; the sidebar paints via the shared theme bus. Verified live: "make the UI theme green" → set_theme ran → command carries Forest tokens (`#34d399`).
- [x] **Mobile re-verified after the sidebar changes**: real-390×844 CDP sweep (`overflow-cdp-119.js`): 12/12 views bleed=0, boxes=0, hscroll=false.

## Teaching-quality queue (previous Phase P2 — still holder-approved)

1. [ ] Farsi-specific contrastive explanations deepened in review feedback (articles, countability, prepositions for Persian speakers).
2. [x] ~~Writing examiner register-goal conditioning surfaced in the UI~~ — SHIPPED 2026-11-02 (Task 116).
3. [ ] **Collocation training in the FSRS loop** — the deck has collocations; review directions don't target them yet.
4. [ ] Calibrated IELTS-style band feedback on the exam tab (descriptors the learner can act on).
5. [ ] Checkpoint scores bending the daily plan, visibly.

## Deliberately NOT planned (unchanged)

Local Whisper · phoneme scoring · new inference server · Redis · paid APIs · domain purchase · multi-gigabyte local models.

## Holder-blocked (parked, awaiting the holder — consent gates)

- Production login mail (domain decision, $0 rule).
- Old GitHub PAT revoke (`…Gf23`); new PAT (`…VVVS`) active and vaulted.
- Real-device test pass (iPhone checklist ready; emulation is not a substitute).
- Multi-week learner evidence (time-gated; timeline log accumulates).
- Old archived repository: monitored, no action without approval.

## Permanent engineering rules

1. **$0 budget** — no paid APIs, no domain purchase.
2. **4 GB deployment** — no large models, no bundle bloat, no unnecessary dependencies.
3. **Evidence hygiene** — probes never count as learning; cleanup verified after every battery.
4. **Claims-vs-diff audit** — every "done" claim verified against tree/API/runtime before trusted (this file obeys it: ticks carry evidence).
5. **Contracts frozen** unless a task explicitly repairs them; both sides ship together, additively where possible.
6. **Deploy at last, verified healthy** — every session closes with `bash scripts/deploy-gate.sh` (build → prod serve → real-browser smoke → commit/push → preview freshness). No session ends on a dev server.

## Execution log (condensed — full detail in `git log`)

- **T104–106** recovered feature layer live on all 12 surfaces + tutor tabs; Progress crash fixed at tree/wire/runtime.
- **T107–108** Writing core loop's three broken legs repaired; contracts doctrine established.
- **T109–112** GUI excellence groups A–E shipped; verify-by-eyes iterations 1–2; One Light Rule enforced; ui-ux-pro-max checklist added as second gate.
- **T113** DOM-level detector on the authed app (12 views via CDP); all AA contrast failures repaired; `rah-primary-action` token; **root-caused stale-next-server serving deleted chunks — ensure-server chunk-integrity check + gate kill-by-identity born**.
- **T114** recycle recovery only (git pull + artifact tar + BUILD_ID; drift fixed, no code diff).
- **T115** visual stimulation wave: strand identity v2, Today hero, celebration layer; detector round-trips caught 4 AI-tells + review cyan — all repaired same task; sweep authed-shell verification hardened; ensure-server staleness heuristic replaced by the honest chunk-existence check.
- **T116** recycle recovery (rebuild + redeploy); owned AA placeholder token (global `::placeholder` = `var(--muted)`); **P2 #2 register dial shipped end-to-end**; gate roads 1–5 green, road 6 failed closed on a **platform-side TLS fault** (ALB serving `CN=*.z.ai` for the preview host; app proven healthy behind it) — documented, workaround: Advanced → proceed.
- **T117** professional UI wave (holder-directed): glyph-carried identity, strand hues retired, button tiers (btn-primary/quiet/danger); **Rah logo + full icon set** (logo.svg, logo-square.svg, PNG 192/512/maskable/apple-touch from one geometry); **coach small-talk misroute root-caused and fixed** (deterministic SMALL_TALK gate, routing on this message only, capability honesty, verifier strips undeliverable offers) — verified live, probe hygiene clean.
- **T118 (2026-11-03)** platform TLS cert **fixed** (strict verify=0, HTTP 200) — road 6 unblocked; ROADMAP.md rewritten as this checkbox ledger from the holder's assessment; **Daily English Mission v1 SHIPPED** (§9): `/api/mission` (GET real state / POST atomic claim) + mission card on Today with four live steps; one scoping bug caught and fixed by the runtime probe — cardState/listeningLog are `learnerId`-keyed while reviewLog/speakSession/writingSub/mistakeFamily are session-`userId`-keyed, and querying the latter group with `"me"` silently read empty tables (documented in the route header); the probe also caught a stale next-server serving the pre-fix build — kill-by-identity + revive (Task 113 doctrine) re-proven; negative-path claim refused with 400, XP unchanged (507) throughout.
- **T119 (2026-11-03) — the holder's mobile bug report + second assessment ("fix the AI tutor first") + three real tutor failures:** (1) **Exam correctness root-caused from the holder's own data**: the stored exam carried an MCQ asking for the definite article and keyed to an article-less sentence with all choices ungrammatical — "many of the answers were wrong" was TRUE. Item replaced with a sound, gated version; exam generation gains vet rule (f) stem-key contradiction + a retry when the vet call fails. (2) **Tutor fabrication fixed at the surface the learner actually uses**: the tutor hub chat posts to `/api/ai` action=tutor, which bypassed the entire governed agent — honesty rules added to the prompt, a post-filter strips fabricated review claims, and two deterministic intents run before the LLM: exam disputes (grounded reply quoting the real stored exam + real gate verdicts, verified live) and theme repaint (six presets; "make the UI theme green" now actually repaints the app via Forest tokens, client applies them in-turn). (3) **Tutor context v1**: due count + top mistake family now ride in every tutor turn. (4) **Mobile overflow fixed**: CDP audit at a real 390×844 viewport (agent-browser cannot size pages; scripts/overflow-cdp-119.js drives Emulation.setDeviceMetricsOverride directly) found the mission card's truncate-in-grid blowing the page sideways (labels now wrap) and the install banner covering the bottom rail (moved above it); the rail went icon-first with the active tab labeled because twelve one-word labels cannot fit 390px without colliding. Final audit: all 12 views hscroll=false, bleed=0, text-out-of-box=0; sweeps desktop+mobile clean (standing Arcade advisory waived).
- **T120 (2026-11-03) — the third audit (code-level) answered: ONE canonical agent.** Verified every audit claim against the tree first (three stacks, not two; the live path was /api/coach-agent all along; the dup-message bug lived only in the dead path; envelopes-in-history was live). Then: `skills/agent.ts`/`assess.ts`/`theme.ts` deleted, `/api/coach` POST → deprecated alias of the shared canonical loop (`coach-agent/serve.ts`); `loadCoachHistory`/`flattenCoach` normalize history on every surface; adaptive response policy replaced the unconditional Socratic persona in all four prompt sources; planner 8×400 + confidence→chat; verifier moves Persian to `fa_note` instead of deleting; `aiJson` gained per-caller `validate`; **`set_theme` restored the agent's app-repaint ability in the sidebar** (tool → server-verified command → theme bus) — plus a real bug found on the way: the `coach_skill` example advertised a nonexistent `/quiz` command. Regression: `test-router.ts` 23/23 unit, `agent-regression-120.sh` 6/6 live in probe mode (greeting, direct answer, read_state enforcement, theme command, probe hygiene), real-390px CDP sweep 12/12 clean, theme captured-and-restored around the battery.
- **T121 (2026-11-03) — RE Lab: browser-first reverse-engineering capability (agent tooling, outside the Rah app; no app code touched).** Holder directive: online platforms first, minimal local downloads, approval before any third-party upload, samples never executed on the host. Researched live: VT v3 (free 4/min·500/day), Triage v0 (Bearer, public reports), ANY.RUN (browser-first; API account-gated), MalwareBazaar (keyless API verified 401 + public pages verified bot-gated behind a `/verify-ua` JS challenge even with a browser UA → browser-first or free Auth-Key), Hybrid Analysis v2, FileScan (docs-tier); "OpenBin" unverified as a platform — documented as such. Built stdlib-only (`scripts/re/`): `re_core.py` (hashes, Shannon + block entropy, pure-Python PE parser with imports-by-name/ordinal + best-effort imphash, packer-section/UPX detection, ASCII+UTF-16 strings, IOC sweep), `re_intel.py` (deep links, honest `browser_required` classification, keyed lookups, **double consent gate** `UPLOAD:<sha256[:12]>`, JSONL audit ledger of lookups/uploads/refusals), `rex.py` CLI (`id entropy pe strings iocs triage links lookup report upload ledger selftest`), `skills/re-lab/SKILL.md` (doctrine: no-execution, no heavy downloads, evidence classes measured/heuristic/external/unknown), `download/re-lab/PLAYBOOK.md` (platform table + Ghidra/IDA/x64dbg/GDB/Procmon/Wireshark/Volatility/DIE/HxD VM doctrine). Evidence: selftest 16/16 (incl. synthetic benign PE round-trip and subprocess gate-refusal), live lookups end-to-end, demo report on a stand-in ELF at `download/re-lab/reports/bd6686bf7a650a97.md`.
- **T122/122b (2026-11-03) — probe hardening + honest mobile audit.** `probe-hardening-test.ts` 16/16: `re_case_record` delete refused under `x-rah-probe:1`, `set_theme` dry-runs, triage flags resolve without DB, the loop strips model-spoofed `_probe`/`_history` args; P1 schema validation landed as `ai-validators.ts` (11 envelope validators wired into writing/speak/placement/quiz/listen/scan/plan/clinic/exam/submit/briefing, 44/44); exam-submit's mechanical fallback stamps `degraded` + a tutor UI notice. 122b caught the 119/119b audits' own blind spot — headless Chrome clamps `--window-size` to 500px, so the "390px" sweeps never tested 390 — and re-pinned 13/13 PASS at a true 390×844 via CDP `Emulation.setDeviceMetricsOverride` (`overflow-audit-390.ts`), plus the CoachSidebar parked-drawer `pointer-events-none` fix and the deploy-gate auth fallback.
- **T123 (2026-11-03) — the go-big wave: three critical features + five polish/audit items, one session.** (1) **§3.1 Voice shadowing SHIPPED**: `lib/shadowing.ts` + `/api/speak/shadow` + a shadowing door in the Speaking studio — 12 interference-tagged targets ordered weakest-focus-first from real ledgers (SoundLog error rates + shadow-miss pressure), TTS model audio at 0.85/1.0, measured ASR-alignment word chips, cross-attempt miss ledger where a word missed 3× mints exactly one FSRS card (`shadow-miss:<word>` marker dedupe); live TTS→ASR roundtrip scored 100 with zero probe writes. (2) **§3.2 Listening library SHIPPED**: 27 authored comprehension questions (grounded — every evidence line a verbatim transcript quote, battery-pinned), sentence-level replay segments at 0.85x, per-word vocab→queue minting (`listen-vocab:<passage>:<word>`, live dedupe verified); accents honestly NOT claimed (one built-in TTS voice). (3) **§3.3 Cross-device drafts SHIPPED**: `/api/write-draft` on a Setting row (no migration) + pure `resolveDrafts` (LWW on save time, identical text never claims conflict, restore banner), probe refuses writes, live round-trip. (4) **§9 recap + restart SHIPPED** on the mission card (zero AI, both-windows-or-nothing). (5) **§8 audio caps enforced**: server-side WAV duration parse, >180s → honest 413 on both ASR funnels, live-proven with a synthetic 200s clip. (6) **C-7 closed**: Mind Reader face on Progress (decline states + heal bar + both correction powers). (7) **P1 context compression closed**: shared bounded seam `coach-agent/context.ts` — loop + planner draw one implementation (8 turns/400 chars/3600 budget, spoofed system rows dropped, screen JSON never breaks under its 900-char cap). (8) **P2 100-case regression SHIPPED** (`test-conversations-100.ts`, per-class metrics) — it caught four REAL routing bugs, all fixed: power-before-core registry order misrouting "explain phrasal verbs", generate-exam's `/\bexam\b/` net launching the builder on history questions ("what did I score on the last exam"), exam-history missing the score-question shapes, and the state gate missing "how much xp do I have". Evidence: batteries 31+23+17+10+12+21+101 checks + router 23 + validators 44 + probe-hardening 16 + re-tools 32, live battery 15/15 (`live-gobig-verify.sh`), agent regression 6/6, real-390px 13/13, tsc clean, eslint clean, deploy gate GREEN (`b9e2004`).
