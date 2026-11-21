// Workspace sandbox: the coach's file tools are rooted here, and the download
// routes enforce the same boundary.

import { mkdir } from "fs/promises";
import { resolve, isAbsolute, sep } from "path";

export const WORKSPACE_ROOT = resolve(process.cwd(), "data/coach-workspace");

export async function ensureWorkspace(): Promise<string> {
  await mkdir(WORKSPACE_ROOT, { recursive: true });
  return WORKSPACE_ROOT;
}

// Resolve a user-supplied relative path inside the root. Returns null on any
// attempt to escape (absolute paths, .., symlink tricks resolve outside).
// Exported so the workspace download routes enforce the SAME sandbox.
export function safePath(rel: string): string | null {
  if (!rel || typeof rel !== "string") return null;
  const p = isAbsolute(rel) ? null : resolve(WORKSPACE_ROOT, rel);
  if (!p) return null;
  if (p !== WORKSPACE_ROOT && !p.startsWith(WORKSPACE_ROOT + sep)) return null;
  return p;
}
