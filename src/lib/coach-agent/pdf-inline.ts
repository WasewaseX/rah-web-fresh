// ---------- inline markdown -> styled runs ----------

import { sanitize } from "./pdf-fonts";

export interface Run {
  text: string;
  style: "regular" | "bold" | "italic" | "mono";
}

export function inlineRuns(md: string): Run[] {
  const s = sanitize(md);
  const runs: Run[] = [];
  let i = 0;
  let plain = "";
  const flush = () => {
    if (plain) {
      runs.push({ text: plain, style: "regular" });
      plain = "";
    }
  };
  while (i < s.length) {
    if (s.startsWith("**", i)) {
      const end = s.indexOf("**", i + 2);
      if (end > i + 1) {
        flush();
        runs.push({ text: s.slice(i + 2, end), style: "bold" });
        i = end + 2;
        continue;
      }
    }
    if (s[i] === "`") {
      const end = s.indexOf("`", i + 1);
      if (end > i) {
        flush();
        runs.push({ text: s.slice(i + 1, end), style: "mono" });
        i = end + 1;
        continue;
      }
    }
    if ((s[i] === "*" || s[i] === "_") && i + 1 < s.length && !/\s/.test(s[i + 1])) {
      const mark = s[i];
      const end = s.indexOf(mark, i + 1);
      if (end > i + 1) {
        flush();
        runs.push({ text: s.slice(i + 1, end), style: "italic" });
        i = end + 1;
        continue;
      }
    }
    plain += s[i];
    i += 1;
  }
  flush();
  return runs.length ? runs : [{ text: "", style: "regular" }];
}
