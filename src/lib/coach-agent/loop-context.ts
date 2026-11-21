// The [live context] line appended to every learner message.

import { slimScreenActivity } from "./context";

// The [live context] line appended to every learner message. Pure so the
// battery can pin it: the coach must NEVER have to ask the learner what is
// already on their screen.
export function buildLiveContext(
  p: { level: unknown; streak: unknown; due: unknown; focus: unknown; recentTraps: string[] },
  currentView?: string,
  activity?: Record<string, unknown> | null,
): string {
  let line = `[live context] level=${p.level} streak=${p.streak} due=${p.due} focus=${p.focus} traps=${p.recentTraps.join(",") || "none"}`;
  if (currentView) line += ` current_view=${currentView}`;
  // Audit P1 (context compression): the screen pack is slimmed by the shared
  // bounded seam (arrays 5, objects 200 chars, line <= 900) - the model gets
  // room-reading signal, never a JSON dump of the page.
  const screen = slimScreenActivity(activity);
  if (screen) line += `\n[current screen] ${screen}`;
  return line;
}
