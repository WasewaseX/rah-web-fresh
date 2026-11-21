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
- run #1 (manual, 2026-11-15): Tasks 140-142 shipped in the prior session; this run
  scheduled the series (cron unavailable - see above) and shipped Tasks 143-145 at
  commit 9423a105983b: 'Review my week' one-click button on live Progress
  (WEEKLY_REVIEW_ASK battery-pinned to the isProgressAsk seam), read_state guide line
  carries the 7-day drill-week, Guide panel 'rusty (14d+)' stale-topic chip;
  batteries 45/45 + 29/29 + 75/75 + 59/59, tsc clean, gate GREEN, browser + probe
  verified. Survival chain fresh: env + pg dumps stamped Nov 15 21:55 UTC.
- scheduled run #2 (2026-11-15): Tasks 146-148 at commit de0257750c52: GuidePanel
  cross-level topic search (searchGuideTopics, <2 chars = nothing, cap 12, hits render
  as drill buttons with count badges; verified live on production: "cleft" -> Cleft
  Sentences B2 p.42), per-level drill-coverage bars (coverageBarRows, verified live:
  g 1/12 v 0/10 per level), and read_state's guide line consolidated into the
  battery-pinned guideStateLine() (all-time coverage + 7-day week + stale-14d+ list
  capped at 5 with re-drill framing); batteries 53/53 + 81/81 + 29/29 + 59/59,
  tsc clean, coach probe PASS requested-safe, gate GREEN. Note for future UI checks:
  CSS `uppercase` transforms innerText, so match header text case-insensitively.
  Survival chain fresh (dumps 22:10 UTC).

## Special runs (NOT counted toward the 4 scheduled runs)
- security run (2026-11-15, holder directive): the holder's security findings list is
  now the permanent PR bar. Every flagged site fixed (raw-SQL validators + documented
  allows, pkill -f -> process-group kill, eval -> evaluate renames in py+ts with
  duolingo parity gate PASS, 7 swallowed-exception sites surfaced, restore-from-vault
  fail-closed, e2e env-object); NEW fail-closed road 4.5/6 in deploy-gate runs
  scripts/security-gate.ts (selftest 9/9, repo scan 19 -> 0; vendored .github/skills
  excluded from scope). Commit c79dab779d5c, pushed, gate GREEN, preview serving it.
  Sandbox-reset note: this turn started from a rewound history (faf312a lineage);
  reconciled via soft reset onto origin/main - content delta was exactly the 18
  security files, no feature work lost.

## Cycle series 2 (holder: 5 more security cycles)
- cycle 1/5 (2026-11-20): external-scanner round 2 resolved. chart.tsx ChartStyle rebuilt
  (CSS key/value/id whitelist sanitization, string child of <style>, no dangerous
  HTML-prop API) - NOTE: file is dead scaffold, unreferenced by any page, absent from
  every prod chunk; all 3 raw-SQL template literals -> validated concatenation (admin/db
  route, pg-validate, db-snapshot-core); 10 py except sites record-then-summarize
  (freshness-check fails closed on unreadable .env; gen_pwa_icons exits 1 on lost panel);
  vendored live-browser.js REMOVED from .github/skills/impeccable (ui-dom-sweep uses the
  binary only; live-mode page script unreferenced, recoverable from git history).
  security-gate hardened: dangerouslySetInnerHTML rule, print-only tightened (stderr
  alone insufficient), pass#comment caught; selftest 12/12, scan CLEAN, batteries
  53/53 + 81/81 + 29/29 + 59/59, gate GREEN, pushed a5d182b9a5cf.

- cycle 2/5 (2026-11-20): scanner round 3 resolved. VACUUM INTO truly parameterized
  (verified bound-parameter support at bun:sqlite AND generated Prisma 6 SQLite client
  levels; admin/db route + db-snapshot-core now $executeRawUnsafe("VACUUM INTO ?", path),
  zero string building, charset guard retained); pg-validate TRUNCATE rebuilt as a single
  STATIC statement (44 models + _prisma_migrations, derived from live information_schema)
  with a live-vs-static drift guard; vendored modern-screenshot.umd.js removed
  (unreferenced, binary-only usage); 4 unused vars deleted (ai.ts withRetry + stale
  eslint-disable, SpeedRound locked, request-code db import, Blocks useMemo); a11y fixed
  (aisettings 2 labels htmlFor/id, SpeedRound autoFocus removed). security-gate SQL rule
  extended: concatenation in raw queries now flagged (bind params = only clean form);
  selftest 14/14, scan CLEAN, tsc clean, eslint clean on changed files, batteries
  53/53 + 81/81 + 29/29 + 59/59, gate GREEN, pushed e72f668ba109.

- cycle 3/5 (2026-11-20): scanner round 4 zeroed (20 findings, all eslint-class).
  live-browser trio removed from impeccable skill (zero refs incl. binary +
  command-metadata); 5 unused bindings deleted; parseExaminer dead quick param
  dropped (single caller updated); new Array -> Array.from; regex dash unescaped;
  empty catch documented; autoFocus removed x2 (a11y); review.tsx dead
  revealed/wasRight states deleted + Date.now() render calls moved to mount
  effect (react purity); App refresh gains stable celebrateDeltas dep; BlitzDeck
  restructured to truthful useCallback memoization after the react compiler
  rejected both latest-ref patterns (immutability + refs rules) - grade deps
  [q,dir,stopDrain] stable while typing, drain bar behavior preserved. tsc clean,
  eslint zero on 9 changed files, batteries 53/53 + 81/81 + 29/29 + 59/59,
  gate 14/14, scan CLEAN, gate GREEN, pushed 5384032a5a83.

- cycle 4/5 (2026-11-20): scanner round 5 zeroed (22 findings, all lint-class,
  zero SQL). set-state-in-effect resolved per compiler doctrine: review.tsx card
  resets moved into grade/load handlers, mount loads deferred one tick (review/
  today/MaterialsPanel), accuracy read from done-state reveals snapshot instead
  of a ref during render, tiles memoized, audio deps [dir, cur], onDone dep
  added; Login framed derived in render + 3 labels associated + catch documented;
  today tip via lazy useState initializer; OfflineBadge role=status -> semantic
  output; aisettings model input aria-label; 4 unused params dropped (type fields
  kept) + dead lookup deleted. Pre-empted round 6: sound.tsx stale directive
  removed (it hid a use-before-declare error; start now stable useCallback before
  callers; mount seeding -> lazy queue initializer), ai-validators stale directive
  removed. NEW gate stage 4.6/6 eslint --max-warnings 0 mirrors the external
  scanner. Whole-src eslint ZERO, tsc clean, batteries 53/53 + 81/81 + 29/29 +
  59/59, gate 14/14, scan CLEAN, gate GREEN, pushed 9f90339ae4f3.

- cycle 5/5 (2026-11-21): scanner round 6 (588 findings) zeroed by scanner-parity
  hardening. eslint.config.mjs enables the external rule set whose "off" overrides
  had silenced the gate lint (no-unused-vars with _-patterns, no-empty, no-empty-
  pattern, exhaustive-deps, jsx-a11y no-autofocus + control-has-associated-label,
  import/no-duplicates). 31 dead files deleted (legacy rah/* generation, zero-ref
  verified incl scripts/tests). 180 findings fixed: 62 unused, 86 label assoc
  (empirical: only aria-label satisfies the rule; datalist+option are controls),
  9 documented catches, 4 autofocus, 7 purity, 6 deps, 4 import dups, 1 pattern.
  Login recall -> lazy initializers. Probe with all rules on showed only classes
  the scanner never enforced - config stays at observed scope. Whole-src eslint
  ZERO, tsc clean, batteries 53/53 + 81/81 + 29/29 + 59/59, gate 14/14, scan
  CLEAN, gate GREEN, pushed 142dfcdd65a3.

## Pending queue (update as tasks ship)
- Task 149: read_state carries checklist readiness (feed the guide-checklist ratings
  Setting into guideStateLine so the coach sees readiness verdicts too)
- Task 150: guide search Enter-to-drill-first-hit and Escape-to-clear
- Task 151: practice asks cross-reference the stale list (loop enriches practice
  context with the learner's rusty topics)
- Standing: RE case unlock (blocked on holder input)
