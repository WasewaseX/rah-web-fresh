# Rah — Roadmap

Single-learner English-learning app (B2 → C1) for a Farsi-speaking learner.
Next.js standalone production build · Prisma · PostgreSQL 16.2 (pgserver wheel, TCP 5433) · Bun.
Public repo: `WasewaseX/rah-web-fresh` · Private data vault: `WasewaseX/vault` (never receives public-repo code, never ships learner data to the public repo).

Last updated: 2026-11-01 (Task 110).

---

## Where the project stands

Shipped and verified (CI green, 19-surface sweep ALL-PASS on production):

- **Core loop**: FSRS-5 review (218-card deck), placement, four strands (writing / speaking / listening / reading), tutor chat with 7-day plan + diagnosis + clinic + exam tabs, grammar, sound & rhythm, arcade, checkpoints, progress (full additive contract), AI settings.
- **Task 107**: persisted e2e batteries — `scripts/e2e-surface-sweep.sh` (19 surfaces), `scripts/e2e-login.sh`, boot-regression harness (cookie bug fixed).
- **Task 108**: Writing core loop repaired (3 broken legs: graded feedback render, history, revision-chain save); track write paths for checkpoint/listening/speaking/grammar verified live on prod.
- **Task 109**: holder lockout repair — owner-email allowlist (`RAH_OWNER_EMAILS`) bypasses the deployment lock; deterministic owner access code (`RAH_ACCESS_CODE`, timing-safe, IP-throttled); owner emails unify onto ONE canonical identity (no data split); login screen gained the access-code path + embedded-frame hint.
- **Task 110**: recycle recovery — platform restore rolled the DB back ~6 days; surgical restore of the documented Oct-31 state (xp 491 / streak 1 / 18 reviews); hourly PG dump + vault push (loss window now ≤ 1 h); e2e-login browser warmup fix.

Learner evidence baseline (honest, no synthetic history): xp 491 · streak 1 · 18 lifetime reviews · 38 tutor msgs · writing 0 · speaking 0 · listening 0.

---

## Active mandate: the Impeccable GUI overhaul

Install and apply the **Impeccable** design vocabulary (https://github.com/pbakaus/impeccable) to rah-web-fresh. Audit the ENTIRE app, then redesign and polish every learning surface to exceptional professional product quality.

Phases (each ends with: `tsc --noEmit` + eslint + `scripts/build-prod.sh` + prod swap + 19-surface sweep + boot-regression + CI green):

1. **Install + init** — `npx impeccable install`; `.impeccable/PRODUCT.md` (constraints below); `.impeccable/DESIGN.md` documenting the existing token layer (`var(--rah-*)`, `var(--muted)`, `var(--line)`…). No new runtime dependencies.
2. **Audit** — baseline browser screenshots of every surface at desktop (1440), tablet (834), mobile (390); `critique`/`audit` findings; list concrete defects per surface (hierarchy, spacing, type scale, empty/loading/error states, feedback, a11y).
3. **Design-system consolidation** — one coherent token set: type scale, spacing rhythm, radii, elevation, color roles (dark UI), motion tokens. Extend the existing CSS-variable layer; no UI library, no Tailwind plugin additions.
4. **Per-surface redesign sprints** — order: shell+nav → Today/home → Review → Writing → Tutor → Reading/Listening/Speaking → Grammar/Sound → Placement/Checkpoint → Progress/Arcade/Settings. Screenshot-iterate until visibly excellent. Preserve ALL backend contracts; no purple gradients, no pill spam, no fake metrics, no generic AI aesthetics.
5. **Responsive + a11y + states pass** — mobile-first layouts for every surface; keyboard/focus/ARIA review; empty, loading, error and offline states everywhere; interaction feedback (hover/active/pressed, optimistic where safe).
6. **Hardening** — `polish`/`harden`/`adapt` review, final sweep at all three viewports, learner-evidence unchanged, ship.

Rules that bound all of the above: **$0 budget** (no paid APIs, no domains), **4 GB box** (no big models, no bundle bloat), single-learner singleton, evidence hygiene (probes reverted, no synthetic history), claims-vs-diff audit gate (every "done" claim verified against the live tree/server).

---

## Feature queue (post-blockers, in order)

1. Voice shadowing (speaking strand depth)
2. Structured listening library
3. Cross-device writing drafts
4. Farsi-specific explanations tuned by diagnosis data
5. Collocation training on the FSRS rail
6. Calibrated IELTS-style feedback with band rubrics
7. PDF / EPUB / web-page import into readings
8. Versioned curriculum (content packs with migration safety)

Deliberately NOT on the list: local Whisper, phoneme scoring, a second inference server, Redis, any paid API.

---

## Holder-blocked items (do not act without the holder)

- **A-6 login decision** — no domain purchase; preview-URL access stays.
- Old PAT revoke (ends `…Gf23`) — ends sessions authenticated by it.
- Real-phone testing of mobile layouts and audio capture.

## Infrastructure doctrine (do not regress)

- Builds: foreground `scripts/build-prod.sh` (hard-guards BUILD_ID, artifact-secret gate) → `scripts/dev-or-prod.sh` swap; background `nohup` builds die with the shell.
- After every sandbox recycle: `bash scripts/ensure-watchdog.sh`, then rebuild + swap (the platform supervisor respawns dev-mode on :3000 until a standalone build exists).
- `.env` wins over platform env (Task 98); env restored from `upload/rah-backups/env-rah-latest` on recycle (Task 100).
- Data survival: hourly PG dump + vault push (Task 110), daily snapshot + integrity repair; the public repo NEVER receives learner data (REG-2).
- Auth: registration locked; owner aliases resolve to one canonical identity; devCode stays dev-only; access code lives only in `.env`.
