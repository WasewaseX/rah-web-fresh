"use client";

// The Coach sidebar: a global agent drawer available on EVERY tab.
// Not a chat interface - an agent cockpit. It shows the agent thinking
// (thought -> tool -> observe steps), streams them live over SSE, renders the
// final answer with corrections, and EXECUTES the agent's commands on the app:
// navigate to any view, refresh state, start a review, toast announcements.
// This is the "access anything, show anything on all tabs" surface.
// Split into CoachSidebar/: shared.ts (types + data), agent.ts (route calls
// and run choreography), parts.tsx (drawer render blocks), CoachSidebar.tsx
// (the component that owns the hooks). This entry keeps the public API.

export type { AgentCommand, CoachMessage } from "./CoachSidebar/shared";
export { default } from "./CoachSidebar/CoachSidebar";
