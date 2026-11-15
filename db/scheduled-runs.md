# Scheduled work-session series (holder order: run the session prompt 5 times, every 2 hours, then stop)

## Series status
- Total runs allowed: 5. Run #1 completed (manual turn, 2026-11-15, see Completed runs).
- cron jobId: N/A - the cron/scheduler tool is NOT available in this sandbox runtime
  ("Tool not found: cron"), and background processes do not survive between messages,
  so the agent cannot self-fire future runs. Runs #2-#5 execute when the holder sends
  the next message (any "continue" or the original session prompt). Each run MUST read
  this file first and honor the guard below.

## Guard (every future run MUST do this first)
1. Count lines under "Completed runs" below.
2. If fewer than 4 scheduled runs are listed: do a full work session (protocol below),
   then append one line under "Completed runs".
3. Once 4 scheduled runs are listed (5 total including run #1): the series is complete -
   reply "Series complete - 5 runs done, stopping as ordered" and do NOT start new work.

## Work-session protocol (each run)
1. Expect sandbox reset: verify git HEAD + tree, .env (3 keys, 600 perms; restore from
   upload/rah-backups/env-rah-latest if it is a stub), PG + next dev up, /api/version.
   For bun scripts: export DATABASE_URL from .env first.
2. git log --oneline -5 to see what previous runs shipped. Build a 12-item todolist
   (TodoWrite) from the Pending queue below + the standing roadmap.
3. Code the highest-priority pending task properly: read source before editing,
   pure logic in src/lib/*, batteries in scripts/*-test.ts, honest labeling
   (drill REQUESTS never "completed"), probe-dry doctrine for new endpoints.
4. Quality bar: bunx tsc --noEmit clean, relevant batteries green, session ends with
   bash scripts/deploy-gate.sh "<English commit message>" (builds, browser-verifies,
   commits, pushes; GH_PAT in .env if push auth needed; never print secrets).
5. Report in full sentences: what shipped, battery counts, tsc, probe results, gate
   result, commit SHA. Never a one-sentence sloppy reply.
6. Standing blocked: RE case re:case:sample-1124e79d needs a full 64-hex SHA-256 or the
   sample file from the holder - never fabricate progress on it.

## Completed runs
- run #1 (manual, 2026-11-15): Tasks 140-142 shipped in the prior session and this run
  scheduled the series (cron unavailable - see above); this run's coding lands as the
  next commits after 203c1f0.

## Pending queue (update as tasks ship)
- Task 143: one-click weekly review button on live Progress view (handCoach -> progress_review)
- Task 144: read_state carries the 7-day guide-week drill line
- Task 145: Guide panel stale-topic age hints (last requested older than ~14d)
- Standing: RE case unlock (blocked on holder input)
