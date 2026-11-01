# Rah — Roadmap

*Living document. Updated at the end of every task group. Current as of Task 112 (2026-11-01).*

## Where the project stands

The recovered feature layer (Tasks 104–106) is live on all 12 surfaces + tutor's 5 tabs; the learner-reported Progress crash is fixed and verified at tree/wire/runtime; the Writing core loop's 3 broken legs are repaired (Task 108); every strand's write path is verified end-to-end with evidence hygiene held. Green CI is not trusted without a live claim-vs-tree audit — that gate stays permanent.

**The verdict that set the current phase:** *the next phase is about making the complete learning experience dependable and improving its teaching quality — not rebuilding infrastructure.*

## Phase P1 — GUI excellence (Groups A–E SHIPPED; polish-iteration pass ACTIVE, Tasks 109–110+)

**Status:** all five groups shipped 2026-10-31 (commits fc8a0f3 → 2861a71, CI #23/#24 green, 19-surface sweeps ALL-PASS, 3-viewport screenshots under `db/evidence/ui/{after-a,after-bc,after-d,desktop,tablet,mobile}`). Task 110 reconciled the ledger after the recycle (data restore + hourly vault protection) and restored this document. Task 111 ran the first verify-by-eyes iteration (detector-driven token re-homing, progress unit-honesty, battery probe hygiene). Task 112 ran the second (2026-11-01), now also driven by the holder-cited ui-ux-pro-max-skill checklist: One Light Rule enforced everywhere (9 reading segment fills + sound/grammar/checkpoint selected states demoted to raised-tonal, 8 arcade CTAs re-homed to signal blue, VoiceArena record in Honest Red), coach FAB lifted clear of the mobile rail, fortnight chart bars fixed (percentage-vs-auto-height collapse), tutor composer unclipped, global cursor:pointer, capture-harness session warmup, boot-regression runner re-homed onto PostgreSQL, detector 0 findings. **Task 113 ran the third iteration (2026-11-01) — the first with the DOM-level detector on the authenticated app (12 views, real browser via CDP): shell dark-on-dark text fixed (color: var(--muted) misuse in App/CoachSidebar → muted-foreground), all AA contrast failures repaired (btn-primary + Install + PairsGame moved to the new documented `rah-primary-action` #2f62c4, 5.5:1; review due pill deep blue), every colored blue glow replaced with neutral elevation, functional text floors enforced (FAB badge 11px, mobile rail 11px, sidebar meta 11-12px, fortnight chart weekday labels 9.5→11px, arcade/review meta 12px), reading placeholder lifted to 5.2:1, fortnight caption reworded + measure capped, BlitzDeck tile 64→48px.** Also Task 113 root-caused a deployment-failure class: next-server renames its process title so pkill-by-path misses it — a stale in-memory build survived three restarts serving HTML that referenced deleted chunk names (the holder's "Application error" class); ensure-server now detects a serving process older than the on-disk BUILD_ID and flips, and deploy-gate kills every server identity before reviving + verifies every served chunk exists on disk. What remains of P1: keep iterating — fresh sweeps, both skills' detectors, fix what they and the eye catch. **Task 114 (2026-11-01)** was recycle recovery only (git pull + artifact tar restore + drift-record fix; no code diff, evidence folded into e07f404). **Task 115 (2026-11-01) — the visual stimulation wave, holder-directed ("the app still lacks visual stimulation"):** strand identity v2 (every study strand owns a vivid hue pair + glyph tile, mapped in DESIGN.md, replacing the four-indistinguishable-greens ramp), `StrandIcon` tile system in bits.tsx, Today rebuilt (ambient hero with solid-ink display headline + streak flame + XP pills, strand-colored plan cards with glowing hover lift and sheen progress bars, icon'd quick stats), dependency-free celebration layer (`next/celebrate.tsx`: XP-delta burst on every XP gain, confetti on level-up, both reduced-motion-safe), icon'd quiet header line, Login first-impression glow + strand strip, gradient Bar with sheen sweep, EmptyState faces. Contrast floors from Task 113 untouched; all new motion stills under prefers-reduced-motion. Detector round-trip: the first mobile sweep caught 4 AI-tell findings on the new hero (gradient text, cyan-on-dark pill/wash, kicker-above-heading, chromatic breathe halo) — all repaired in the same task (solid #cfe0ff ink headline, neutral-gold XP pill on hairline border, kicker deleted, breathe shadow neutralized, cyan radial dropped); a second round flagged the review strand's cyan gradient — the strand re-hued to lime (tell-hue constraint now documented in DESIGN.md); text-wrap:pretty added for the straggler advisory. Sweep tooling hardened: the DOM sweep now verifies the authed shell before scanning (the first mobile run silently swept the LOGIN page 12×) and the capture harness got the same fix. **Infra repair found by the gate (Task 115): the Task 113 staleness heuristic in ensure-server (BOOT_AT vs BUILD_ID mtime) could never fire because /api/version's startedAt is a rolling per-serve timestamp — a 19:52 stale next-server survived the 20:02 release serving HTML that named chunks the new build had wiped (ChunkLoadError → "Application error", the exact holder-seen incident class), caught only by the new authed-shell browser gate. ensure-server now detects staleness the honest way: every chunk the served HTML references must exist on disk; verified live.**

Method: the **Impeccable** skill (pbakaus/impeccable, installed at `.github/skills/impeccable/`, v4.8.0) — PRODUCT.md + DESIGN.md captured; every group follows the skill's playbooks (typeset → layout → animate → harden/adapt per surface group), with the craft-floor rules read before every edit and the 62-rule slop detector as the ban list (no purple gradients, no pills-for-decoration, no generic AI aesthetics, no fake metrics). Since Task 112 the **ui-ux-pro-max-skill** (nextlevelbuilder) pre-delivery checklist rides along as the second gate: cursor-pointer on clickables, reflow without clipping, focus states, reduced motion, 375/768/1024/1440 responsive proof.

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
6. **Deploy at last, verified healthy (holder directive, 2026-11-01)** — every session CLOSES with `bash scripts/deploy-gate.sh`: fresh production build → port 3000 flipped to the standalone → real-browser smoke that FAILS on any client-side exception (a JSON health endpoint cannot see a crashed client bundle — the Task 113 incident) → commit/push → preview freshness. No session ends on a dev server.
