# Credential Rotation Runbook — Task 102 follow-through (2026-10-30)

**Why now:** the Task 101 release asset (public ~6 h on 2026-10-29) contained the
holder's ACTIVE GitHub fine-grained PAT and the live Resend SMTP key. The asset
was deleted the same day and the pack pipeline was rebuilt with a hard gate, but
**a credential that was once public must be treated as exposed until rotated** —
the holder's 30-Oct status check made rotation the top priority. Everything that
CAN be done from the workspace is done; the two remaining steps are one-time
holder UI actions (GitHub and Resend do not allow key management via API keys
that are themselves restricted — the current Resend key is send-only, verified
live: list/create return `401 restricted_api_key`).

---

## Part 1 · GitHub fine-grained PAT — holder action (~2 min), then operator

1. Sign in as `WasewaseX` → **Settings → Developer settings → Fine-grained
   tokens → Generate new token**.
2. **Token name:** `rah-web-fresh-rotation-2026-10`
3. **Expiration:** 90 days (or shorter; set a reminder — the workspace can
   re-check `x-github-token-expiration` headers after the swap).
4. **Resource owner:** `WasewaseX`.
5. **Repository access:** "Only select repositories" → pick **`rah-web-fresh`
   ONLY**. Do NOT grant the vault repo or the archived repo.
6. **Permissions:** Repository permissions → **Contents: Read and write**.
   Nothing else is needed for the current workflow (push + release assets +
   Actions read are covered by Contents/metadata; add **Actions: Read** only if
   you want the workspace to keep reading CI runs if GitHub tightens defaults).
7. **Generate token** → copy it.

**Hand-off (either works):** paste the token in this chat, or save it to
`db/vault-work/github-tokens.md` yourself and just tell me it is there. The
token is never printed back, never committed, and `db/` is gitignored +
tracing-excluded + gate-excluded.

**Then the operator (me) does, in order:**
1. Swap the token into the git remote and verify a real push (empty commit to a
   scratch branch, deleted right after — or the next real commit).
2. Update the vault copy of the token record (private vault repo).
3. Confirm CI visibility with the new token.
4. Tell the holder: **now revoke the old token** (same page → the old
   `rah-web…` token → Delete). Never earlier — the old token is the fallback
   until the new one is proven.

## Part 2 · Resend API key — holder action (~1 min), then operator

1. Sign in at **resend.com → API Keys → Create API Key**.
2. **Name:** `rah-web-2026-10`.
3. **Permission:** `Full access` (recommended: with it the OPERATOR can revoke
   the old key via the API, closing the rotation without a second dashboard
   trip; if you prefer least privilege, pick `Sending access` — then revoking
   the old key stays a one-click dashboard action for you).
4. Copy the key (starts with `re_`).

**Hand-off:** same as above (chat or `.env`-adjacent note; I will place it in
the gitignored `.env` only — it is never committed, never logged, never in the
frontend, and `.env` is excluded from every artifact by the allowlist gate).

**Then the operator (me) does, in order:**
1. Write the new key into `.env` (`SMTP_PASS`), `chmod 600`.
2. Run `scripts/smtp-verify-once.ts` (connect + TLS + AUTH, zero mails sent).
3. Restart the server at the next safe window (mail route only needs the env
   at boot; the current sandbox restriction is unchanged either way).
4. With the new full-access key: `DELETE /api-keys/<old-key-id>` — the old
   restricted key dies without you touching the dashboard again.
5. Re-run the gate on any newly packed artifact (habitual — `.env` was never
   allowed into the pack since Task 102 part 1).

## Verification checklist (both rotations done)

- [ ] `git push` succeeds with the new PAT; CI run goes green
- [ ] old GitHub token revoked (holder, after step 1 above)
- [ ] `smtp-verify-once` returns OK with the new key
- [ ] old Resend key revoked (operator via API, or holder via dashboard)
- [ ] `grep -r` over tracked files finds no `github_pat_` / `re_` secrets
- [ ] worklog entry records both rotations with dates

## Explicitly NOT part of this rotation (standing rules)

- No domain purchase (strict $0) — sandbox sending limits stay until the
  holder picks an A-6 option.
- No deletion or un-archiving of the old repository (holder decision A-1,
  Task 101: KEEP ARCHIVED; monitoring continues).
- No new services, no paid APIs, no heavyweight local tooling.
