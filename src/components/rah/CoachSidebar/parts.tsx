"use client";

// Coach drawer render blocks: floating opener, header (with the
// delete-account confirm), empty card, message thread, live agent trace,
// workspace panel and composer. Pure render - every value and handler
// arrives via props from CoachSidebar.

import { ArrowRight, BrainCircuit, Eye, FileDown, FileText, FolderOpen, GraduationCap, LogOut, Send, Square, Trash2, Wrench, X } from "lucide-react";
import { Btn, Chip } from "../ui";
import { clearRahToken } from "@/lib/rah-fetch";
import type { AgentCommand, CoachMessage, LiveStep, WorkspaceFile } from "./shared";
import { fmtSize, SUGGESTIONS } from "./shared";

// Floating opener: visible on every tab, every viewport.
export function CoachFab({ due, onOpen }: { due: number; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      aria-label="Open coach sidebar"
      className="fixed right-4 bottom-20 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[var(--rah-primary)] to-[var(--rah-primary-deep)] text-white shadow-[0_12px_32px_-8px_rgba(0,0,0,.6)] transition-transform hover:scale-105 active:scale-95 md:bottom-5"
    >
      <GraduationCap className="h-6 w-6" />
      {due > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#ffb02e] text-[11px] font-black text-[#1a1405]">
          {due > 99 ? "99" : due}
        </span>
      )}
    </button>
  );
}

// Delete the account: clears the token, toasts the outcome, signs out.
function deleteAccount(onToast: (t: { title: string; desc: string }) => void, onSignOut: () => void) {
  void fetch("/api/account", { method: "DELETE" })
    .then((r) => r.json())
    .then((d: { ok?: boolean; removed?: { learnerState: boolean } }) => {
      clearRahToken();
      onToast({
        title: "Account deleted",
        desc: d.removed?.learnerState
          ? "Everything was wiped: account, progress, reviews, files. The app is empty again."
          : "Your account is gone. Shared learner state kept (other accounts remain).",
      });
      onSignOut();
    })
    .catch(() => onToast({ title: "Deletion failed", desc: "Try again in a moment." }));
}

// The drawer header: identity, gems, the delete-account confirm, sign out
// and close.
export function CoachHeader({ running, gems, confirmDelete, deleting, setConfirmDelete, setDeleting, onToast, onSignOut, onClose }: {
  running: boolean;
  gems: number | null;
  confirmDelete: boolean;
  deleting: boolean;
  setConfirmDelete: (v: boolean) => void;
  setDeleting: (v: boolean) => void;
  onToast: (t: { title: string; desc: string }) => void;
  onSignOut: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--rah-primary)] to-[var(--rah-primary-deep)] text-white">
          <GraduationCap className="h-4.5 w-4.5" />
        </div>
        <div>
          <div className="text-sm font-black text-[#f2f5fa]">Coach</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d889c]">
            {running ? "working…" : "agent · every tab"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {gems !== null && <Chip tone="blue">{gems} gems</Chip>}
        {confirmDelete ? (
          <>
            <button
              onClick={() => {
                if (deleting) return;
                setDeleting(true);
                deleteAccount(onToast, onSignOut);
              }}
              disabled={deleting}
              title="Really delete everything"
              className="rounded-lg px-2 py-1.5 text-[11px] font-bold text-[#ff6b6b] transition-colors hover:bg-[#ff6b6b]/10 disabled:opacity-50"
            >
              {deleting ? "deleting…" : "really delete"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              title="Keep my account"
              className="rounded-lg p-2 min-h-[40px] min-w-[40px] text-[#7d889c] transition-colors hover:bg-white/[0.06] hover:text-[#f2f5fa]"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            title="Delete account - wipes everything for good"
            className="rounded-lg p-2 min-h-[40px] min-w-[40px] text-[#7d889c] transition-colors hover:bg-[#ff6b6b]/10 hover:text-[#ff6b6b]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => {
            void fetch("/api/auth/session", { method: "DELETE" }).then(() => {
              clearRahToken();
              onSignOut();
            });
          }}
          title="Sign out"
          className="rounded-lg p-2 min-h-[40px] min-w-[40px] text-[#7d889c] transition-colors hover:bg-white/[0.06] hover:text-[#f2f5fa]"
        >
          <LogOut className="h-4 w-4" />
        </button>
        <button
          onClick={onClose}
          title="Close"
          className="rounded-lg p-2 min-h-[40px] min-w-[40px] text-[#7d889c] transition-colors hover:bg-white/[0.06] hover:text-[#f2f5fa]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function EmptyCoachCard() {
  return (
    <div className="rounded-2xl border border-[var(--rah-primary)]/20 bg-[var(--rah-surface)] p-4">
      <div className="flex items-center gap-2 text-xs font-bold text-[var(--rah-accent)]">
        <GraduationCap className="h-3.5 w-3.5" /> An agent, not a chatbot
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-[#8b96a9]">
        I can read your live state, write files, render PDFs, run code, search the web, and act across every tab. Ask for a plan, a report, a drill file - I will show my steps as I work.
      </p>
    </div>
  );
}

// The message thread: user bubbles, coach replies with corrections, tool
// chips and the re-run command buttons.
export function CoachMessages({ messages, onCommand }: { messages: CoachMessage[]; onCommand: (cmd: AgentCommand) => void }) {
  return (
    <>
      {messages.map((m) =>
        m.role === "user" ? (
          <div key={m.id} className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--rah-primary)]/[0.16] px-3.5 py-2.5 text-[13px] font-medium text-[#dbe7ff] break-words [overflow-wrap:anywhere]">
              {m.text}
            </div>
          </div>
        ) : (
          <div key={m.id} className="space-y-2">
            <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-white/[0.06] bg-[var(--rah-surface)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#e8eefb] break-words [overflow-wrap:anywhere]">
              {m.reply}
            </div>
            {m.corrections && m.corrections.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {m.corrections.slice(0, 4).map((c, i) => (
                  <span key={i} className="rounded-lg border border-[#ff6b6b]/25 bg-[#ff6b6b]/[0.08] px-2 py-1 text-[11px] text-[#ffb3b3] break-words [overflow-wrap:anywhere]">
                    {c.wrong} <ArrowRight className="inline h-3 w-3" /> {c.right}
                  </span>
                ))}
              </div>
            )}
            {m.toolsUsed && m.toolsUsed.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {m.toolsUsed.map((t, i) => (
                  <span key={i} className="rounded-md bg-[#1b2438] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#7d889c]">
                    {t}
                  </span>
                ))}
              </div>
            )}
            {m.commands && m.commands.filter((c) => c.type === "navigate" || c.type === "start_review" || c.type === "open_placement").length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {m.commands
                  .filter((c) => c.type === "navigate" || c.type === "start_review" || c.type === "open_placement")
                  .map((c, i) => (
                    <button
                      key={i}
                      onClick={() => onCommand(c)}
                      className="rounded-lg border border-[var(--rah-primary)]/30 bg-[var(--rah-primary)]/[0.1] px-2.5 py-1 text-[11px] font-bold text-[var(--rah-accent)] transition-colors hover:bg-[var(--rah-primary)]/[0.2]"
                    >
                      {c.type === "start_review" ? "Start review" : c.type === "open_placement" ? "Open placement" : `Go to ${c.view}`}
                    </button>
                  ))}
              </div>
            )}
          </div>
        ),
      )}
    </>
  );
}

function stepIcon(kind: LiveStep["kind"]) {
  return kind === "tool" ? <Wrench className="h-3.5 w-3.5" /> : kind === "observe" ? <Eye className="h-3.5 w-3.5" /> : kind === "error" ? <X className="h-3.5 w-3.5" /> : <BrainCircuit className="h-3.5 w-3.5" />;
}

// Live agent trace: visible WHILE working (and after a failure so the steps
// stay inspectable); collapses once the final answer lands, so the
// conversation shows one clean reply instead of tool noise.
export function AgentTrace({ steps, running }: { steps: LiveStep[]; running: boolean }) {
  return (
    <div className="space-y-1.5 rounded-2xl border border-white/[0.06] bg-[var(--rah-bg)] p-3">
      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-[#7d889c]">
        <span className="flex items-center gap-1.5">
          <FileText className="h-3 w-3" /> agent trace
        </span>
        {!running && (
          <button
            onClick={() => {
              const text = steps.map((s) => `[${s.kind}] ${s.label}${s.detail ? ` — ${s.detail}` : ""}`).join("\n");
              void navigator.clipboard?.writeText(text).catch(() => undefined);
            }}
            className="normal-case tracking-normal text-[var(--rah-accent)] hover:text-[#f2f5fa]"
          >
            copy
          </button>
        )}
      </div>
      {steps.map((s, i) => (
        <div key={i} className="flex items-start gap-2 text-[11px] leading-snug">
          <span className={`mt-0.5 shrink-0 ${s.kind === "error" ? "text-[#ff6b6b]" : s.kind === "observe" ? (s.ok === false ? "text-[#ffb02e]" : "text-[#4ade80]") : s.kind === "tool" ? "text-[var(--rah-accent)]" : "text-[#8b96a9]"}`}>
            {stepIcon(s.kind)}
          </span>
          <div className="min-w-0 break-words [overflow-wrap:anywhere]">
            <span className="font-semibold text-[#dbe3f0]">{s.label}</span>
            {s.detail && <span className="text-[#6b7688]"> — {s.detail.length > 110 ? `${s.detail.slice(0, 110)}…` : s.detail}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RunningRow() {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold text-[#7d889c]">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#2a3242] border-t-[var(--rah-primary)]" />
      agent running…
    </div>
  );
}

// Workspace: the agent's deliverables, downloadable.
export function WorkspacePanel({ files, wsOpen, onToggle, onOpenFile }: { files: WorkspaceFile[]; wsOpen: boolean; onToggle: () => void; onOpenFile: (f: WorkspaceFile, download: boolean) => void }) {
  return (
    <div className="border-t border-white/[0.06] px-4 py-2">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
        aria-expanded={wsOpen}
      >
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#7d889c]">
          <FolderOpen className="h-3 w-3" /> workspace
          {files.length > 0 && (
            <span className="rounded-full bg-[var(--rah-primary)]/[0.18] px-1.5 py-0.5 text-[9px] font-bold text-[var(--rah-accent)]">{files.length}</span>
          )}
        </span>
        <span className="text-[11px] font-bold text-[#8b96a9]">{wsOpen ? "hide" : "show"}</span>
      </button>
      {wsOpen && (
        <div className="mt-1 max-h-40 space-y-1 overflow-y-auto pb-1">
          {files.length === 0 && (
            <div className="px-1 py-1.5 text-[11px] text-[#8b96a9]">
              Nothing yet - ask me to write a plan or make a PDF and it lands here.
            </div>
          )}
          {files.map((f) => (
            <div key={f.path} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--rah-bg)] px-2.5 py-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className={`h-3.5 w-3.5 shrink-0 ${f.pdf ? "text-[#ff8ba0]" : "text-[#7d889c]"}`} />
                <span className="truncate text-[12px] font-semibold text-[#dbe3f0]" title={`data/coach-workspace/${f.path}`}>
                  {f.path}
                </span>
                <span className="shrink-0 text-[11px] text-[#8b96a9]">{fmtSize(f.size)}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!f.pdf && (
                  <button
                    onClick={() => void onOpenFile(f, false)}
                    title="Preview"
                    className="rounded-md p-1.5 text-[#7d889c] transition-colors hover:bg-white/[0.06] hover:text-[#f2f5fa]"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => void onOpenFile(f, true)}
                  title="Download"
                  className="rounded-md p-1.5 text-[var(--rah-accent)] transition-colors hover:bg-[var(--rah-primary)]/[0.15]"
                >
                  <FileDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Suggestions + input: Enter submits, the danger button stops a running agent.
export function Composer({ input, setInput, running, onSend, onStop }: { input: string; setInput: (v: string) => void; running: boolean; onSend: (text: string) => void; onStop: () => void }) {
  return (
    <div className="border-t border-white/[0.06] px-4 pb-4 pt-3">
      <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => void onSend(s)}
            disabled={running}
            className="shrink-0 rounded-full border border-white/[0.08] bg-[var(--rah-surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--rah-accent)] transition-colors hover:border-[var(--rah-primary)]/40 disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSend(input);
        }}
        className="flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Message the agent"
          placeholder={running ? "Agent is working…" : "Ask the agent to do something…"}
          disabled={running}
          className="min-h-11 flex-1 rounded-xl border border-white/[0.08] bg-[var(--rah-surface)] px-3.5 text-[13px] text-[#f2f5fa] outline-none transition-colors placeholder:text-[#8b96a9] focus:border-[var(--rah-primary)]/50 disabled:opacity-50"
        />
        <Btn type="submit" disabled={running || !input.trim()} className="!min-h-11 !px-3">
          <Send className="h-4 w-4" />
        </Btn>
        {running && (
          <Btn onClick={onStop} variant="danger" className="!min-h-11 !px-3 rah-pulse">
            <Square className="h-4 w-4" />
          </Btn>
        )}
      </form>
    </div>
  );
}
