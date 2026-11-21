// ---------- block parser ----------

import { sanitize } from "./pdf-fonts";

export interface Block {
  kind: "h1" | "h2" | "h3" | "p" | "bullet" | "number" | "code" | "quote" | "hr" | "table";
  text?: string;
  lines?: string[];
  cells?: string[][];
  number?: number;
}

// Mutable parser state: the open paragraph, the open fenced code block, the
// open list and the open table. The flush helpers close whichever construct
// is pending into the block list, exactly as the in-function closures did.
interface ParseState {
  blocks: Block[];
  para: string[];
  code: string[] | null;
  list: { kind: "bullet" | "number"; items: string[] } | null;
  table: string[][] | null;
}

function flushPara(st: ParseState): void {
  if (st.para.length) {
    st.blocks.push({ kind: "p", text: st.para.join(" ").trim() });
    st.para = [];
  }
}

function flushList(st: ParseState): void {
  if (st.list) {
    const items = st.list.items;
    const kind = st.list.kind;
    items.forEach((it, i) => st.blocks.push({ kind, text: it, number: kind === "number" ? i + 1 : undefined }));
    st.list = null;
  }
}

function flushTable(st: ParseState): void {
  if (st.table && st.table.length) {
    const rows = st.table.filter((r) => !r.every((cell) => /^:?-{2,}:?$/.test(cell.trim()) || cell.trim() === ""));
    if (rows.length) st.blocks.push({ kind: "table", cells: rows });
    st.table = null;
  }
}

// Consume one source line against the open constructs. Line-kind order is the
// grammar: fence > blank > table row > heading > hr > bullet > number > quote
// > paragraph text.
function consumeLine(st: ParseState, raw: string): void {
  const line = raw.trimEnd();
  if (st.code !== null) {
    if (line.trim().startsWith("```")) {
      st.blocks.push({ kind: "code", lines: st.code });
      st.code = null;
    } else st.code.push(raw);
    return;
  }
  const t = line.trim();
  if (t.startsWith("```")) {
    flushPara(st);
    flushList(st);
    flushTable(st);
    st.code = [];
    return;
  }
  if (!t) {
    flushPara(st);
    flushList(st);
    flushTable(st);
    return;
  }
  if (/^\|.*\|$/.test(t)) {
    flushPara(st);
    flushList(st);
    st.table = st.table ?? [];
    st.table.push(t.slice(1, -1).split("|").map((x) => x.trim()));
    return;
  }
  flushTable(st);
  const h = t.match(/^(#{1,3})\s+(.*)$/);
  if (h) {
    flushPara(st);
    flushList(st);
    st.blocks.push({ kind: h[1].length === 1 ? "h1" : h[1].length === 2 ? "h2" : "h3", text: h[2] });
    return;
  }
  if (/^(-{3,}|\*{3,})$/.test(t)) {
    flushPara(st);
    flushList(st);
    st.blocks.push({ kind: "hr" });
    return;
  }
  const b = t.match(/^[-*+]\s+(.*)$/);
  if (b) {
    flushPara(st);
    if (!st.list || st.list.kind !== "bullet") {
      flushList(st);
      st.list = { kind: "bullet", items: [] };
    }
    st.list.items.push(b[1]);
    return;
  }
  const n = t.match(/^(\d+)[.)]\s+(.*)$/);
  if (n) {
    flushPara(st);
    if (!st.list || st.list.kind !== "number") {
      flushList(st);
      st.list = { kind: "number", items: [] };
    }
    st.list.items.push(n[2]);
    return;
  }
  const q = t.match(/^>\s?(.*)$/);
  if (q) {
    flushPara(st);
    flushList(st);
    st.blocks.push({ kind: "quote", text: q[1] });
    return;
  }
  flushList(st);
  st.para.push(t);
}

export function parseBlocks(md: string): Block[] {
  const src = sanitize(md).split("\n");
  const st: ParseState = { blocks: [], para: [], code: null, list: null, table: null };
  for (const raw of src) consumeLine(st, raw);
  if (st.code !== null && st.code.length) st.blocks.push({ kind: "code", lines: st.code });
  flushPara(st);
  flushList(st);
  flushTable(st);
  return st.blocks;
}
