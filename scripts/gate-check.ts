// In-process gate check: does runAgent enforce add_cards for a deck-add ask?
//   export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | cut -d= -f2-)" && bun scripts/gate-check.ts
import { runAgent } from "../src/lib/coach-agent/loop";

const events: string[] = [];
const turn = await runAgent(
  "add the word serendipity to my vocab deck",
  [],
  undefined,
  (e) => events.push(`${e.type}${e.label ? `:${e.label.slice(0, 90)}` : ""}`),
  "home",
  null,
  undefined,
  { probe: true },
);
console.log("events:", events.join(" | "));
console.log("toolsUsed:", turn.toolsUsed);
console.log("ADD_CARDS ENFORCED:", turn.toolsUsed.includes("add_cards"));
console.log("reply (first 300):", turn.reply.slice(0, 300));
process.exit(turn.toolsUsed.includes("add_cards") ? 0 : 1);
