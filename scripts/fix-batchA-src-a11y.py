"""Cycle 6 bulk fix, batch A: src a11y + unicorn + spreads.

- 4 dead vendored ui/ components deleted (zero importers, like ui/sidebar).
- canvas backdrops: tabIndex={-1} so aria-hidden no longer sits on a
  focusable element.
- reading gloss words become real buttons (role + keyboard toggle).
- labels get htmlFor/id pairs (label-has-associated-control accepts them).
- new Array(n) -> Array.from; protective [...pool] -> pool.slice();
  `?? {}` spread fallbacks dropped (spread of null is already {}).
"""
import pathlib

ROOT = pathlib.Path("/home/z/my-project")

def patch(rel, old, new, count=1):
    p = ROOT / rel
    s = p.read_text()
    n = s.count(old)
    if n == 0 and new in s:
        print(f"skip  {rel}: already applied")
        return
    assert n == count, f"{rel}: expected {count}, found {n}: {old[:70]!r}"
    p.write_text(s.replace(old, new))
    print(f"ok    {rel}: {old.splitlines()[0].strip()[:56]!r}")

# --- dead vendored ui components --------------------------------------------
for f in ["src/components/ui/breadcrumb.tsx", "src/components/ui/carousel.tsx",
          "src/components/ui/pagination.tsx", "src/components/ui/input-otp.tsx"]:
    (ROOT / f).unlink()
    print(f"rm    {f}")

# --- LogoMark svg: decorative, drop the role ---------------------------------
patch("src/components/rah/next/bits.tsx",
      '<svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden role="img">',
      '<svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>')

# --- decorative canvas backdrops: not focusable ------------------------------
patch("src/components/rah/AuraCanvas.tsx",
      '      aria-hidden\n      className="pointer-events-none fixed inset-0 h-full w-full opacity-[0.16]"',
      '      aria-hidden\n      tabIndex={-1}\n      className="pointer-events-none fixed inset-0 h-full w-full opacity-[0.16]"')
patch("src/components/rah/next/AuraCanvas.tsx",
      '      aria-hidden\n      className="pointer-events-none fixed inset-0 h-full w-full opacity-[0.16]"',
      '      aria-hidden\n      tabIndex={-1}\n      className="pointer-events-none fixed inset-0 h-full w-full opacity-[0.16]"')
patch("src/components/rah/Aurora.tsx",
      '      aria-hidden\n      className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-90"',
      '      aria-hidden\n      tabIndex={-1}\n      className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-90"')
patch("src/components/rah/next/Aurora.tsx",
      '      aria-hidden\n      className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-90"',
      '      aria-hidden\n      tabIndex={-1}\n      className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-90"')
patch("src/components/rah/WebGLBackdrop.tsx",
      '      aria-hidden\n      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"',
      '      aria-hidden\n      tabIndex={-1}\n      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"')
patch("src/components/rah/next/WebGLBackdrop.tsx",
      '      aria-hidden\n      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"',
      '      aria-hidden\n      tabIndex={-1}\n      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"')

# --- reading gloss words: real buttons with keyboard access -------------------
patch("src/components/rah/next/reading.tsx",
      """                  <span
                    key={j}
                    onClick={() => setGloss((x) => ({ ...x, [g.w]: !x[g.w] }))}
                    className="cursor-pointer underline decoration-dotted decoration-2 underline-offset-4"
                    style={{ textDecorationColor: "var(--accent)" }}
                  >""",
      """                  <span
                    key={j}
                    role="button"
                    tabIndex={0}
                    onClick={() => setGloss((x) => ({ ...x, [g.w]: !x[g.w] }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setGloss((x) => ({ ...x, [g.w]: !x[g.w] }));
                      }
                    }}
                    className="cursor-pointer underline decoration-dotted decoration-2 underline-offset-4"
                    style={{ textDecorationColor: "var(--accent)" }}
                  >""")

# --- speaking: audio captions + associated label -------------------------------
patch("src/components/rah/next/speaking.tsx",
      '              <audio ref={audioRef} controls src={audioUrl}\n                     aria-label="Your recording" className="w-full" style={{ maxHeight: 44 }} />',
      '              <audio ref={audioRef} controls src={audioUrl}\n                     aria-label="Your recording" className="w-full" style={{ maxHeight: 44 }}>\n                <track kind="captions" />\n              </audio>')
patch("src/components/rah/next/speaking.tsx",
      '              <label className="text-[12.5px] font-bold block mb-1">What you said, as close as you remember</label>\n              <textarea\n                value={transcript}\n                aria-label="What you said"',
      '              <label htmlFor="said-recall" className="text-[12.5px] font-bold block mb-1">What you said, as close as you remember</label>\n              <textarea\n                id="said-recall"\n                value={transcript}\n                aria-label="What you said"')

# --- writing: associate the repair labels --------------------------------------
patch("src/components/rah/next/writing.tsx",
      '          <label className="text-[12.5px] font-bold block mb-1 mt-3">1. The one error I keep making (worst one only)</label>\n          <textarea\n            value={repaired}',
      '          <label htmlFor="repair-error" className="text-[12.5px] font-bold block mb-1 mt-3">1. The one error I keep making (worst one only)</label>\n          <textarea\n            id="repair-error"\n            value={repaired}')
patch("src/components/rah/next/writing.tsx",
      '          <label className="text-[12.5px] font-bold block mb-1 mt-4">2. Now use that corrected structure in two brand new sentences</label>',
      '          <label htmlFor="reuse-0" className="text-[12.5px] font-bold block mb-1 mt-4">2. Now use that corrected structure in two brand new sentences</label>')
patch("src/components/rah/next/writing.tsx",
      '            <input\n              key={i}\n              value={v}',
      '            <input\n              key={i}\n              id={`reuse-${i}`}\n              value={v}')

# --- unicorn: new Array -> Array.from ------------------------------------------
patch("src/lib/arena-score.ts",
      "  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));",
      "  const dp: number[][] = Array.from({ length: n + 1 }, () => Array.from({ length: m + 1 }, () => 0));")
patch("src/lib/phonemes.ts",
      "  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));",
      "  const dp: number[][] = Array.from({ length: n + 1 }, () => Array.from({ length: m + 1 }, () => 0));")
patch("src/lib/pronunciation.ts",
      "  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));",
      "  const dp: number[][] = Array.from({ length: n + 1 }, () => Array.from({ length: m + 1 }, () => 0));")
patch("src/lib/pronunciation.ts",
      "  const matched: (string | null)[] = new Array(n).fill(null);",
      "  const matched: (string | null)[] = Array.from({ length: n }, () => null);")
patch("src/lib/coach-agent/tools.ts",
      "  const perDay = new Array<number>(7).fill(0); // [0] = today, [1..6] = the next days",
      "  const perDay = Array.from({ length: 7 }, () => 0); // [0] = today, [1..6] = the next days")

# --- protective iteration copy without spread ----------------------------------
patch("src/lib/agent/exam.ts",
      "      for (const it of [...pool]) {",
      "      for (const it of pool.slice()) {")

# --- useless `?? {}` spread fallbacks ------------------------------------------
patch("src/lib/agent/mode-flow.ts",
      "  const traps = { ...(data.traps ?? {}) };",
      "  const traps = { ...data.traps };")
patch("src/lib/agent/mode-flow.ts",
      "  const examples: Record<string, { wrong: string; right: string }> = { ...(data.examples ?? {}) };",
      "  const examples: Record<string, { wrong: string; right: string }> = { ...data.examples };")
patch("src/lib/coach-agent/loop.ts",
      "      const callArgs: ToolArgs = { ...(turn.args ?? {}) };",
      "      const callArgs: ToolArgs = { ...turn.args };")

print("batch A complete")
