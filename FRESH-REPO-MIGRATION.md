# FRESH-REPO-MIGRATION — the account holder's chosen privacy closure

> **EXECUTED 2026-10-27 (Task 99).** The new public repo is
> **`WasewaseX/rah-web-fresh`**, created empty via the API and seeded with a
> SINGLE ORPHAN ROOT COMMIT of the hardened tree (hardening commit `b30c9a1`
> was the last commit on the old repo — the orphan root carries the exact
> same tree). `PRIVACY-PURGE-REQUEST.md` was removed from the tree per §2.
> `scripts/privacy-sweep.py` now defaults to the new repo
> (`RAH_SWEEP_REPO=WasewaseX/rah-web` overrides for the old-repo closure
> evidence). The old repo `WasewaseX/rah-web` was ARCHIVED (read-only) —
> NOT deleted: deletion is the account holder's 30-day step and is the one
> that actually kills the dangling objects. Before-evidence at execution
> time: 15/16 pre-scrub SHAs still DANGLING-RETRIEVABLE on the old repo
> (2026-10-27 sweep). Remaining human steps: (1) in ~30 days, delete the
> archived old repo; (2) re-create branch protection on the new repo's
> main if the API scope did not carry it over. Closure criteria in §8
> below now evaluate against the OLD repo: after deletion, its URLs 404
> and two consecutive sweeps (with `RAH_SWEEP_REPO=WasewaseX/rah-web`)
> record unreachable/CLEAN.
>
> **TASK 101/102 DECISION UPDATE (2026-10-29/30) — SUPERSEDES the
> "remaining human steps" above.** The account holder DECIDED (verbatim:
> "dont delete ... about unarchiving only if its necessary"): the old repo
> `WasewaseX/rah-web` STAYS ARCHIVED — no deletion is planned, and NO
> deletion or un-archiving may be executed without the holder's explicit
> fresh approval (standing rule #4, the consent gate). The dangling-object
> exposure is therefore a HOLDER-ACCEPTED, actively-monitored state (daily
> `privacy-sweep.py` with `RAH_SWEEP_REPO=WasewaseX/rah-web`), not an open
> human step. The §8 closure criteria about post-deletion 404s are
> dormant until the holder ever revives them. Everything else above
> (orphan history, purge-request file removed from the tree, sweeps) is
> unchanged. `PRIVACY-PURGE-REQUEST.md` is NOT in the current tree — it
> survives only in old-repo history and in this document's description.

Written 2026-10-25 (Task 97). Decision recorded verbatim from the account
holder: the GitHub Support purge request is superseded — **"its okay we
will just make a fresh repo but later."** This document makes "later" a
checklist, not a research project, and defines what dies with the old repo.

## 1. Why this closes the privacy exposure (and what it does NOT close)

The exposure is: ~15 dangling-but-anonymously-retrievable pre-scrub commit
objects and one cached db blob in the PUBLIC repo `WasewaseX/rah-web`
(monitored daily by `scripts/privacy-sweep.py`; 15/16 dangling + blob
served as of 2026-10-25). Deleting/recreating the repository removes ALL
objects, refs, caches, and API reachability for that repo at once — the
dangling objects die with the repo. **It does not close**: third-party
caches/aggregators that may have already scraped the content (unverifiable
by anyone, including GitHub Support — the same residual risk the purge
request's fine print carried), and it does not affect the PRIVATE vault
repo (which holds only scrubbed snapshots by construction).

Until the migration happens: the daily sweep + alert layer keeps monitoring
(the standing gate), and `PRIVACY-PURGE-REQUEST.md` stays in the tree as
the fallback if the account holder ever prefers the Support route instead.

## 2. What moves to the fresh repo

- The full current git history FROM the flip commit forward is optional —
  the cleanest choice is a **fresh orphan history** (single initial commit
  = current tree state), which also guarantees no pre-scrub object ever
  re-ships via a push. Keep the old repo archived (read-only) for
  reference if desired.
- Everything in the tree EXCEPT: `PRIVACY-PURGE-REQUEST.md` +
  `download/GITHUB-SUPPORT-PURGE-REQUEST.md` (obsolete after migration),
  and anything else the sweep flags.
- GitHub settings to re-create: branch protection on main, Actions enabled
  (the ci.yml PG-service workflow ships in the tree), repo description.
- The vault repo is UNTOUCHED (private; separate lifecycle).

## 3. Migration checklist (execute in order, ~20 minutes)

1. Pick the moment right after a boot-guard + vault push (so db/backups +
   upload/rah-backups + vault are all fresh).
2. `git clone --no-hardlinks` the current repo to a scratch dir; run the
   privacy sweep one last time against the OLD repo and record the result
   (the before/after evidence pair).
3. Create the new GitHub repo (empty, private-or-public per the account
   holder's choice — the app repo was public by design; a fresh repo
   starts with ZERO dangling objects either way).
4. Orphan-start: `git checkout --orphan fresh && git add -A && git commit`
   (single initial commit), remove the two purge-request files first.
5. Push to the new repo; update any remotes/links that referenced the old
   URL; re-enable Actions (first run proves the PG-service CI).
6. Update this file + ROADMAP-STATUS with the new remote (SHA of the
   initial commit) and flip `scripts/privacy-sweep.py`'s repo target.
7. Archive (do not delete) the old repo for 30 days as evidence, then
   delete it — deletion is the step that actually kills the dangling
   objects; archiving first preserves the before/after audit trail.
8. Closure criteria (same shape as the purge request's): the raw blob URL
   404s; the old repo's API returns 404; TWO consecutive daily sweeps
   against the OLD repo return unreachable/CLEAN; the alert layer fires
   the CLEAN-day INFO.

## 4. Who does what

- Steps 3–5 need the account holder's GitHub session (repo creation +
  push rights) — the agent can prepare everything else (orphan branch,
  file removals, sweep retarget) as a ready-to-run script when "later"
  arrives.
- The daily sweep monitoring continues until step 8 completes.
