// Shared AI message/profile shapes, imported by every engine and prompt
// module so no sibling has to import from the ./ai barrel (no cycles).

// Chat message shape shared by every engine (built-in and BYO).
export interface ChatMsg {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ProfileJson {
  level: string;
  streak: number;
  focus: string;
  due: number;
  recentTraps: string[];
  weakSkills: string[];
  mistakes: { tag: string; count: number; label: string }[];
  mistakesHealed: number;
}
