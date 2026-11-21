// Per-user isolation (Task 67, the recorded residual): every arcade table -
// the FSRS deck queue, trophies, game records, quests, rival, league, runs,
// skill bands, placement - is keyed by the session user now. Functions keep
// their shapes: the user resolves from the request context (cookie ladder)
// and degrades to the singleton "me" under the deployment lock.
import { contentUserId } from "@/lib/scope";

async function uid(): Promise<string> {
  return contentUserId().catch(() => "me");
}

export { uid };
