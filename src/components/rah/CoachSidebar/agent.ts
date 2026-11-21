// Coach agent run choreography: the SSE stream reader, the send flow, the
// command executor and the workspace/history/file route calls. CoachSidebar
// owns the hooks; these module functions receive setters and helpers through
// explicit bundles.

import type { Dispatch, SetStateAction } from "react";
import { getCoachActivity } from "@/lib/activity-store";
import { applyTheme, type RahTheme } from "@/lib/theme-bus";
import type { ViewId } from "../App";
import type { AgentCommand, CoachMessage, LiveStep, WorkspaceFile } from "./shared";
import { scrubHistoryReply } from "./shared";

type FinalAnswer = { reply?: string; corrections?: { wrong: string; right: string }[]; commands?: AgentCommand[] };

// One send flow's reads and writes, grouped as one bundle (the original send
// callback's closure + deps).
export interface CoachSend {
  running: boolean;
  view: string;
  setInput: Dispatch<SetStateAction<string>>;
  setRunning: Dispatch<SetStateAction<boolean>>;
  setSteps: Dispatch<SetStateAction<LiveStep[]>>;
  setFinalArrived: Dispatch<SetStateAction<boolean>>;
  setMessages: Dispatch<SetStateAction<CoachMessage[]>>;
  abortRef: { current: AbortController | null };
  executeCommand: (cmd: AgentCommand) => void;
  refresh: () => void;
  loadWorkspace: () => void;
}

// Reads the SSE trace: thought/tool/observe/error steps land in onStep as
// they arrive; the final event is returned with the run's answer.
async function readCoachStream(body: ReadableStream<Uint8Array>, onStep: (s: LiveStep) => void): Promise<{ final: FinalAnswer | null; lastError: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let final: FinalAnswer | null = null;
  let lastError = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const ev = JSON.parse(line.slice(6)) as {
        type: string; label?: string; detail?: string; ok?: boolean;
        reply?: string; corrections?: { wrong: string; right: string }[]; commands?: AgentCommand[];
      };
      if (ev.type === "thought" || ev.type === "tool") {
        onStep({ kind: ev.type === "tool" ? "tool" : "thought", label: ev.label ?? "", detail: ev.detail });
      } else if (ev.type === "observe") {
        onStep({ kind: "observe", label: ev.label ?? "", detail: ev.detail, ok: ev.ok });
      } else if (ev.type === "error") {
        lastError = ev.label ?? "error";
        onStep({ kind: "error", label: ev.label ?? "error", detail: ev.detail });
      } else if (ev.type === "final") {
        final = { reply: ev.reply, corrections: ev.corrections, commands: ev.commands };
      }
    }
  }
  return { final, lastError };
}

// One agent run: POST the message, stream the trace into steps, land the
// final answer (or an honest failure line) in the thread.
export async function runCoachSend(f: CoachSend, text: string): Promise<void> {
  const message = text.trim();
  if (!message || f.running) return;
  f.setInput("");
  f.setRunning(true);
  f.setSteps([]);
  f.setFinalArrived(false);
  f.setMessages((m) => [...m, { id: Date.now(), role: "user", text: message }]);

  // Review feature #15: Stop. The controller aborts the fetch; the server
  // sees req.signal fire, closes the loop between steps, and the stopped
  // turn still persists to history.
  const ctrl = new AbortController();
  f.abortRef.current = ctrl;

  try {
    const r = await fetch("/api/coach-agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, view: f.view, activity: getCoachActivity() }),
      signal: ctrl.signal,
    });
    if (!r.ok || !r.body) {
      const err = (await r.json().catch(() => ({ error: "Coach unreachable" }))) as { error?: string };
      f.setSteps([{ kind: "error", label: err.error ?? "Coach unreachable" }]);
      f.setRunning(false);
      return;
    }
    const run = await readCoachStream(r.body, (step) => f.setSteps((prev) => [...prev, step]));
    if (run.final?.reply) {
      f.setMessages((m) => [...m, { id: Date.now() + 1, role: "coach", reply: run.final?.reply, corrections: run.final?.corrections, commands: run.final?.commands }]);
      (run.final.commands ?? []).forEach(f.executeCommand);
      f.setFinalArrived(true);
      f.refresh();
      f.loadWorkspace(); // the run may have written files
    } else {
      // A run that ends without a final answer must still SAY something.
      f.setMessages((m) => [
        ...m,
        {
          id: Date.now() + 1,
          role: "coach",
          reply: run.lastError
            ? `I hit a snag (${run.lastError}) before I could answer. Your message stands - send it again in a moment.`
            : "The connection dropped mid-run. Send that again and I will pick it up.",
        },
      ]);
    }
  } catch {
    if (ctrl.signal.aborted) {
      f.setSteps((s) => [...s, { kind: "error", label: "Stopped" }]);
      f.setMessages((m) => [
        ...m,
        {
          id: Date.now() + 1,
          role: "coach",
          reply: "Stopped. What ran before the stop stays in the trace and in my memory - send another message whenever you want the rest done.",
        },
      ]);
      f.refresh();
      f.loadWorkspace();
    } else {
      f.setSteps((s) => [...s, { kind: "error", label: "Connection dropped mid-run" }]);
    }
  } finally {
    f.abortRef.current = null;
    f.setRunning(false);
  }
}

// Executes the agent's commands on the app: navigate, refresh, toast,
// start_review / open_placement, set_theme.
export function runAgentCommand(cmd: AgentCommand, act: { go: (v: ViewId) => void; refresh: () => void; toast: (t: { title: string; desc: string }) => void }) {
  if (cmd.type === "navigate" && cmd.view) {
    const allowed: ViewId[] = ["home", "review", "write", "speak", "listen", "read", "placement", "arcade", "progress"];
    if (allowed.includes(cmd.view as ViewId)) act.go(cmd.view as ViewId);
  } else if (cmd.type === "open_placement") {
    act.go("placement");
  } else if (cmd.type === "start_review") {
    act.go("review");
  } else if (cmd.type === "refresh") {
    act.refresh();
  } else if (cmd.type === "toast" && cmd.title) {
    act.toast({ title: cmd.title, desc: cmd.desc ?? "" });
  } else if (cmd.type === "set_theme" && cmd.tokens) {
    // Audit 2026-11-03: the agent can actually repaint the app. Tokens are
    // validated server side (set_theme tool) and painted here through the
    // same theme bus the app shell and tutor use, so the change is instant
    // and identical to a settings-driven repaint.
    try {
      applyTheme(JSON.parse(cmd.tokens) as RahTheme);
    } catch {
      // malformed tokens: the persisted profile still repaints on next state load
    }
  }
}

// Workspace listing (null keeps the current list on failure - a nicety).
export async function requestWorkspace(): Promise<WorkspaceFile[] | null> {
  try {
    const r = await fetch("/api/workspace", { cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as { files?: WorkspaceFile[] };
    return j.files ?? [];
  } catch {
    return null;
  }
}

// Chat history -> renderable messages (null keeps what is shown - a nicety).
// Old turns may carry raw protocol objects; scrubHistoryReply unwraps them.
export async function requestHistory(): Promise<CoachMessage[] | null> {
  try {
    const r = await fetch("/api/chat", { cache: "no-store" });
    if (!r.ok) return null;
    const data = (await r.json()) as {
      messages: { id: number; role: string; text?: string; parsed?: { skill?: string; reply?: string; corrections?: { wrong: string; right: string }[]; commands?: AgentCommand[]; toolsUsed?: string[] } }[];
    };
    return data.messages
      .filter((m) => m.role === "user" || (m.parsed && (m.parsed.reply || m.parsed.skill === "agent")))
      .slice(-40)
      .map((m) => ({
        id: m.id,
        role: m.role as "user" | "coach",
        text: m.text,
        reply: scrubHistoryReply(m.parsed?.reply),
        corrections: m.parsed?.corrections,
        commands: m.parsed?.commands,
        toolsUsed: m.parsed?.toolsUsed,
      }));
  } catch {
    return null;
  }
}

// Open/download a workspace file through fetch (NOT an <a href>): the fetch
// wrapper attaches x-rah-token, so this works even where cookies are dropped
// (preview iframes) - a plain link navigation would 401 there.
export async function openWorkspaceFile(f: WorkspaceFile, download: boolean): Promise<void> {
  try {
    const r = await fetch(`/api/workspace/file?path=${encodeURIComponent(f.path)}${download ? "&dl=1" : ""}`);
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    if (download) {
      const a = document.createElement("a");
      a.href = url;
      a.download = f.path.split("/").pop() ?? "file";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      window.open(url, "_blank");
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    // download is a nicety; the panel stays usable
  }
}
