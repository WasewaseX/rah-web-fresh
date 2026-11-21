// The JSON-repair regression wall: loop unit pins for extractTurn/sanitizeReply.
import { check } from "./harness";

// ================= 5. LOOP UNITS: the JSON-repair regression wall =================
export async function loopUnits() {
  console.log("\n--- loop units: extractTurn / sanitizeReply ---");
  const { extractTurn, sanitizeReply } = await import("@/lib/coach-agent/loop");

  // The EXACT shape from the user's chat log (mangled braces, spaced keys).
  const wild = '{"thought":"The learner is asking me to \'make an exam\' at B2 level with a vocabulary focus. I should use the coach_skill function to generate an exam tailored to their current level and focus area.", "tool": "coach_skill", "args": {"message": "/exam vocabulary B2"}}}';
  const w = extractTurn(wild);
  check(w.kind === "json" && w.turn.tool === "coach_skill", "wild mangled JSON extracts a tool call", JSON.stringify(w));
  check((w.turn.args as any)?.message === "/exam vocabulary B2", "wild args survive the salvage", JSON.stringify(w.turn.args));
  check(!w.turn.reply, "wild mangled JSON never becomes a reply", JSON.stringify(w.turn.reply));

  // Truncated JSON (model cut mid-args).
  const cut = '{"thought":"need state","tool":"read_state","args":{';
  const c = extractTurn(cut);
  check(c.kind === "json" && c.turn.tool === "read_state", "truncated JSON repairs to a tool call", JSON.stringify(c));

  // Thought-only turn: parses, but has no tool and no final - the loop's
  // continuation branch (not the final branch) must own it.
  const t = extractTurn('{"thought":"Let me think about what to do here."}');
  check(!t.turn.tool && !t.turn.final && !t.turn.reply, "thought-only turn has no tool/final (loop will nudge)", JSON.stringify(t));

  // Fenced JSON.
  const f = extractTurn('```json\n{"thought":"go","final":true,"reply":"Here is your plan.","corrections":[],"commands":[]}\n```');
  check(f.turn.final === true && f.turn.reply === "Here is your plan.", "fenced final parses", JSON.stringify(f));

  // Plain prose: a legitimate final.
  const p = extractTurn("Great work today! Your streak is safe.");
  check(p.kind === "prose" && p.turn.final === true && p.turn.reply!.includes("streak"), "prose becomes a final answer", JSON.stringify(p));

  // Mangled final whose reply survives salvage.
  const mf = extractTurn('{"thought":"done","final":true,"reply":"The final will take place on Sunday - nice fix.","corrections":[]}');
  check(mf.turn.reply!.includes("Sunday"), "mangled final salvages the reply", JSON.stringify(mf));

  // sanitizeReply: raw JSON as reply gets unwrapped or replaced.
  check(sanitizeReply('{"thought":"x","tool":"read_state"}', "FB") === "FB", "sanitizeReply replaces a tool-call reply", sanitizeReply('{"thought":"x","tool":"read_state"}', "FB"));
  check(sanitizeReply('{"final":true,"reply":"Clean answer"}', "FB") === "Clean answer", "sanitizeReply unwraps a nested reply", "unwrap failed");
  check(sanitizeReply("A normal sentence.", "FB") === "A normal sentence.", "sanitizeReply passes prose through", "prose mangled");
}
