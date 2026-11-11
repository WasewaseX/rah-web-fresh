// Task 119: deterministic intent handlers for the tutor chat path.
// The learner-facing failures this fixes (holder transcripts, 2026-11-03):
//   1. "make the Ui theme green" -> the tutor answered "I don't have the
//      ability to change the app's UI theme" - factually wrong: Rah has a
//      full theme-preset system (/api/theme, agent theme-control skill) the
//      tutor chat simply never routed to.
//   2. "many of the answers were wrong what are you doing?" -> the tutor
//      fabricated a review ("I've reviewed the grammar exam and answer key")
//      and invented a topic list that matched no real question. Exam
//      disputes now get a GROUNDED, deterministic reply quoting the actual
//      stored items - honesty by construction, not by prompting.
// Both intents run BEFORE the LLM. No model call, no fabrication surface.
//
// Task 124 (2026-11-05 holder transcript, same class of failure, round two):
//   3. Color-only asks ("make it blue again", "go green please") missed the
//      matcher and reached the LLM, which confabulated a policy wall:
//      "I've reached the limit for theme changes in this session ... when
//      the budget resets." No such budget exists. Matcher v2 adds color-only
//      and reset-direct paths (with false-positive guards so a practice
//      sentence like "make the wall green" still does not repaint), and the
//      route now runs an honesty net over the LLM reply: invented limits are
//      stripped wherever they appear, theme-inability claims when the topic
//      is the theme.

import { PRESETS, presetById, sanitizeTokens } from "@/lib/agent/theme";
import type { ThemeTokens } from "@/lib/agent/types";

export interface ThemeIntent {
  reset: boolean;
  presetId: string;
  tokens: Required<ThemeTokens> | null;
  reply: string;
  fa: string;
  // Task 135: graded signal strength of the gates that fired (0..1). The
  // DECISION is unchanged - the same gates, the same order - but the score
  // makes every hit auditable: logs show exactly why a message was taken
  // over, and future routing can hedge below 0.6 without touching the gate
  // logic. One computation, two consumers, zero drift.
  confidence: number;
}

export interface ThemeSignalScore {
  gates: string[]; // which entry gates fired, e.g. ["theme+action","colorDirect"]
  suppressed: string[]; // guards that vetoed, e.g. ["learningAsk"]
  confidence: number; // 0..1, additive per gate, clamped
}

const clampConfidence = (x: number) => Math.max(0, Math.min(0.99, x));

const THEME_TRIGGER =
  /\b(theme|colou?r ?scheme|colou?rs?|appearance|repaint|dark mode)\b/i;
const THEME_ACTION = /\b(change|switch|make|set|apply|turn|go|give|use|paint|repaint|want|reset|restore)\b/i;

// v2 shared color vocabulary (superset of the COLOR_MAP words).
const COLOR_WORDS =
  "green|blue|forest|ocean|sunset|orange|warm|amber|purple|violet|lavender|pink|rose|red|emerald|azure|midnight";

const COLOR_MAP: { re: RegExp; preset: string }[] = [
  { re: /\b(green|forest|emerald)\b/i, preset: "forest" },
  { re: /\b(blue|ocean|sea|azure)\b/i, preset: "ocean" },
  { re: /\b(orange|sunset|warm|amber)\b/i, preset: "sunset" },
  { re: /\b(purple|violet|lavender)\b/i, preset: "violet" },
  { re: /\b(pink|rose|red)\b/i, preset: "rose" },
  { re: /\b(reset|default|normal|original|midnight|back)\b/i, preset: "midnight" },
];

const PRESET_NAMES: Record<string, string> = {
  midnight: "Midnight (the default dark blue)",
  ocean: "Ocean (bright blue)",
  forest: "Forest (green)",
  sunset: "Sunset (warm orange)",
  violet: "Violet (purple)",
  rose: "Rose (pink/red)",
};

// v2 color-only paths. Each requires an ACTION VERB, plus one disambiguator,
// so a practice sentence ("make the wall green", "the sea is blue") never
// repaints the app:
//   - closer path:  "make it blue again" / "go green please" / "paint it
//     violet instead" - action + color + conversational closer.
//   - preset path:  "switch to ocean" / "set forest" - preset names are the
//     app's own theme vocabulary, unambiguous by construction.
//   - app-noun path: "the app is too dark, make it green" - color within a
//     short window of an app-context noun (either order), action required.
const COLOR_CLOSER =
  new RegExp(`\\b(change|switch|make|set|apply|turn|give|paint|want|have|go)\\b[^.!?]{0,20}\\b(${COLOR_WORDS})\\b\\s*(again|instead|please|now|too|back)\\b`, "i");
const PRESET_DIRECT =
  new RegExp(`\\b(change|switch|go|set|apply|turn|give)\\s+(?:to\\s+|it\\s+to\\s+|me\\s+)?(ocean|forest|sunset|violet|rose|midnight)\\b`, "i");
const APP_NOUN = "app|ui|screen|site|website|interface|page|rah|mode|look|style|design";
const APP_NOUN_COLOR =
  new RegExp(`\\b(?:${APP_NOUN})\\b[^.!?]{0,24}\\b(${COLOR_WORDS})\\b|\\b(${COLOR_WORDS})\\b[^.!?]{0,24}\\b(?:${APP_NOUN})\\b`, "i");
const RESET_PATTERNS = [
  /\b(reset|restore)\b[^.!?]{0,16}\b(theme|colou?r|mode|look|appearance|style|it|this|everything)\b/i,
  /\b(go|switch|turn|change|set)\s+(?:it\s+)?back\b[^.!?]{0,24}\b(normal|default|old|original|theme|colou?r|mode|look|it|this|the way it was)\b/i,
];

// Hoisted from matchThemeIntent (Task 135) so the scorer and the matcher
// share the exact same vocabulary - the score can never disagree with the
// decision because both are derived from THIS gate set.
const LEARNING_ASK =
  /\b(example|examples?|sentence|sentences?|words?|mean|means|meaning|translate|pronunciation|pronounce|vocab\w*|idiom|idioms|grammar)\b/i;
const STRONG_THEME = /\b(theme|colou?r ?scheme|appearance|repaint|dark mode)\b/i;

export function scoreThemeSignals(text: string): ThemeSignalScore {
  const t = text.slice(0, 300);
  const gates: string[] = [];
  const suppressed: string[] = [];
  let score = 0;
  const mentionsTheme = THEME_TRIGGER.test(t);
  const hasAction = THEME_ACTION.test(t);
  const colorDirect = /\b(green|blue|forest|ocean|sunset|violet|purple|rose|pink)\b[^.!?]{0,24}\b(theme|colou?r|mode|look)\b/i.test(t) ||
    /\btheme\b[^.!?]{0,24}\b(green|blue|forest|ocean|sunset|violet|purple|rose|pink)\b/i.test(t);
  const colorCloser = COLOR_CLOSER.test(t);
  const presetDirect = PRESET_DIRECT.test(t);
  const appNounColor = hasAction && APP_NOUN_COLOR.test(t);
  const resetDirect = RESET_PATTERNS.some((re) => re.test(t));
  // Gate weights: theme-noun+action and the app's own preset vocabulary are
  // the strongest evidence (0.6); reset direct and the other disambiguated
  // color paths are strong (0.55); color-next-to-theme-word without an
  // explicit action is weaker (0.3).
  if (mentionsTheme && hasAction) {
    gates.push("theme+action");
    score += 0.6;
  }
  if (colorDirect) {
    gates.push("colorDirect");
    score += 0.3;
  }
  if (colorCloser) {
    gates.push("colorCloser");
    score += 0.55;
  }
  if (presetDirect) {
    gates.push("presetDirect");
    score += 0.6;
  }
  if (appNounColor) {
    gates.push("appNounColor");
    score += 0.55;
  }
  if (resetDirect) {
    gates.push("resetDirect");
    score += 0.6;
  }
  // The learning-ask guard mirrors matchThemeIntent's veto exactly: a lesson
  // ask with no strong theme noun is the main false-positive class, so it
  // not only vetoes the match - it also drives the score to (or below) zero.
  const learningAsk = LEARNING_ASK.test(t);
  if (learningAsk && !STRONG_THEME.test(t) && !appNounColor && !resetDirect) {
    suppressed.push("learningAsk");
    score -= 0.4;
  }
  return { gates, suppressed, confidence: clampConfidence(score) };
}

export function matchThemeIntent(text: string): ThemeIntent | null {
  const t = text.slice(0, 300);
  // Task 135: the gates are computed ONCE here and both the decision and the
  // confidence come from that single computation.
  const sig = scoreThemeSignals(t);
  if (sig.gates.length === 0) return null;
  if (sig.suppressed.includes("learningAsk")) return null;

  const wantsReset =
    (/\b(reset|restore|default|original|back to (the )?old|back to (the )?normal)\b/i.test(t) && !/\b(green|blue|forest|ocean|sunset|violet|purple|rose|pink|red)\b/i.test(t)) ||
    (sig.gates.includes("resetDirect") && !/\b(green|blue|forest|ocean|sunset|violet|purple|rose|pink|red)\b/i.test(t));
  if (wantsReset) {
    const p = presetById("midnight")!;
    return {
      reset: true,
      presetId: "midnight",
      tokens: p.tokens,
      reply:
        "Done - the theme is reset to Midnight, the default dark blue. The app repaints immediately and it survives reloads. Want to try Forest green or Ocean blue sometime, just say the word.",
      fa: "تم به حالت پیش‌فرض برگشت. هر وقت خواستی دوباره عوضش کن.",
      confidence: sig.confidence,
    };
  }

  let preset = "forest"; // the holder asked for green first; green is the canonical ask
  for (const c of COLOR_MAP) {
    if (c.re.test(t)) {
      preset = c.preset;
      break;
    }
  }
  const p = presetById(preset)!;
  const name = PRESET_NAMES[preset] ?? preset;
  return {
    reset: false,
    presetId: preset,
    tokens: p.tokens,
    reply: `Done - the app now wears the ${name} theme. It repaints instantly and survives reloads; no settings digging needed. If you want another look, ask for green, blue, sunset, violet, rose - or say "reset the theme".`,
    fa: "تم عوض شد و همان لحظه اعمال می‌شود. هر رنگی خواستی بگو.",
    confidence: sig.confidence,
  };
}

// Broad net for the route's honesty check: "was the learner plausibly talking
// about the app's look?" Deliberately wider than matchThemeIntent - it only
// decides whether a model reply that CLAIMS theme inability gets replaced.
export function isThemeishMessage(text: string): boolean {
  const t = String(text).slice(0, 300);
  if (THEME_TRIGGER.test(t)) return true;
  if (matchThemeIntent(t)) return true;
  return COLOR_CLOSER.test(t) || PRESET_DIRECT.test(t) ||
    new RegExp(`\\b(change|switch|make|set|apply|turn|paint|go|give|use|want)\\b[^.!?]{0,20}\\b(${COLOR_WORDS})\\b`, "i").test(t);
}

// Fabrication detectors for the honesty net. Two classes, different scope:
// - claimsInventedLimit: budgets/quotas/session caps DO NOT EXIST anywhere in
//   this app, so a reply claiming one is always a fabrication, whatever the
//   learner asked. ("...reached the limit for theme changes in this session
//   ... when the budget resets.")
// - claimsThemeInability: "I can't change the theme / it's in your settings"
//   - only a fabrication when the learner was actually talking about the
//   look (isThemeishMessage gates it in the route); a vocabulary lesson about
//   the word "theme" must pass through untouched.
export function claimsInventedLimit(reply: string): boolean {
  const s = String(reply).slice(0, 600);
  if (
    /\breached\b[^.!?]{0,24}\b(limit|cap|maximum|max)\b[^.!?]{0,80}\b(theme|colou?r|change|session)/i.test(s) ||
    /\bsession (limit|cap|budget|quota)\b/i.test(s) ||
    (/\b(limit|cap)\b[^.!?]{0,40}\b(changes?|reached)\b/i.test(s) && /theme|colou?r/i.test(s))
  ) {
    return true;
  }
  // "budget resets" class: must be sentence-scoped so an English lesson ABOUT
  // budgets ("the company budget resets every quarter") never trips it, while
  // "...changing the theme again later when the budget resets" does.
  return String(s)
    .split(/[.!?]+/)
    .some((sent) =>
      /\b(budget|quota|allowance)\b[^.!?]{0,40}\b(resets?|refills?|spent|exhausted|runs? out|used up)\b/i.test(sent) &&
      /theme|colou?r|\bapp\b|session|\bi\b|\bmy\b|\bme\b|changing|change/i.test(sent)
    );
}

export function claimsThemeInability(reply: string): boolean {
  const s = String(reply).slice(0, 600);
  return (
    /\b(don't|do not|not able to|cannot|can't|won't|will not)\b[^.!?]{0,60}\b(change|switch|set|apply|update|control|repaint|adjust|modify|alter)\b[^.!?]{0,40}\b(theme|colou?rs?|appearance|look|ui|mode|design)\b/i.test(s) ||
    /\bno ability\b[^.!?]{0,60}\b(theme|colou?r|appearance)/i.test(s) ||
    /\b(settings|preferences|display settings)\b[^.!?]{0,60}\b(theme|colou?rs?|appearance|look)\b/i.test(s) ||
    /\b(theme|colou?rs?|appearance)\b[^.!?]{0,60}\b(settings|preferences)\b/i.test(s)
  );
}

// Grounded replacements, used by the route's honesty net. Every word is true:
// the presets listed are the real ones, and applying them takes one message.
export function themeHelpReply(): { reply: string; fa: string } {
  return {
    reply:
      'Let me fix my own mistake first: Rah CAN repaint itself - there is no settings hunt and no limit. Say any of: "green", "blue", "sunset", "violet", "rose", or "reset the theme" for the default Midnight look, and the whole app repaints instantly. If you meant something else by it, tell me in a couple of words and I will get it right.',
    fa: "راح خودش تم را عوض می‌کند؛ فقط رنگ را بگو: سبز، آبی، بنفش، صورتی یا reset.",
  };
}

export function limitResetReply(): { reply: string; fa: string } {
  return {
    reply:
      "That previous line was my mistake, straight up: there are no budgets, quotas, or session limits anywhere in Rah - nothing resets and nothing runs out. If you were asking for a new look, say green, blue, sunset, violet, or rose and it repaints on the spot. And if \"wat?\" meant my last reply made no sense - you were right, it did not. What did you want?",
    fa: "پاسخ قبلی‌ام اشتباه بود؛ هیچ محدودیتی در کار نیست. بگو چه می‌خواهی تا درست انجامش دهم.",
  };
}

export function themeTokensFor(intent: ThemeIntent): string | null {
  if (!intent.tokens) return "";
  const clean = sanitizeTokens(intent.tokens as Record<string, string>);
  return clean ? JSON.stringify(clean) : "";
}

export interface ExamDisputeReply {
  reply: string;
  fa: string;
  grounded: boolean;
}

export function matchExamDispute(text: string): boolean {
  const t = String(text).slice(0, 400);
  return (
    /(\banswers?\b|\bkey\b|\bgrading\b|\bgrade\b|\bmarked\b|\bscore\b|\bquestions?\b)[^.!?\n]{0,60}\b(wrong|incorrect|unfair|bad|mistake|bogus|off)\b/i.test(t) ||
    /\b(wrong|incorrect)[^.!?\n]{0,40}\b(answers?|key|grade|question)/i.test(t) ||
    /\byou marked me\b/i.test(t)
  );
}

// Compact, honest, grounded. Quotes the REAL stored exam when one exists.
// `brokenIds` lists items that FAILED the deterministic answerability gate -
// the route computes it, so every claim in the reply is backed by a real run.
// Never claims a review happened when none did.
export function examDisputeReply(
  exam: { title: string; items: { id: string; type: string; q: string; a: string }[] } | null,
  brokenIds: string[]
): ExamDisputeReply {
  if (!exam || exam.items.length === 0) {
    return {
      grounded: false,
      reply:
        "Straight answer: I can't re-open that exam from here - the chat exams are not kept after the turn, so there is nothing for me to honestly re-check. Paste the question you were marked wrong on and we will grade it together right now. And to be clear: if a key contradicted its own question, that is the generator's fault, not your English.",
      fa: "امتحان قبلی ذخیره نشده؛ سؤالش را بفرست تا با هم دوباره بررسی کنیم.",
    };
  }
  const broken = new Set(brokenIds);
  const shown = exam.items.slice(0, 4);
  const list = shown
    .map((it) => {
      const flag = broken.has(it.id) ? " [BROKEN - key fails Rah's own answerability gate]" : "";
      return `${it.id}) ${String(it.q).slice(0, 100)} -> key: ${JSON.stringify(String(it.a).slice(0, 50))}${flag}`;
    })
    .join(" | ");
  const verdict = broken.size
    ? `${broken.size === 1 ? "At least one item is" : `${broken.size} items are`} mechanically broken - that is the generator's fault, not your English.`
    : "the keys pass Rah's structural gate, but if one still reads unfair to you, say which and we will redo it together.";
  return {
    grounded: true,
    reply: `You were right to push back, so here is the honest version: I re-opened the exam actually stored in Rah ("${exam.title}", ${exam.items.length} items) and ran each one through Rah's own answerability gate just now. Real questions and keys: ${list}. Verdict: ${verdict} Point at any item and we will rebuild it together.`,
    fa: "آزمون واقعی را باز کردم و سؤال‌ها را با همان gate خودِ رح بررسی کردم؛ اگر سوالی خراب باشد تقصیر مولد است نه شما.",
  };
}
