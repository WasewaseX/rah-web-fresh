"use client";

// The Coach sidebar component: owns the hooks and the drawer layout; the
// render blocks live in parts.tsx and the route/run choreography in agent.ts.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppState, ViewId } from "../App";
import type { AgentCommand, CoachMessage, LiveStep, WorkspaceFile } from "./shared";
import { openWorkspaceFile, requestHistory, requestWorkspace, runAgentCommand, runCoachSend } from "./agent";
import { AgentTrace, CoachFab, CoachHeader, CoachMessages, Composer, EmptyCoachCard, RunningRow, WorkspacePanel } from "./parts";

export default function CoachSidebar({
  open, onOpenChange, state, view, go, refresh, toast, onSignOut,
}: { open: boolean; onOpenChange: (v: boolean) => void; state: AppState | null; view: string; go: (v: ViewId) => void; refresh: () => void; toast: (t: { title: string; desc: string }) => void; onSignOut: () => void; }) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [steps, setSteps] = useState<LiveStep[]>([]);
  const [running, setRunning] = useState(false);
  const [finalArrived, setFinalArrived] = useState(false);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [wsOpen, setWsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const stopRun = useCallback(() => abortRef.current?.abort(), []);
  const loadWorkspace = useCallback(() => {
    void requestWorkspace().then((next) => {
      if (next) setFiles(next);
    });
  }, []);
  const openFile = useCallback((f: WorkspaceFile, download: boolean) => openWorkspaceFile(f, download), []);
  const loadHistory = useCallback(() => {
    void requestHistory().then((msgs) => {
      if (msgs) setMessages(msgs);
    });
  }, []);

  useEffect(() => {
    if (open && !startedRef.current) {
      startedRef.current = true;
      void loadHistory();
      void loadWorkspace();
    }
  }, [open, loadHistory, loadWorkspace]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, steps, running]);

  const executeCommand = useCallback((cmd: AgentCommand) => runAgentCommand(cmd, { go, refresh, toast }), [go, refresh, toast]);

  // Send bundle: identity tracks exactly the values runCoachSend reads (the
  // original send callback's closure + deps).
  const sf = useMemo(() => ({ running, view, setInput, setRunning, setSteps, setFinalArrived, setMessages, abortRef, executeCommand, refresh, loadWorkspace }), [running, view, executeCommand, refresh, loadWorkspace]);
  const send = useCallback((text: string) => void runCoachSend(sf, text), [sf]);

  return (
    <>
      {!open && <CoachFab due={state?.due ?? 0} onOpen={() => onOpenChange(true)} />}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-white/[0.08] bg-[#0d1320]/95 backdrop-blur-2xl shadow-[-24px_0_64px_-24px_rgba(0,0,0,.8)] transition-transform duration-300 sm:w-[440px] ${
          open ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <CoachHeader
          running={running}
          gems={state ? state.learner.gems ?? 0 : null}
          confirmDelete={confirmDelete}
          deleting={deleting}
          setConfirmDelete={setConfirmDelete}
          setDeleting={setDeleting}
          onToast={toast}
          onSignOut={onSignOut}
          onClose={() => onOpenChange(false)}
        />

        {/* Stream */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 && steps.length === 0 && <EmptyCoachCard />}
          <CoachMessages messages={messages} onCommand={executeCommand} />
          {steps.length > 0 && (running || !finalArrived) && <AgentTrace steps={steps} running={running} />}
          {running && <RunningRow />}
        </div>

        {/* Workspace: the agent's deliverables, downloadable */}
        <WorkspacePanel files={files} wsOpen={wsOpen} onToggle={() => { setWsOpen((v) => !v); void loadWorkspace(); }} onOpenFile={openFile} />

        {/* Suggestions + input */}
        <Composer input={input} setInput={setInput} running={running} onSend={send} onStop={stopRun} />
      </div>
    </>
  );
}
