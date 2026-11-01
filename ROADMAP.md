# Rah — Roadmap

*Living document. Updated at the end of every task group. Current as of Task 110 (2026-11-01).*

## Where the project stands

The recovered feature layer (Tasks 104–106) is live on all 12 surfaces + tutor's 5 tabs; the learner-reported Progress crash is fixed and verified at tree/wire/runtime; the Writing core loop's 3 broken legs are repaired (Task 108); every strand's write path is verified end-to-end with evidence hygiene held. Green CI is not trusted without a live claim-vs-tree audit — that gate stays permanent.

**The verdict that set the current phase:** *the next phase is about making the complete learning experience dependable and improving its teaching quality — not rebuilding infrastructure.*

## Phase P1 — GUI excellence (Groups A–E SHIPPED; polish-iteration pass ACTIVE, Tasks 109–110+)

**Status:** all five groups shipped 2026-10-31 (commits fc8a0f3 → 2861a71, CI #23/#24 green, 19-surface sweeps ALL-PASS, 3-viewport screenshots under `db/evidence/ui/{after-a,after-bc,after-d,desktop,tablet,mobile}`). Task 110 reconciled the ledger after the recycle (data restore + hourly vault protection) and restored this document. What remains of P1: verify-by-eyes iteration — fresh screenshots, the skill's own audit/critique detectors, fix what they and the eye catch, per-group gates as below.

Method: the **Impeccable** skill (pbakaus/impeccable, installed at `.github/skills/impeccable/`, v4.8.0) — PRODUCT.md + DESIGN.md captured; every group follows the skill's playbooks (typeset → layout → animate → harden/adapt per surface group), with the craft-floor rules read before every edit and the 62-rule slop detector as the ban list (no purple gradients, no pills-for-decoration, no generic AI aesthetics, no fake metrics).

Verification per group: production build + 19-surface browser sweep + boot-regression + real screenshots at **desktop 1440 / tablet 768 / mobile 390** compared before/after. Backend contracts are frozen: no route payload changes in P1.

| Group | Surfaces | Focus |
|---|---|---|
| A | Shell/nav + Home/Today + shared bits | typography ladder, hierarchy, spacing rhythm, nav clarity, ambient light coherence |
| B | Review + Writing + Speaking | the core produce-check-repair loops; state feedback; focus flow; recording UX |
| C | Listening + Reading + Grammar + Sound | study rhythm, media layouts, lesson progress honesty |
| D | Progress + Placement + Checkpoint + Tutor + Arcade + Settings | data storytelling (honest charts), forms, tutor payload cards, settings calm |
| E | Cross-cutting | empty/loading/error states, interaction feedback, a11y (focus rings, RTL Farsi, reduced-motion), 3-viewport adaptation pass |

Each group lands as its own commit + CI green + before/after screenshots under `db/evidence/ui/`.

## Phase P2 — Teaching quality (next after P1)

1. Farsi-specific explanations deepened in review feedback (contrastive grammar: articles, countability, prepositions for Persian speakers).
2. Writing examiner: register-goal conditioning surfaced in the UI (the goal dial is wired; the learner never sees it).
3. Collocation training in the FSRS loop (the deck has collocations; the review directions don't target them yet).
4. Calibrated IELTS-style feedback on the exam tab (band descriptors the learner can act on).
5. Checkpoint scores feeding the daily plan visibly (measurement → plan bend, made visible).

## Phase P3 — Feature queue (post-P2, holder-approved items)

Voice shadowing → structured listening library → cross-device writing drafts → PDF/EPUB/web import → versioned curriculum. Deliberately NOT planned: local Whisper, phoneme scoring, new inference server, Redis, paid APIs, domain purchase.

## Holder-blocked (parked, awaiting the holder)

- **A-6 production login mail** — needs the holder's domain decision ($0 rule means no purchase without consent).
- **Old GitHub PAT revoke** (ends `…Gf23`) — consent gate; new PAT (`…VVVS`) active and recorded in the vault.
- **Real-device test pass** — iPhone checklist ready (DEVICE-TEST-CHECKLIST.md, offline tests A–F); emulation is not a substitute.
- **Multi-week learner evidence** — time-gated; the evidence timeline log accumulates honestly.

## Permanent engineering rules

1. $0 budget — no paid APIs, no domain purchase.
2. 4 GB deployment — no large models, no bundle bloat, no unnecessary dependencies.
3. Evidence hygiene — probes never count as learning; cleanup verified after every battery.
4. Claims-vs-diff audit — every "done" claim verified against the tree/API/runtime before it is trusted.
5. Contracts frozen unless a task explicitly repairs them (Tasks 106–108 doctrine: both sides of a contract change ship together, additively where possible).
