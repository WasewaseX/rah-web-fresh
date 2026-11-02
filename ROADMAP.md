# Rah — Roadmap

*Checkbox ledger, rewritten 2026-11-03 (Task 118) from the holder's full product assessment (2026-11-02, sections 1–10). **How to read:** a ticked box was verified against the tree and the live runtime before ticking (rule 4) — the line names its evidence. An unticked box is genuinely open, with the already-built basis named. **Overall completion vs the original goal: ~70%** (the assessment's independent estimate: 68–72%).*

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

- [ ] **Goal-bound voice shadowing** — listen → imitate → word-level compare → recurring errors become FSRS items. Basis live: Sound Lab word tier, `SpeakSession`, mistake families.
- [ ] **Structured B2–C1 listening library** — graded clips, several accents, transcripts, replayable segments, comprehension questions, vocabulary extraction. Basis live: listening strand with rounds + `ListeningLog`.
- [ ] **Cross-device writing + improvement history** — server-saved drafts, conflict resolution, rubric-linked before/after deltas. Basis live: `WritingSub` revisions already server-side.

## 4 · Ten polish items (assessment section 4 = C-1…C-10 in `TASK-95-BACKLOG.md`)

- [ ] **C-1 Review queue** — FSRS queue live; "why due now" explanation, new-vs-revision distinction, scheduling confidence open.
- [ ] **C-2 Talk conversation** — talk mode live; mic recovery, interruption handling, mobile-browser behavior, typed fallback open.
- [ ] **C-3 Sound Lab** — word-level measured tier live; measured-vs-inferred separation, confidence display, replayable examples open.
- [ ] **C-4 AI coach evidence** — capability honesty + no-undeliverable-offers shipped (Task 117, rules 7–9 + verifier strip); full evidence panel (tools ran, what changed, resume) open.
- [ ] **C-5 Exam generation/grading** — exam loop live; distractor-plausibility tests + rubric calibration vs human-rated answers open.
- [ ] **C-6 CEFR placement** — placement + `PlacementResult` history live; skill-specific sample counts + explicit uncertainty display open.
- [ ] **C-7 Mistake memory** — `MistakeFamily` + forgiveness live; per-error decline-over-time surfacing to the learner open.
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
- [ ] Audio upload compression + server-side duration caps (client caps exist; server limits unverified).
- [ ] Real-device microphone/keyboard/touch-target pass (→ §2.3).

## 9 · Retention hook — The Daily English Mission (assessment section 9, its #1 recommendation)

**Rule: XP is awarded only when the learning action is measured as done.** No new currencies, no superficial rewards.

- [x] Today opens on a mission built from real weak spots + due reviews — **SHIPPED 2026-11-03 (Task 118)**: mission card on Today, four steps computed server-side from the FSRS due queue (canonical due filter, target = min(due, 8)), today's ListeningLog / SpeakSession / WritingSub counts, and the top open MistakeFamily for the speaking step.
- [x] Step 1 · clear the due review queue (FSRS). Step 2 · one listening round. Step 3 · one speaking attempt aimed at a recurring error. Step 4 · one short writing applying today's expressions.
- [x] Completion → +50 XP once per day — **SHIPPED**: claim is atomic (the `Setting` row `mission:<day>` primary key is the ledger; double-submit rolls back, zero XP); honest 400 refusal while incomplete; verified live with XP unchanged on the negative path.
- [ ] Weekly recap: what measurably improved.
- [x] Streak protection — already live (freeze banking absorbs one missed day; `touchStreak`).
- [ ] Missed day → supportive restart plan (no guilt).
- Basis live: Today plan cards, hero signals, `DailyStat` per-strand counters, FSRS due queue, `MistakeFamily`, XP/streak engine.

## 10 · Execution order (assessment section 10, merged with Rah's P1→P3 history)

| # | Phase | Status |
|---|---|---|
| 1 | Email, credential, privacy blockers | [x] done except holder-blocked email delivery (§2.1) |
| 2 | Full end-to-end test of all existing surfaces | [x] emulated complete; real-device open (§2.3) |
| 3 | **Daily English Mission** (§9) | [x] v1 SHIPPED 2026-11-03 (Task 118); weekly recap + restart plan open |
| 4 | Voice shadowing (§3.1) | queued |
| 5 | Listening library (§3.2) | queued |
| 6 | Writing draft sync + improvement history (§3.3) | queued |
| 7 | Polish the ten (§4, C-1…C-10) | queued; items absorbed as strands ship |
| 8 | Real-device offline + multi-week validation | ongoing, time-gated, holder-blocked |

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
