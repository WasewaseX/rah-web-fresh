// Unit battery for cross-device writing drafts (ROADMAP §3.3): the pure
// resolution seam (local vs server, last-write-wins on the save timestamp)
// plus the sanitize contract the server route and the client store share.
// Run: bun scripts/test-write-draft-sync.ts

import { resolveDrafts, loadWriteDraft, saveWriteDraft, clearWriteDraft, type WriteDraft } from "../src/lib/write-draft";

let pass = 0;
let fail = 0;
function check(cond: boolean, name: string, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}${detail ? " - " + detail : ""}`);
  }
}

const d = (text: string, at: number, goalSel = "exam"): WriteDraft => ({ text, goalSel, revisingId: null, at });

// 1. both sides empty -> nothing to restore
{
  const r = resolveDrafts(null, null);
  check(r.source === "none" && r.draft === null, "no drafts anywhere -> none");
}

// 2. one-sided cases: the existing side wins by existing
{
  const a = d("alpha draft", 100);
  check(resolveDrafts(a, null).source === "local" && resolveDrafts(a, null).draft?.text === "alpha draft", "local-only -> local wins");
  check(resolveDrafts(null, a).source === "remote" && resolveDrafts(null, a).draft?.text === "alpha draft", "remote-only -> remote wins");
}

// 3. conflict: strictly newer timestamp wins, on both sides
{
  const local = d("older local words", 100);
  const remote = d("newer remote words", 200);
  const r = resolveDrafts(local, remote);
  check(r.source === "remote" && r.draft?.text === "newer remote words", "newer remote beats older local", JSON.stringify(r));
  const r2 = resolveDrafts(d("newer local words", 300), d("older remote words", 200));
  check(r2.source === "local" && r2.draft?.text === "newer local words", "newer local beats older remote");
}

// 4. honesty guard: identical text is never claimed as a resolved conflict
{
  const local = d("same words both sides", 100);
  const remote = d("same words both sides", 500);
  const r = resolveDrafts(local, remote);
  check(r.source === "same", "identical text -> source 'same', no conflict claim", r.source);
  check(r.draft?.at === 500, "same-text keeps the newer metadata");
  // equal timestamps with different text: deterministic (local wins the tie)
  const tie = resolveDrafts(d("a", 100), d("b", 100));
  check(tie.source === "local" && tie.draft?.text === "a", "timestamp tie -> local, deterministic");
}

// 5. store contract still holds (injectable store, corrupt payload ignored)
{
  const mem = new Map<string, string>();
  const store = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
  check(saveWriteDraft(d("persisted", 42), store), "save into injectable store");
  check(loadWriteDraft(store)?.text === "persisted", "load round-trips");
  mem.set("rah-write-draft-v1", "{not json");
  check(loadWriteDraft(store) === null, "corrupt payload ignored, never thrown");
  check(saveWriteDraft(d("", 1), store) === true && loadWriteDraft(store) === null, "empty-text save clears the cache");
  check(clearWriteDraft(store) === true && mem.size === 0, "clear removes the key");
  check(loadWriteDraft(null) === null && saveWriteDraft(d("x", 1), undefined) === false, "null store never crashes");
}

// 6. sanitize contract mirrored by the server route: oversized text is the
// client's problem to avoid, but a hostile payload cannot smuggle types
{
  const hostile = JSON.parse(JSON.stringify({ text: 42, goalSel: 5, revisingId: "x", at: "soon" }));
  const mem = new Map<string, string>();
  const store = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
  mem.set("rah-write-draft-v1", JSON.stringify(hostile));
  check(loadWriteDraft(store) === null, "non-string text rejected by sanitize");
  mem.set("rah-write-draft-v1", JSON.stringify({ text: "ok", goalSel: "work", revisingId: 7, at: 123 }));
  const ok = loadWriteDraft(store);
  check(ok?.revisingId === 7 && ok?.goalSel === "work" && ok?.at === 123, "valid payload passes sanitize with fields intact");
  mem.set("rah-write-draft-v1", JSON.stringify({ text: "ok", revisingId: -5, at: "NaN" }));
  const clamped = loadWriteDraft(store);
  check(clamped?.revisingId === null && clamped?.at === 0, "negative revisingId / bogus at clamp to safe defaults");
}

console.log(`\nwrite-draft-sync battery: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
