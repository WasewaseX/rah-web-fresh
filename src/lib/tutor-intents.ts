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

import { PRESETS, presetById, sanitizeTokens } from "@/lib/agent/theme";
import type { ThemeTokens } from "@/lib/agent/types";

export interface ThemeIntent {
  reset: boolean;
  presetId: string;
  tokens: Required<ThemeTokens> | null;
  reply: string;
  fa: string;
}

const THEME_TRIGGER =
  /\b(theme|colou?r ?scheme|colou?rs?|appearance|repaint|dark mode)\b/i;
const THEME_ACTION = /\b(change|switch|make|set|apply|turn|go|give|use|paint|repaint|want|reset|restore)\b/i;

const COLOR_MAP: { re: RegExp; preset: string }[] = [
  { re: /\b(green|forest|emerald)\b/i, preset: "forest" },
  { re: /\b(blue|ocean|sea|azure)\b/i, preset: "ocean" },
  { re: /\b(orange|sunset|warm|amber)\b/i, preset: "sunset" },
  { re: /\b(purple|violet)\b/i, preset: "violet" },
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

export function matchThemeIntent(text: string): ThemeIntent | null {
  const t = text.slice(0, 300);
  const mentionsTheme = THEME_TRIGGER.test(t);
  const hasAction = THEME_ACTION.test(t);
  const colorDirect = /\b(green|blue|forest|ocean|sunset|violet|purple|rose|pink)\b[^.!?]{0,24}\b(theme|colou?r|mode|look)\b/i.test(t) ||
    /\btheme\b[^.!?]{0,24}\b(green|blue|forest|ocean|sunset|violet|purple|rose|pink)\b/i.test(t);
  if (!(mentionsTheme && hasAction) && !colorDirect) return null;

  const wantsReset = /\b(reset|restore|default|original|back to (the )?old|back to (the )?normal)\b/i.test(t) && !/\b(green|blue|forest|ocean|sunset|violet|purple|rose|pink|red)\b/i.test(t);
  if (wantsReset) {
    const p = presetById("midnight")!;
    return {
      reset: true,
      presetId: "midnight",
      tokens: p.tokens,
      reply:
        "Done - the theme is reset to Midnight, the default dark blue. The app repaints immediately and it survives reloads. Want to try Forest green or Ocean blue sometime, just say the word.",
      fa: "تم به حالت پیش‌فرض برگشت. هر وقت خواستی دوباره عوضش کن.",
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
