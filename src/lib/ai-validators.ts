// Schema validators for the AI JSON envelopes (audit 2026-11-03, P1:
// "ai.ts schema validation"). extractJson guarantees only that the model
// produced SOME object - a parseable envelope with the wrong shape used to
// sail through into routes and components and crash or misrender there.
// aiJson's `validate` option turns a shape violation into a RETRY with the
// contract reminder, and only a valid object (or the explicit fallback /
// honest 502) reaches the caller.
//
// Rules for every validator in this file:
//   - pure, no imports, signature (out: unknown) => string | null
//     (null = valid, string = the contract violation for the retry nudge)
//   - load-bearing fields only: strings must be non-empty where the route
//     actually renders them, arrays must exist with sane bounds, numbers must
//     be in the range the prompt promises. Cosmetic optionality stays optional.
//   - error strings are written for the MODEL to read (they go back as
//     "contract violation: ..."), so they name the exact expected shape.

/* eslint-disable @typescript-eslint/no-explicit-any */

type V = (out: unknown) => string | null;

const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isArr = (v: unknown): v is any[] => Array.isArray(v);

function reqStr(o: any, key: string, label: string, minLen = 1): string | null {
  if (!isStr(o[key]) || o[key].trim().length < minLen) return `${label} must be a non-empty string (got ${JSON.stringify(o[key] ?? null)})`;
  return null;
}

function reqArr(o: any, key: string, label: string, min: number, max: number): string | null {
  if (!isArr(o[key])) return `${label} must be an array`;
  if (o[key].length < min) return `${label} must have at least ${min} item(s) (got ${o[key].length})`;
  if (o[key].length > max) return `${label} must have at most ${max} item(s) (got ${o[key].length})`;
  return null;
}

function reqScore(o: any, key: string, label: string, min = 1, max = 10): string | null {
  if (!isNum(o[key]) || o[key] < min || o[key] > max) return `${label} must be a number ${min}-${max}`;
  return null;
}

function each(arr: any[], label: string, check: (item: any, i: number) => string | null): string | null {
  for (let i = 0; i < arr.length; i++) {
    const e = check(arr[i], i);
    if (e) return `${label}[${i}]: ${e}`;
  }
  return null;
}

const obj = (v: unknown) => v && typeof v === "object" && !Array.isArray(v);

// ---------- the envelopes ----------

// /api/coach/briefing: {"priority", "plan":[3], "pep"}
export const validateBrief: V = (out) => {
  if (!obj(out)) return "briefing output must be a JSON object";
  const o = out as any;
  return reqStr(o, "priority", "priority") ?? reqArr(o, "plan", "plan", 3, 3) ?? each(o.plan, "plan", (it) => (isStr(it) && it.trim() ? null : "each plan item must be a non-empty string")) ?? reqStr(o, "pep", "pep") ?? null;
};

// /api/quiz: {"title", "items":[{type, q, choices?, a, why, fa}]}
export const validateQuiz: V = (out) => {
  if (!obj(out)) return "quiz output must be a JSON object";
  const o = out as any;
  const head = reqStr(o, "title", "title") ?? reqArr(o, "items", "items", 4, 20);
  if (head) return head;
  return each(o.items, "items", (it) => {
    if (!obj(it)) return "item must be an object";
    const e = reqStr(it, "q", "q") ?? reqStr(it, "a", "a");
    if (e) return e;
    if (String(it.type) === "mcq") {
      if (!isArr(it.choices) || it.choices.length < 2) return "mcq items need a choices array of at least 2 options";
      if (!it.choices.includes(it.a)) return "mcq: a must be one of the choices exactly";
    }
    return null;
  });
};

// /api/listen: {"title", "text", "questions":[{q, choices[4], a, why}]}
export const validateListen: V = (out) => {
  if (!obj(out)) return "listen output must be a JSON object";
  const o = out as any;
  const head = reqStr(o, "title", "title") ?? (isStr(o.text) && o.text.trim().length >= 80 ? null : "text must be the monologue (at least 80 characters)") ?? reqArr(o, "questions", "questions", 2, 10);
  if (head) return head;
  return each(o.questions, "questions", (q) => {
    if (!obj(q)) return "question must be an object";
    if (!isArr(q.choices) || q.choices.length < 2) return "questions need a choices array of at least 2 options";
    return reqStr(q, "q", "q") ?? (q.choices.includes(q.a) ? null : "a must be one of the choices exactly");
  });
};

// /api/speak: {"scores":{fluency,range,accuracy,delivery}, "errors", "upgrades", "round2", "verdict", "fa_note"}
export const validateSpeak: V = (out) => {
  if (!obj(out)) return "speak output must be a JSON object";
  const o = out as any;
  if (!obj(o.scores)) return "scores must be an object {fluency, range, accuracy, delivery}";
  const s = reqScore(o.scores, "fluency", "scores.fluency") ?? reqScore(o.scores, "range", "scores.range") ?? reqScore(o.scores, "accuracy", "scores.accuracy") ?? reqScore(o.scores, "delivery", "scores.delivery");
  if (s) return s;
  if (!isArr(o.errors)) return "errors must be an array (may be empty)";
  const e = each(o.errors, "errors", (it) => (obj(it) ? reqStr(it, "bad", "bad") ?? reqStr(it, "good", "good") : "error entry must be an object {bad, good, fa}"));
  if (e) return e;
  if (!isArr(o.upgrades)) return "upgrades must be an array";
  if (!obj(o.round2) || !isStr(o.round2.constraint) || !o.round2.constraint.trim()) return "round2 must be an object with a non-empty constraint string";
  return reqStr(o, "verdict", "verdict") ?? null;
};

// /api/writing: {"level", "scores":{task,organization,range,accuracy}, "verdict", "errors", "upgrades", "next_focus"}
export const WRITING_LEVELS = ["B2", "B2+", "C1"];
export const validateWriting: V = (out) => {
  if (!obj(out)) return "writing output must be a JSON object";
  const o = out as any;
  if (!WRITING_LEVELS.includes(o.level)) return `level must be one of ${WRITING_LEVELS.join(" | ")} (got ${JSON.stringify(o.level)})`;
  if (!obj(o.scores)) return "scores must be an object {task, organization, range, accuracy}";
  const s = reqScore(o.scores, "task", "scores.task") ?? reqScore(o.scores, "organization", "scores.organization") ?? reqScore(o.scores, "range", "scores.range") ?? reqScore(o.scores, "accuracy", "scores.accuracy");
  if (s) return s;
  if (!isArr(o.errors) || o.errors.length > 12) return "errors must be an array of at most 12 items";
  const e = each(o.errors, "errors", (it) => (obj(it) ? reqStr(it, "bad", "bad") ?? reqStr(it, "good", "good") : "error entry must be an object {bad, good, fa}"));
  if (e) return e;
  if (!isArr(o.upgrades)) return "upgrades must be an array";
  return reqStr(o, "verdict", "verdict") ?? null;
};

// /api/tutor/exam/submit (AssessReport) and the tutor exam runner
export const ASSESS_BANDS = ["B1", "B1+", "B2", "B2+", "C1", "C1+"];
export const validateAssess: V = (out) => {
  if (!obj(out)) return "assessment output must be a JSON object";
  const o = out as any;
  if (!isStr(o.band) || !ASSESS_BANDS.includes(o.band)) return `band must be one of ${ASSESS_BANDS.join(" | ")} (got ${JSON.stringify(o.band)})`;
  if (!isArr(o.strengths) || !isArr(o.weaknesses)) return "strengths and weaknesses must be arrays";
  if (!isArr(o.errors)) return "errors must be an array (an empty one is rebuilt mechanically)";
  if (!isArr(o.prescription)) return "prescription must be an array";
  return reqStr(o, "verdict", "verdict") ?? null;
};

// /api/tutor/plan (PlanReport): {"goal", "days":[7 x {day, focus, tasks:[{text, minutes}]}]}
export const validatePlan: V = (out) => {
  if (!obj(out)) return "plan output must be a JSON object";
  const o = out as any;
  const head = reqStr(o, "goal", "goal") ?? reqArr(o, "days", "days", 5, 9);
  if (head) return head;
  return each(o.days, "days", (d, i) => {
    if (!obj(d)) return "day must be an object";
    if (!isNum(d.day)) return `day number missing (entry ${i})`;
    const e = reqStr(d, "focus", "focus") ?? reqArr(d, "tasks", "tasks", 1, 6);
    if (e) return e;
    return each(d.tasks, "tasks", (t) => (obj(t) ? reqStr(t, "text", "text") ?? reqScore(t, "minutes", "minutes", 5, 30) : "task must be an object {text, minutes}"));
  });
};

// /api/tutor/scan: {"band", "verdict", "strengths", "weaknesses":[{point, fix}], "actions", "confidence"}
export const validateScan: V = (out) => {
  if (!obj(out)) return "scan output must be a JSON object";
  const o = out as any;
  if (!isStr(o.band) || !ASSESS_BANDS.includes(o.band)) return `band must be one of ${ASSESS_BANDS.join(" | ")} (got ${JSON.stringify(o.band)})`;
  const head = reqStr(o, "verdict", "verdict") ?? reqArr(o, "weaknesses", "weaknesses", 1, 10) ?? reqArr(o, "actions", "actions", 1, 8);
  if (head) return head;
  const w = each(o.weaknesses, "weaknesses", (it) => (obj(it) ? reqStr(it, "point", "point") ?? reqStr(it, "fix", "fix") : "weakness must be an object {point, fix}"));
  if (w) return w;
  if (o.confidence !== undefined && o.confidence !== null && (!isNum(o.confidence) || o.confidence < 0 || o.confidence > 1)) return "confidence must be a number 0-1";
  return null;
};

// /api/tutor/clinic: {"title", "goal", "items":[5 x {kind, q, a, fa}]}
export const validateClinic: V = (out) => {
  if (!obj(out)) return "clinic drill output must be a JSON object";
  const o = out as any;
  const head = reqStr(o, "title", "title") ?? reqArr(o, "items", "items", 4, 8);
  if (head) return head;
  return each(o.items, "items", (it) => (obj(it) ? reqStr(it, "q", "q") ?? reqStr(it, "a", "a") : "item must be an object {kind, q, a, fa}"));
};

// /api/placement (writing sample): {"level" in RUNGS, "confidence", "reasons"}
export const PLACEMENT_RUNGS = ["B1", "B2", "B2+", "C1"];
export const validatePlacementW: V = (out) => {
  if (!obj(out)) return "placement output must be a JSON object";
  const o = out as any;
  if (!PLACEMENT_RUNGS.includes(o.level)) return `level must be one of ${PLACEMENT_RUNGS.join(" | ")} (got ${JSON.stringify(o.level)})`;
  if (!isNum(o.confidence) || o.confidence < 0 || o.confidence > 1) return "confidence must be a number 0-1";
  return reqStr(o, "reasons", "reasons") ?? null;
};

// /api/tutor/exam (generation): the route filters items itself and 502s below
// 4 - the validator makes a thin reply burn retry budget with the contract
// reminder instead of a cold failure.
export const validateExamGen: V = (out) => {
  if (!obj(out)) return "exam output must be a JSON object";
  const o = out as any;
  const head = reqArr(o, "items", "items", 4, 24);
  if (head) return head;
  return each(o.items, "items", (it) => (obj(it) ? reqStr(it, "q", "q") ?? reqStr(it, "a", "a") : "item must be an object with q and a"));
};
