// ---------- code blocks and tables ----------

import { sanitize, type Fonts } from "./pdf-fonts";
import { PAGE_W, MARGIN_X, MARGIN_BOTTOM, INK, LINE, CODE_BG, TABLE_HEAD_BG, newPage, type Ctx } from "./pdf-layout";

export function drawCodeBlock(c: Ctx, lines: string[]): void {
  const size = 8.5;
  const leading = 11.5;
  const pad = 8;
  const maxChars = 92;
  const f = c.fonts;

  // wrap long lines by characters first
  const wrapped: string[] = [];
  for (const raw of lines) {
    let ln = sanitize(raw);
    while (f.mono.widthOfTextAtSize(ln, size) > (PAGE_W - MARGIN_X * 2) - pad * 2) {
      let cut = Math.min(maxChars, ln.length);
      while (cut > 1 && f.mono.widthOfTextAtSize(ln.slice(0, cut), size) > (PAGE_W - MARGIN_X * 2) - pad * 2) cut -= 1;
      wrapped.push(ln.slice(0, cut));
      ln = ln.slice(cut);
    }
    wrapped.push(ln);
  }

  // draw in page-sized chunks: rect + text per chunk
  let i = 0;
  while (i < wrapped.length) {
    const rowsOnThisPage = Math.floor((c.y - MARGIN_BOTTOM - pad * 2) / leading);
    const chunk = wrapped.slice(i, i + Math.max(rowsOnThisPage, 1));
    const blockH = chunk.length * leading + pad * 2 - 4;
    if (c.y - blockH < MARGIN_BOTTOM && chunk.length > 1) {
      chunk.pop();
    }
    const h = chunk.length * leading + pad * 2 - 4;
    c.page.drawRectangle({ x: MARGIN_X, y: c.y - h + 4, width: PAGE_W - MARGIN_X * 2, height: h, color: CODE_BG, borderColor: LINE, borderWidth: 0.5 });
    let ty = c.y - pad - size + 2;
    for (const ln of chunk) {
      c.page.drawText(ln, { x: MARGIN_X + pad, y: ty, size, font: f.mono, color: INK });
      ty -= leading;
    }
    c.y -= h + 6;
    i += chunk.length;
    if (i < wrapped.length) newPage(c);
  }
}

export function drawTable(c: Ctx, cells: string[][], f: Fonts): void {
  const size = 8.75;
  const pad = 5;
  const cols = Math.max(...cells.map((r) => r.length));
  const colW: number[] = [];
  for (let i = 0; i < cols; i++) {
    let w = 0;
    for (const row of cells) {
      const txt = sanitize(row[i] ?? "");
      const font = row === cells[0] ? f.bold : f.regular;
      w = Math.max(w, font.widthOfTextAtSize(txt, size));
    }
    colW.push(Math.min(Math.max(w + pad * 2, 42), 210));
  }
  const total = colW.reduce((a, b) => a + b, 0);
  const scale = (PAGE_W - MARGIN_X * 2) / total;
  if (scale < 1) for (let i = 0; i < colW.length; i++) colW[i] = colW[i] * scale;

  const rowH = (row: string[], header: boolean): number => {
    let maxLines = 1;
    row.forEach((cell, ci) => {
      const font = header ? f.bold : f.regular;
      const textW = font.widthOfTextAtSize(sanitize(cell), size);
      const avail = Math.max((colW[ci] ?? colW[colW.length - 1]) - pad * 2, 24);
      maxLines = Math.max(maxLines, Math.max(1, Math.ceil(textW / avail)));
    });
    return maxLines * 11 + pad + 3;
  };

  const drawRow = (row: string[], header: boolean) => {
    const h = rowH(row, header);
    const w = colW.reduce((a, b) => a + b, 0);
    if (header) c.page.drawRectangle({ x: MARGIN_X, y: c.y - h + 4, width: w, height: h, color: TABLE_HEAD_BG });
    let x = MARGIN_X;
    row.forEach((cell, ci) => {
      const cw = colW[ci] ?? colW[colW.length - 1];
      c.page.drawRectangle({ x, y: c.y - h + 4, width: cw, height: h, borderColor: LINE, borderWidth: 0.5 });
      const font = header ? f.bold : f.regular;
      let line = "";
      let ly = c.y - pad - size + 4;
      const flushLine = () => {
        if (line) c.page.drawText(line, { x: x + pad, y: ly, size, font, color: INK });
        ly -= 11;
        line = "";
      };
      for (const ch of sanitize(cell)) {
        if (line && font.widthOfTextAtSize(line + ch, size) > cw - pad * 2) flushLine();
        line += ch;
      }
      flushLine();
      x += cw;
    });
    c.y -= h;
  };

  for (let ri = 0; ri < cells.length; ri++) {
    const header = ri === 0;
    const h = rowH(cells[ri], header);
    if (c.y - h < MARGIN_BOTTOM) {
      newPage(c);
      if (ri > 0) drawRow(cells[0], true); // repeat the header row
    }
    drawRow(cells[ri], header);
  }
  c.y -= 8;
}
