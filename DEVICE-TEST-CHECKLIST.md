# Physical-Device Test Checklist — Task 95 open item (2026-10-31)

**Goal:** produce real evidence that the app works on the learner's phone —
responsive layout, review flow, and what actually happens when the network
drops — without buying anything, installing anything, or opening any port.

**Blocked today (do not count as failures):** logging in on a *fresh* device
needs an email code, and login-email delivery is blocked on the holder's A-6
decision. If a phone browser still holds a valid session from earlier use,
everything below works; otherwise do the layout checks and wait for A-6 for
the rest. Also: the sandbox recycles — if the app URL is unreachable, wait a
few minutes and retry; that is the environment, not the app.

---

## Setup (2 min, $0)

1. On the phone, open **the same app URL you use on the desktop**.
2. If the app loads straight into the learner view — session cookie works,
   continue. If it shows the login/code screen — fresh-device login is
   A-6-blocked: do only steps A, B, F and stop.

## Tests (record actual behavior, not expectations)

**A. Layout pass** — open Today / review / tutor chat. Record: anything
clipped, sideways-scrolling, or buttons too small to tap?

**B. Review with network ON** — complete one review card (any grade).
Record: XP/streak visible, sound plays (if the card has audio).

**C. Airplane-mode mid-session** — with a review answer typed/selected but
NOT submitted, switch on airplane mode, then submit.
Record exactly what happens: silent retry? error toast? lost answer?

**D. Recovery** — turn airplane mode OFF, wait 10 s.
Record: does the pending review post? (Check on desktop: `/api/version`
shows `xp` — if it moved by the expected amount, the answer landed.)

**E. Offline reload** — airplane mode ON, reload the page.
Record: cached shell? blank? error page?

**F. Install prompt** — if the browser offers "Add to Home screen", accept
it and launch from the icon. Record: works / not offered / broken.

## Results table (fill in, date it, keep it in the chat or a file)

| # | Test | Date | Result (actual behavior) | Verdict |
|---|------|------|--------------------------|---------|
| A | Layout pass | | | pass / issue |
| B | Review online | | | pass / issue |
| C | Airplane-mode submit | | | pass / issue |
| D | Recovery | | | pass / issue |
| E | Offline reload | | | pass / issue |
| F | Add to Home screen | | | pass / issue |

## Evidence hygiene

- Run `bash scripts/learner-evidence.sh` before and after the session — the
  before/after lines in `db/evidence/evidence-timeline.log` are the durable
  proof that device activity reached the DB.
- Never paste learner names, emails, or message contents into the table —
  behavior only.
- A single filled table with one date on it already advances the open item;
  the "multi-week" bar is met by repeating this on later weeks (the evidence
  script's timeline log accumulates the week-over-week record by itself).
