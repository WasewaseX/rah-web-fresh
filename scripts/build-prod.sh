#!/usr/bin/env bash
# Task 91: the ONLY sanctioned way to produce the production build.
#
# Bare `next build` regenerates .next/standalone WITHOUT the static assets
# (Next's documented standalone deployment step). The Task 91 browser E2E
# caught the exact failure this creates: a prod server that serves fresh HTML
# referencing chunks it then 404s - a blank page with zero console errors.
# dev-or-prod.sh now self-heals the copy on every prod boot, but building
# through this wrapper keeps the artifact correct at build time too.
set -eu
cd /home/z/my-project

npx next build "$@"

rm -rf .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/static
mkdir -p .next/standalone/public
cp -r public/. .next/standalone/public/

echo "build-prod: BUILD_ID=$(cat .next/BUILD_ID)"
# Task 95 (review P1 #5): record the intended release so deploy-drift-check
# can alert when the served build ever differs from what was last built
# here on purpose.
mkdir -p backups
# Task 102 part 3: read BUILD_ID ONCE, right after the build, and GUARD it.
# Found live 2026-10-30: backups/.intended-build-id was EMPTY (recycle
# snapshot semantics truncated it after the 09:00 build) and the manifest
# disagreed with the packed artifact's own BUILD_ID by one leading char -
# the manifest read the tree while the artifact carried the truth. From now
# on the post-pack refresh below (read FROM the tgz) is authoritative.
BUILD_ID="$(cat .next/BUILD_ID 2>/dev/null || true)"
if [ -z "$BUILD_ID" ]; then
  echo "build-prod: FATAL - .next/BUILD_ID missing/empty after build; refusing to record or pack" >&2
  exit 1
fi
printf '%s\n' "$BUILD_ID" > backups/.intended-build-id
echo "build-prod: intended-release record -> backups/.intended-build-id"

# Task 99 (review P1, triply-proven): PRESERVE THE ARTIFACT. Recycles #8/#9
# wiped .next/BUILD_ID twice in two days and the boot road fell back to dev
# (the exact "website not working" class). Rebuilding in place works but
# takes minutes and depends on the toolchain; restoring the preserved
# artifact is seconds and reproduces the EXACT intended build. The tgz
# (~100 MB) exceeds GitHub's 100 MB file limit, so it lives on
# upload/rah-backups as an atomically replaced -latest file plus a sha256
# manifest. ensure-server.sh consumes it (and can fetch it back from the
# holder-approved GitHub release when the mount is gone).
#
# Task 102 (LEAK LESSON - do not regress): the Task 101 pack was
# `tar -C .next standalone` with NO exclusions. Next standalone had copied
# .env in and outputFileTracing had pulled db/ (learner data +
# db/vault-work/github-tokens.md with the holder's GitHub PAT), scripts/,
# upload/ (incl. env backup) into standalone/ - the 321 MB PUBLIC release
# asset carried all of it for ~6h. Now: (1) pack ONLY the runtime-essential
# allowlist subtree-by-subtree, (2) scripts/artifact-secret-gate.sh must
# PASS before the atomic replace - a failing gate leaves the previous good
# artifact in place and exits non-zero.
ARTIFACT_TGZ="upload/rah-backups/rah-build-latest.tgz"
ARTIFACT_JSON="upload/rah-backups/rah-build-latest.json"
mkdir -p upload/rah-backups
# Allowlist pack via a hardlink staging tree: entries keep the standalone/
# prefix (restore path + gate contract), staging is near-free (same fs).
STAGE="$(mktemp -d .packXXXXXX)"
mkdir "$STAGE/standalone"
for item in .next public node_modules server.js package.json next.config.ts prisma; do
  if [ -e ".next/standalone/$item" ]; then cp -al ".next/standalone/$item" "$STAGE/standalone/$item"; fi
done
RC_TAR=0
tar -czf "$ARTIFACT_TGZ.tmp" -C "$STAGE" standalone 2>/dev/null || RC_TAR=$?
rm -rf "$STAGE"
if [ "$RC_TAR" -eq 0 ] && [ -f "$ARTIFACT_TGZ.tmp" ]; then
  if bash scripts/artifact-secret-gate.sh "$ARTIFACT_TGZ.tmp"; then
    # Task 102 part 3: the manifest's build_id is read FROM THE PACKED BYTES
    # (ground truth), never from the tree - the tree can be truncated by a
    # recycle between build and pack; the tgz cannot disagree with itself.
    ART_BUILD="$(tar -xzOf "$ARTIFACT_TGZ.tmp" standalone/.next/BUILD_ID 2>/dev/null | tr -d '\n\r' || true)"
    if [ -z "$ART_BUILD" ]; then
      echo "build-prod: REFUSED to publish artifact - packed BUILD_ID unreadable" >&2
      rm -f "$ARTIFACT_TGZ.tmp"
      exit 1
    fi
    printf '%s\n' "$ART_BUILD" > backups/.intended-build-id
    ART_SHA=$(sha256sum "$ARTIFACT_TGZ.tmp" | cut -d' ' -f1)
    mv "$ARTIFACT_TGZ.tmp" "$ARTIFACT_TGZ"
    python3 - "$ARTIFACT_JSON" "$ART_BUILD" "$ART_SHA" <<'PY'
import json, sys, datetime
out, build_id, sha = sys.argv[1:4]
json.dump({"build_id": build_id, "sha256": sha,
           "ts": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
           "bytes": None,
           "note": "restore via ensure-server.sh when BUILD_ID is wiped; Task 102: allowlist pack + secret gate; build_id read from the packed artifact itself"},
          open(out, "w"), indent=1)
PY
    echo "build-prod: artifact preserved -> $ARTIFACT_TGZ (sha256=${ART_SHA:0:12}..., BUILD_ID=$ART_BUILD, gate PASSED)"
  else
    RC=$?
    echo "build-prod: REFUSED to publish artifact - secret gate FAILED (exit $RC). Previous artifact left untouched." >&2
    rm -f "$ARTIFACT_TGZ.tmp"
    exit 1
  fi
else
  echo "build-prod: WARNING - artifact preservation failed (build itself is fine)"
fi

echo "build-prod: standalone static chunks: $(ls .next/standalone/.next/static/chunks | wc -l)"
echo "build-prod: standalone public files:  $(ls .next/standalone/public | wc -l)"
