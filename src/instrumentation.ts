/**
 * Boot-time data-survival chain (Task 90) - runs on EVERY boot road.
 *
 * Task 87 proved the recovery machinery against the ensure-server.sh boot
 * path. But the deployment's supervisor restarts the app via `bun run dev`
 * -> scripts/dev-or-prod.sh -> bare server.js, which NEVER ran ensure-server.
 * On that road a live-but-damaged DB (the Oct-23 class: review history
 * present, FSRS schedule gone) would be served unrepaired, and a missing DB
 * would boot schema-only before db-restore could act.
 *
 * Next.js calls register() once per server instance and AWITS it before the
 * first request is handled, so this is the one hook that covers every boot
 * road: supervisor restart, ensure-server revive, dev, and standalone prod.
 *
 * Task 102: Next 16 Turbopack compiles this file for BOTH runtimes and its
 * Edge analysis hard-errors on Node APIs (process.cwd/kill/pid) - a cold
 * build (post-recycle-#12) failed with 21 such errors. The entire Node body
 * moved to src/lib/boot-guard-node.ts, dynamically imported ONLY in the
 * nodejs branch (NEXT_RUNTIME is a compile-time constant per bundle, so the
 * Edge graph never includes it). Mirrors the ensure-server order exactly:
 *   1. db-guard.sh boot        - snapshot-if-used BEFORE schema work / restore-if-fresh
 *   2. db-restore.sh           - restore-if-MISSING (sync -> vault -> OSS -> backups)
 *   3. db-migrate-safe.sh      - versioned migrate deploy, never reset
 *   4. db-integrity-repair.sh  - insert-only FSRS repair BEFORE writes accepted
 * (dev-only client-stamp guard unchanged, inside the node module.)
 *
 * Hard rules: NEVER blocks boot on failure (every step is failure-isolated),
 * never runs twice concurrently (global flag + stale-tolerant lockfile),
 * every step has a hard timeout.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootGuard } = await import("./lib/boot-guard-node");
  await bootGuard();
}
