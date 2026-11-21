// ---------- file tools (workspace sandbox) ----------

import { spawn } from "child_process";
import { existsSync } from "fs";
import { readdir, readFile, writeFile, stat, mkdir } from "fs/promises";
import { dirname, join } from "path";
import { safePath, WORKSPACE_ROOT } from "./workspace";
import type { ToolArgs, ToolResult } from "./types";

async function listFiles(args: ToolArgs): Promise<ToolResult> {
  const rel = String(args.path ?? ".");
  const p = safePath(rel);
  if (!p) return { ok: false, summary: "Rejected path (outside the workspace)" };
  if (!existsSync(p)) return { ok: false, summary: `No such path: ${rel}` };
  const st = await stat(p);
  if (st.isFile()) {
    const content = await readFile(p, "utf8");
    return { ok: true, summary: `Read ${rel} (${content.length} bytes)`, detail: content.slice(0, 4000) };
  }
  const entries = await readdir(p, { withFileTypes: true });
  const lines = await Promise.all(
    entries.map(async (e) => {
      const s = await stat(join(p, e.name));
      return `${e.isDirectory() ? "dir " : "file"} ${e.name}${e.isDirectory() ? "" : ` (${s.size}b)`}`;
    }),
  );
  return {
    ok: true,
    summary: `Workspace ${rel}: ${entries.length} entries`,
    detail: `workspace root: data/coach-workspace\n${lines.join("\n") || "(empty - nothing written yet)"}`,
  };
}

async function readFileTool(args: ToolArgs): Promise<ToolResult> {
  const rel = String(args.path ?? "");
  const p = safePath(rel);
  if (!p) return { ok: false, summary: "Rejected path (outside the workspace)" };
  if (!existsSync(p) || !(await stat(p)).isFile()) return { ok: false, summary: `No such file: ${rel}` };
  const content = await readFile(p, "utf8");
  return {
    ok: true,
    summary: `Read ${rel} (${content.length} bytes)`,
    detail: content.slice(0, 6000) + (content.length > 6000 ? `\n... (${content.length - 6000} more bytes)` : ""),
  };
}

async function writeFileTool(args: ToolArgs): Promise<ToolResult> {
  const rel = String(args.path ?? "");
  const content = String(args.content ?? "");
  const p = safePath(rel);
  if (!p || !rel) return { ok: false, summary: "Rejected path (outside the workspace)" };
  if (/\.(sh|bash|exe|dll|bat|cmd)$/i.test(rel)) return { ok: false, summary: "Rejected file type" };
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, content, "utf8");
  return { ok: true, summary: `Wrote ${rel} (${content.length} bytes)`, detail: `file created at data/coach-workspace/${rel}` };
}

// ---------- run_js: the coding ability ----------

const RUN_TIMEOUT_MS = 12_000;
const MAX_OUTPUT = 4000;

function runJs(args: ToolArgs): Promise<ToolResult> {
  const file = String(args.file ?? "");
  const p = safePath(file);
  if (!p || !file) return Promise.resolve({ ok: false, summary: "run_js needs a workspace file (e.g. scratch.ts)" });
  if (!/\.(ts|js|mjs|cjs)$/i.test(file)) return Promise.resolve({ ok: false, summary: "run_js runs .ts/.js files only" });
  if (!existsSync(p)) return Promise.resolve({ ok: false, summary: `No such file: ${file} - write it first with write_file` });

  return new Promise((res) => {
    const child = spawn("bun", ["run", p], { cwd: WORKSPACE_ROOT, env: { ...process.env, RAH_AGENT_SANDBOX: "1" } });
    let out = "";
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGKILL");
    }, RUN_TIMEOUT_MS);
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (out += d.toString()));
    child.on("error", (e) => {
      clearTimeout(timer);
      res({ ok: false, summary: `run_js failed to start: ${e.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const trimmed = out.slice(0, MAX_OUTPUT);
      res({
        ok: !killed && code === 0,
        summary: killed ? `${file}: timed out after ${RUN_TIMEOUT_MS / 1000}s` : `${file}: exit ${code}`,
        detail: trimmed + (out.length > MAX_OUTPUT ? `\n... (${out.length - MAX_OUTPUT} more chars)` : ""),
      });
    });
  });
}

export { listFiles, readFileTool, writeFileTool, runJs };
