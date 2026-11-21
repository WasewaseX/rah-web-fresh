// Grammarly RE (Task 85): live pre-flight contract + register goal pins.
import { check, type Ctx } from "./harness";

// ================= Grammarly RE (Task 85): live pre-flight contract =================
export async function grammarlyPin(c: Ctx) {
  console.log("\n--- grammarly RE: live pre-flight + register goal ---");
  const api = c.api;
  {
    // The splice contract: every finding's offset/length must index the EXACT
    // text POSTed, so an editor can accept a replacement by slicing. Text has
    // LEADING WHITESPACE on purpose - the route must NOT trim before screening
    // (a trim shifted every offset and splices landed one space off).
    const raw = "  She dont like it. He go to school every day. Its fine with me, and the colour is nice.";
    const g = await api("/api/grammar-check", { method: "POST", body: JSON.stringify({ text: raw }) });
    check(g.status === 200, "grammar-check: screens raw untrimmed text", `status ${g.status}`);
    const errs: { offset: number; length: number; excerpt: string }[] = g.body?.errors ?? [];
    check(errs.length >= 2, "grammar-check: finds the seeded errors", `got ${errs.length}`);
    const all: { offset: number; length: number; excerpt: string; kind: string }[] = [
      ...(errs ?? []).map((f) => ({ ...f, kind: "error" })),
      ...((g.body?.style ?? []) as { offset: number; length: number; excerpt: string }[]).map((f) => ({ ...f, kind: "style" })),
    ];
    check(all.every((f) => Number.isFinite(f.offset) && Number.isFinite(f.length) && f.length > 0), "grammar-check: every finding carries numeric offset/length");
    check(
      all.every((f) => raw.slice(f.offset, f.offset + f.length) === f.excerpt),
      "grammar-check: splice contract text.slice(offset, offset+length) === excerpt (untrimmed offsets)",
      JSON.stringify(all.find((f) => raw.slice(f.offset, f.offset + f.length) !== f.excerpt)),
    );
    const dont = errs.find((f) => f.excerpt.toLowerCase().includes("dont"));
    check(!!dont && (dont as unknown as { replacements: string[] }).replacements.length > 0, "grammar-check: error findings carry replacements", JSON.stringify(dont));
    // Register goal: a pure prompt-input unit pin (no AI call in the battery).
    const { writingSystem, WRITING_GOALS } = await import("@/lib/ai");
    check(WRITING_GOALS.length === 3 && WRITING_GOALS.every((g2) => ["exam", "work", "casual"].includes(g2)), "writing goals: exactly exam/work/casual");
    const sysExam = writingSystem({ level: "B2" } as never, "exam");
    const sysCasual = writingSystem({ level: "B2" } as never, "casual");
    check(sysExam.includes("EXAM BOARD") && !sysCasual.includes("EXAM BOARD"), "writing goal exam reaches the grader prompt", "exam register line present only for exam");
    check(sysCasual.includes("CASUALLY") && sysExam !== sysCasual, "writing goal casual changes the prompt");
  }
}
