// Shared tool contracts: every tool returns the same envelope shape.

export interface ToolResult {
  ok: boolean;
  summary: string; // one line for the step trace UI
  detail?: string; // full observation fed back to the model (truncated by the loop)
  // Machine-readable payload the LOOP (not the model) may turn into a client
  // command - e.g. set_theme returns the validated tokens so the sidebar can
  // repaint. The model never authors these values, it can only trigger them.
  data?: unknown;
}

export type ToolArgs = Record<string, unknown>;
