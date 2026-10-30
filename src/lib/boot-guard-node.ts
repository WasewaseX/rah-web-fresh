/**
 * Node-only boot guard (Task 102). The ENTIRE Task 90 boot chain moved here
 * from src/instrumentation.ts: Next 16 Turbopack compiles instrumentation.ts
 * for BOTH runtimes, and its Edge analysis hard-errors on Node APIs
 * (process.cwd / process.kill / process.pid) - which surfaced as a cold-build
 * failure (21 errors) after recycle #12 wiped .next and forced the first
 * cold build since the Edge check began. instrumentation.ts now keeps only
 * the documented NEXT_RUNTIME switch and dynamically imports THIS module in
 * the nodejs branch, so the Edge graph never includes it. Behavior is
 * byte-identical: same scripts, same order, same single-flight lockfile,
 * same failure isolation.
 */
export async function bootGuard(): Promise<void> {
  const g = globalThis as { __rahBootGuard?: boolean };
  if (g.__rahBootGuard) return;
  g.__rahBootGuard = true;

  const { execFile } = await import("child_process");
  const fs = await import("fs");
  const path = await import("path");

  const root = process.cwd();
  const log = (line: string) => console.log(`[rah-boot] ${new Date().toISOString()} ${line}`);

  // Single-flight across processes: lockfile with PID, stale after 120s.
  const lockPath = path.join(root, "db", ".boot-guard.lock");
  try {
    if (fs.existsSync(lockPath)) {
      const raw = fs.readFileSync(lockPath, "utf8").trim();
      const pid = parseInt(raw.split(" ")[0] ?? "", 10);
      const at = parseInt(raw.split(" ")[1] ?? "", 10);
      const fresh = Number.isFinite(at) && Date.now() - at < 120_000;
      const alive = Number.isFinite(pid) && pid > 0 && (() => {
        try { process.kill(pid, 0); return true; } catch { return false; }
      })();
      if (fresh && alive) {
        log(`another boot guard holds the lock (pid ${pid}) - skipping`);
        return;
      }
      log(`taking over stale lock (pid ${raw})`);
    }
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, `${process.pid} ${Date.now()}`);
  } catch {
    /* lock failure must never block boot */
  }

  const run = (script: string, timeoutMs: number): Promise<void> =>
    new Promise((resolve) => {
      const t0 = Date.now();
      execFile(
        "bash",
        [path.join(root, "scripts", script)],
        { cwd: root, timeout: timeoutMs, killSignal: "SIGKILL" },
        (err, stdout, stderr) => {
          const ms = Date.now() - t0;
          const tail = `${stdout ?? ""}${stderr ?? ""}`.split("\n").filter(Boolean).slice(-2).join(" | ");
          if (err) log(`${script} FAILED in ${ms}ms: ${String(err.message).slice(0, 120)} :: ${tail}`);
          else log(`${script} ok in ${ms}ms :: ${tail}`);
          resolve(); // failure-isolated by contract: always resolve
        },
      );
    });

  try {
    log(`boot guard chain starting (cwd=${root}, NODE_ENV=${process.env.NODE_ENV ?? "unset"})`);
    await run("db-guard.sh", 90_000);            // boot: snapshot-if-used / restore-if-fresh
    await run("db-restore.sh", 120_000);          // restore-if-MISSING from the snapshot chain
    await run("db-migrate-safe.sh", 120_000);     // forward-only schema move
    await run("db-integrity-repair.sh", 120_000); // insert-only FSRS repair
    log("boot guard chain complete - server may accept requests");
  } catch (e) {
    log(`boot guard chain error (non-fatal): ${String(e).slice(0, 160)}`);
  } finally {
    try { fs.rmSync(lockPath, { force: true }); } catch { /* ignore */ }
  }
}
