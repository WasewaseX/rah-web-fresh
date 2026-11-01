# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One primary user: a single adult learner, a native Farsi speaker, studying English on a self-set road from B2 toward C1. They use Rah daily in short sessions, mostly on a phone (real-device verification pending; iPhone emulation used so far). There is deliberately no second audience: registration is locked to this one learner (Task 99). The holder/developer operates the repository and infrastructure; they are not an in-app audience.

*(Users and operating context inferred from 108 recorded project tasks and the holder's briefs; the learner's own answers were never collected.)*

## Product Purpose

Rah ("راه" — road in Farsi) is a single-learner English-learning app that turns daily study into an honest, measurable road from B2 to C1. Success means: the learner returns daily by choice, produces language (not just recognizes it), repairs their own errors, and every number shown is measured from real rows — never decorative.

## Positioning

Honest-evidence tutoring that no engagement-optimized competitor could copy without deleting its own growth mechanics: one learner, produce-before-check pedagogy, retrieval-direction accuracy tracked per review (FSRS), Farsi-native explanations of errors, and a visible refusal to fake progress. The app would rather show an empty honest state than a flattering lie.

## Operating Context

- Deployment: Next.js standalone production build on a 4 GB-RAM sandbox; PostgreSQL 16 via local pgserver (TCP 5433); Bun/node toolchain. Supervisor scripts revive services after workspace recycles.
- Budget: strictly $0 — no paid APIs, no domain purchase. Mail delivery is sandbox-limited: Resend's sandbox delivers ONLY to the account owner's address (geministudent@atomicmail.io, verified live Task 109); a deterministic owner access code (RAH_ACCESS_CODE) covers the holder when mail fails (Task 109).
- Learner identity: exactly one row (`Learner.id = "me"`, createdAt 2026-10-20). Registration locked.
- Evidence hygiene: automated test/probe activity must never count as learning progress; probe rows are deleted and ledger deltas reverted after every battery.
- The learner reads English UI copy with Farsi support text (`.fa-text`, RTL) for explanations and error reasons.

## Capabilities and Constraints

- Surfaces: Today/home, Review (spaced retrieval, 8 retrieval directions), Writing (draft → examiner feedback → repair → model), Speaking (record, self-eval), Listening, Reading, Grammar, Sound (pronunciation perception), Placement, Progress, Checkpoint, Tutor (Chat/7-day plan/Diagnosis/Clinic/Exam), Arcade, AI-engine settings.
- FSRS scheduling with live interval previews; direction-accuracy ledger per review; mistake-memory families; writing examiner with LanguageTool grounding; XP/streak/daily-goal ledgers; checkpoints; coach sidebar agent.
- Hard constraints: $0 budget; 4 GB RAM (no large local models, no inference servers, no Redis, no bundle bloat); preserve all backend contracts (route payloads are audited and verified); no new heavy dependencies for visual work.
- Explicitly undecided (holder-blocked): production login mail (domain purchase A-6), old GitHub PAT revoke, real-device test pass, voice shadowing and later feature-queue items.

## Brand Commitments

- Name: **Rah** — the road metaphor is the product's voice ("your road from B2 to C1", day-count framing).
- Voice: direct, warm, never patronizing; speaks to one person; explains the WHY of every exercise; honest about what is unproven ("No level yet", "Progress is resting").
- Banned by the holder's brief: generic AI aesthetics, purple gradients, excessive pills/chips, fake metrics, unnecessary dependencies.
- Existing themes: Midnight (dark, default for the recovered `.rah-next` generation) and a cream light theme; green accent family; scoped design tokens under `.rah-next`.

## Evidence on Hand

- Real learner rows (2026-11-01, post-recycle restore): streak 1, xp 491, 18 lifetime retrievals, 38 tutor messages, 0 writing/speaking/listening submissions — the empty strands are real absences the UI must represent honestly.
- Visual evidence: 19-surface browser sweep logs (db/evidence/surface-sweep-latest.log); screenshots to be regenerated per design group under db/evidence/ui/.
- Prior audit gates: every API payload the UI consumes is verified in tree and on the wire (Tasks 106–108).

## Product Principles

1. **Honesty outranks delight.** Any number that exists for show gets deleted; empty states say what is real.
2. **Produce before check.** The learner writes/speaks/recalls first; feedback second. UI sequences follow this.
3. **The repair is the exercise.** Error correction alone is not learning; every flow ends in re-use.
4. **Measure first.** Placement, direction accuracy, and strand balance bend the plan; the UI makes the measurement feel like progress, not an exam.
5. **One road, no guilt.** Missed days reset without punishment; the streak is information, not a lash.

## Accessibility & Inclusion

- Farsi (RTL) text blocks must render with proper direction and a readable face alongside Latin text.
- Phone-first: every surface must work one-handed at 390 px; desktop is the secondary target (1440 px), tablet checked at 768 px.
- Respect `prefers-reduced-motion` (already honored by the WebGL backdrop guard); keep it honored for all new motion.
- Honest states for session expiry (no crash, a sign-in path) — an accessibility-adjacent trust rule already shipped in Task 106.
