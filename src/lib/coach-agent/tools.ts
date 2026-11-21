// The coach's hands. Every tool the agent can call, with hard guards.
// File tools are sandboxed to the workspace root (data/coach-workspace):
// absolute paths and traversal outside the root are rejected before anything runs.
// run_js executes in a child bun process inside the workspace with a hard timeout
// and captured stdout/stderr - this is the coding ability: the agent can write a
// script with write_file, run it, read the output, and fix itself across steps.
//
// The implementations live in sibling modules under tools/ (topic files);
// this entry is the public surface - it re-exports every name this module
// exported before, so importers (loop.ts, re-tools.ts, the workspace routes)
// keep their exact import paths.

export { WORKSPACE_ROOT, ensureWorkspace, safePath } from "./tools/workspace";
export type { ToolResult, ToolArgs } from "./tools/types";
export { UNTRUSTED_FRAME } from "./tools/web";
export type { ToolDef, ToolTier } from "./tools/registry";
export {
  TOOL_TIERS,
  toolTier,
  TIER_BUDGETS,
  TOOLS,
  toolByName,
} from "./tools/registry";
