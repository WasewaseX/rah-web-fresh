// ---------- fonts ----------

import { PDFFont } from "pdf-lib";

export const FONT_PATHS = {
  regular: "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  bold: "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  italic: "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf",
  mono: "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
  cjk: "/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf",
};

export interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  mono: PDFFont;
  cjk: PDFFont | null;
}

export const CJK_RE = /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/;

export function pickFont(f: Fonts, style: "regular" | "bold" | "italic" | "mono", text: string): PDFFont {
  if (style !== "mono" && f.cjk && CJK_RE.test(text)) return f.cjk;
  return f[style];
}

// pdf-lib throws on codepoints the embedded font cannot map (e.g. Arabic in a
// Latin font). Replace them honestly instead of crashing the tool: the reports
// the coach writes are Latin-script; exotic scripts become "?" placeholders.
export function sanitize(text: string): string {
  let out = "";
  for (const ch of text.replace(/\r/g, "").replace(/\t/g, "    ")) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 32 && ch !== "\n") continue;
    if (c >= 0x0600 && c <= 0x06ff) { out += "?"; continue; } // Arabic: unshapable without an RTL engine
    if (c > 0xffff) continue; // astral planes (emoji): not in any embedded font
    out += ch;
  }
  return out;
}
