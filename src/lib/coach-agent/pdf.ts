// A real markdown -> PDF engine for the coach's make_pdf tool.
// Why hand-built layout on pdf-lib instead of a converter package: every
// npm "md to pdf" bridge needs headless Chromium (300MB, dies in serverless)
// or ships a layout engine that cannot run inside the Next server. pdf-lib +
// fontkit is pure JS, and the layout rules here are small enough to own:
// A4, Liberation Sans (Helvetica metrics) for Latin text, Noto Serif SC for
// CJK runs, DejaVu Mono for code, deterministic wrapping, no network.
//
// The pipeline is split across pdf-* siblings (fonts, inline runs, layout,
// block parser, code/table drawing); this file owns document assembly and
// re-exports the public names so importers keep importing from "./pdf".

import { PDFDocument, PDFFont, PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { FONT_PATHS, CJK_RE, sanitize, type Fonts } from "./pdf-fonts";
import { inlineRuns } from "./pdf-inline";
import { PAGE_W, PAGE_H, MARGIN_X, MARGIN_TOP, INK, MUTED, LINE, ACCENT, ensure, wrapDraw, type Ctx } from "./pdf-layout";
import { parseBlocks, type Block } from "./pdf-blocks";
import { drawCodeBlock, drawTable } from "./pdf-draw";

export interface PdfResult {
  bytes: Uint8Array;
  pages: number;
}

export { inlineRuns } from "./pdf-inline";
export type { Run } from "./pdf-inline";
export { parseBlocks } from "./pdf-blocks";

// Create the document and embed its fonts. CJK is conditional: the font is
// ~9MB raw, so it is only embedded (subset) when the report actually uses it.
async function createDoc(md: string): Promise<{ doc: PDFDocument; fonts: Fonts }> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle("Rah - coach report");
  doc.setProducer("rah-web coach agent");

  const fs = await import("fs/promises");
  // subset: true keeps each embedded font to the glyphs actually used
  const embed = async (p: string): Promise<PDFFont> => doc.embedFont(await fs.readFile(p), { subset: true });
  const fonts: Fonts = {
    regular: await embed(FONT_PATHS.regular),
    bold: await embed(FONT_PATHS.bold),
    italic: await embed(FONT_PATHS.italic),
    mono: await embed(FONT_PATHS.mono),
    cjk: null,
  };
  if (CJK_RE.test(sanitize(md))) {
    // CJK font is ~9MB raw: only embed (subset) when the report actually uses it
    try {
      fonts.cjk = await embed(FONT_PATHS.cjk);
    } catch {
      fonts.cjk = null; // CJK falls back to Latin-only rendering
    }
  }
  return { doc, fonts };
}

// Heading, paragraph and list blocks. firstH1 suppresses the top gap before
// the very first h1 of the document (per-run state, kept across the loop).
function renderTextBlock(c: Ctx, fonts: Fonts, b: Block, contentW: number, st: { firstH1: boolean }): void {
  switch (b.kind) {
    case "h1": {
      // Convention everywhere: c.y IS the baseline of the next line drawn.
      c.y -= st.firstH1 ? 0 : 14;
      st.firstH1 = false;
      const size = 18.5;
      c.page.drawText(b.text ?? "", { x: MARGIN_X, y: c.y, size, font: fonts.bold, color: INK });
      c.y -= 24; // past descenders
      c.page.drawRectangle({ x: MARGIN_X, y: c.y + 2, width: 46, height: 2.5, color: ACCENT });
      c.y -= 10;
      break;
    }
    case "h2": {
      ensure(c, 36);
      c.y -= 14;
      const size = 13.5;
      c.page.drawText(b.text ?? "", { x: MARGIN_X, y: c.y, size, font: fonts.bold, color: INK });
      c.y -= 18;
      break;
    }
    case "h3": {
      ensure(c, 30);
      c.y -= 10;
      const size = 11.5;
      c.page.drawText(b.text ?? "", { x: MARGIN_X, y: c.y, size, font: fonts.bold, color: INK });
      c.y -= 16;
      break;
    }
    case "p": {
      const size = 10;
      const leading = 14.5;
      ensure(c, leading * 2 + 4);
      wrapDraw(c, inlineRuns(b.text ?? ""), { size, leading, x: MARGIN_X, maxW: contentW });
      c.y -= leading + 5;
      break;
    }
    case "bullet": {
      const size = 10;
      const leading = 14;
      const indent = 16;
      ensure(c, leading * 2 + 2);
      c.page.drawText("•", { x: MARGIN_X + 3, y: c.y, size: size + 1, font: fonts.regular, color: ACCENT });
      wrapDraw(c, inlineRuns(b.text ?? ""), { size, leading, x: MARGIN_X + indent, maxW: contentW - indent });
      c.y -= leading + 3;
      break;
    }
    case "number": {
      const size = 10;
      const leading = 14;
      const indent = 20;
      ensure(c, leading * 2 + 2);
      c.page.drawText(`${b.number ?? 1}.`, { x: MARGIN_X, y: c.y, size, font: fonts.bold, color: ACCENT });
      wrapDraw(c, inlineRuns(b.text ?? ""), { size, leading, x: MARGIN_X + indent, maxW: contentW - indent });
      c.y -= leading + 3;
      break;
    }
  }
}

// Code, quote, hr and table blocks - the non-text renderers.
function renderMiscBlock(c: Ctx, fonts: Fonts, b: Block, contentW: number): void {
  switch (b.kind) {
    case "code": {
      drawCodeBlock(c, b.lines ?? []);
      break;
    }
    case "quote": {
      const size = 10;
      const leading = 14;
      const indent = 14;
      ensure(c, leading * 2 + 4);
      const estLines = Math.max(1, Math.ceil(fonts.italic.widthOfTextAtSize(sanitize(b.text ?? ""), size) / (contentW - indent)));
      // bar spans from just above the first baseline to below the last one
      c.page.drawRectangle({ x: MARGIN_X, y: c.y - (estLines - 1) * leading - 10, width: 2.5, height: (estLines - 1) * leading + 14, color: LINE });
      wrapDraw(c, inlineRuns(b.text ?? ""), { size, leading, x: MARGIN_X + indent, maxW: contentW - indent, color: MUTED });
      c.y -= leading + 6;
      break;
    }
    case "hr": {
      ensure(c, 18);
      c.y -= 8;
      c.page.drawRectangle({ x: MARGIN_X, y: c.y, width: contentW, height: 0.75, color: LINE });
      c.y -= 10;
      break;
    }
    case "table": {
      ensure(c, 40);
      drawTable(c, b.cells ?? [], fonts);
      break;
    }
  }
}

// Footer on every page: workspace name left, page counter right.
function drawFooters(doc: PDFDocument, fonts: Fonts): PDFPage[] {
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText("Rah - coach workspace", { x: MARGIN_X, y: 34, size: 7.5, font: fonts.regular, color: MUTED });
    const label = `${i + 1} / ${pages.length}`;
    const w = fonts.regular.widthOfTextAtSize(label, 7.5);
    p.drawText(label, { x: PAGE_W - MARGIN_X - w, y: 34, size: 7.5, font: fonts.regular, color: MUTED });
  });
  return pages;
}

export async function markdownToPdf(md: string): Promise<PdfResult> {
  const { doc, fonts } = await createDoc(md);
  const c: Ctx = { doc, fonts, page: doc.addPage([PAGE_W, PAGE_H]), y: PAGE_H - MARGIN_TOP };
  const contentW = PAGE_W - MARGIN_X * 2;
  const st = { firstH1: true };
  for (const b of parseBlocks(md)) {
    if (b.kind === "code" || b.kind === "quote" || b.kind === "hr" || b.kind === "table") {
      renderMiscBlock(c, fonts, b, contentW);
    } else {
      renderTextBlock(c, fonts, b, contentW, st);
    }
  }
  const pages = drawFooters(doc, fonts);
  const bytes = await doc.save();
  return { bytes, pages: pages.length };
}
