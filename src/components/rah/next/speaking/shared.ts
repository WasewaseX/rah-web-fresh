// Task repetition: record the same prompt, get a transcript from the
// built-in engine, let the coach pre-fill a four-slot repair plan (one
// grammar item, one vocab upgrade, one pronunciation risk, one awkward
// sentence), edit it, then record attempt two. Recognition is not
// production, so the learner still reviews every slot by hand.
export type Phase = "pick" | "prep" | "record" | "diagnose" | "again";

export interface Attempt {
  n: number;
  seconds: number;
  eval: { grammar: string; vocab: string; pron: string; awkward: string };
  transcript?: string;
}

export const EMPTY_EV = { grammar: "", vocab: "", pron: "", awkward: "" };
