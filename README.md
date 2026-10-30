# Rah — a single-learner English-learning app

Rah is a working, reliable, lightweight, **$0** English-learning web app built for
one Farsi-speaking learner. It is not a demo or a flashcard skeleton: it is a
daily-driver learning system — spaced repetition, reading, writing, speaking,
pronunciation, exam practice, progress tracking — designed to survive
interruptions, offline periods, and hostile infrastructure.

## What it does today

| Area | State |
|---|---|
| Learning engine | FSRS spaced repetition with per-tag mastery tracking and a proven-only curriculum gate (B2 → B2+ → C1) |
| Reading | Bring-your-own-materials: paste text → one AI extraction → deterministic source-checked learning cards in the same review queue |
| Anki | CSV/TSV and `.apkg` import/export |
| Writing | Grammar checks, diagnosis, autosaved drafts, revision history |
| Speaking / pronunciation | Measured word-level pronunciation feedback (see the $0 constraint below) |
| Exams | IELTS / TOEFL / Cambridge-style practice tracks with honest "practice estimate" labeling |
| Coach | AI coach with learner memory, correction and forgetting controls |
| Offline | Offline app shell, review/game queue with replay-safe sync |
| Progress | Goal planner, daily stats, recall measurements, weekly checkpoints |
| Reliability | PostgreSQL with automated restore drills, boot-road self-healing guards, offsite backup chain, alert layer |

Honest limitations: exam scores are practice estimates (not validated against
human-rated responses yet); pronunciation is word-level, not phoneme-level;
real email login is currently blocked on a provider limitation (see below).

## The constraints that shape everything

1. **Strict $0.** No paid APIs, no trials. The AI surfaces run on free-tier
   providers; speech scoring uses the existing word-level measured tier.
2. **Lightweight deployment.** ~4 GB RAM box. No multi-gigabyte local models,
   no resident inference services, no Redis. Heavy work happens behind
   server APIs or not at all.
3. **One learner.** Registration is locked to the first account; all learner
   data is user-scoped at the database level.
4. **Nothing sensitive without consent.** Any action on the holder's assets
   beyond normal app operation (deleting/archiving repos, visibility,
   history, data deletion) requires the account holder's explicit approval
   first. This is a standing rule, not a courtesy.

## Stack

- Next.js 16 (App Router) with `output: "standalone"` production builds
- PostgreSQL 16 (userspace `pgserver` wheel, TCP 5433, trust auth on loopback)
  via Prisma; versioned migrations with a single PG baseline
- Bun for the toolchain; Node for the standalone server
- GitHub Actions CI (postgres:17 service) on every push

## Operations (the part that took the longest to get right)

The deployment recycles its workspace without warning. The project treats
that as a first-class condition — the boot road self-heals in this order:
restore `.env` from the preserved copy → ensure the pgserver wheel →
restore/verify the PostgreSQL data dir from the newest sha256-verified dump →
restore the production build artifact (BUILD_ID missing = sha-gated untar) →
boot → drift-check the served build against the intended-release record.

Key scripts: `scripts/dev-or-prod.sh` (the real boot road),
`scripts/pg-survival.sh`, `scripts/pg-wheel-ensure.sh`, `scripts/ensure-server.sh`,
`scripts/build-prod.sh`, `scripts/artifact-secret-gate.sh`, `scripts/vault-sync.sh`,
`scripts/deploy-drift-check.sh`, `scripts/privacy-sweep.py`, `scripts/alert.sh`.

Build artifacts never ship through git (size); they live as a
sha256-manifested release asset (`build-latest` tag) plus local copies. Every
artifact passes `scripts/artifact-secret-gate.sh` — an allowlist-of-paths plus
secret-content-patterns gate — before it can be published anywhere. This gate
exists because a build artifact once shipped workspace files publicly; the
incident record and the fix live in `TASK-95-BACKLOG.md` (Task 102 ledger).

## Documentation map

- `TASK-95-BACKLOG.md` — the governed backlog (A–E), per-task ledgers with
  claims-vs-proof tables, standing rules
- `ROADMAP-STATUS.md` — the external audit, item by item, with status + evidence
- `ROADMAP-AUDIT.md` — combined plan + incident log
- `FRESH-REPO-MIGRATION.md` — the privacy migration record and the
  holder's decisions on the old repository
- `OFFLINE-TEST-PROTOCOL.md` — the seven physical-device offline scenarios
- `EMAIL-OPERATIONS.md` — mail provider runbooks and the current delivery blocker
- `PRONUNCIATION-VALIDATION.md` — the pronunciation acceptance criteria
- `PILOT-PROTOCOL.md` — the multi-week real-learner measurement protocol
- `worklog.md` — the full chronological engineering log

## Status

Tracked in `ROADMAP-STATUS.md` and `TASK-95-BACKLOG.md` (both carry
"Last updated" headers with per-task summaries). The short version: the core
application and learning engine are substantially built and battle-tested
against infrastructure failures; the remaining work is launch-grade email
login (blocked on a holder decision), real-device offline validation,
multi-week evidence that the learner measurably improves, and the next
feature tier (voice shadowing, cross-device drafts, calibrated exam scoring).
