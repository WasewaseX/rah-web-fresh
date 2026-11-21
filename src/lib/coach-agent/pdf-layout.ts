// ---------- layout constants, page context and word wrapping ----------

import { PDFDocument, PDFPage, rgb, type Color } from "pdf-lib";
import { pickFont, type Fonts } from "./pdf-fonts";
import type { Run } from "./pdf-inline";

export const PAGE_W = 595.28;
export const PAGE_H = 841.89;
export const MARGIN_X = 56;
export const MARGIN_TOP = 68;
export const MARGIN_BOTTOM = 62;

export const INK = rgb(0.12, 0.15, 0.2);
export const MUTED = rgb(0.42, 0.47, 0.55);
export const LINE = rgb(0.82, 0.85, 0.89);
export const ACCENT = rgb(0.31, 0.55, 1.0);
export const CODE_BG = rgb(0.955, 0.96, 0.97);
export const TABLE_HEAD_BG = rgb(0.925, 0.945, 0.985);

export interface Ctx {
  doc: PDFDocument;
  fonts: Fonts;
  page: PDFPage;
  y: number;
}

export function newPage(c: Ctx): void {
  c.page = c.doc.addPage([PAGE_W, PAGE_H]);
  c.y = PAGE_H - MARGIN_TOP;
}

export function ensure(c: Ctx, needed: number): void {
  if (c.y - needed < MARGIN_BOTTOM) newPage(c);
}

interface Frag {
  text: string;
  style: Run["style"];
}

interface Word {
  frags: Frag[];
  width: number;
}

function fragWidth(fr: Frag, f: Fonts, size: number): number {
  return pickFont(f, fr.style, fr.text).widthOfTextAtSize(fr.text, size);
}

// Draw styled runs with word wrapping inside [x, x+maxW]; returns lines drawn.
export function wrapDraw(
  c: Ctx,
  runs: Run[],
  geom: { size: number; leading: number; x: number; maxW: number; color?: Color },
): number {
  const { size, leading, x, maxW } = geom;
  const color = geom.color ?? INK;
  const f = c.fonts;
  // build word list with widths, keeping per-frag styles
  const words: Word[] = [];
  {
    let cur: Frag[] = [];
    const push = () => {
      const w: Word = { frags: cur, width: 0 };
      w.width = w.frags.reduce((s, fr) => s + fragWidth(fr, f, size), 0);
      words.push(w);
      cur = [];
    };
    for (const r of runs) {
      const parts = r.text.split(" ");
      parts.forEach((p, idx) => {
        if (idx > 0) push();
        if (p) cur.push({ text: p, style: r.style });
      });
    }
    push();
  }

  const spaceW = f.regular.widthOfTextAtSize(" ", size);
  let linesDrawn = 0;
  let line: Word[] = [];
  let lineW = 0;

  const drawLine = () => {
    let cx = x;
    for (const w of line) {
      for (const fr of w.frags) {
        const font = pickFont(f, fr.style, fr.text);
        c.page.drawText(fr.text, { x: cx, y: c.y, size, font, color });
        cx += fragWidth(fr, f, size);
      }
      cx += spaceW;
    }
    linesDrawn += 1;
  };

  for (const w of words) {
    const add = line.length === 0 ? w.width : w.width + spaceW;
    if (line.length > 0 && lineW + add > maxW) {
      drawLine();
      c.y -= leading;
      if (c.y < MARGIN_BOTTOM) newPage(c);
      line = [];
      lineW = 0;
    }
    if (w.width > maxW && line.length === 0) {
      // hard-break a monster word character by character
      let acc = "";
      let accStyle: Run["style"] = "regular";
      for (const fr of w.frags) {
        for (const ch of fr.text) {
          const testW = fragWidth({ text: acc + ch, style: fr.style }, f, size);
          if (acc && testW > maxW) {
            c.page.drawText(acc, { x, y: c.y, size, font: pickFont(f, accStyle, acc), color });
            c.y -= leading;
            if (c.y < MARGIN_BOTTOM) newPage(c);
            acc = ch;
            accStyle = fr.style;
          } else {
            acc += ch;
            accStyle = fr.style;
          }
        }
      }
      if (acc) c.page.drawText(acc, { x, y: c.y, size, font: pickFont(f, accStyle, acc), color });
      linesDrawn += 1;
      continue;
    }
    line.push(w);
    lineW += add;
  }
  if (line.length > 0 || linesDrawn === 0) drawLine();
  return linesDrawn;
}
