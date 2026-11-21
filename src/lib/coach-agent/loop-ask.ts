// Deterministic ask-classifiers for the loop's server-side enforcement nudges.
// Each predicate is pure and exported for the battery; the loop pairs every
// one of them with a single per-run nudge that demands the real tool before
// any final reply is accepted.

// Review feature C (the 7.4/10 wave, agent dependability): prompt rules
// alone could not stop the model from answering state questions straight
// from [live context]. The LOOP now enforces the rule deterministically: a
// final answer with zero tool calls on a state-shaped question gets ONE
// server-side nudge that demands read_state, then the run continues. Pure
// and exported for the battery.
export function isStateQuestion(message: string): boolean {
  return /\b(streak|due\b|due count|my level|my xp|\bxp\b|gems?\b|review\b.*due|my mistakes|my progress|what should i (do|practice)|how am i doing|read_state)\b/i.test(message);
}

// Task 125 (live-probed failures): "add the word X to my vocab deck" was
// answered with a workspace document / a skill run, and the final reply
// CLAIMED the card was added - a fabricated action. Week/workload questions
// were answered from read_state, which only knows today. Prompt descs alone
// did not hold (the model pattern-matched to familiar tools), so the loop
// enforces both deterministically, same doctrine as isStateQuestion: one
// server-side nudge per run that demands the real tool before any final
// reply is accepted. Pure and exported for the battery.
export function isDeckAddAsk(message: string): boolean {
  return /\b(add|put)\b[^.!?]{0,24}\b(into|to|in)\b[^.!?]{0,24}\b(deck|vocab\w*|flash\s?cards?|my cards?)\b/i.test(message);
}

export function isWeekAsk(message: string): boolean {
  return (
    /\b(week|weekly|coming days|next (few|7|seven) days|forecast|upcoming)\b/i.test(message) &&
    /\b(review|reviews|due|cards?|queue|workload|stud(y|ying)|reps?)\b/i.test(message)
  );
}

// Task 140: past-activity asks ("how did my week go") are the mirror of
// isWeekAsk - they need progress_review (the drill ledger), not the forecast.
// Kept tight to week/day/month-shaped retrospection so plain "progress"
// questions stay on read_state's mandate. Pure and exported for the battery.
export function isProgressAsk(message: string): boolean {
  return /\b(how (was|is|did)\s+(my|the)\s+(week|day|month)|weekly (progress|report|review)|week in review|my (week|progress) (this|last) (week|month)|what did i (do|study|practice) (this|last) (week|month))\b/i.test(message);
}
