// Shared shapes for the coach agent loop: client commands, streamed events and
// the turn result. Kept beside the loop driver so the prompt, repair and
// enforcement siblings can depend on the shapes without pulling the SDK in.

export const MAX_STEPS = 6;

export interface AgentCommand {
  type: "navigate" | "refresh" | "toast" | "open_placement" | "start_review" | "set_theme";
  view?: string;
  title?: string;
  desc?: string;
  // set_theme only: the validated token JSON is copied from the tool's own
  // result by the loop - the model never authors these values.
  tokens?: string;
}

export interface AgentEvent {
  type: "thought" | "tool" | "observe" | "final" | "error" | "done";
  label?: string;
  detail?: string;
  ok?: boolean;
  reply?: string;
  corrections?: { wrong: string; right: string; trap?: string }[];
  commands?: AgentCommand[];
  stepsUsed?: number;
}

export interface AgentTurn {
  reply: string;
  corrections: { wrong: string; right: string; trap?: string }[];
  commands: AgentCommand[];
  steps: { label: string; detail?: string; ok?: boolean }[];
  toolsUsed: string[];
  stopped?: boolean;
}

// Review feature #15: the graceful close when the learner stops a run. Pure
// (exported for the battery): the reply always names what WAS done and never
// pretends the task completed.
export function stoppedReply(steps: { label: string; ok?: boolean }[]): string {
  const done = steps.map((s) => s.label).filter((l) => l && !l.startsWith("Mode:") && !l.startsWith("Unknown"));
  if (done.length === 0) {
    return "Stopped before I got going - nothing was done yet. Send another message whenever you want me back on it.";
  }
  return `Stopped, as you asked. Completed before the stop: ${done.join(", ")}. Nothing beyond that ran; your message stands whenever you want the rest done.`;
}
