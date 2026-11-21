// Shared types, data and small helpers for the Coach sidebar. Split out of
// CoachSidebar.tsx; nothing here touches React state.

export interface CoachMessage {
  id: number;
  role: "user" | "coach";
  text?: string;
  reply?: string;
  corrections?: { wrong: string; right: string }[];
  commands?: AgentCommand[];
  toolsUsed?: string[];
}

export interface AgentCommand {
  type: "navigate" | "refresh" | "toast" | "open_placement" | "start_review" | "set_theme";
  view?: string;
  title?: string;
  desc?: string;
  // set_theme only: validated token JSON produced by the server loop from the
  // tool's own result - never model-authored.
  tokens?: string;
}

export interface LiveStep {
  kind: "thought" | "tool" | "observe" | "error";
  label: string;
  detail?: string;
  ok?: boolean;
}

export interface WorkspaceFile {
  path: string;
  size: number;
  mtime: number;
  pdf: boolean;
}

export function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const SUGGESTIONS = [
  "Read my state and decide what I should do right now",
  "Make me a progress report as a PDF",
  "Find my weakest tags and write a 7-day drill plan file",
  "Search the web for B2 listening resources and save the best to a file",
];

// History written before the agent's JSON-repair fix can carry raw turn objects
// as the reply. Scrub them at render: unwrap a nested reply, never show braces.
export function scrubHistoryReply(reply: string | undefined): string | undefined {
  const r = (reply ?? "").trim();
  if (!r.startsWith("{") || !/"(thought|tool|final|args|reply)"/.test(r)) return reply;
  const m = r.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (m) {
    try {
      const unwrapped = JSON.parse(`"${m[1]}"`) as string;
      if (unwrapped.trim() && !unwrapped.trim().startsWith("{")) return unwrapped;
    } catch {
      // unparseable protocol marker - fall through to the leak notice
    }
  }
  return "(older turn - the raw agent protocol leaked here; it is fixed now)";
}
