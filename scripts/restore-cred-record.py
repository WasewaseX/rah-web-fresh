#!/usr/bin/env python3
"""Restore/repair the gitignored credential record db/vault-work/github-tokens.md.

Why this exists: sandbox recycles have twice truncated gitignored paths
(the BUILD_ID incident, and again on 2026-10-31 when this record vanished
while git still had it on vault/main). The durable store is the PRIVATE
vault repo (WasewaseX/vault, branch main, file github-tokens.md at root).
This tool re-creates the local record from vault/main and normalizes it to
the post-rotation structure (ACTIVE new PAT / RETIRED old PAT / Resend
status / recovery note). Idempotent: safe to run any time.

Hard rules honored here:
- No token is ever printed to stdout/stderr by this script.
- No token is ever written to any tracked file.
- The record file is forced to chmod 600 before any content is written.

Usage: python3 scripts/restore-cred-record.py [--from-remote]
  --from-remote : force re-fetch of the record from vault/main
"""
import os
import re
import subprocess
import sys

ROOT = "/home/z/my-project"
REC_DIR = os.path.join(ROOT, "db", "vault-work")
REC = os.path.join(REC_DIR, "github-tokens.md")

RETIRED_HEADING = (
    "## GitHub Fine-Grained PAT — RETIRED (LEAKED 2026-10-29; revoke pending holder)"
)
ACTIVE_HEADING = "## GitHub Fine-Grained PAT — ACTIVE (rotation of 2026-10-30)"


def sh(args: list[str], allow_fail: bool = False) -> str:
    r = subprocess.run(args, cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0 and not allow_fail:
        raise RuntimeError(f"cmd failed: {' '.join(args)}: {r.stderr.strip()[:200]}")
    return r.stdout


def remote_token(remote: str) -> str:
    url = sh(["git", "remote", "get-url", remote]).strip()
    m = re.match(r"https://[^:]+:([^@]+)@", url)
    if not m:
        raise RuntimeError(f"remote {remote} has no embedded token")
    return m.group(1)


def main() -> int:
    force = "--from-remote" in sys.argv

    # 1. Ensure directory + gitignore coverage BEFORE any secret touches disk.
    os.makedirs(REC_DIR, exist_ok=True)
    chk = sh(["git", "check-ignore", "-v", REC], allow_fail=True).strip()
    if not chk:
        print("FATAL: db/vault-work/ is NOT gitignored - refusing to write", flush=True)
        return 3
    os.chmod(REC_DIR, 0o700)
    if os.path.exists(REC):
        os.chmod(REC, 0o600)

    # 2. Fetch the durable copy from the private vault when needed.
    if force or not os.path.exists(REC) or os.path.getsize(REC) == 0:
        sh(["git", "fetch", "vault", "main"], allow_fail=True)
        blob = sh(["git", "show", "vault/main:github-tokens.md"], allow_fail=True)
        if blob.strip():
            with open(REC, "w") as f:
                f.write(blob)
            os.chmod(REC, 0o600)
            print("record restored from vault/main", flush=True)
        elif not os.path.exists(REC):
            print("FATAL: no local record and vault fetch failed", flush=True)
            return 3

    body = open(REC).read()

    # 3. Extract the OLD token from the restored record (never printed).
    # Prefer the token inside the RETIRED section; fall back to first match
    # only for pre-rotation records (which have exactly one token).
    old = None
    m_ret = re.search(
        r"RETIRED.*?github_pat_([A-Za-z0-9_]{80,})", body, re.DOTALL
    )
    if m_ret:
        old = re.search(r"github_pat_[A-Za-z0-9_]{80,}", body)  # positional only
        retired_tok = "github_pat_" + m_ret.group(1)
    else:
        retired_tok = None
    first = re.search(r"github_pat_[A-Za-z0-9_]{80,}", body)
    old_tok = retired_tok or (first.group(0) if first else None)
    new_tok = remote_token("origin")

    if old_tok and old_tok == new_tok and not retired_tok:
        print(
            "note: record has a single token == remote token "
            "(pre-rotation vault copy)", flush=True,
        )

    # 4. Normalize structure (idempotent).
    changed = False
    if ACTIVE_HEADING not in body:
        active = f"""# Credential Vault — WasewaseX
> **NEVER make this repository public. Never commit these values to any other repo.**

{ACTIVE_HEADING}
- Token: `{new_tok}`
- Account: WasewaseX (id 321686523)
- Created by holder in dashboard 2026-10-30; handed off in chat (approved path,
  CREDENTIAL-ROTATION-RUNBOOK Part 1).
- Expiry: fine-grained PAT expiry is not exposed via REST API; visible at
  github.com → Settings → Developer settings → Fine-grained tokens.
- Verified 2026-10-31: GET /user → 200 (WasewaseX); GET /repos/rah-web-fresh →
  200; collaborators/permission → 200; Actions runs visible (run #10);
  push-proven: commit aa5070a on main, CI run #10 SUCCESS; both remotes
  (origin rah-web-fresh + vault) carry this token.

"""
        body = active + body
        changed = True

    if "RETIRED" not in body and old_tok and old_tok != new_tok:
        body = body.replace(
            "## GitHub Fine-Grained PAT (active)", RETIRED_HEADING, 1
        )
        body = body.replace(
            "- Stored: 2026-10-21, per owner instruction \"never discard this GitHub token\"",
            "- Stored: 2026-10-21, per owner instruction \"never discard this GitHub token\"\n"
            "- Status: LEAKED 2026-10-29 via the Task 101 public release asset (asset deleted,\n"
            "  git histories clean). Workspace no longer depends on it anywhere.\n"
            "- HOLDER ACTION NOW: github.com → Settings → Developer settings → Fine-grained\n"
            "  tokens → the 2026-10-21 token → Delete (replacement is push-proven).",
            1,
        )
        changed = True

    note = """
## Recovery note
- 2026-10-31: local db/vault-work/github-tokens.md lost to a sandbox recycle
  (gitignored dir truncated — same failure class as the BUILD_ID incident);
  restored from vault/main by scripts/restore-cred-record.py and normalized to
  the post-rotation structure. The private vault repo is the durable store;
  the local copy is always re-creatable via: python3 scripts/restore-cred-record.py
"""
    if "## Recovery note" not in body:
        body = body.rstrip() + "\n" + note
        changed = True

    if changed:
        with open(REC, "w") as f:
            f.write(body)
    os.chmod(REC, 0o600)

    # 5. Self-verification (counts only, no values).
    final = open(REC).read()
    toks = re.findall(r"github_pat_[A-Za-z0-9_]{80,}", final)
    ok_active = ACTIVE_HEADING in final
    ok_retired = "RETIRED" in final
    ok_new = new_tok in final
    ok_old = (old_tok in final) if old_tok else False
    print(
        f"record ok={ok_active and ok_retired and ok_new and ok_old} "
        f"tokens={len(toks)} active_section={ok_active} retired_section={ok_retired}",
        flush=True,
    )
    return 0 if (ok_active and ok_retired and ok_new and ok_old) else 2


if __name__ == "__main__":
    sys.exit(main())
